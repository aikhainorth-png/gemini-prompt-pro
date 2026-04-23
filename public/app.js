import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import * as ViralModes from './gem-modes.js';
import * as ConversionModes from './gem-modes-conversion.js';
import * as HybridModes from './gem-modes-hybrid.js';
import { buildCharacterFactoryProfile } from './character-factory.js';
import { callAI } from './providers.js';

const ADMIN_EMAILS = ['aikhainorth@gmail.com'];
const LS_FORM = 'GEMINI_FINAL_PROMPT_PRO_FORM_SPARK_V1';
const LS_KEY = 'userGeminiApiKey';
const LS_OPENAI_KEY = 'userOpenAIApiKey';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const LS_PROMPT_STRATEGY = 'GEMINI_FINAL_PROMPT_PRO_PROMPT_STRATEGY_V1';
const LS_TEXT_OVERLAY = 'GEMINI_FINAL_PROMPT_PRO_TEXT_OVERLAY_V1';
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

function hasAdminEmail(email=''){ return ADMIN_EMAILS.includes(String(email).toLowerCase()); }

function getModeSource(){
  const strategy = $('promptStrategy')?.value || localStorage.getItem(LS_PROMPT_STRATEGY) || 'viral';
  if (strategy === 'conversion') return ConversionModes;
  if (strategy === 'hybrid') return HybridModes;
  return ViralModes;
}
function getCurrentStrategy(){
  return $('promptStrategy')?.value || localStorage.getItem(LS_PROMPT_STRATEGY) || 'viral';
}

function isMobileLike(){
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) || window.innerWidth <= 1024;
}

function safeBind(id, ev, fn){ const el=$(id); if(el) el.addEventListener(ev, fn); }
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
function getFormData(){ return { product:$('product')?.value.trim()||'', location:$('location')?.value.trim()||'', view:$('view')?.value.trim()||'', promptStrategy:$('promptStrategy')?.value||localStorage.getItem(LS_PROMPT_STRATEGY)||'viral', gemMode:$('gemMode')?.value||'signboard', providerMode:$('providerMode')?.value||'gemini', voiceType:$('voiceType')?.value||'หญิง', viralTone:$('viralTone')?.value||'ล้างสต๊อก', sceneCount:Number($('sceneCount')?.value||1), duration:Number($('duration')?.value||10), textOverlayEnabled: !!$('textOverlayEnabled')?.checked, textStyleId: $('textStyleId')?.value||'auto', overlayHookText: ($('overlayHookText')?.value||'').trim(), overlaySceneTarget: $('overlaySceneTarget')?.value||'all', overlayPosition: $('overlayPosition')?.value||'top', overlaySize: $('overlaySize')?.value||'large' }; }
function saveForm(){ const data = getFormData(); localStorage.setItem(LS_FORM, JSON.stringify(data)); localStorage.setItem(LS_PROMPT_STRATEGY, data.promptStrategy || 'viral'); }
function loadForm(){ const raw=localStorage.getItem(LS_FORM); if(!raw) return; try{ const d=JSON.parse(raw); if($('product')) $('product').value=d.product||''; if($('location')) $('location').value=d.location||''; if($('view')) $('view').value=d.view||''; if($('promptStrategy')) $('promptStrategy').value=d.promptStrategy || localStorage.getItem(LS_PROMPT_STRATEGY) || 'viral'; if($('gemMode')) $('gemMode').value=d.gemMode||'signboard'; if($('providerMode')) $('providerMode').value=d.providerMode||'gemini'; if($('voiceType')) $('voiceType').value=d.voiceType||'หญิง'; if($('viralTone')) $('viralTone').value=d.viralTone||'ล้างสต๊อก'; if($('sceneCount')) $('sceneCount').value=String(d.sceneCount||1); if($('duration')) $('duration').value=String(d.duration||10); if($('textOverlayEnabled')) $('textOverlayEnabled').checked=!!d.textOverlayEnabled; if($('textStyleId')) $('textStyleId').value=d.textStyleId||'auto'; if($('overlayHookText')) $('overlayHookText').value=d.overlayHookText||''; if($('overlaySceneTarget')) $('overlaySceneTarget').value=d.overlaySceneTarget||'all'; if($('overlayPosition')) $('overlayPosition').value=d.overlayPosition||'top'; if($('overlaySize')) $('overlaySize').value=d.overlaySize||'large'; }catch{} }

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


