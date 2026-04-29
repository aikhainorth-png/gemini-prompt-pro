import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, query, where, orderBy, limit, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import * as ViralModes from './gem-modes.js';
import * as ConversionModes from './gem-modes-conversion.js';
import * as HybridModes from './gem-modes-hybrid.js';
import * as ProMaxModes from './GEM_MODES_MASTER_PROMPT_PRO_MAX.js';
import { buildCharacterFactoryProfile } from './character-factory.js';
import { callAI } from './providers.js';
import { sanitizePolicyText } from './policy-engine.js';

const ADMIN_EMAILS = ['aikhainorth@gmail.com'];
const LS_FORM = 'GEMINI_FINAL_PROMPT_PRO_FORM_SPARK_V1';
const LS_KEY = 'userGeminiApiKey';
const LS_OPENAI_KEY = 'userOpenAIApiKey';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const LS_PROMPT_STRATEGY = 'GEMINI_FINAL_PROMPT_PRO_PROMPT_STRATEGY_V1';
const $ = (id) => document.getElementById(id);
const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch {}
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let userDocCache = null;
let currentHistoryId = null;
let deleteKeyTarget = "gemini";
let userDocUnsubscribe = null;
let approvalPollTimer = null;

function hasAdminEmail(email=''){ return ADMIN_EMAILS.includes(String(email).toLowerCase()); }

function getModeSource(){
  const strategy = $('promptStrategy')?.value || localStorage.getItem(LS_PROMPT_STRATEGY) || 'viral';
  if (strategy === 'conversion') return ConversionModes;
  if (strategy === 'hybrid') return HybridModes;
  if (strategy === 'pro_max') return ProMaxModes;
  return ViralModes;
}
function getCurrentStrategy(){
  return $('promptStrategy')?.value || localStorage.getItem(LS_PROMPT_STRATEGY) || 'viral';
}

function isMobileLike(){
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) || window.innerWidth <= 1024;
}

function canUseSessionStorage(){
  try{
    const key = "__firebase_redirect_storage_test__";
    window.sessionStorage.setItem(key, "1");
    window.sessionStorage.removeItem(key);
    return true;
  }catch(e){
    return false;
  }
}

function isEmbeddedWebView(){
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|TikTok|Bytedance|Twitter|wv\)|; wv|WebView/i.test(ua);
}

function showMobileLoginHelp(error){
  const detail = error?.message || String(error || "");
  const note = isEmbeddedWebView()
    ? "ตรวจพบว่าเปิดผ่าน In-App Browser เช่น TikTok / LINE / Facebook กรุณากดเมนู ⋮ แล้วเลือก เปิดใน Chrome หรือ Safari ก่อนเข้าสู่ระบบ"
    : "กรุณาเปิดผ่าน Chrome หรือ Safari โดยตรง แล้วกด Sign in with Google อีกครั้ง";
  showError("เข้าสู่ระบบไม่สำเร็จบนมือถือ/แท็บเล็ต: " + note + (detail ? "\nรายละเอียด: " + detail : ""));
  showToast("กรุณาเปิดผ่าน Chrome/Safari แล้วล็อกอินใหม่");
}

function safeBind(id, ev, fn){ const el = $(id); if(el) el.addEventListener(ev, fn); }
function generateCharacterSessionId(){ return String(Math.floor(1000000000000000 + Math.random() * 9000000000000000)); }

const THAI_CHARACTER_VOICE_PROFILES = {
  thai_female:{label:'ผู้หญิง',image:'Thai woman, Asian only, realistic Thai facial features, natural dark hair, warm friendly expression, photorealistic live-action appearance',voice:'Thai female natural commercial voice, warm, friendly, clear, trustworthy, natural spoken Thai',dna:'Thai female presenter, realistic Asian face, natural dark hair, warm friendly expression, human live-action proportions'},
  thai_male:{label:'ผู้ชาย',image:'Thai man, Asian only, realistic Thai facial features, natural dark hair, confident friendly expression, photorealistic live-action appearance',voice:'Thai male natural commercial voice, confident, friendly, clear, trustworthy, natural spoken Thai',dna:'Thai male presenter, realistic Asian face, natural dark hair, confident friendly expression, human live-action proportions'},
  elder_female:{label:'หญิงชรา',image:'elderly Thai woman, Asian only, kind face, natural wrinkles, grey or silver hair, warm trustworthy expression, photorealistic live-action appearance',voice:'Thai elderly female voice, calm, warm, wise, trustworthy, natural spoken Thai',dna:'elderly Thai female presenter, realistic Asian elder face, grey hair, kind expression, human live-action proportions'},
  elder_male:{label:'ชายชรา',image:'elderly Thai man, Asian only, wise face, natural wrinkles, silver hair, calm trustworthy expression, photorealistic live-action appearance',voice:'Thai elderly male voice, calm, slightly deep, wise, trustworthy, natural spoken Thai',dna:'elderly Thai male presenter, realistic Asian elder face, silver hair, calm wise expression, human live-action proportions'},
  thai_girl:{label:'เด็กผู้หญิง',image:'Thai little girl, Asian only, child-safe realistic appearance, cheerful expression, natural dark hair, photorealistic live-action appearance',voice:'Thai little girl voice, cheerful, cute, energetic, natural spoken Thai',dna:'Thai little girl, realistic Asian child face, natural dark hair, cheerful expression, child-safe live-action proportions'},
  thai_boy:{label:'เด็กผู้ชาย',image:'Thai little boy, Asian only, child-safe realistic appearance, playful expression, natural dark hair, photorealistic live-action appearance',voice:'Thai little boy voice, playful, energetic, clear, natural spoken Thai',dna:'Thai little boy, realistic Asian child face, natural dark hair, playful expression, child-safe live-action proportions'}
};
function getThaiCharacterVoiceProfile(voiceType='thai_female'){
  const normalized = {'หญิง':'thai_female','ชาย':'thai_male','ผู้หญิง':'thai_female','ผู้ชาย':'thai_male','หญิงชรา':'elder_female','ชายชรา':'elder_male','เด็กผู้หญิง':'thai_girl','เด็กผู้ชาย':'thai_boy'}[voiceType] || voiceType || 'thai_female';
  return THAI_CHARACTER_VOICE_PROFILES[normalized] || THAI_CHARACTER_VOICE_PROFILES.thai_female;
}
function getCharacterId(d={}, character={}){
  return character?.characterId || character?.shortName || d.characterSessionId || generateCharacterSessionId();
}

function stripRepeatedCharacterBlocks(text=''){
  let src = normalizeTextBlock(text);
  if(!src) return src;

  // Remove existing injected/meta blocks so each scene can be rebuilt cleanly.
  const patterns = [
    /\n?Character\s*ID\s*:\s*[^\n]*(?:\n|$)/ig,
    /\n?Character\s*DNA\s*Block\s*:\s*[\s\S]*?(?=\n(?:Voice\s*Profile\s*:|Continuity\s*Lock\s*:|Character\s*Description\s*:|Thai\s*\/\s*Asian\s*identity\s*:|\[TEXT OVERLAY\]|\[H2 OVERLAY\]|SCENE[_\s]*\d+|Scene\s*\d+|$))/ig,
    /\n?Character\s*Description\s*:\s*[\s\S]*?(?=\n(?:Voice\s*Profile\s*:|Continuity\s*Lock\s*:|Character\s*DNA\s*Block\s*:|\[TEXT OVERLAY\]|\[H2 OVERLAY\]|SCENE[_\s]*\d+|Scene\s*\d+|$))/ig,
    /\n?Thai\s*\/\s*Asian\s*identity\s*:\s*[^\n]*(?:\n|$)/ig,
    /\n?Voice\s*Profile\s*:\s*[\s\S]*?(?=\n(?:Continuity\s*Lock\s*:|Character\s*ID\s*:|Character\s*DNA\s*Block\s*:|\[TEXT OVERLAY\]|\[H2 OVERLAY\]|SCENE[_\s]*\d+|Scene\s*\d+|$))/ig,
    /\n?Continuity\s*Lock\s*:\s*[\s\S]*?(?=\n(?:Character\s*ID\s*:|Character\s*DNA\s*Block\s*:|Voice\s*Profile\s*:|\[TEXT OVERLAY\]|\[H2 OVERLAY\]|SCENE[_\s]*\d+|Scene\s*\d+|$))/ig,
    /\n?Lip\s*sync\s*[^\n]*(?:\n|$)/ig,
    /\n?Audio\s*(?:Cue|Requirement|Profile)?\s*:\s*[^\n]*(?:\n|$)/ig
  ];
  patterns.forEach(re => { src = src.replace(re, '\n'); });
  return src.replace(/\n{3,}/g, '\n\n').trim();
}

function buildCharacterDNAHeader(d, character, type='image'){
  const profile = getThaiCharacterVoiceProfile(d.voiceType);
  const id = getCharacterId(d, character);
  const visualDna = `${profile.dna}; ${character?.summary || ''}`.replace(/\s+/g,' ').trim();

  if(type === 'image'){
    return `Character ID: ${id}\nCharacter DNA Block:\n${visualDna}\nContinuity Lock:\nsame person, same Thai / Asian identity, same face, same hair, same outfit, same body proportions, same age, same identity across all scenes, only expression / pose / camera angle may change. Photorealistic live-action still image only. No voice profile, no dialogue, no lip sync, no audio instructions in IMAGE PROMPT. No 3D, no cartoon, no chibi, no mascot, no CGI, no animation style.`;
  }

  return `Character ID: ${id}\nCharacter DNA Block:\n${visualDna}\nVoice Profile:\n${profile.voice}\nContinuity Lock:\nsame person, same Thai / Asian identity, same face, same hair, same outfit, same body proportions, same age, same voice profile, same identity across all scenes, only expression / pose / camera angle may change. Photorealistic live-action video only. No 3D, no cartoon, no chibi, no mascot, no CGI, no animation style.`;
}

function prependDNAIfMissing(text='', d, character, type='image'){
  const cleaned = stripRepeatedCharacterBlocks(text);
  const header = buildCharacterDNAHeader(d, character, type);
  return `${header}\n\n${cleaned}`.trim();
}

