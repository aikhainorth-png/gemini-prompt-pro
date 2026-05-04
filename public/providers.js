import { getProviderConfig } from './provider-config.js';
import { buildPromptBundleSchema } from './openai-schema.js';

function getOpenAIKey(){ return localStorage.getItem('userOpenAIApiKey') || ''; }
function getGeminiKey(){ return localStorage.getItem('userGeminiApiKey') || ''; }

const OPENAI_SCENE_LOCK_PROMPT = `
OPENAI SCENE OUTPUT LOCK — REQUIRED:
You MUST return valid JSON only with exactly these keys:
{
  "image_prompt": "...",
  "video_prompt": "...",
  "caption_hashtags": "..."
}

VIDEO PROMPT FORMAT — STRICT:
- video_prompt MUST always contain scene headers.
- Always start video_prompt with exactly:
SCENE_1_VIDEO_PROMPT:
- If the user requested more than 1 scene, continue:
SCENE_2_VIDEO_PROMPT:
SCENE_3_VIDEO_PROMPT:
...until every requested scene is included.
- NEVER return video_prompt as one paragraph without SCENE headers.
- NEVER leave SCENE_1_VIDEO_PROMPT: empty.
- Every SCENE_*_VIDEO_PROMPT block must include:
  1) visual action and product interaction,
  2) camera movement,
  3) Thai spoken dialogue / voiceover,
  4) continuity details,
  5) CTA or payoff when appropriate.

IMAGE PROMPT FORMAT:
- If multiple scenes are requested, image_prompt should also use:
SCENE_1_IMAGE_PROMPT:
SCENE_2_IMAGE_PROMPT:
...until every requested scene is included.
- Do not skip scene labels when multi-scene is requested.

Return final prompts only. No markdown. No explanation.
`;

