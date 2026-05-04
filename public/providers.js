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
      const tail = src.slice(i + 1, i + 90);
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

function inferNumberFromPrompt(prompt = '', label = 'Scene count', fallback = 1){
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*(\\d+)', 'i');
  const m = String(prompt || '').match(re);
  const n = Number(m?.[1] || fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildTimeRange(sceneNo = 1, sceneCount = 1, duration = 10){
  const count = Math.max(1, Number(sceneCount || 1));
  const total = Math.max(1, Number(duration || 10));
  const start = ((sceneNo - 1) * total / count);
  const end = (sceneNo * total / count);
  const fmt = (v) => Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/,'');
  return `[${fmt(start)}-${fmt(end)}s]`;
}

function hasNonEmptySceneBlock(text = '', sceneNo = 1, kind = 'VIDEO'){
  const src = normalizeRawText(text);
  const re = kind === 'IMAGE'
    ? new RegExp(`(?:^|\\n)\\s*SCENE[_\\s]*${sceneNo}[_\\s]*IMAGE[_\\s]*PROMPT\\s*:\\s*`, 'i')
    : new RegExp(`(?:^|\\n)\\s*SCENE[_\\s]*${sceneNo}[_\\s]*(?:VIDEO|VDO)(?:[_\\s]*(?:\\+\\s*AUDIO|AUDIO))?[_\\s]*PROMPT\\s*:\\s*`, 'i');
  const m = re.exec(src);
  if(!m) return false;
  const start = m.index + m[0].length;
  const next = src.slice(start).search(/(?:^|\n)\s*SCENE[_\s]*\d+[_\s]*(?:IMAGE|VIDEO|VDO)/i);
  const body = next >= 0 ? src.slice(start, start + next) : src.slice(start);
  return body.trim().length > 30;
}

function ensureSceneVideoFormat(videoPrompt = '', sceneCount = 1, duration = 10){
  const count = Math.max(1, Number(sceneCount || 1));
  const src = normalizeRawText(videoPrompt);
  const fallbackBody = src.replace(/(?:^|\n)\s*SCENE[_\s]*\d+[_\s]*(?:VIDEO|VDO)(?:[_\s]*(?:\+\s*AUDIO|AUDIO))?[_\s]*PROMPT\s*:\s*/gim, '').trim();

  if(count === 1){
    if(hasNonEmptySceneBlock(src, 1, 'VIDEO')) return src;
    const body = fallbackBody || 'Complete one-scene vertical 9:16 photorealistic live-action video. Product appears immediately, visible demonstration, Thai spoken line, clear basket CTA.';
    return `SCENE_1_VIDEO_PROMPT:\n${buildTimeRange(1, count, duration)}\nVISUAL:\n${body}\nDIALOGUE_TH:\n"พูดภาษาไทยให้ตรงกับสินค้าและโทนขายแบบเป็นธรรมชาติ จบด้วยชวนกดตะกร้า"\nLIP_SYNC:\nNatural Thai lip-sync, clear mouth movement, dialogue fits ${buildTimeRange(1, count, duration)}.`;
  }

  const blocks = [];
  for(let i = 1; i <= count; i++){
    if(hasNonEmptySceneBlock(src, i, 'VIDEO')){
      const headerRe = new RegExp(`(?:^|\\n)\\s*SCENE[_\\s]*${i}[_\\s]*(?:VIDEO|VDO)(?:[_\\s]*(?:\\+\\s*AUDIO|AUDIO))?[_\\s]*PROMPT\\s*:\\s*`, 'i');
      const m = headerRe.exec(src);
      const start = m.index + m[0].length;
      const next = src.slice(start).search(/(?:^|\n)\s*SCENE[_\s]*\d+[_\s]*(?:VIDEO|VDO|IMAGE)/i);
      const body = (next >= 0 ? src.slice(start, start + next) : src.slice(start)).trim();
      const hasTime = /^\s*\[\d+(?:\.\d+)?-\d+(?:\.\d+)?s\]/m.test(body);
      const hasDialogue = /DIALOGUE_TH\s*:|VOICEOVER\s*:|เสียงพูด|บทพูด/i.test(body);
      const hasLip = /LIP_SYNC\s*:|lip\s*sync/i.test(body);
      blocks.push(`SCENE_${i}_VIDEO_PROMPT:\n${hasTime ? '' : buildTimeRange(i, count, duration) + '\n'}${body}${hasDialogue ? '' : `\nDIALOGUE_TH:\n"พูดภาษาไทยให้ตรงกับสินค้า โทนขายธรรมชาติ และจบซีนให้ครบ"`}${hasLip ? '' : `\nLIP_SYNC:\nNatural Thai lip-sync, dialogue timing fits ${buildTimeRange(i, count, duration)}.`}`);
    }else{
      blocks.push(`SCENE_${i}_VIDEO_PROMPT:\n${buildTimeRange(i, count, duration)}\nVISUAL:\n${fallbackBody || `Scene ${i} of ${count}: photorealistic live-action TikTok product video, product visible, natural Thai presenter action, vertical 9:16.`}\nDIALOGUE_TH:\n"${i === count ? 'รีบกดตะกร้าไว้เลยค่ะ โปรนี้พลาดแล้วเสียดายแน่นอน' : 'เดี๋ยวดูของจริงให้ชัด ๆ นะคะ ตัวนี้น่าใช้มาก'}"\nLIP_SYNC:\nNatural Thai lip-sync, clear mouth movement, dialogue fits ${buildTimeRange(i, count, duration)}.`);
    }
  }
  return blocks.join('\n\n');
}

function ensureSceneImageFormat(imagePrompt = '', sceneCount = 1){
  const count = Math.max(1, Number(sceneCount || 1));
  const src = normalizeRawText(imagePrompt);
  if(count <= 1){
    if(hasNonEmptySceneBlock(src, 1, 'IMAGE')) return src;
    return src;
  }
  if(Array.from({length:count}, (_,idx)=>hasNonEmptySceneBlock(src, idx+1, 'IMAGE')).every(Boolean)) return src;
  return src; // keep existing stable image engine intact; app.js handles overlay safely.
}

function buildOpenAISceneContract(userPrompt = ''){
  const count = inferNumberFromPrompt(userPrompt, 'Scene count', 1);
  const duration = inferNumberFromPrompt(userPrompt, 'Total duration', 10);
  const sceneLines = Array.from({length:count}, (_,idx)=>{
    const no = idx + 1;
    return `SCENE_${no}_VIDEO_PROMPT:\n${buildTimeRange(no, count, duration)}\nVISUAL:\n[detailed visible action, product interaction, camera movement]\nDIALOGUE_TH:\n"[exact Thai spoken line for this scene]"\nLIP_SYNC:\n[natural Thai lip-sync timing for ${buildTimeRange(no, count, duration)}]`;
  }).join('\n\n');
  return `\n\nOPENAI SCENE 100% LOCK + SCENE TIME + LIP SYNC PRO:\n- Return ONLY valid JSON matching the schema.\n- video_prompt MUST contain exactly ${count} scene block(s).\n- If scene count is 1, still use SCENE_1_VIDEO_PROMPT and complete the full clip in that single scene.\n- If scene count is ${count}, do not create more or fewer than ${count} scenes.\n- Do not merge scenes into a paragraph.\n- Do not leave any scene header empty.\n- Every scene must include time range, VISUAL, DIALOGUE_TH, and LIP_SYNC.\n- Use this exact video_prompt structure:\n${sceneLines}\n\nimage_prompt should follow the requested image scene format. caption_hashtags must be one caption line plus exactly 5 hashtags.`;
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
  const partialJson = jsonResult ? null : recoverPartialJsonObject(src);
  const looseResult = jsonResult || partialJson || parseLoosePromptText(src);
  const result = normalizeParsedObject(looseResult);

  if(!result.image_prompt && !result.video_prompt){
    const snippet = src.slice(0, 260).replace(/\s+/g, ' ').trim();
    throw new Error(`ไม่สามารถแปลงผลลัพธ์ ${providerLabel} เป็น Final Prompt ได้ • ตัวอย่างคำตอบ: ${snippet}`);
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
  const sceneCount = inferNumberFromPrompt(userPrompt, 'Scene count', 1);
  const totalDuration = inferNumberFromPrompt(userPrompt, 'Total duration', 10);
  const sceneContract = buildOpenAISceneContract(userPrompt);
  const payload = {
    model: cfg.model,
    input: [
      { role: 'system', content: `${systemPrompt}${sceneContract}` },
      { role: 'user', content: `${userPrompt}${sceneContract}` }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'prompt_bundle',
        strict: true,
        schema: buildPromptBundleSchema()
      }
    },
    store: false,
    max_output_tokens: 6000
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
  const result = parseStructuredText(text, 'OpenAI', raw);
  result.image_prompt = ensureSceneImageFormat(result.image_prompt || '', sceneCount);
  result.video_prompt = ensureSceneVideoFormat(result.video_prompt || '', sceneCount, totalDuration);
  return result;
}

export async function callAI(providerId, args){
  if(providerId === 'openai') return callOpenAI(args);
  return callGemini(args);
}