function populateTextStyleOptions(modeId, selected='auto'){
  const select = $('textStyleId');
  if(!select) return;
  const source = getModeSource();
  const options = source.getTextStyleOptions ? source.getTextStyleOptions() : [];
  const recommendedIds = source.getRecommendedTextStyleIdsForMode ? source.getRecommendedTextStyleIdsForMode(modeId) : [];
  const recommendedSet = new Set(recommendedIds);
  select.innerHTML = [`<option value="auto">Auto (แนะนำตามหมวด)</option>`].concat(options.map(opt => `<option value="${opt.id}">${recommendedSet.has(opt.id)?'⭐ ':''}${opt.label}</option>`)).join('');
  select.value = options.some(o=>o.id===selected) || selected==='auto' ? selected : 'auto';
}

function populateOverlaySceneOptions(){
  const select = $('overlaySceneTarget');
  if(!select) return;
  const count = Number($('sceneCount')?.value || 1);
  const current = select.value || 'all';
  const opts = [{value:'all',label:'All Scene'}];
  for(let i=1;i<=count;i++) opts.push({value:`scene_${i}`,label:`Scene ${i}`});
  select.innerHTML = opts.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
  select.value = opts.some(o=>o.value===current) ? current : (count > 1 ? 'scene_1' : 'all');
}

function toggleTextOverlayUI(){
  const enabled = !!$('textOverlayEnabled')?.checked;
  if($('textOverlayBody')) $('textOverlayBody').style.display = enabled ? 'block' : 'none';
  updateTextOverlayPreview();
}

function getEffectiveTextStyleConfig(data = getFormData()){
  const source = getModeSource();
  if(data.textStyleId && data.textStyleId !== 'auto' && source.getTextStyleById){
    return source.getTextStyleById(data.textStyleId);
  }
  if(source.getDefaultTextStyleForMode){
    return source.getDefaultTextStyleForMode(data.gemMode);
  }
  return null;
}

function getEffectiveOverlayHookText(data = getFormData()){
  if(data.overlayHookText) return data.overlayHookText;
  const source = getModeSource();
  if(source.generateTextOverlayHook){
    return source.generateTextOverlayHook({ modeId:data.gemMode, viralTone:data.viralTone, productName:data.product });
  }
  return data.viralTone || data.product || 'โปรแรงห้ามเลื่อน';
}

function updateTextOverlayPreview(){
  const preview = $('textOverlayPreview');
  if(!preview) return;
  const data = getFormData();
  if(!data.textOverlayEnabled){ preview.innerHTML = '<div class="muted">ปิดอยู่</div>'; return; }
  const style = getEffectiveTextStyleConfig(data);
  const hook = getEffectiveOverlayHookText(data);
  const label = style ? `${style.code} — ${style.label}` : 'Auto';
  const position = data.overlayPosition || 'top';
  const size = data.overlaySize || 'large';
  preview.innerHTML = `<div style="font-weight:800;font-size:${size==='small'?'18px':size==='medium'?'22px':size==='xl'?'34px':'28px'};line-height:1.2;">${hook}</div><div class="muted" style="margin-top:8px">${label} • ${position} • ${data.overlaySceneTarget}</div>`;
}

function buildTextOverlayBlock(data = getFormData()){
  if(!data.textOverlayEnabled) return '';
  const style = getEffectiveTextStyleConfig(data);
  if(!style) return '';
  const hook = getEffectiveOverlayHookText(data);
  const position = data.overlayPosition || 'top';
  const sizeMap = { small:'small', medium:'medium', large:'large', xl:'extra large viral' };
  return `\n\n[TEXT OVERLAY]\nUse Thai overlay text on the ${position} area of the image, size ${sizeMap[data.overlaySize] || 'large'}.\n${style.prompt.replace('[HOOK TEXT]', hook)}\n`;
}

function injectTextOverlayIntoImagePrompt(imagePrompt='', data = getFormData()){
  const block = buildTextOverlayBlock(data);
  if(!block) return imagePrompt;
  const target = data.overlaySceneTarget || 'all';
  const text = String(imagePrompt || '').trim();
  if(!text) return text;
  const count = Number(data.sceneCount || 1);
  if(count <= 1 || target === 'all') return `${text}${block}`;
  const m = target.match(/scene_(\d+)/);
  const sceneNo = m ? Number(m[1]) : 1;
  const marker = new RegExp(`(SCENE[_\s]*${sceneNo}[_\s]*(?:IMAGE[_\s]*PROMPT|IMAGE)\s*:\s*)([\s\S]*?)(?=(?:SCENE[_\s]*${sceneNo+1}[_\s]*(?:IMAGE[_\s]*PROMPT|IMAGE)\s*:)|$)`, 'i');
  if(marker.test(text)){
    return text.replace(marker, (full, head, body)=> `${head}${body.trim()}${block}\n`);
  }
  return `${text}\n\nApply the following text overlay to Scene ${sceneNo} only:${block}`;
}

