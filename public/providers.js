import { getProviderConfig } from './provider-config.js';
import { buildPromptBundleSchema } from './openai-schema.js';

function getOpenAIKey(){ return localStorage.getItem('userOpenAIApiKey') || ''; }
function getGeminiKey(){ return localStorage.getItem('userGeminiApiKey') || ''; }

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
      // stop at closing quote only if followed by comma/end/next key/object close
      const tail = src.slice(i + 1, i + 80);
      if(/^\s*(?:,\s*"[A-Za-z_][\w]*"\s*:|}|$)/.test(tail)) break;
    }
    out += ch;
  }
  return out.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
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
  const blocks = [];
  for(let i = 0; i < matches.length; i++){
    const m = matches[i];
    const kind = String(m[2] || '').toUpperCase();
    const isWanted = group === 'IMAGE' ? kind === 'IMAGE' : (kind === 'VIDEO' || kind === 'VDO');
    if(!isWanted) continue;
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
    const block = src.slice(start, end).trim();
    if(block) blocks.push(block);
  }
  return blocks.join('\n\n').trim();
}

function parseLoosePromptText(text = ''){
  const src = normalizeRawText(text);
  const imageFromScene = extractScenePromptGroup(src, 'IMAGE');
  const videoFromScene = extractScenePromptGroup(src, 'VIDEO');

  const imageByLabel = getSectionByLabel(src,
    ['image_prompt','image prompt','final image prompt','IMAGE PROMPT','ภาพ prompt','พรอมต์ภาพ'],
    ['video_prompt','video prompt','vdo prompt','VIDEO PROMPT','VDO PROMPT','caption_hashtags','caption hashtags','caption','hashtags','CAPTION']
  );
  const videoByLabel = getSectionByLabel(src,
    ['video_prompt','video prompt','vdo prompt','final video prompt','VIDEO PROMPT','VDO PROMPT','วิดีโอ prompt','พรอมต์วิดีโอ'],
    ['caption_hashtags','caption hashtags','caption','hashtags','CAPTION','image_prompt','image prompt','IMAGE PROMPT']
  );
  const captionByLabel = getSectionByLabel(src,
    ['caption_hashtags','caption hashtags','caption and hashtags','caption','hashtags','CAPTION'],
    ['image_prompt','image prompt','video_prompt','video prompt','vdo prompt','IMAGE PROMPT','VIDEO PROMPT','VDO PROMPT']
  );

  return {
    image_prompt: pickFirst(imageFromScene, imageByLabel),
    video_prompt: pickFirst(videoFromScene, videoByLabel),
    caption_hashtags: captionByLabel
  };
}

function parseStructuredText(text, providerLabel, rawDebug){
  const src = normalizeRawText(text);
  if(!src){
    const finishReason = rawDebug?.candidates?.[0]?.finishReason;
    const blockReason = rawDebug?.promptFeedback?.blockReason;
    const reason = finishReason || blockReason;
    throw new Error(`${providerLabel} ไม่ได้ส่งข้อความกลับมา${reason ? ` (${reason})` : ''}`);
  }

  const jsonResult = tryParseJson(src);
  const looseResult = jsonResult || recoverPartialJsonObject(src) || parseLoosePromptText(src);
  const result = normalizeParsedObject(looseResult);

  if(!result.image_prompt && !result.video_prompt){
    const snippet = src.slice(0, 260).replace(/\s+/g, ' ').trim();
    throw new Error(`ไม่สามารถแปลงผลลัพธ์ ${providerLabel} เป็น Final Prompt ได้ • ตัวอย่างคำตอบ: ${snippet}`);
  }

  if(!result.video_prompt && result.image_prompt){
    result.video_prompt = `VIDEO + AUDIO PROMPT:\nใช้ IMAGE PROMPT ด้านบนเป็น key visual ของ TikTok Live และสร้างคลิปไลฟ์สดแนวตั้ง 9:16: โฮสต์ไทยพูดสดกับกล้อง โชว์สินค้า ตอบคอมเมนต์ภาษาไทย หัวใจและ Gift เด้ง มี CTA ให้กดตะกร้า พร้อมบทพูดไทยธรรมชาติ`;
  }
  if(!result.image_prompt && result.video_prompt){
    result.image_prompt = `IMAGE PROMPT:\nUltra realistic TikTok Live smartphone screenshot, vertical 9:16, Thai live host presenting the product clearly, real TikTok Live UI, Thai comments, floating hearts, gift notification, cart CTA, photorealistic, no 3D, no cartoon.`;
  }
  if(!result.caption_hashtags){
    result.caption_hashtags = 'โปรเฉพาะไลฟ์ กดตะกร้าเลย #TikTokShop #โปรไลฟ์ #ของดีบอกต่อ #ช้อปออนไลน์ #ลดราคา';
  }
  return result;
}

function extractGeminiText(raw = {}){
  const parts = raw?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p?.text || '').filter(Boolean).join('').trim();
}

function buildGeminiJsonContract(userPrompt = ''){
  return `${userPrompt}\n\nSTRICT JSON OUTPUT CONTRACT FOR GEMINI:\nReturn ONLY one valid JSON object. No markdown. No code fence. No explanation.\nRequired keys exactly:\n{\n  "image_prompt": "final image prompt text",\n  "video_prompt": "final video/audio prompt text",\n  "caption_hashtags": "one Thai caption line plus exactly 5 hashtags"\n}\nIf multiple scenes are requested, keep SCENE_1_IMAGE_PROMPT / SCENE_1_VIDEO_PROMPT headers inside the string values only.`;
}

export async function callGemini({ systemPrompt, userPrompt }){
  const cfg = getProviderConfig('gemini');
  const apiKey = getGeminiKey();
  if(!apiKey) throw new Error('ยังไม่มี Gemini API Key');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: buildGeminiJsonContract(userPrompt) }] }],
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 8192,
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
  const text = extractGeminiText(raw);
  return parseStructuredText(text, 'Gemini', raw);
}

export async function callOpenAI({ systemPrompt, userPrompt }){
  const cfg = getProviderConfig('openai');
  const apiKey = getOpenAIKey();
  if(!apiKey) throw new Error('ยังไม่มี OpenAI API Key');
  const strictUserPrompt = `${userPrompt}\n\nSTRICT JSON OUTPUT CONTRACT FOR OPENAI:\nReturn ONLY one valid JSON object. No markdown. No explanation. Required keys exactly: image_prompt, video_prompt, caption_hashtags. Keep each value complete. For TikTok Live prompts, be detailed but do not exceed output budget.`;
  const payload = {
    model: cfg.model,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: strictUserPrompt }
    ],
    max_output_tokens: 8192,
    text: {
      format: {
        type: 'json_schema',
        name: 'prompt_bundle',
        strict: true,
        schema: buildPromptBundleSchema()
      }
    },
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
  const text = raw?.output_text || raw?.output?.flatMap(item => item?.content || []).map(part => part?.text || '').join('').trim();
  return parseStructuredText(text, 'OpenAI', raw);
}

export async function callAI(providerId, args){
  if(providerId === 'openai') return callOpenAI(args);
  return callGemini(args);
}