function normalizeRawText(text = ''){
  return String(text || '')
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function pickFirst(...values){
  for(const v of values){
    const s = String(v || '').trim();
    if(s) return s;
  }
  return '';
}

function escapeRegExp(text = ''){
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findBalancedJsonObject(text = ''){
  const src = String(text || '');
  const start = src.indexOf('{');
  if(start < 0) return '';
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  for(let i = start; i < src.length; i++){
    const ch = src[i];
    if(inString){
      if(escaped){ escaped = false; continue; }
      if(ch === '\\'){ escaped = true; continue; }
      if(ch === quote){ inString = false; quote = ''; }
      continue;
    }
    if(ch === '"' || ch === "'"){
      inString = true;
      quote = ch;
      continue;
    }
    if(ch === '{') depth++;
    if(ch === '}'){
      depth--;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return '';
}

function normalizeParsedObject(parsed = {}){
  return {
    image_prompt: pickFirst(parsed.image_prompt, parsed.imagePrompt, parsed.image, parsed.imagePromptText, parsed.final_image_prompt),
    video_prompt: pickFirst(parsed.video_prompt, parsed.videoPrompt, parsed.vdo_prompt, parsed.vdoPrompt, parsed.video, parsed.videoPromptText, parsed.final_video_prompt),
    caption_hashtags: pickFirst(parsed.caption_hashtags, parsed.captionHashtags, parsed.caption, parsed.hashtags, parsed.caption_and_hashtags)
  };
}

function tryParseJson(text = ''){
  const cleaned = normalizeRawText(text);
  if(!cleaned) return null;

  try{ return normalizeParsedObject(JSON.parse(cleaned)); }catch{}

  const balanced = findBalancedJsonObject(cleaned);
  if(balanced){
    try{ return normalizeParsedObject(JSON.parse(balanced)); }catch{}
  }

  const m = cleaned.match(/\{[\s\S]*\}/);
  if(m){
    try{ return normalizeParsedObject(JSON.parse(m[0])); }catch{}
  }

  return null;
}

function extractJsonStringFieldLoose(text = '', key = ''){
  const src = normalizeRawText(text);
  const re = new RegExp('"' + escapeRegExp(key) + '"\\s*:\\s*"', 'i');
  const m = re.exec(src);
  if(!m) return '';
  let i = m.index + m[0].length;
  let out = '';
  let escaped = false;
  for(; i < src.length; i++){
    const ch = src[i];
    if(escaped){ out += ch; escaped = false; continue; }
    if(ch === '\\'){ escaped = true; continue; }
    if(ch === '"'){
      const tail = src.slice(i + 1, i + 100);
      if(/^\s*(?:,\s*"[A-Za-z_][\w]*"\s*:|}|$)/.test(tail)) break;
    }
    out += ch;
  }
  return out
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .trim();
}

function recoverPartialJsonObject(text = ''){
  const image = extractJsonStringFieldLoose(text, 'image_prompt') || extractJsonStringFieldLoose(text, 'imagePrompt');
  const video = extractJsonStringFieldLoose(text, 'video_prompt') || extractJsonStringFieldLoose(text, 'videoPrompt') || extractJsonStringFieldLoose(text, 'vdo_prompt');
  const caption = extractJsonStringFieldLoose(text, 'caption_hashtags') || extractJsonStringFieldLoose(text, 'captionHashtags') || extractJsonStringFieldLoose(text, 'caption');
  if(!image && !video && !caption) return null;
  return normalizeParsedObject({ image_prompt: image, video_prompt: video, caption_hashtags: caption });
}

function getSectionByLabel(text = '', startLabels = [], stopLabels = []){
  const src = String(text || '');
  const startPattern = startLabels.map(escapeRegExp).join('|');
  const stopPattern = stopLabels.map(escapeRegExp).join('|');
  const re = new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?(?:\\*\\*)?\\[?(?:${startPattern})\\]?(?:\\*\\*)?\\s*[:：-]?\\s*\\n?([\\s\\S]*?)(?=\\n\\s*(?:#{1,4}\\s*)?(?:\\*\\*)?\\[?(?:${stopPattern})\\]?(?:\\*\\*)?\\s*[:：-]?|$)`, 'i');
  const m = src.match(re);
  return m ? m[1].trim() : '';
}

function extractScenePromptGroup(text = '', group = 'IMAGE'){
  const src = normalizeRawText(text);
  const headerRe = /(?:^|\n)\s*SCENE[_\s]*(\d+)[_\s]*(IMAGE|VIDEO|VDO)(?:[_\s]*(?:\+\s*AUDIO|AUDIO))?[_\s]*PROMPT\s*:/gim;
  const matches = [...src.matchAll(headerRe)];
  if(!matches.length) return '';
  const target = group.toUpperCase();
  const blocks = [];
  for(let i = 0; i < matches.length; i++){
    const m = matches[i];
    const sceneNo = Number(m[1] || i + 1);
    const kind = String(m[2] || '').toUpperCase();
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
    const isImage = target === 'IMAGE' && kind === 'IMAGE';
    const isVideo = target === 'VIDEO' && (kind === 'VIDEO' || kind === 'VDO');
    if(isImage || isVideo){
      blocks.push(src.slice(start, end).trim());
    }
  }
  return blocks.join('\n\n').trim();
}

function parseStructuredText(text, providerLabel){
  if(!text) throw new Error(`${providerLabel} ไม่ได้ส่งข้อความกลับมา`);

  const raw = normalizeRawText(text);
  let parsed = tryParseJson(raw) || recoverPartialJsonObject(raw);

  if(!parsed){
    const image = getSectionByLabel(raw, ['IMAGE PROMPT', 'IMAGE_PROMPT', 'image_prompt'], ['VIDEO PROMPT', 'VIDEO + AUDIO PROMPT', 'VIDEO_PROMPT', 'video_prompt', 'CAPTION', 'CAPTION HASHTAGS']);
    const video = getSectionByLabel(raw, ['VIDEO PROMPT', 'VIDEO + AUDIO PROMPT', 'VIDEO_PROMPT', 'video_prompt'], ['CAPTION', 'CAPTION HASHTAGS', 'caption_hashtags']);
    const caption = getSectionByLabel(raw, ['CAPTION', 'CAPTION HASHTAGS', 'caption_hashtags'], []);
    parsed = normalizeParsedObject({
      image_prompt: image || extractScenePromptGroup(raw, 'IMAGE'),
      video_prompt: video || extractScenePromptGroup(raw, 'VIDEO'),
      caption_hashtags: caption
    });
  }

  if(!parsed || (!parsed.image_prompt && !parsed.video_prompt && !parsed.caption_hashtags)){
    const sample = raw.slice(0, 260);
    throw new Error(`ไม่สามารถแปลงผลลัพธ์ ${providerLabel} เป็น Final Prompt ได้ • ตัวอย่างคำตอบ: ${sample}`);
  }

  return {
    image_prompt: String(parsed.image_prompt || '').trim(),
    video_prompt: ensureVideoScenePrompt(String(parsed.video_prompt || '').trim()),
    caption_hashtags: String(parsed.caption_hashtags || '').trim()
  };
}

function isHeaderOnlyScenePrompt(text = ''){
  const src = normalizeRawText(text);
  return /^SCENE[_\s]*1[_\s]*(?:VIDEO|VDO)(?:[_\s]*(?:\+\s*AUDIO|AUDIO))?[_\s]*PROMPT\s*:\s*$/i.test(src);
}

function hasSceneVideoHeader(text = ''){
  return /(?:^|\n)\s*SCENE[_\s]*1[_\s]*(?:VIDEO|VDO)(?:[_\s]*(?:\+\s*AUDIO|AUDIO))?[_\s]*PROMPT\s*:/i.test(text || '');
}

function ensureVideoScenePrompt(video = ''){
  const src = normalizeRawText(video);
  if(!src) return '';
  if(isHeaderOnlyScenePrompt(src)) return src; // surface true empty output instead of hiding it
  if(hasSceneVideoHeader(src)) return src;
  return `SCENE_1_VIDEO_PROMPT:\n${src}`;
}

export async function callGemini({ systemPrompt, userPrompt }){
  const cfg = getProviderConfig('gemini');
  const apiKey = getGeminiKey();
  if(!apiKey) throw new Error('ยังไม่มี Gemini API Key');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          image_prompt: { type: 'STRING' },
          video_prompt: { type: 'STRING' },
          caption_hashtags: { type: 'STRING' }
        },
        required: ['image_prompt','video_prompt','caption_hashtags'],
        propertyOrdering: ['image_prompt','video_prompt','caption_hashtags']
      }
    }
  };
  const res = await fetch(endpoint, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  const raw = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(raw?.error?.message || `Gemini API Error ${res.status}`);
  const text = raw?.candidates?.[0]?.content?.parts?.map(p=>p.text || '').join('').trim();
  return parseStructuredText(text, 'Gemini');
}

export async function callOpenAI({ systemPrompt, userPrompt }){
  const cfg = getProviderConfig('openai');
  const apiKey = getOpenAIKey();
  if(!apiKey) throw new Error('ยังไม่มี OpenAI API Key');

  const lockedSystemPrompt = `${systemPrompt}\n\n${OPENAI_SCENE_LOCK_PROMPT}`;
  const lockedUserPrompt = `${userPrompt}\n\nREMINDER FOR OPENAI: video_prompt must start with SCENE_1_VIDEO_PROMPT: and every scene header must contain a full non-empty prompt.`;

  const payload = {
    model: cfg.model,
    input: [
      { role: 'system', content: lockedSystemPrompt },
      { role: 'user', content: lockedUserPrompt }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'prompt_bundle',
        strict: true,
        schema: buildPromptBundleSchema()
      }
    },
    max_output_tokens: 6000,
    store: false
  };
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  const raw = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(raw?.error?.message || `OpenAI API Error ${res.status}`);

  const text = raw?.output_text
    || raw?.output?.flatMap(item => item?.content || []).map(part => part?.text || '').join('').trim();

  const parsed = parseStructuredText(text, 'OpenAI');

  if(!parsed.video_prompt || isHeaderOnlyScenePrompt(parsed.video_prompt)){
    const sample = String(text || '').slice(0, 300);
    throw new Error(`OpenAI ส่ง VIDEO PROMPT ไม่ครบหรือมีแต่หัวข้อ SCENE_1_VIDEO_PROMPT • กรุณากดสร้างใหม่ หรือเพิ่ม max_output_tokens • ตัวอย่างคำตอบ: ${sample}`);
  }

  return parsed;
}

export async function callAI(providerId, args){
  if(providerId === 'openai') return callOpenAI(args);
  return callGemini(args);
}