function updateTextOverlayDefaultsFromMode(modeId, forceAuto=false){
  populateTextStyleOptions(modeId, $('textStyleId')?.value || 'auto');
  if(forceAuto && $('textStyleId')) $('textStyleId').value = 'auto';
  updateTextOverlayPreview();
}

function formatPerScene(duration,sceneCount){ const v=duration/Math.max(sceneCount,1); return Number.isInteger(v)?`${v}s`:`${v.toFixed(1)}s`; }
function updateSummary(){ const d=getFormData(); if($('summaryPreview')) $('summaryPreview').textContent=[`สินค้า: ${d.product||'-'}`,`สถานที่: ${d.location||'-'}`,`มุมมองสินค้า: ${d.view||'-'}`,`GEM MODE: ${getModeSource().getGemModeConfig(d.gemMode).label}`,`AI Provider: ${d.providerMode||'gemini'}`,`ประเภทเสียงพากย์: ${d.voiceType||'-'}`,`โทนไวรัล: ${d.viralTone||'-'}`,`จำนวน Scene: ${d.sceneCount}`,`เวลาทั้งหมด: ${d.duration} วินาที`,`เวลาเฉลี่ยต่อ Scene: ${formatPerScene(d.duration,d.sceneCount)}`, `TEXT OVERLAY: ${d.textOverlayEnabled ? ('เปิดใช้งาน • ' + (getEffectiveTextStyleConfig(d)?.code || 'AUTO') + ' • ' + (d.overlaySceneTarget || 'all')) : 'ปิดอยู่'}`].join('\n'); if($('statScene')) $('statScene').textContent=String(d.sceneCount); if($('statDuration')) $('statDuration').textContent=`${d.duration}s`; if($('statPerScene')) $('statPerScene').textContent=formatPerScene(d.duration,d.sceneCount); }
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
    voiceType: ['แม่และเด็ก','ชุดชั้นใน','เครื่องสำอาง','ครีมบำรุงผิว','แฟชั่น'].some(word => mode.label.includes(word)) ? 'หญิง' : (($('voiceType')?.value) || 'หญิง'),
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