function injectDNAIntoStructuredPrompt(prompt='', type='image', d={}, character={}){
  const count = Number(d.sceneCount || 1);
  const src = normalizeTextBlock(prompt);
  if(!src) return src;
  if(count <= 1) return prependDNAIfMissing(src, d, character, type);

  const blocks = splitBySceneMarkers(src);
  const hasAllScenes = blocks.length >= count && Array.from({length:count}, (_,i)=>i+1).every(no => blocks.some(b => b.sceneNo === no));

  // Keep the stable engine result when the parser cannot see all scenes.
  // Do not rebuild partial scenes, because that is what made scene 2/3 disappear.
  if(!hasAllScenes) return prependDNAIfMissing(src, d, character, type);

  return Array.from({length:count}, (_,i)=>{
    const sceneNo=i+1;
    const block=blocks.find(b=>b.sceneNo===sceneNo);
    const body=block ? cleanSceneBlock(block.raw, type, sceneNo) : '';
    const header=type==='image'?`SCENE_${sceneNo}_IMAGE_PROMPT:`:`SCENE_${sceneNo}_VIDEO_PROMPT:`;
    return `${header}\n${prependDNAIfMissing(body,d,character,type)}`;
  }).join('\n\n');
}

function showToast(message){ const t=$('toast'); if(!t) return; t.textContent=message; t.classList.add('show'); clearTimeout(showToast._timer); showToast._timer=setTimeout(()=>t.classList.remove('show'),2200); }
function setLoading(v){ $('loadingOverlay')?.classList.toggle('show', !!v); if($('generateBtn')) $('generateBtn').disabled=!!v; if($('statusPill')) $('statusPill').textContent=v?'Loading':'Ready'; }
function showError(message=''){ const el=$('errorBanner'); if(!el) return; el.textContent=message; el.classList.toggle('show', !!message); }
function showPending(v){ $('pendingBanner')?.classList.toggle('show', !!v); }
function showLoginGate(v){ $('loginGate')?.classList.toggle('show', !!v); }
function showPendingGate(v){ $('pendingGate')?.classList.toggle('show', !!v); }
function updatePendingGateUser(){ const el=$('pendingUserEmail'); if(!el) return; el.textContent=currentUser?.email || currentUser?.displayName || 'Signed in'; }
function setAppAccessLock(lock = true){ const shell=document.querySelector('.shell'); if(shell) shell.style.display = lock ? 'none' : ''; document.body.style.overflow = lock ? 'hidden' : ''; }
function saveUserApiKey(key){ if(key?.trim()) localStorage.setItem(LS_KEY,key.trim()); else localStorage.removeItem(LS_KEY); }
function getUserApiKey(){ return localStorage.getItem(LS_KEY)||''; }
function saveOpenAIKey(key){ if(key?.trim()) localStorage.setItem(LS_OPENAI_KEY,key.trim()); else localStorage.removeItem(LS_OPENAI_KEY); }
function getOpenAIKey(){ return localStorage.getItem(LS_OPENAI_KEY)||''; }
function updateOpenAIKeyStatus(message,isConnected=false){ const el=$('openAIKeyStatus'); if(!el) return; el.textContent=message; el.style.color=isConnected?'#9ed2ff':'#97a2c4'; }
function updateOpenAINativeModeStatus(message){ const el=$('openAINativeStatus'); if(el) el.textContent=message; }
function toggleOpenAIPanel(forceOpen){ const body=$('openAIPanelBody'); const btn=$('toggleOpenAIBtn'); if(!body||!btn) return; const open=typeof forceOpen==='boolean'?forceOpen:body.style.display==='none'; body.style.display=open?'block':'none'; btn.textContent=open?'▲':'▼'; }
function toggleOpenAIKeyVisibility(e){
  if (e) e.preventDefault();

  const input = document.getElementById('userOpenAIKey');
  const btn = document.getElementById('toggleOpenAIEyeBtn');

  if (!input) {
    console.error('ไม่พบ input id=userOpenAIKey');
    return;
  }

  const nextType = input.type === 'password' ? 'text' : 'password';
  input.setAttribute('type', nextType);

  if (btn) {
    btn.textContent = nextType === 'text' ? '🙈' : '👁️';
    btn.setAttribute('aria-label', nextType === 'text' ? 'ซ่อน OpenAI Key' : 'แสดง OpenAI Key');
  }

  input.focus();
}
function togglePrivateKeysPanel(forceOpen){ const body=$('privateKeysBody'); const btn=$('togglePrivateKeysBtn'); if(!body||!btn) return; const open=typeof forceOpen==='boolean'?forceOpen:body.style.display==='none'; body.style.display=open?'grid':'none'; btn.textContent=open?'▲':'▼'; }

