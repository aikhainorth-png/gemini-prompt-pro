import { getProviderConfig } from './provider-config.js';
import { buildPromptBundleSchema } from './openai-schema.js';

function getOpenAIKey(){ return localStorage.getItem('userOpenAIApiKey') || ''; }
function getGeminiKey(){ return localStorage.getItem('userGeminiApiKey') || ''; }

function completeJsonCandidate(text=''){
  let s = String(text || '').trim();
  if(!s) return s;
  s = s.replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();
  const start = s.indexOf('{');
  if(start > 0) s = s.slice(start);
  const last = s.lastIndexOf('}');
  if(last >= 0) return s.slice(0, last + 1);
  return s;
}

function recoverJsonFields(text=''){
  const raw = String(text || '');
  const pick = (key) => {
    const re = new RegExp('"' + key + '"\\s*:\\s*"([\\s\\S]*?)(?="\\s*,\\s*"(?:image_prompt|video_prompt|caption_hashtags)"|"\\s*}\\s*$|$)', 'i');
    const m = raw.match(re);
    if(!m) return '';
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
  };
  const image = pick('image_prompt');
  const video = pick('video_prompt');
  const caption = pick('caption_hashtags');
  if(image || video || caption){
    return {
      image_prompt: image,
      video_prompt: video || 'VIDEO + AUDIO PROMPT: Continue from the TikTok Live image prompt as a realistic Thai live-commerce video. Host speaks Thai naturally, demonstrates the product, responds to comments, shows basket CTA, hearts, gifts, and urgency.',
      caption_hashtags: caption || 'ไลฟ์นี้ต้องดู กดตะกร้าก่อนหมด #TikTokShop #ของดีบอกต่อ #ไลฟ์สด #โปรแรง #รีวิวจริง'
    };
  }
  return null;
}

function parseStructuredText(text, providerLabel){
  if(!text) throw new Error(`${providerLabel} ไม่ได้ส่งข้อความกลับมา`);
  let parsed;
  const cleaned = completeJsonCandidate(text);
  try{ parsed = JSON.parse(cleaned); }
  catch{
    const m = String(text).match(/\{[\s\S]*\}/);
    if(m){ try{ parsed = JSON.parse(m[0]); }catch{} }
    if(!parsed){
      const recovered = recoverJsonFields(text);
      if(recovered) return recovered;
      throw new Error(`ไม่สามารถแปลงผลลัพธ์ ${providerLabel} เป็น Final Prompt ได้ • ตัวอย่างคำตอบ: ${String(text).slice(0, 260)}`);
    }
  }
  return {
    image_prompt: String(parsed.image_prompt || '').trim(),
    video_prompt: String(parsed.video_prompt || '').trim(),
    caption_hashtags: String(parsed.caption_hashtags || parsed.caption || '').trim()
  };
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
      temperature: 0.75,
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
  const text = raw?.candidates?.[0]?.content?.parts?.map(p=>p.text || '').join('').trim();
  return parseStructuredText(text, 'Gemini');
}

export async function callOpenAI({ systemPrompt, userPrompt }){
  const cfg = getProviderConfig('openai');
  const apiKey = getOpenAIKey();
  if(!apiKey) throw new Error('ยังไม่มี OpenAI API Key');
  const payload = {
    model: cfg.model,
    input: [
      { role: 'system', content: `${systemPrompt}\n\nOPENAI STRICT OUTPUT RULE: Return only one complete valid JSON object with image_prompt, video_prompt, caption_hashtags. Do not stop early. No markdown. No explanation.` },
      { role: 'user', content: userPrompt }
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
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });
  const raw = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(raw?.error?.message || `OpenAI API Error ${res.status}`);
  const text = raw?.output_text || raw?.output?.flatMap(item => item?.content || []).map(part => part?.text || '').join('').trim();
  return parseStructuredText(text, 'OpenAI');
}

export async function callAI(providerId, args){
  if(providerId === 'openai') return callOpenAI(args);
  return callGemini(args);
}