function clearForm(){ ['product','location','view'].forEach(id=>{if($(id)) $(id).value='';}); if($('promptStrategy')) $('promptStrategy').value='viral'; localStorage.setItem(LS_PROMPT_STRATEGY,'viral'); populateGemModeOptions('signboard'); if($('gemMode')) $('gemMode').value='signboard'; if($('providerMode')) $('providerMode').value='gemini'; if($('voiceType')) $('voiceType').value='หญิง'; populateViralToneOptions('signboard','ล้างสต๊อก'); if($('sceneCount')) $('sceneCount').value='1'; if($('duration')) $('duration').value='10'; if($('textOverlayEnabled')) $('textOverlayEnabled').checked=false; if($('textStyleId')) $('textStyleId').value='auto'; if($('overlayHookText')) $('overlayHookText').value=''; if($('overlayPosition')) $('overlayPosition').value='top'; if($('overlaySize')) $('overlaySize').value='large'; if($('imagePrompt')) $('imagePrompt').value=''; if($('videoPrompt')) $('videoPrompt').value=''; if($('captionPrompt')) $('captionPrompt').value=''; if($('resultsWrap')) $('resultsWrap').style.display='none'; if($('emptyState')) $('emptyState').style.display='flex'; currentHistoryId=null; resetPromptEditors(); saveAndRefresh(); showToast('ล้างข้อมูลแล้ว'); }
function buildSystemInstruction(d = getPreparedFormData(getFormData())){
  const gem = getModeSource().getGemModeConfig(d.gemMode);
  const character = buildCharacterFactoryProfile(d);
  const characterInstruction = character.enabled ? `

CHARACTER FACTORY PRO MAX ACTIVE:
${character.profileBlock}

${character.dnaBlock}

${character.lockBlock}` : '';
  return `${gem.systemPrompt}${characterInstruction}

GLOBAL OUTPUT RULES:
- Return FINAL-READY prompts only, not analysis.
- Generate two polished deliverables:
1) image_prompt: a single final image generation prompt for a vertical 9:16 promotional image
2) video_prompt: a single final video generation prompt containing all scenes in sequence
- For the image prompt, explicitly state that any uploaded or attached image must be used as the product reference only.
- No subtitles in video prompt.
- If people appear, avoid clear faces; prefer hands, arms, backs, or blurred passersby.
- VOICEOVER PRO MAX: every scene in the video prompt must contain Thai voiceover dialogue.
- Every scene must include exact Thai spoken lines ready for narration or lip-sync.
- The selected voice type controls narrator gender.
- The selected viral tone controls urgency, emotion, and selling pressure.
- No silent scenes.
- Keep both prompts fully final and ready to use.`;
}
function buildUserPrompt(d){
  const gem = getModeSource().getGemModeConfig(d.gemMode);
  const character = buildCharacterFactoryProfile(d);
  const randomNote = d.randomizedFields?.length ? `\nAUTO RANDOM FILLED: ${d.randomizedFields.join(', ')}` : '';
  const characterNote = character.enabled ? `\n\nCHARACTER FACTORY PRO MAX:\n${character.profileBlock}\n\n${character.dnaBlock}\n\n${character.lockBlock}` : '';
  return `GEM MODE: ${gem.label}
GEM DESCRIPTION: ${gem.description}${randomNote}${characterNote}

Create final production-ready prompts using these inputs.
Product: ${d.product}
Location: ${d.location}
View / shot direction: ${d.view}
Voiceover type: ${d.voiceType}
Viral tone: ${d.viralTone}
Scene count: ${d.sceneCount}
Total duration: ${d.duration} seconds
Average duration per scene: ${formatPerScene(d.duration,d.sceneCount)}${d.textOverlayEnabled ? `\nTEXT OVERLAY ENABLED: yes\nPreferred text hook: ${getEffectiveOverlayHookText(d)}\nPreferred text style: ${(getEffectiveTextStyleConfig(d)?.code || 'AUTO')} ${(getEffectiveTextStyleConfig(d)?.label || '')}\nOverlay target: ${d.overlaySceneTarget}\nOverlay position: ${d.overlayPosition}\nOverlay size: ${d.overlaySize}` : ''}\n\nRequirements:
- Return one final image prompt and one final video prompt.
- The image prompt must clearly instruct the model to use the attached/uploaded image as the product reference only.
- The video prompt must include Scene 1 to Scene ${d.sceneCount} in sequence.
- Every scene must include Thai voiceover dialogue, not just visual direction.
- Narration gender must follow the selected voice type: ${d.voiceType}.
- The selling psychology and urgency must follow the selected viral tone: ${d.viralTone}.
- Add exact spoken Thai lines for every scene, ready for voiceover or lip-sync.
- Follow the selected GEM MODE creative strategy closely.
- If scene count is greater than 1 and CHARACTER FACTORY PRO MAX is active, embed the locked character profile and continuity lock into the resulting prompts so the same character appears in every scene.
- For multi-scene outputs, keep the same main character identity across all scenes with no redesign or reinterpretation.
- Also return caption_hashtags: one Thai caption line plus exactly 5 hashtags, where 3 hashtags are product-related and 2 hashtags are trending Thai commerce/social hashtags.
- Final only.\n- If text overlay is enabled, keep space in the composition for overlay text on the requested target scene without blocking the product.`;
}
function buildResponseSchema(){ return {type:'OBJECT',properties:{image_prompt:{type:'STRING'},video_prompt:{type:'STRING'},caption_hashtags:{type:'STRING'}},required:['image_prompt','video_prompt','caption_hashtags'],propertyOrdering:['image_prompt','video_prompt','caption_hashtags']}; }
async function callSelectedProvider(d){ return await callAI(d.providerMode, { systemPrompt: buildSystemInstruction(d), userPrompt: buildUserPrompt(d) }); }
async function upsertCurrentUser(user){ const email=String(user.email||'').toLowerCase(); const ref=doc(db,'users',user.uid); const snap=await getDoc(ref); const now=serverTimestamp(); const base={uid:user.uid,email,displayName:user.displayName||'',photoURL:user.photoURL||'',lastLoginAt:now,updatedAt:now}; if(hasAdminEmail(email)){ await setDoc(ref,{...base,createdAt:snap.exists()?snap.data().createdAt||now:now,approved:true,role:'admin',approvedAt:now},{merge:true}); } else if(!snap.exists()){ await setDoc(ref,{...base,createdAt:now,approved:false,role:'user'},{merge:true}); } else { await setDoc(ref,base,{merge:true}); } const updated=await getDoc(ref); userDocCache=updated.exists()?updated.data():null; }
function isApproved(){ return !!(userDocCache?.approved || hasAdminEmail(currentUser?.email)); }
function isAdmin(){ return !!(userDocCache?.role==='admin' || hasAdminEmail(currentUser?.email)); }
async function signInGoogle(){ try{ if(isMobileLike()){ await signInWithRedirect(auth, provider); return; } await signInWithPopup(auth, provider);}catch(e){ showError(`เข้าสู่ระบบไม่สำเร็จ: ${e.message}`); showToast('เข้าสู่ระบบไม่สำเร็จ'); } }
async function refreshCurrentUserDoc(){ if(!currentUser) return; const snap=await getDoc(doc(db,'users',currentUser.uid)); userDocCache=snap.exists()?snap.data():null; }