function connectOpenAIKey(){ const key=($('userOpenAIKey')?.value||'').trim(); if(!key){ updateOpenAIKeyStatus('กรุณาวาง OpenAI API Key ก่อนเชื่อมต่อ'); return showToast('กรุณาวาง OpenAI API Key ก่อน'); } saveOpenAIKey(key); updateOpenAINativeModeStatus('⚡ OpenAI Private Mode • ใช้ Key ส่วนตัวแล้ว'); updateOpenAIKeyStatus('เชื่อมต่อ OpenAI Key เรียบร้อย • พร้อมใช้งาน', true); showToast('เชื่อมต่อ OpenAI API Key แล้ว'); }
async function testOpenAIKey(){ const key=($('userOpenAIKey')?.value||'').trim(); if(!key){ updateOpenAIKeyStatus('กรุณาวาง OpenAI API Key ก่อนทดสอบ'); return showToast('ยังไม่มี OpenAI API Key'); } updateOpenAIKeyStatus('กำลังทดสอบ OpenAI API Key...'); try{ const payload={ model:'gpt-4.1-mini', input:'Reply with the single word OK.', max_output_tokens:20, store:false}; const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify(payload)}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d?.error?.message||`OpenAI API Error ${r.status}`); saveOpenAIKey(key); updateOpenAINativeModeStatus('⚡ OpenAI Private Mode • ทดสอบ Key ผ่านแล้ว'); updateOpenAIKeyStatus('ทดสอบ OpenAI Key สำเร็จ • พร้อมใช้งาน', true); showToast('ทดสอบ OpenAI API Key สำเร็จ'); }catch(e){ updateOpenAIKeyStatus(`ทดสอบ OpenAI Key ไม่ผ่าน • ${e.message}`); showToast('ทดสอบ OpenAI Key ไม่ผ่าน'); } }
function promptDeleteOpenAIKey(){
 if(!getOpenAIKey()) return showToast('ยังไม่มี OpenAI Key ให้ลบ');
 deleteKeyTarget='openai';
 const msg=$('deleteModalMessage');
 if(msg) msg.textContent='ต้องการลบ OpenAI API Key ที่เก็บไว้ในเครื่องนี้หรือไม่?';
 const confirm=$('confirmDeleteBtn');
 if(confirm) confirm.textContent='ลบ OpenAI Key';
 $('deleteModal')?.classList.add('show');
}
function updateGeminiKeyStatus(message,isConnected=false){ const el=$('geminiKeyStatus'); if(!el) return; el.textContent=message; el.style.color=isConnected?'#9ed2ff':'#97a2c4'; }
function updateGeminiNativeModeStatus(message){ const el=$('geminiNativeStatus'); if(el) el.textContent=message; }
function toggleGeminiApiPanel(forceOpen){ const body=$('apiPanelBody'); const btn=$('toggleApiBtn'); if(!body||!btn) return; const open=typeof forceOpen==='boolean'?forceOpen:body.style.display==='none'; body.style.display=open?'block':'none'; btn.textContent=open?'▲':'▼'; }
function toggleGeminiKeyVisibility(){ const input=$('userApiKey'); const btn=$('toggleEyeBtn'); if(!input) return; const showing=input.type==='text'; input.type=showing?'password':'text'; if(btn) btn.textContent=showing?'👁️':'🙈'; }
function connectGeminiKey(){ const key=($('userApiKey')?.value||'').trim(); if(!key){ updateGeminiKeyStatus('กรุณาวาง Gemini API Key ก่อนเชื่อมต่อ'); return showToast('กรุณาวาง Gemini API Key ก่อน'); } saveUserApiKey(key); updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • ใช้ Key ส่วนตัวแล้ว'); updateGeminiKeyStatus('เชื่อมต่อ Key เรียบร้อย • ระบบจะใช้ Key นี้ในการเรียก Gemini', true); showToast('เชื่อมต่อ Gemini API Key แล้ว'); }
async function testGeminiKey(){ const key=($('userApiKey')?.value||'').trim(); if(!key){ updateGeminiKeyStatus('กรุณาวาง Gemini API Key ก่อนทดสอบ'); return showToast('ยังไม่มี Gemini API Key'); } updateGeminiKeyStatus('กำลังทดสอบ Gemini API Key...'); try{ const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d?.error?.message||`Gemini API Error ${r.status}`); saveUserApiKey(key); updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • ทดสอบ Key ผ่านแล้ว'); updateGeminiKeyStatus('ทดสอบ Key สำเร็จ • พร้อมใช้งาน', true); showToast('ทดสอบ Gemini API Key สำเร็จ'); }catch(e){ updateGeminiKeyStatus(`ทดสอบ Key ไม่ผ่าน • ${e.message}`); showToast('ทดสอบ Key ไม่ผ่าน'); } }
function promptDeleteGeminiKey(){
 if(!getUserApiKey()) return showToast('ยังไม่มี Key ให้ลบ');
 deleteKeyTarget='gemini';
 const msg=$('deleteModalMessage');
 if(msg) msg.textContent='ต้องการลบ Gemini API Key ที่เก็บไว้ในเครื่องนี้หรือไม่?';
 const confirm=$('confirmDeleteBtn');
 if(confirm) confirm.textContent='ลบ Gemini Key';
 $('deleteModal')?.classList.add('show');
}

function closeDeleteModal(){
 $('deleteModal')?.classList.remove('show');
}

function deleteKeyNow(){
 if(deleteKeyTarget==='openai'){
   saveOpenAIKey('');
   if($('userOpenAIKey')) $('userOpenAIKey').value='';
   updateOpenAIKeyStatus('ลบ OpenAI API Key แล้ว');
   updateOpenAINativeModeStatus('⚡ OpenAI Private Mode พร้อมใช้งาน');
   closeDeleteModal();
   return showToast('ลบ OpenAI Key แล้ว');
 }
 saveUserApiKey('');
 if($('userApiKey')) $('userApiKey').value='';
 updateGeminiKeyStatus('ลบ Gemini API Key แล้ว');
 updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode พร้อมใช้งาน');
 closeDeleteModal();
 showToast('ลบ Gemini Key แล้ว');
}
function getFormData(){ return { product:$('product')?.value.trim()||'', location:$('location')?.value.trim()||'', view:$('view')?.value.trim()||'', promptStrategy:$('promptStrategy')?.value||localStorage.getItem(LS_PROMPT_STRATEGY)||'viral', gemMode:$('gemMode')?.value||'signboard', providerMode:$('providerMode')?.value||'gemini', voiceType:$('voiceType')?.value||'thai_female', viralTone:$('viralTone')?.value||'ล้างสต๊อก', sceneCount:Number($('sceneCount')?.value||1), duration:Number($('duration')?.value||10), textOverlayEnabled: !!$('textOverlayEnabled')?.checked, textOverlayStyle:$('textOverlayStyle')?.value||'', textOverlayScene:$('textOverlayScene')?.value||'all', textOverlayHook:$('textOverlayHook')?.value.trim()||'', textOverlayPosition:$('textOverlayPosition')?.value||'center', textOverlaySize:$('textOverlaySize')?.value||'medium', h2OverlayEnabled: !!$('h2OverlayEnabled')?.checked, h2OverlayStyle:$('h2OverlayStyle')?.value||'', h2OverlayScene:$('h2OverlayScene')?.value||'all', h2OverlayHook:$('h2OverlayHook')?.value.trim()||'' }; }
function saveForm(){ const data = getFormData(); localStorage.setItem(LS_FORM, JSON.stringify(data)); localStorage.setItem(LS_PROMPT_STRATEGY, data.promptStrategy || 'viral'); }
function loadForm(){ const raw=localStorage.getItem(LS_FORM); if(!raw) return; try{ const d=JSON.parse(raw); if($('product')) $('product').value=d.product||''; if($('location')) $('location').value=d.location||''; if($('view')) $('view').value=d.view||''; if($('promptStrategy')) $('promptStrategy').value=d.promptStrategy || localStorage.getItem(LS_PROMPT_STRATEGY) || 'viral'; if($('gemMode')) $('gemMode').value=d.gemMode||'signboard'; if($('providerMode')) $('providerMode').value=d.providerMode||'gemini'; if($('voiceType')) $('voiceType').value=d.voiceType||'thai_female'; if($('viralTone')) $('viralTone').value=d.viralTone||'ล้างสต๊อก'; if($('sceneCount')) $('sceneCount').value=String(d.sceneCount||1); if($('duration')) $('duration').value=String(d.duration||10); if($('textOverlayEnabled')) $('textOverlayEnabled').checked=!!d.textOverlayEnabled; if($('textOverlayStyle')) $('textOverlayStyle').value=d.textOverlayStyle||''; if($('textOverlayScene')) $('textOverlayScene').value=d.textOverlayScene||'all'; if($('textOverlayHook')) $('textOverlayHook').value=d.textOverlayHook||''; if($('textOverlayPosition')) $('textOverlayPosition').value=d.textOverlayPosition||'center'; if($('textOverlaySize')) $('textOverlaySize').value=d.textOverlaySize||'medium'; if($('h2OverlayEnabled')) $('h2OverlayEnabled').checked=!!d.h2OverlayEnabled; if($('h2OverlayStyle')) $('h2OverlayStyle').value=d.h2OverlayStyle||''; if($('h2OverlayScene')) $('h2OverlayScene').value=d.h2OverlayScene||'all'; if($('h2OverlayHook')) $('h2OverlayHook').value=d.h2OverlayHook||''; }catch{} }

function populateGemModeOptions(selectedMode){
  const select = $('gemMode');
  if(!select) return;
  const current = selectedMode || select.value || 'signboard';
  const options = getModeSource().getGemModeOptions();
  select.innerHTML = options.map(opt => `<option value="${opt.id}">${opt.label}</option>`).join('');
  select.value = current;
}

function populateViralToneOptions(modeId, selectedTone=''){
  const select = $('viralTone');
  const mode = getModeSource().getGemModeConfig(modeId);
  if(!select || !mode) return;
  const tones = Array.isArray(mode.viralTones) && mode.viralTones.length ? mode.viralTones : ['ล้างสต๊อก'];
  select.innerHTML = tones.map(tone => `<option value="${tone}">${tone}</option>`).join('');
  select.value = tones.includes(selectedTone) ? selectedTone : tones[0];
}


function normalizeExampleItem(example, index = 0){
  if(!example) return { title:`ตัวอย่าง ${index + 1}`, location:'', view:'' };
  if(typeof example === 'string') return { title: example, location:'', view:'' };
  return { title: example.title || `ตัวอย่าง ${index + 1}`, location: example.location || '', view: example.view || '' };
}

function updateExampleButtons(modeId){
  const mode = getModeSource().getGemModeConfig(modeId);
  const examples = Array.isArray(mode.examples) ? mode.examples : [];
  const ids = ['exampleTissueBtn','exampleBatteryBtn','exampleChairBtn'];
  ids.forEach((id, index) => {
    const btn = $(id);
    if(!btn) return;
    const ex = normalizeExampleItem(examples[index], index); btn.textContent = ex.title;
  });
}

function applyGemMode(modeId, opts = {}){
  const mode = getModeSource().getGemModeConfig(modeId);
  if($('gemMode')) $('gemMode').value = mode.id;
  populateViralToneOptions(mode.id, opts.keepTone ? ($('viralTone')?.value || '') : (opts.selectedTone || ''));
  updateExampleButtons(mode.id);
  if(opts.toast) showToast(`เปลี่ยนโหมดเป็น ${mode.label}`);
  if(!opts.skipSave) saveAndRefresh();
}

function maybeAutoDetectGemMode(){
  const product = $('product')?.value || '';
  if(!product.trim()) return;
  const detected = getModeSource().autoDetectGemMode(product);
  const current = $('gemMode')?.value || 'signboard';
  if(detected && detected !== current){
    applyGemMode(detected, { toast: true });
  }
}

function getPreparedFormData(raw){
  const d = { ...raw };
  const mode = getModeSource().getGemModeConfig(d.gemMode);
  let randomized = [];
  if(!d.location?.trim()){
    d.location = getModeSource().pickRandomFrom(mode.randomLocations || []) || 'พื้นที่ใช้งานจริงที่เหมาะกับสินค้า';
    randomized.push('สถานที่');
  }
  if(!d.view?.trim()){
    d.view = getModeSource().pickRandomFrom(mode.randomViews || []) || 'มุมกล้องมือถือแบบใช้งานจริง เห็นสินค้าเด่นชัด';
    randomized.push('มุมมองสินค้า');
  }
  d.randomizedFields = randomized;
  return d;
}


function populateOverlaySceneOptions(){
  const count = Number($('sceneCount')?.value || 1);
  const opts = ['<option value="all">All Scene</option>'];
  for(let i=1;i<=count;i++) opts.push(`<option value="scene_${i}">Scene ${i}</option>`);
  ['textOverlayScene','h2OverlayScene'].forEach(id => {
    const sel=$(id); if(!sel) return;
    const current = sel.value || 'all';
    sel.innerHTML = opts.join('');
    sel.value = [...sel.options].some(o=>o.value===current) ? current : 'all';
  });
}
function updateOverlayBodies(){
  $('textOverlayBody')?.classList.toggle('show', !!$('textOverlayEnabled')?.checked);
  $('h2OverlayBody')?.classList.toggle('show', !!$('h2OverlayEnabled')?.checked);
}
function getRecommendedOverlayConfig(){
  const mode = $('gemMode')?.value || 'signboard';
  const productName = $('product')?.value || '';
  return getModeSource().getRecommendedTextStyles ? getModeSource().getRecommendedTextStyles(mode, productName) : { text:'S-01', h2:'H2-01' };
}
function populateTextStyleOptions(){
  const sel = $('textOverlayStyle');
  if(!sel || !getModeSource().getTextStyleOptions) return;
  const current = sel.value || '';
  sel.innerHTML = `<option value="auto">Auto ตามหมวดสินค้า</option>` + getModeSource().getTextStyleOptions().map(opt=>`<option value="${opt.id}">${opt.label}</option>`).join('');
  sel.value = [...sel.options].some(o=>o.value===current) ? current : 'auto';
}
function populateH2StyleOptions(){
  const sel = $('h2OverlayStyle');
  if(!sel || !getModeSource().getH2StyleOptions) return;
  const current = sel.value || '';
  sel.innerHTML = `<option value="auto">Auto ตามหมวดสินค้า</option>` + getModeSource().getH2StyleOptions().map(opt=>`<option value="${opt.id}">${opt.label}</option>`).join('');
  sel.value = [...sel.options].some(o=>o.value===current) ? current : 'auto';
}
function getResolvedTextStyleId(){
  const val = $('textOverlayStyle')?.value || 'auto';
  return val === 'auto' ? (getRecommendedOverlayConfig().text || 'S-01') : val;
}
function getResolvedH2StyleId(){
  const val = $('h2OverlayStyle')?.value || 'auto';
  return val === 'auto' ? (getRecommendedOverlayConfig().h2 || 'H2-01') : val;
}
function getAutoHookText(){
  const product = $('product')?.value?.trim() || 'สินค้านี้';
  const tone = $('viralTone')?.value || 'ล้างสต๊อก';
  const modeLabel = getModeSource().getGemModeConfig(($('gemMode')?.value || 'signboard')).label;
  const templates = [
    `หยุดดู ${product}!`,
    `${tone} ${product}`,
    `${product} ต้องลอง`,
    `${modeLabel} ห้ามเลื่อน`,
    `โปรแรงของ ${product}`
  ];
  return templates[0];
}
function getAutoH2Text(){
  const tone = $('viralTone')?.value || 'โปรแรง';
  return `${tone} วันนี้เท่านั้น`;
}
function updateOverlayPreview(){
  const styleId = getResolvedTextStyleId();
  const style = getModeSource().getTextStyleConfig ? getModeSource().getTextStyleConfig(styleId) : null;
  const hook = ($('textOverlayHook')?.value || '').trim() || getAutoHookText();
  const text = style ? style.label : styleId;
  if($('textOverlayPreview')) $('textOverlayPreview').textContent = `${hook} • ${text}`;
  const h2Id = getResolvedH2StyleId();
  const h2 = getModeSource().getH2StyleConfig ? getModeSource().getH2StyleConfig(h2Id) : null;
  const h2Hook = ($('h2OverlayHook')?.value || '').trim() || getAutoH2Text();
  if($('h2OverlayPreview')) $('h2OverlayPreview').textContent = `${h2Hook} • ${h2 ? h2.label : h2Id}`;
}
function appendOverlayBlocksToText(baseText, blocks=[]){
  const cleaned = String(baseText||'').trim();
  const extras = blocks.filter(Boolean).join('\n\n');
  return [cleaned, extras].filter(Boolean).join('\n\n');
}
function applyOverlayToSceneStructuredPrompt(imagePrompt, sceneCount, overlayCfgs=[]){
  const count = Number(sceneCount || 1);
  const scenes = parseScenePrompts(imagePrompt, '', count);
  const hasAllScenes = scenes.length >= count && Array.from({length:count}, (_,i)=>i+1).every(no => scenes.some(s => Number(s.sceneNo) === no && String(s.imagePrompt||'').trim()));

  // SAFE MODE: if scene parsing is incomplete, do not rebuild image_prompt.
  // Append overlay instructions once at the end to preserve the original AI-generated scene prompts.
  if(!hasAllScenes){
    return appendOverlayBlocksToText(imagePrompt, overlayCfgs.filter(c=>c?.enabled).map(c=>c.block));
  }

  const rebuilt = scenes.map(scene => {
    const blocks = [];
    overlayCfgs.forEach(cfg => {
      if(!cfg || !cfg.enabled) return;
      if(cfg.scene !== 'all' && cfg.scene !== `scene_${scene.sceneNo}`) return;
      blocks.push(cfg.block);
    });
    const body = appendOverlayBlocksToText(scene.imagePrompt, blocks);
    return `SCENE_${scene.sceneNo}_IMAGE_PROMPT:\n${body}`;
  });
  return rebuilt.join('\n\n');
}

function applyTextOverlayToImagePrompt(imagePrompt, d){
  const cfgs = [];
  if(d.textOverlayEnabled){
    const style = getModeSource().getTextStyleConfig(getResolvedTextStyleId());
    const hook = d.textOverlayHook || getAutoHookText();
    cfgs.push({ enabled:true, scene:d.textOverlayScene || 'all', block:`[TEXT OVERLAY]\nText: ${hook}\nStyle: ${style.label}\nUse for [TEXT OVERLAY] in Image Prompt. ${style.prompt.replace('[HOOK TEXT]', hook)}\nPosition: ${d.textOverlayPosition || 'center'}\nSize: ${d.textOverlaySize || 'medium'}` });
  }
  if(d.h2OverlayEnabled){
    const style = getModeSource().getH2StyleConfig(getResolvedH2StyleId());
    const hook = d.h2OverlayHook || getAutoH2Text();
    cfgs.push({ enabled:true, scene:d.h2OverlayScene || 'all', block:`[H2 OVERLAY]\nText: ${hook}\nStyle: ${style.label}\nUse for secondary subtitle / promo capsule in Image Prompt. ${style.prompt.replace('[H2 TEXT]', hook)}` });
  }
  if(!cfgs.length) return imagePrompt;
  if(Number(d.sceneCount||1) > 1) return applyOverlayToSceneStructuredPrompt(imagePrompt, d.sceneCount, cfgs);
  return appendOverlayBlocksToText(imagePrompt, cfgs.map(c=>c.block));
}

function formatPerScene(duration,sceneCount){ const v=duration/Math.max(sceneCount,1); return Number.isInteger(v)?`${v}s`:`${v.toFixed(1)}s`; }
function updateSummary(){ const d=getFormData(); if($('summaryPreview')) $('summaryPreview').textContent=[`สินค้า: ${d.product||'-'}`,`สถานที่: ${d.location||'-'}`,`มุมมองสินค้า: ${d.view||'-'}`,`GEM MODE: ${getModeSource().getGemModeConfig(d.gemMode).label}`,`AI Provider: ${d.providerMode||'gemini'}`,`ตัวละคร + เสียงพากย์: ${getThaiCharacterVoiceProfile(d.voiceType).label||d.voiceType||'-'}`,`โทนไวรัล: ${d.viralTone||'-'}`,`จำนวน Scene: ${d.sceneCount}`,`เวลาทั้งหมด: ${d.duration} วินาที`,`เวลาเฉลี่ยต่อ Scene: ${formatPerScene(d.duration,d.sceneCount)}`,`TEXT OVERLAY: ${d.textOverlayEnabled ? (d.textOverlayStyle || 'auto') : 'ปิด'}`,`H2: ${d.h2OverlayEnabled ? (d.h2OverlayStyle || 'auto') : 'ปิด'}`,`STORE VIRAL PACK V3: 200 TEXT / 40 H2`].join('\n'); if($('statScene')) $('statScene').textContent=String(d.sceneCount); if($('statDuration')) $('statDuration').textContent=`${d.duration}s`; if($('statPerScene')) $('statPerScene').textContent=formatPerScene(d.duration,d.sceneCount); }
function saveAndRefresh(){ saveForm(); updateSummary(); }
function validateForm(d){ if(!d.product) return 'กรุณากรอกสินค้า'; return ''; }
function setPromptEditing(type, editing){
  const map = {
    image: { textarea:'imagePrompt', editBtn:'editImageBtn', saveBtn:'saveImageBtn', label:'IMAGE' },
    video: { textarea:'videoPrompt', editBtn:'editVideoBtn', saveBtn:'saveVideoBtn', label:'VDO' },
    caption: { textarea:'captionPrompt', editBtn:'editCaptionBtn', saveBtn:'saveCaptionBtn', label:'CAPTION' }
  };
  const cfg = map[type];
  if(!cfg) return;
  const textarea=$(cfg.textarea); const editBtn=$(cfg.editBtn); const saveBtn=$(cfg.saveBtn);
  if(!textarea||!editBtn||!saveBtn) return;
  textarea.readOnly=!editing;
  textarea.classList.toggle('editing', editing);
  editBtn.textContent=editing?`ยกเลิก ${cfg.label}`:`แก้ไข ${cfg.label}`;
  saveBtn.style.display=editing?'inline-flex':'none';
}
function resetPromptEditors(){ setPromptEditing('image',false); setPromptEditing('video',false); setPromptEditing('caption',false); }
function togglePromptEdit(type){ const map={image:'imagePrompt',video:'videoPrompt',caption:'captionPrompt'}; const textarea=$(map[type]||'videoPrompt'); const isImage=type==='image'; if(!textarea||!textarea.value.trim()) return showToast('ยังไม่มี prompt ให้แก้ไข'); if(!textarea.readOnly) return setPromptEditing(type,false); setPromptEditing(type,true); textarea.focus(); }
async function savePromptEdit(type){ const map={image:'imagePrompt',video:'videoPrompt',caption:'captionPrompt'}; const textarea=$(map[type]||'videoPrompt'); const isImage=type==='image'; const value=(textarea?.value||'').trim(); if(!value) return showToast('ข้อความว่างไม่ได้'); try{ if(currentUser && currentHistoryId){ const updateMap={ image:{imagePrompt:value,updatedAt:serverTimestamp()}, video:{videoPrompt:value,updatedAt:serverTimestamp()}, caption:{captionHashtags:value,updatedAt:serverTimestamp()} }; await updateDoc(doc(db,'promptHistory',currentHistoryId), updateMap[type] || updateMap.video); await renderHistory(); } setPromptEditing(type,false); const msgMap={image:'บันทึก IMAGE PROMPT แล้ว',video:'บันทึก VDO PROMPT แล้ว',caption:'บันทึก CAPTION แล้ว'}; showToast(msgMap[type] || 'บันทึกแล้ว'); }catch(e){ showToast(`บันทึกไม่สำเร็จ: ${e.message}`); } }


function loadExample(slot){
  const mode = getModeSource().getGemModeConfig($('gemMode')?.value || 'signboard');
  const examples = Array.isArray(mode.examples) ? mode.examples : [];
  const ex = normalizeExampleItem(examples[slot] || examples[0], slot);
  if(!ex.title) return;

  const exampleDefaults = {
    voiceType: ['แม่และเด็ก','ชุดชั้นใน','เครื่องสำอาง','ครีมบำรุงผิว','แฟชั่น'].some(word => mode.label.includes(word)) ? 'thai_female' : (($('voiceType')?.value) || 'thai_female'),
    viralTone: ($('viralTone')?.value) || ((mode.viralTones && mode.viralTones[0]) || 'ล้างสต๊อก'),
    sceneCount: 1,
    duration: 10
  };

  if($('product')) $('product').value = ex.title;
  if($('location')) $('location').value = ex.location || getModeSource().pickRandomFrom(mode.randomLocations || []);
  if($('view')) $('view').value = ex.view || getModeSource().pickRandomFrom(mode.randomViews || []);
  if($('voiceType')) $('voiceType').value = exampleDefaults.voiceType;
  populateViralToneOptions(mode.id, exampleDefaults.viralTone);
  if($('sceneCount')) $('sceneCount').value = String(exampleDefaults.sceneCount);
  if($('duration')) $('duration').value = String(exampleDefaults.duration);
  saveAndRefresh();
  showToast(`โหลดตัวอย่าง ${mode.label} แล้ว`);
}


function getSceneWorkspace(){ return $('sceneWorkspace'); }
function resetSceneWorkspace(){
  const wrap = getSceneWorkspace();
  if(wrap) wrap.innerHTML='';
  if($('sceneWorkspaceWrap')) $('sceneWorkspaceWrap').style.display='none';
  if($('singleImageCard')) $('singleImageCard').style.display='';
  if($('singleVideoCard')) $('singleVideoCard').style.display='';
  if($('captionCard')) $('captionCard').style.display='none';
}

function normalizeTextBlock(v=''){ return String(v||'').replace(/^```[\w-]*\n?/,'').replace(/```$/,'').trim(); }

function splitBySceneMarkers(text=''){
  const src = normalizeTextBlock(text);
  const matches = [...src.matchAll(/(?:^|\n)\s*(?:SCENE[_\s]*(\d+)(?:[_\s]*(?:IMAGE|VIDEO|VDO)(?:[_\s]*(?:\+\s*AUDIO|AUDIO))?[_\s]*PROMPT)?|Scene\s*(\d+)(?:\s*\([^\n]*?\))?\s*:)/gim)];
  if(!matches.length) return [];
  const blocks = [];
  for(let i=0;i<matches.length;i++){
    const m = matches[i];
    const start = m.index;
    const end = i+1 < matches.length ? matches[i+1].index : src.length;
    const sceneNo = Number(m[1] || m[2] || i+1);
    blocks.push({ sceneNo, raw: src.slice(start, end).trim() });
  }
  return blocks;
}

function cleanSceneBlock(raw='', type='image', sceneNo=1){
  let out = normalizeTextBlock(raw);
  const patterns = type === 'image'
    ? [new RegExp(`^\\s*SCENE[_\\s]*${sceneNo}[_\\s]*IMAGE[_\\s]*PROMPT\\s*:\\s*`, 'i'), new RegExp(`^\\s*Scene\\s*${sceneNo}\\s*(?:\\([^)]*\\))?\\s*:\\s*`, 'i')]
    : [new RegExp(`^\\s*SCENE[_\\s]*${sceneNo}[_\\s]*(?:VIDEO|VDO)(?:[_\\s]*(?:\\+\\s*AUDIO|AUDIO))?[_\\s]*PROMPT\\s*:\\s*`, 'i'), new RegExp(`^\\s*Scene\\s*${sceneNo}\\s*(?:\\([^)]*\\))?\\s*:\\s*`, 'i')];
  patterns.forEach(p => { out = out.replace(p, ''); });
  return out.trim();
}

function synthesizeImagePromptFromVideo(videoText='', sceneNo=1){
  const cleaned = normalizeTextBlock(videoText);
  if(!cleaned) return '';
  return `Photorealistic live-action vertical 9:16 key visual for Scene ${sceneNo}. Use the video scene direction below as the still-image source context. Keep the same locked human character identity, same outfit, same location family, same lighting family, and the strongest selling visual moment from the scene. No 3D, no animation, no cartoon, no chibi, no mascot style.

Scene context:
${cleaned}`;
}

function parseScenePrompts(imagePrompt='', videoPrompt='', sceneCount=1){
  const count = Number(sceneCount || 1);
  const imageBlocks = splitBySceneMarkers(imagePrompt);
  const videoBlocks = splitBySceneMarkers(videoPrompt);
  const scenes = [];
  for(let i=1;i<=count;i++){
    const imgMatch = imageBlocks.find(b => b.sceneNo === i);
    const vidMatch = videoBlocks.find(b => b.sceneNo === i);
    let img = imgMatch ? cleanSceneBlock(imgMatch.raw, 'image', i) : '';
    let vid = vidMatch ? cleanSceneBlock(vidMatch.raw, 'video', i) : '';
    if(!img && vid) img = synthesizeImagePromptFromVideo(vid, i);
    scenes.push({ sceneNo: i, imagePrompt: img, videoPrompt: vid });
  }
  const hasStructured = scenes.some(s => s.imagePrompt || s.videoPrompt);
  if(hasStructured) return scenes.filter(s => s.imagePrompt || s.videoPrompt);
  if(count > 1){
    return Array.from({length: count}, (_, idx) => ({
      sceneNo: idx + 1,
      imagePrompt: idx === 0 ? normalizeTextBlock(imagePrompt) : synthesizeImagePromptFromVideo(videoPrompt, idx + 1),
      videoPrompt: idx === 0 ? normalizeTextBlock(videoPrompt) : ''
    }));
  }
  return [];
}

function buildCombinedScenePrompt(type='image'){
  const wrap = getSceneWorkspace();
  if(!wrap) return '';
  const blocks = [...wrap.querySelectorAll('.scene-card')].map(card => {
    const no = Number(card.dataset.sceneNo || 0);
    const textarea = card.querySelector(type === 'image' ? '.scene-image-textarea' : '.scene-video-textarea');
    const value = (textarea?.value || '').trim();
    if(!value) return '';
    const header = type === 'image' ? `SCENE_${no}_IMAGE_PROMPT:` : `SCENE_${no}_VIDEO_PROMPT:`;
    return `${header}\n${value}`;
  }).filter(Boolean);
  return blocks.join('\n\n');
}

async function saveScenePromptEdit(sceneNo, type){
  const card = document.querySelector(`.scene-card[data-scene-no="${sceneNo}"]`);
  if(!card) return;
  const textarea = card.querySelector(type === 'image' ? '.scene-image-textarea' : '.scene-video-textarea');
  if(!textarea) return;
  const value = (textarea.value || '').trim();
  if(!value) return showToast('ข้อความว่างไม่ได้');
  textarea.readOnly = true;
  textarea.classList.remove('editing');
  const saveBtn = card.querySelector(type === 'image' ? '.save-scene-image-btn' : '.save-scene-video-btn');
  const editBtn = card.querySelector(type === 'image' ? '.edit-scene-image-btn' : '.edit-scene-video-btn');
  if(saveBtn) saveBtn.style.display='none';
  if(editBtn) editBtn.textContent = 'แก้ไข';
  if(type === 'image' && $('imagePrompt')) $('imagePrompt').value = buildCombinedScenePrompt('image');
  if(type === 'video' && $('videoPrompt')) $('videoPrompt').value = buildCombinedScenePrompt('video');
  try{
    if(currentUser && currentHistoryId){
      const payload = { updatedAt: serverTimestamp() };
      if(type === 'image') payload.imagePrompt = buildCombinedScenePrompt('image');
      else payload.videoPrompt = buildCombinedScenePrompt('video');
      await updateDoc(doc(db,'promptHistory',currentHistoryId), payload);
      await renderHistory();
    }
    showToast(`บันทึก ${type === 'image' ? 'IMAGE' : 'VIDEO'} ของ Scene ${sceneNo} แล้ว`);
  }catch(e){ showToast(`บันทึกไม่สำเร็จ: ${e.message}`); }
}

function toggleScenePromptEdit(sceneNo, type){
  const card = document.querySelector(`.scene-card[data-scene-no="${sceneNo}"]`);
  if(!card) return;
  const textarea = card.querySelector(type === 'image' ? '.scene-image-textarea' : '.scene-video-textarea');
  const saveBtn = card.querySelector(type === 'image' ? '.save-scene-image-btn' : '.save-scene-video-btn');
  const editBtn = card.querySelector(type === 'image' ? '.edit-scene-image-btn' : '.edit-scene-video-btn');
  if(!textarea || !textarea.value.trim()) return showToast('ยังไม่มี prompt ให้แก้ไข');
  const editing = textarea.readOnly;
  textarea.readOnly = !editing;
  textarea.classList.toggle('editing', editing);
  if(saveBtn) saveBtn.style.display = editing ? 'inline-flex' : 'none';
  if(editBtn) editBtn.textContent = editing ? 'ยกเลิก' : 'แก้ไข';
  if(editing) textarea.focus();
}

async function copyScenePrompt(sceneNo, type, btn){
  const card = document.querySelector(`.scene-card[data-scene-no="${sceneNo}"]`);
  if(!card) return;
  const textarea = card.querySelector(type === 'image' ? '.scene-image-textarea' : '.scene-video-textarea');
  const text = textarea?.value || '';
  if(!text.trim()) return showToast('ยังไม่มีข้อความให้คัดลอก');
  await navigator.clipboard.writeText(text);
  const old = btn.textContent;
  btn.textContent='คัดลอกแล้ว';
  btn.classList.remove('btn-dark');
  btn.classList.add('btn-green');
  setTimeout(()=>{ btn.textContent=old; btn.classList.remove('btn-green'); btn.classList.add('btn-dark'); }, 1200);
}

function renderSceneWorkspace(sceneCount, imagePrompt='', videoPrompt=''){
  const wrap = getSceneWorkspace();
  if(!wrap) return false;
  const scenes = parseScenePrompts(imagePrompt, videoPrompt, sceneCount);
  if(Number(sceneCount||1) <= 1 || !scenes.length){
    wrap.innerHTML='';
    if($('sceneWorkspaceWrap')) $('sceneWorkspaceWrap').style.display='none';
    if($('singleImageCard')) $('singleImageCard').style.display='';
    if($('singleVideoCard')) $('singleVideoCard').style.display='';
    if($('captionCard')) $('captionCard').style.display='';
    return false;
  }

  if($('sceneWorkspaceWrap')) $('sceneWorkspaceWrap').style.display='block';
  if($('singleImageCard')) $('singleImageCard').style.display='none';
  if($('singleVideoCard')) $('singleVideoCard').style.display='none';
  if($('captionCard')) $('captionCard').style.display='';

  wrap.innerHTML = scenes.map(scene => `
    <section class="scene-card" data-scene-no="${scene.sceneNo}">
      <div class="scene-head">
        <div class="scene-title">SCENE ${scene.sceneNo}</div>
        <div class="scene-badge">แยก Prompt ต่อฉาก</div>
      </div>
      <div class="scene-grid">
        <section class="prompt-card scene-subcard">
          <div class="prompt-top"><h3>IMAGE PROMPT</h3><div class="row" style="align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto"><span class="tag image">Image</span><div class="edit-actions"><button class="btn btn-outline edit-scene-image-btn" data-scene="${scene.sceneNo}" style="padding:10px 12px">แก้ไข</button><button class="btn btn-green save-scene-image-btn" data-scene="${scene.sceneNo}" style="padding:10px 12px;display:none">บันทึก</button><button class="btn btn-dark copy-scene-image-btn" data-scene="${scene.sceneNo}" style="padding:10px 12px">คัดลอก</button></div></div></div>
          <textarea class="prompt-box scene-image-textarea" readonly>${scene.imagePrompt || ''}</textarea>
        </section>
        <section class="prompt-card scene-subcard">
          <div class="prompt-top"><h3>VIDEO + AUDIO PROMPT</h3><div class="row" style="align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto"><span class="tag video">Video</span><div class="edit-actions"><button class="btn btn-outline edit-scene-video-btn" data-scene="${scene.sceneNo}" style="padding:10px 12px">แก้ไข</button><button class="btn btn-green save-scene-video-btn" data-scene="${scene.sceneNo}" style="padding:10px 12px;display:none">บันทึก</button><button class="btn btn-dark copy-scene-video-btn" data-scene="${scene.sceneNo}" style="padding:10px 12px">คัดลอก</button></div></div></div>
          <textarea class="prompt-box scene-video-textarea" readonly>${scene.videoPrompt || ''}</textarea>
        </section>
      </div>
    </section>`).join('');

  wrap.querySelectorAll('.edit-scene-image-btn').forEach(btn => btn.addEventListener('click', ()=>toggleScenePromptEdit(btn.dataset.scene,'image')));
  wrap.querySelectorAll('.save-scene-image-btn').forEach(btn => btn.addEventListener('click', ()=>saveScenePromptEdit(btn.dataset.scene,'image')));
  wrap.querySelectorAll('.copy-scene-image-btn').forEach(btn => btn.addEventListener('click', ()=>copyScenePrompt(btn.dataset.scene,'image',btn)));
  wrap.querySelectorAll('.edit-scene-video-btn').forEach(btn => btn.addEventListener('click', ()=>toggleScenePromptEdit(btn.dataset.scene,'video')));
  wrap.querySelectorAll('.save-scene-video-btn').forEach(btn => btn.addEventListener('click', ()=>saveScenePromptEdit(btn.dataset.scene,'video')));
  wrap.querySelectorAll('.copy-scene-video-btn').forEach(btn => btn.addEventListener('click', ()=>copyScenePrompt(btn.dataset.scene,'video',btn)));
  return true;
}


function clearForm(){ ['product','location','view'].forEach(id=>{if($(id)) $(id).value='';}); if($('promptStrategy')) $('promptStrategy').value='viral'; localStorage.setItem(LS_PROMPT_STRATEGY,'viral'); populateGemModeOptions('signboard'); if($('gemMode')) $('gemMode').value='signboard'; if($('providerMode')) $('providerMode').value='gemini'; if($('voiceType')) $('voiceType').value='thai_female'; populateViralToneOptions('signboard','ล้างสต๊อก'); if($('sceneCount')) $('sceneCount').value='1'; if($('duration')) $('duration').value='10'; if($('imagePrompt')) $('imagePrompt').value=''; if($('videoPrompt')) $('videoPrompt').value=''; if($('captionPrompt')) $('captionPrompt').value=''; if($('textOverlayEnabled')) $('textOverlayEnabled').checked=false; if($('textOverlayStyle')) $('textOverlayStyle').value='auto'; if($('textOverlayScene')) $('textOverlayScene').value='all'; if($('textOverlayHook')) $('textOverlayHook').value=''; if($('textOverlayPosition')) $('textOverlayPosition').value='center'; if($('textOverlaySize')) $('textOverlaySize').value='medium'; if($('h2OverlayEnabled')) $('h2OverlayEnabled').checked=false; if($('h2OverlayStyle')) $('h2OverlayStyle').value='auto'; if($('h2OverlayScene')) $('h2OverlayScene').value='all'; if($('h2OverlayHook')) $('h2OverlayHook').value=''; updateOverlayBodies(); updateOverlayPreview(); resetSceneWorkspace(); if($('resultsWrap')) $('resultsWrap').style.display='none'; if($('emptyState')) $('emptyState').style.display='flex'; currentHistoryId=null; resetPromptEditors(); saveAndRefresh(); showToast('ล้างข้อมูลแล้ว'); }
function buildSystemInstruction(d = getPreparedFormData(getFormData())){
  const gem = getModeSource().getGemModeConfig(d.gemMode);
  const character = buildCharacterFactoryProfile(d);
  const thaiCharacterProfile = getThaiCharacterVoiceProfile(d.voiceType);
  const characterInstruction = character.enabled ? `

CHARACTER FACTORY PRO MAX ACTIVE:
${character.profileBlock}

${character.dnaBlock}

${character.lockBlock}` : '';
  return `${gem.systemPrompt}${characterInstruction}

THAI CHARACTER + VOICE LOCK:
- Selected character type: ${thaiCharacterProfile.label}.
- Main character must be Thai / Asian only: ${thaiCharacterProfile.image}.
- Voice must match selected character: ${thaiCharacterProfile.voice}.
- Default visual style: photorealistic live-action cinematic only.
- Never use 3D, cartoon, chibi, mascot, CGI, animation, Pixar-like, or stylized character unless the user explicitly types those words.

GLOBAL OUTPUT RULES:
- Return FINAL-READY prompts only, not analysis.
- Generate two polished deliverables:
1) image_prompt: a single final image generation prompt for a vertical 9:16 promotional image
2) video_prompt: a single final video generation prompt containing all scenes in sequence
- For the image prompt, explicitly state that any uploaded or attached image must be used as the product reference only.
- The default visual style must be photorealistic live-action cinematic advertising.
- Absolutely no 3D animated style, no cartoon style, no chibi style, no mascot style, and no CGI-stylized character unless the user explicitly asks for that.
- No subtitles in video prompt.
- If people appear, avoid clear faces; prefer hands, arms, backs, or blurred passersby.
- VOICEOVER PRO MAX: every scene in the video prompt must contain Thai voiceover dialogue.
- Every scene must include exact Thai spoken lines ready for narration or lip-sync.
- The selected character + voice type controls the visible character identity and narrator voice.
- The selected viral tone controls urgency, emotion, and selling pressure.
- No silent scenes.
- Keep both prompts fully final and ready to use.
- If Scene count is greater than 1, format the image prompt and video prompt with clear blocks using these exact headers:
SCENE_1_IMAGE_PROMPT:
...
SCENE_2_IMAGE_PROMPT:
...
and
SCENE_1_VIDEO_PROMPT:
...
SCENE_2_VIDEO_PROMPT:
...
Continue the same pattern for all scenes.`;
}
function buildUserPrompt(d){
  const gem = getModeSource().getGemModeConfig(d.gemMode);
  const character = buildCharacterFactoryProfile(d);
  const randomNote = d.randomizedFields?.length ? `\nAUTO RANDOM FILLED: ${d.randomizedFields.join(', ')}` : '';
  const thaiCharacterProfile = getThaiCharacterVoiceProfile(d.voiceType);
  const characterNote = character.enabled ? `\n\nCHARACTER FACTORY PRO MAX:\n${character.profileBlock}\n\n${character.dnaBlock}\n\n${character.lockBlock}` : '';
  return `GEM MODE: ${gem.label}
GEM DESCRIPTION: ${gem.description}${randomNote}${characterNote}

Create final production-ready prompts using these inputs.
Product: ${sanitizePolicyText(d.product)}
Location: ${sanitizePolicyText(d.location)}
View / shot direction: ${sanitizePolicyText(d.view)}
Character + voice type: ${thaiCharacterProfile.label}
Character visual profile: ${thaiCharacterProfile.image}
Voice profile: ${thaiCharacterProfile.voice}
Viral tone: ${d.viralTone}
Scene count: ${d.sceneCount}
Total duration: ${d.duration} seconds
Average duration per scene: ${formatPerScene(d.duration,d.sceneCount)}

Requirements:
- Return one final image prompt and one final video prompt.
- The image prompt must clearly instruct the model to use the attached/uploaded image as the product reference only.
- The default visual style must be photorealistic live-action cinematic advertising.
- Do not use 3D animated, cartoon, chibi, mascot, or CGI-stylized character language anywhere in the output unless the user explicitly asks for that style.
- The video prompt must include Scene 1 to Scene ${d.sceneCount} in sequence.
- Every scene must include Thai voiceover dialogue, not just visual direction.
- Visible character and narration voice must follow the selected Thai / Asian character + voice profile: ${thaiCharacterProfile.label}.
- The selling psychology and urgency must follow the selected viral tone: ${d.viralTone}.
- Add exact spoken Thai lines for every scene, ready for voiceover or lip-sync.
- Follow the selected GEM MODE creative strategy closely.
- If scene count is greater than 1 and CHARACTER FACTORY PRO MAX is active, every SCENE_n_IMAGE_PROMPT must begin with Character ID, Character DNA Block, and Continuity Lock only. Do not put Voice Profile, dialogue, lip-sync, or audio instructions inside IMAGE PROMPT.
- Every SCENE_n_VIDEO_PROMPT must begin with Character ID, Character DNA Block, Voice Profile, and Continuity Lock.
- For multi-scene outputs, keep the same main character identity across all scenes with no redesign or reinterpretation.
- If scene count is greater than 1, split both image_prompt and video_prompt into clear scene blocks using these exact headers only: SCENE_1_IMAGE_PROMPT:, SCENE_2_IMAGE_PROMPT:, ... and SCENE_1_VIDEO_PROMPT:, SCENE_2_VIDEO_PROMPT:, ...
- Also return caption_hashtags: one Thai caption line plus exactly 5 hashtags, where 3 hashtags are product-related and 2 hashtags are trending Thai commerce/social hashtags.
- If TEXT OVERLAY or H2 overlay are enabled, preserve those overlay instructions naturally inside the image prompt output for the selected scenes.
- Final only.`;
}
function buildResponseSchema(){ return {type:'OBJECT',properties:{image_prompt:{type:'STRING'},video_prompt:{type:'STRING'},caption_hashtags:{type:'STRING'}},required:['image_prompt','video_prompt','caption_hashtags'],propertyOrdering:['image_prompt','video_prompt','caption_hashtags']}; }
async function callSelectedProvider(d){ return await callAI(d.providerMode, { systemPrompt: buildSystemInstruction(d), userPrompt: buildUserPrompt(d) }); }
async function upsertCurrentUser(user){ const email=String(user.email||'').toLowerCase(); const ref=doc(db,'users',user.uid); const snap=await getDoc(ref); const now=serverTimestamp(); const base={uid:user.uid,email,displayName:user.displayName||'',photoURL:user.photoURL||'',lastLoginAt:now,updatedAt:now}; if(hasAdminEmail(email)){ await setDoc(ref,{...base,createdAt:snap.exists()?snap.data().createdAt||now:now,approved:true,role:'admin',approvedAt:now},{merge:true}); } else if(!snap.exists()){ await setDoc(ref,{...base,createdAt:now,approved:false,role:'user'},{merge:true}); } else { await setDoc(ref,base,{merge:true}); } const updated=await getDoc(ref); userDocCache=updated.exists()?updated.data():null; }
function isApproved(){ return !!(userDocCache?.approved || hasAdminEmail(currentUser?.email)); }
function isAdmin(){ return !!(userDocCache?.role==='admin' || hasAdminEmail(currentUser?.email)); }
async function signInGoogle(){
  showError('');
  try { provider.setCustomParameters({ prompt: 'select_account' }); } catch(e) {}

  if(isEmbeddedWebView()){
    showMobileLoginHelp(new Error('In-App Browser detected'));
    return;
  }

  try{
    if(isMobileLike() || !canUseSessionStorage()){
      await signInWithRedirect(auth, provider);
      return;
    }
    await signInWithPopup(auth, provider);
    return;
  }catch(e){
    try{
      await signInWithRedirect(auth, provider);
      return;
    }catch(redirectError){
      showError('เข้าสู่ระบบไม่สำเร็จ: ' + ((redirectError && redirectError.message) || (e && e.message) || e));
      showToast('เข้าสู่ระบบไม่สำเร็จ');
    }
  }
}

async function refreshCurrentUserDoc(){ if(!currentUser) return; const snap=await getDoc(doc(db,'users',currentUser.uid)); userDocCache=snap.exists()?snap.data():null; }

function stopApprovalWatcher(){
  if(typeof userDocUnsubscribe === 'function'){
    try{ userDocUnsubscribe(); }catch(e){}
  }
  userDocUnsubscribe = null;
  if(approvalPollTimer){
    clearInterval(approvalPollTimer);
    approvalPollTimer = null;
  }
}

function startApprovalWatcher(){
  stopApprovalWatcher();
  if(!currentUser) return;
  const ref = doc(db, 'users', currentUser.uid);
  userDocUnsubscribe = onSnapshot(ref, async (snap)=>{
    userDocCache = snap.exists() ? snap.data() : null;
    await renderAuthState();
    if(isApproved()){
      showToast('บัญชีได้รับอนุมัติแล้ว');
      stopApprovalWatcher();
    }
  }, (e)=>{
    console.warn('Approval watcher error', e);
  });

  approvalPollTimer = setInterval(async ()=>{
    if(currentUser && !isApproved()){
      try{
        await refreshCurrentUserDoc();
        await renderAuthState();
        if(isApproved()){
          showToast('บัญชีได้รับอนุมัติแล้ว');
          stopApprovalWatcher();
        }
      }catch(e){}
    }
  }, 5000);
}

async function renderAuthState(){ 
  const approved = isApproved();
  const finderBtn = $('finderBtn');

  if(!currentUser){
    showLoginGate(true);
    showPendingGate(false);
    setAppAccessLock(true);

    if($('authPill')) $('authPill').textContent = 'ยังไม่ได้เข้าสู่ระบบ';
    if($('loginBtn')) $('loginBtn').style.display = 'inline-flex';
    if($('logoutBtn')) $('logoutBtn').style.display = 'none';
    if($('adminLink')) $('adminLink').style.display = 'none';
    if(finderBtn) finderBtn.style.display = 'none';

    showPending(false);
    await renderHistory();
    return;
  }

  if(!approved){
    updatePendingGateUser();
    showLoginGate(false);
    showPendingGate(true);
    setAppAccessLock(true);

    if($('authPill')) $('authPill').textContent = `${currentUser.email || currentUser.displayName || 'Signed in'} • รออนุมัติ`;
    if($('loginBtn')) $('loginBtn').style.display = 'none';
    if($('logoutBtn')) $('logoutBtn').style.display = 'inline-flex';
    if($('adminLink')) $('adminLink').style.display = isAdmin() ? 'inline-flex' : 'none';
    if(finderBtn) finderBtn.style.display = 'none';

    showPending(true);
    await renderHistory();
    return;
  }

  showLoginGate(false);
  showPendingGate(false);
  setAppAccessLock(false);

  if($('authPill')) $('authPill').textContent = currentUser.email || currentUser.displayName || 'Signed in';
  if($('loginBtn')) $('loginBtn').style.display = 'none';
  if($('logoutBtn')) $('logoutBtn').style.display = 'inline-flex';
  if($('adminLink')) $('adminLink').style.display = isAdmin() ? 'inline-flex' : 'none';
  if(finderBtn) finderBtn.style.display = 'inline-flex';

  showPending(false);
  await renderHistory();
}

async function savePromptHistoryRecord(d,result){ const character = buildCharacterFactoryProfile(d); const ref=await addDoc(collection(db,'promptHistory'),{ uid:currentUser.uid,email:currentUser.email||'',product:d.product,location:d.location,view:d.view,gemMode:d.gemMode,providerMode:d.providerMode,voiceType:d.voiceType,viralTone:d.viralTone,sceneCount:d.sceneCount,duration:d.duration,characterFactorySummary: character.enabled ? character.summary : '',imagePrompt:result.image_prompt,videoPrompt:result.video_prompt,captionHashtags:result.caption_hashtags,createdAt:serverTimestamp() }); return ref.id; }

function sanitizePolicyStructuredPrompt(text = '') {
  return String(text || '')
    .split(/(\n?SCENE_\d+_(?:IMAGE|VIDEO)_PROMPT:\n?)/gi)
    .map(part => {
      if (/SCENE_\d+_(?:IMAGE|VIDEO)_PROMPT:/i.test(part)) return part;
      return sanitizePolicyText(part);
    })
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function generatePrompts(){ showError(''); if(!currentUser) return showToast('กรุณาเข้าสู่ระบบก่อน'); if(!isApproved()) return showToast('บัญชียังไม่ได้รับอนุมัติจากแอดมิน'); const raw=getFormData(); const d=getPreparedFormData(raw); d.characterSessionId = generateCharacterSessionId(); const err=validateForm(d); if(err) return showToast(err); const character = buildCharacterFactoryProfile(d); try{ setLoading(true); updateGeminiNativeModeStatus('⚡ Gemini / OpenAI PRO MAX • กำลังสร้าง Final Prompt'); 
const result = await callSelectedProvider(d);

// ห้าม sanitize ก่อน parse / overlay / DNA เพราะจะทำให้ Scene header เพี้ยน
result.image_prompt = applyTextOverlayToImagePrompt(result.image_prompt || '', d);
result.image_prompt = injectDNAIntoStructuredPrompt(result.image_prompt, 'image', d, character);

result.video_prompt = injectDNAIntoStructuredPrompt(result.video_prompt || '', 'video', d, character);

// sanitize หลังสุดแบบรักษา Scene header
result.image_prompt = sanitizePolicyStructuredPrompt(result.image_prompt);
result.video_prompt = sanitizePolicyStructuredPrompt(result.video_prompt);
result.caption_hashtags = sanitizePolicyText(result.caption_hashtags || '');

      if($('imagePrompt')) $('imagePrompt').value=result.image_prompt; if($('videoPrompt')) $('videoPrompt').value=result.video_prompt; if($('captionPrompt')) $('captionPrompt').value=result.caption_hashtags; renderSceneWorkspace(d.sceneCount, result.image_prompt, result.video_prompt); if($('resultsWrap')) $('resultsWrap').style.display='grid'; if($('emptyState')) $('emptyState').style.display='none'; if($('captionCard')) $('captionCard').style.display=''; if($('statusPill')) $('statusPill').textContent='Done'; updateGeminiNativeModeStatus('⚡ Gemini / OpenAI PRO MAX • สร้าง Final Prompt สำเร็จแล้ว'); currentHistoryId=await savePromptHistoryRecord(d,result); resetPromptEditors(); await renderHistory(); showToast(character.enabled ? `สร้าง Final Prompt สำเร็จ • ล็อคตัวละคร ${character.shortName}` : 'สร้าง Final Prompt สำเร็จ'); }catch(e){ if($('statusPill')) $('statusPill').textContent='Error'; updateGeminiNativeModeStatus('⚡ Gemini / OpenAI PRO MAX • เกิดข้อผิดพลาด'); updateGeminiKeyStatus(`เกิดข้อผิดพลาด • ${e.message}`); showError(e.message); showToast(e.message); }finally{ setLoading(false); } }
async function copyBlock(id,btn){ const text=$(id)?.value||''; if(!text.trim()) return showToast('ยังไม่มีข้อความให้คัดลอก'); await navigator.clipboard.writeText(text); const old=btn.textContent; btn.textContent='✔ คัดลอกแล้ว'; btn.classList.remove('btn-dark'); btn.classList.add('btn-green'); setTimeout(()=>{btn.textContent=old; btn.classList.remove('btn-green'); btn.classList.add('btn-dark');},1200); }
function escapeHtml(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function renderHistoryList(items){
  const wrap=$('historyList');
  if(!wrap) return;
  if(!items.length){
    wrap.innerHTML='<div class="history-item"><div class="meta">ยังไม่มีประวัติ prompt</div></div>';
    return;
  }
  wrap.innerHTML=items.map(item=>{
    const d=item.createdAt?.toDate?item.createdAt.toDate():null;
    const when=d?d.toLocaleString('th-TH'):'ล่าสุด';
    return `<div class="history-item">
      <h4>${escapeHtml(item.product||'Untitled')}</h4>
      <div class="meta">${when} • ${escapeHtml(item.location||'-')} • ${item.sceneCount||1} scene • ${item.duration||10}s • ${escapeHtml(getModeSource().getGemModeConfig(item.gemMode||'signboard').label)} • ${escapeHtml(item.providerMode||'gemini')}</div>
      <div class="preview"><strong>IMAGE:</strong> ${escapeHtml(item.imagePrompt||'')}</div>
      <div class="preview" style="margin-top:8px"><strong>VDO:</strong> ${escapeHtml(item.videoPrompt||'')}</div>
      <div class="preview" style="margin-top:8px"><strong>CAPTION:</strong> ${escapeHtml(item.captionHashtags||'')}</div>
      ${item.characterFactorySummary ? `<div class=\"preview\" style=\"margin-top:8px\"><strong>CHARACTER:</strong> ${escapeHtml(item.characterFactorySummary)}</div>` : ''}
      <div class="row" style="margin-top:10px">
        <button class="btn btn-dark use-history-btn" data-id="${item.id}" style="padding:10px 12px">ใช้ต่อ</button>
        <button class="btn btn-red delete-history-btn" data-id="${item.id}" style="padding:10px 12px">ลบ</button>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.use-history-btn').forEach(btn=>btn.addEventListener('click',()=>useHistoryItem(btn.dataset.id)));
  wrap.querySelectorAll('.delete-history-btn').forEach(btn=>btn.addEventListener('click',()=>deleteHistoryItem(btn.dataset.id)));
}
async function useHistoryItem(id){
  try{
    const snap = await getDoc(doc(db,'promptHistory',id));
    if(!snap.exists()) return showToast('ไม่พบรายการประวัติ');
    const item = snap.data();
    if($('product')) $('product').value=item.product||'';
    if($('location')) $('location').value=item.location||'';
    if($('view')) $('view').value=item.view||'';
    if($('gemMode')) $('gemMode').value=item.gemMode||getModeSource().autoDetectGemMode(item.product||'');
    if($('providerMode')) $('providerMode').value=item.providerMode||'gemini';
    if($('voiceType')) $('voiceType').value=item.voiceType||'หญิง';
    applyGemMode($('gemMode')?.value || 'signboard', { selectedTone: item.viralTone || '', skipSave: true });
    if($('sceneCount')) $('sceneCount').value=String(item.sceneCount||1);
    if($('duration')) $('duration').value=String(item.duration||10);
    if($('imagePrompt')) $('imagePrompt').value=item.imagePrompt||'';
    if($('videoPrompt')) $('videoPrompt').value=item.videoPrompt||'';
    if($('captionPrompt')) $('captionPrompt').value=item.captionHashtags||'';
    renderSceneWorkspace(item.sceneCount||1, item.imagePrompt||'', item.videoPrompt||'');
    if($('resultsWrap')) $('resultsWrap').style.display='grid';
    if($('emptyState')) $('emptyState').style.display='none';
    if($('captionCard')) $('captionCard').style.display='';
    currentHistoryId = id;
    saveAndRefresh();
    resetPromptEditors();
    showToast('ดึง Prompt History มาใช้ต่อแล้ว');
  }catch(e){ showToast(`ดึงประวัติไม่สำเร็จ: ${e.message}`); }
}
async function deleteHistoryItem(id){
  try{
    await updateDoc(doc(db,'promptHistory',id),{deletedAt:serverTimestamp()});
    // soft delete not supported by rules? fallback: hide from list by clearing owner? not good
  }catch(e){}
  try{
    const ref=doc(db,'promptHistory',id);
    await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js').then(async m=>{ await m.deleteDoc(ref); });
    if(currentHistoryId===id) currentHistoryId=null;
    await renderHistory();
    showToast('ลบ Prompt History แล้ว');
  }catch(e){ showToast(`ลบไม่สำเร็จ: ${e.message}`); }
}
async function clearHistoryItems(){
  try{
    const ref=collection(db,'promptHistory');
    const snap=await getDocs(query(ref,where('uid','==',currentUser.uid),orderBy('createdAt','desc'),limit(50)));
    const mod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    await Promise.all(snap.docs.map(d=>mod.deleteDoc(d.ref)));
    currentHistoryId=null;
    await renderHistory();
    showToast('ล้าง Prompt History แล้ว');
  }catch(e){ showToast(`ล้างประวัติไม่สำเร็จ: ${e.message}`); }
}
async function renderHistory(){
  try{
    const ref=collection(db,'promptHistory');
    const qy=currentUser?query(ref,where('uid','==',currentUser.uid),orderBy('createdAt','desc'),limit(10)):query(ref,limit(0));
    const snap=await getDocs(qy);
    renderHistoryList(snap.docs.map(d=>({id:d.id,...d.data()})));
  }catch(e){
    if($('historyList')) $('historyList').innerHTML=`<div class="history-item"><div class="meta">โหลดประวัติไม่สำเร็จ: ${escapeHtml(e.message)}</div></div>`;
  }
}
function bindEvents(){ safeBind('deleteModal','click',(e)=>{
  if(e.target?.id === 'deleteModal') closeDeleteModal();
}); safeBind('togglePrivateKeysBtn','click',()=>togglePrivateKeysPanel()); safeBind('loginGateBtn','click',signInGoogle); safeBind('closeDeleteBtn','click',closeDeleteModal); safeBind('cancelDeleteBtn','click',closeDeleteModal); safeBind('confirmDeleteBtn','click',deleteKeyNow); safeBind('toggleEyeBtn','click',toggleGeminiKeyVisibility); safeBind('toggleOpenAIEyeBtn','click',toggleOpenAIKeyVisibility); safeBind('connectOpenAIKeyBtn','click',connectOpenAIKey); safeBind('testOpenAIKeyBtn','click',testOpenAIKey); safeBind('deleteOpenAIKeyBtn','click',promptDeleteOpenAIKey); safeBind('connectKeyBtn','click',connectGeminiKey); safeBind('testKeyBtn','click',testGeminiKey); safeBind('deleteKeyBtn','click',promptDeleteGeminiKey); safeBind('loginBtn','click',signInGoogle); safeBind('logoutBtn','click',()=>signOut(auth)); safeBind('pendingBackToLoginBtn','click', async ()=>{ try{ await signOut(auth); }catch(e){ showToast('ออกจากระบบไม่สำเร็จ'); } }); safeBind('generateBtn','click',generatePrompts); safeBind('copyImageBtn','click',()=>copyBlock('imagePrompt',$('copyImageBtn'))); safeBind('copyVideoBtn','click',()=>copyBlock('videoPrompt',$('copyVideoBtn'))); safeBind('copyCaptionBtn','click',()=>copyBlock('captionPrompt',$('copyCaptionBtn'))); safeBind('editImageBtn','click',()=>togglePromptEdit('image')); safeBind('saveImageBtn','click',()=>savePromptEdit('image')); safeBind('editVideoBtn','click',()=>togglePromptEdit('video')); safeBind('saveVideoBtn','click',()=>savePromptEdit('video')); safeBind('editCaptionBtn','click',()=>togglePromptEdit('caption')); safeBind('saveCaptionBtn','click',()=>savePromptEdit('caption')); safeBind('refreshHistoryBtn','click',renderHistory); safeBind('clearHistoryBtn','click',clearHistoryItems); safeBind('clearBtn','click',clearForm); safeBind('exampleTissueBtn','click',()=>loadExample(0)); safeBind('exampleBatteryBtn','click',()=>loadExample(1)); safeBind('exampleChairBtn','click',()=>loadExample(2)); 
safeBind('promptStrategy','change',()=>{
  localStorage.setItem(LS_PROMPT_STRATEGY, $('promptStrategy')?.value || 'viral');

  const currentMode = $('gemMode')?.value || 'signboard';
  populateGemModeOptions(currentMode);

  const nextMode = $('gemMode')?.value || currentMode;
  populateViralToneOptions(nextMode, $('viralTone')?.value || '');
  updateExampleButtons(nextMode);

  saveAndRefresh();
});

safeBind('gemMode','change',()=>{
  const modeId = $('gemMode')?.value || 'signboard';
  applyGemMode(modeId, { toast: true });
});
safeBind('textOverlayEnabled','change',()=>{ updateOverlayBodies(); updateOverlayPreview(); saveAndRefresh(); }); safeBind('h2OverlayEnabled','change',()=>{ updateOverlayBodies(); updateOverlayPreview(); saveAndRefresh(); }); ['textOverlayStyle','textOverlayScene','textOverlayHook','textOverlayPosition','textOverlaySize','h2OverlayStyle','h2OverlayScene','h2OverlayHook'].forEach(id=>{ safeBind(id,'input',()=>{ updateOverlayPreview(); saveAndRefresh(); }); safeBind(id,'change',()=>{ updateOverlayPreview(); saveAndRefresh(); }); }); safeBind('sceneCount','change',()=>{ populateOverlaySceneOptions(); updateOverlayPreview(); saveAndRefresh(); }); safeBind('gemMode','change',()=>{ const modeId = $('gemMode')?.value || 'signboard'; applyGemMode(modeId, { toast: true }); populateTextStyleOptions(); populateH2StyleOptions(); updateOverlayPreview(); }); safeBind('product','blur',maybeAutoDetectGemMode); safeBind('product','change',maybeAutoDetectGemMode); ['product','location','view','promptStrategy','gemMode','providerMode','voiceType','viralTone','sceneCount','duration'].forEach(id=>{ safeBind(id,'input',saveAndRefresh); safeBind(id,'change',saveAndRefresh); }); }

function rebindOpenAIButtons(){
  const connectBtn = $('connectOpenAIKeyBtn');
  if (connectBtn) connectBtn.onclick = connectOpenAIKey;

  const testBtn = $('testOpenAIKeyBtn');
  if (testBtn) testBtn.onclick = testOpenAIKey;

  const deleteBtn = $('deleteOpenAIKeyBtn');
  if (deleteBtn) deleteBtn.onclick = promptDeleteOpenAIKey;

  const eyeBtn = $('toggleOpenAIEyeBtn');
  if (eyeBtn) {
    eyeBtn.onclick = null;
    eyeBtn.addEventListener('click', toggleOpenAIKeyVisibility);
  }
}

async function init(){
  if($('promptStrategy')) $('promptStrategy').value = localStorage.getItem(LS_PROMPT_STRATEGY) || 'viral';
  populateGemModeOptions('signboard');
  bindEvents();
  rebindOpenAIButtons();
  loadForm();
  populateGemModeOptions($('gemMode')?.value || 'signboard');
  applyGemMode(($('gemMode')?.value || 'signboard'), { keepTone: true, skipSave: true });
  populateTextStyleOptions();
  populateH2StyleOptions();
  populateOverlaySceneOptions();
  updateOverlayBodies();
  updateOverlayPreview();
  updateSummary();
  resetPromptEditors();
  togglePrivateKeysPanel(false);
  setAppAccessLock(true);
  showLoginGate(true);
  showPendingGate(false);

  const savedKey=getUserApiKey();
  if(savedKey&&$('userApiKey')){ $('userApiKey').value=savedKey; updateGeminiKeyStatus('พบ API Key ที่บันทึกไว้ในเครื่องนี้ • พร้อมใช้งาน', true); }
  else { updateGeminiKeyStatus('ยังไม่ได้เชื่อมต่อ Gemini API Key • ระบบจะเก็บ Key ใน localStorage ของเครื่องนี้เท่านั้น', false); }

  const savedOpenAIKey=getOpenAIKey();
  if(savedOpenAIKey&&$('userOpenAIKey')){ $('userOpenAIKey').value=savedOpenAIKey; updateOpenAIKeyStatus('พบ OpenAI API Key ที่บันทึกไว้ในเครื่องนี้ • พร้อมใช้งาน', true); }
  else { updateOpenAIKeyStatus('ยังไม่ได้เชื่อมต่อ OpenAI API Key • ระบบจะเก็บ Key ใน localStorage ของเครื่องนี้เท่านั้น', false); }
  try { await getRedirectResult(auth); } catch(e) { console.warn('Google redirect result skipped:', e); }

  onAuthStateChanged(auth, async (user)=>{
    stopApprovalWatcher();
    currentUser=user;
    userDocCache=null;
    currentHistoryId=null;
    showError('');
    try{
      if(user){
        await upsertCurrentUser(user);
        if(!isApproved()) startApprovalWatcher();
      }
    }catch(e){
      showError('Sync user ไม่สำเร็จ: ' + e.message);
    }
    await renderAuthState();
  });
}
document.addEventListener('DOMContentLoaded', init);