async function renderAuthState(){
  const approved = isApproved();

  if(!currentUser){
    showLoginGate(true);
    showPendingGate(false);
    setAppAccessLock(true);

    if($('authPill')) $('authPill').textContent = 'ยังไม่ได้เข้าสู่ระบบ';
    if($('loginBtn')) $('loginBtn').style.display = 'inline-flex';
    if($('logoutBtn')) $('logoutBtn').style.display = 'none';
    if($('adminLink')) $('adminLink').style.display = 'none';

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

  showPending(false);
  await renderHistory();
}

async function savePromptHistoryRecord(d,result){ const character = buildCharacterFactoryProfile(d); const ref=await addDoc(collection(db,'promptHistory'),{ uid:currentUser.uid,email:currentUser.email||'',product:d.product,location:d.location,view:d.view,gemMode:d.gemMode,providerMode:d.providerMode,voiceType:d.voiceType,viralTone:d.viralTone,sceneCount:d.sceneCount,duration:d.duration,characterFactorySummary: character.enabled ? character.summary : '',imagePrompt:result.image_prompt,videoPrompt:result.video_prompt,captionHashtags:result.caption_hashtags,createdAt:serverTimestamp() }); return ref.id; }
async function generatePrompts(){ showError(''); if(!currentUser) return showToast('กรุณาเข้าสู่ระบบก่อน'); if(!isApproved()) return showToast('บัญชียังไม่ได้รับอนุมัติจากแอดมิน'); const raw=getFormData(); const d=getPreparedFormData(raw); const err=validateForm(d); if(err) return showToast(err); const character = buildCharacterFactoryProfile(d); try{ setLoading(true); updateGeminiNativeModeStatus('⚡ Gemini / OpenAI PRO MAX • กำลังสร้าง Final Prompt'); const result=await callSelectedProvider(d); const finalResult = { ...result, image_prompt: injectTextOverlayIntoImagePrompt(result.image_prompt, d) }; if($('imagePrompt')) $('imagePrompt').value=finalResult.image_prompt; if($('videoPrompt')) $('videoPrompt').value=finalResult.video_prompt; if($('captionPrompt')) $('captionPrompt').value=finalResult.caption_hashtags; updateTextOverlayPreview(); if($('resultsWrap')) $('resultsWrap').style.display='grid'; if($('emptyState')) $('emptyState').style.display='none'; if($('statusPill')) $('statusPill').textContent='Done'; updateGeminiNativeModeStatus('⚡ Gemini / OpenAI PRO MAX • สร้าง Final Prompt สำเร็จแล้ว'); currentHistoryId=await savePromptHistoryRecord(d,finalResult); resetPromptEditors(); await renderHistory(); showToast(character.enabled ? `สร้าง Final Prompt สำเร็จ • ล็อคตัวละคร ${character.shortName}` : 'สร้าง Final Prompt สำเร็จ'); }catch(e){ if($('statusPill')) $('statusPill').textContent='Error'; updateGeminiNativeModeStatus('⚡ Gemini / OpenAI PRO MAX • เกิดข้อผิดพลาด'); updateGeminiKeyStatus(`เกิดข้อผิดพลาด • ${e.message}`); showError(e.message); showToast(e.message); }finally{ setLoading(false); } }
async function copyBlock(id,btn){ const text=$(id)?.value||''; if(!text.trim()) return showToast('ยังไม่มีข้อความให้คัดลอก'); await navigator.clipboard.writeText(text); const old=btn.textContent; btn.textContent='คัดลอกแล้ว'; setTimeout(()=>{btn.textContent=old;},1200); }
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
    if($('resultsWrap')) $('resultsWrap').style.display='grid';
    if($('emptyState')) $('emptyState').style.display='none';
    currentHistoryId = id;
    populateOverlaySceneOptions();
    updateTextOverlayDefaultsFromMode($('gemMode')?.value || 'signboard');
    saveAndRefresh();
    resetPromptEditors();
    updateTextOverlayPreview();
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
  updateTextOverlayDefaultsFromMode(nextMode, true);
  populateOverlaySceneOptions();
  saveAndRefresh();
});

safeBind('gemMode','change',()=>{
  const modeId = $('gemMode')?.value || 'signboard';
  applyGemMode(modeId, { toast: true });
  updateTextOverlayDefaultsFromMode(modeId, true);
});
safeBind('textOverlayEnabled','change',()=>{ toggleTextOverlayUI(); saveAndRefresh(); }); safeBind('textStyleId','change',()=>{ updateTextOverlayPreview(); saveAndRefresh(); }); safeBind('overlayHookText','input',()=>{ updateTextOverlayPreview(); saveAndRefresh(); }); safeBind('overlaySceneTarget','change',()=>{ updateTextOverlayPreview(); saveAndRefresh(); }); safeBind('overlayPosition','change',()=>{ updateTextOverlayPreview(); saveAndRefresh(); }); safeBind('overlaySize','change',()=>{ updateTextOverlayPreview(); saveAndRefresh(); }); safeBind('sceneCount','change',()=>{ populateOverlaySceneOptions(); updateTextOverlayPreview(); saveAndRefresh(); }); safeBind('product','blur',maybeAutoDetectGemMode); safeBind('product','change',maybeAutoDetectGemMode); ['product','location','view','promptStrategy','gemMode','providerMode','voiceType','viralTone','sceneCount','duration'].forEach(id=>{ safeBind(id,'input',saveAndRefresh); safeBind(id,'change',saveAndRefresh); }); }

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

async function init(){ try{ await getRedirectResult(auth); }catch(e){} if($('promptStrategy')) $('promptStrategy').value = localStorage.getItem(LS_PROMPT_STRATEGY) || 'viral'; populateGemModeOptions('signboard'); bindEvents(); rebindOpenAIButtons(); loadForm(); populateGemModeOptions($('gemMode')?.value || 'signboard'); applyGemMode(($('gemMode')?.value || 'signboard'), { keepTone: true, skipSave: true }); populateTextStyleOptions($('gemMode')?.value || 'signboard', $('textStyleId')?.value || 'auto'); populateOverlaySceneOptions(); toggleTextOverlayUI(); updateTextOverlayPreview(); updateSummary(); resetPromptEditors(); togglePrivateKeysPanel(false); setAppAccessLock(true); showLoginGate(true); showPendingGate(false); const savedKey=getUserApiKey(); if(savedKey&&$('userApiKey')){ $('userApiKey').value=savedKey; updateGeminiKeyStatus('พบ API Key ที่บันทึกไว้ในเครื่องนี้ • พร้อมใช้งาน', true); } else { updateGeminiKeyStatus('ยังไม่ได้เชื่อมต่อ Gemini API Key • ระบบจะเก็บ Key ใน localStorage ของเครื่องนี้เท่านั้น', false); } const savedOpenAIKey=getOpenAIKey(); if(savedOpenAIKey&&$('userOpenAIKey')){ $('userOpenAIKey').value=savedOpenAIKey; updateOpenAIKeyStatus('พบ OpenAI API Key ที่บันทึกไว้ในเครื่องนี้ • พร้อมใช้งาน', true); } else { updateOpenAIKeyStatus('ยังไม่ได้เชื่อมต่อ OpenAI API Key • ระบบจะเก็บ Key ใน localStorage ของเครื่องนี้เท่านั้น', false); } onAuthStateChanged(auth, async (user)=>{ currentUser=user; userDocCache=null; currentHistoryId=null; showError(''); try{ if(user) await upsertCurrentUser(user); }catch(e){ showError(`Sync user ไม่สำเร็จ: ${e.message}`); } await renderAuthState(); }); setInterval(async ()=>{ if(currentUser && !isApproved()){ try{ await refreshCurrentUserDoc(); if(isApproved()){ await renderAuthState(); showToast('บัญชีได้รับอนุมัติแล้ว'); } }catch(e){} } }, 5000); }
document.addEventListener('DOMContentLoaded', init);
