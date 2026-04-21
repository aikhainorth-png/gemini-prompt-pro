import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, addDoc, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { GEM_MODES, getGemModeConfig, getGemModeOptions } from './gem-modes.js';

const ADMIN_EMAILS = ['aikhainorth@gmail.com'];
const LS_FORM = 'GEMINI_FINAL_PROMPT_PRO_FORM_SPARK_V1';
const LS_KEY = 'userGeminiApiKey';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const $ = (id) => document.getElementById(id);
const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch {}
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let userDocCache = null;
let currentHistoryId = null;

function hasAdminEmail(email=''){ return ADMIN_EMAILS.includes(String(email).toLowerCase()); }
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
function updateGeminiKeyStatus(message,isConnected=false){ const el=$('geminiKeyStatus'); if(!el) return; el.textContent=message; el.style.color=isConnected?'#9ed2ff':'#97a2c4'; }
function updateGeminiNativeModeStatus(message){ const el=$('geminiNativeStatus'); if(el) el.textContent=message; }
function toggleGeminiApiPanel(forceOpen){ const body=$('apiPanelBody'); const btn=$('toggleApiBtn'); if(!body||!btn) return; const open=typeof forceOpen==='boolean'?forceOpen:body.style.display==='none'; body.style.display=open?'block':'none'; btn.textContent=open?'▲':'▼'; }
function toggleGeminiKeyVisibility(){ const input=$('userApiKey'); if(input) input.type=input.type==='password'?'text':'password'; }
function connectGeminiKey(){ const key=($('userApiKey')?.value||'').trim(); if(!key){ updateGeminiKeyStatus('กรุณาวาง Gemini API Key ก่อนเชื่อมต่อ'); return showToast('กรุณาวาง Gemini API Key ก่อน'); } saveUserApiKey(key); updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • ใช้ Key ส่วนตัวแล้ว'); updateGeminiKeyStatus('เชื่อมต่อ Key เรียบร้อย • ระบบจะใช้ Key นี้ในการเรียก Gemini', true); showToast('เชื่อมต่อ Gemini API Key แล้ว'); }
async function testGeminiKey(){ const key=($('userApiKey')?.value||'').trim(); if(!key){ updateGeminiKeyStatus('กรุณาวาง Gemini API Key ก่อนทดสอบ'); return showToast('ยังไม่มี Gemini API Key'); } updateGeminiKeyStatus('กำลังทดสอบ Gemini API Key...'); try{ const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d?.error?.message||`Gemini API Error ${r.status}`); saveUserApiKey(key); updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • ทดสอบ Key ผ่านแล้ว'); updateGeminiKeyStatus('ทดสอบ Key สำเร็จ • พร้อมใช้งาน', true); showToast('ทดสอบ Gemini API Key สำเร็จ'); }catch(e){ updateGeminiKeyStatus(`ทดสอบ Key ไม่ผ่าน • ${e.message}`); showToast('ทดสอบ Key ไม่ผ่าน'); } }
function promptDeleteGeminiKey(){
 if(!getUserApiKey()) return showToast('ยังไม่มี Key ให้ลบ');
 $('deleteModal').classList.add('show');
}

function closeDeleteModal(){
 $('deleteModal').classList.remove('show');
}

function deleteKeyNow(){
 saveUserApiKey('');
 if($('userApiKey')) $('userApiKey').value='';
 updateGeminiKeyStatus('ลบ Gemini API Key แล้ว');
 closeDeleteModal();
 showToast('ลบ Key แล้ว');
}
function getFormData(){ return { product:$('product')?.value.trim()||'', location:$('location')?.value.trim()||'', view:$('view')?.value.trim()||'', gemMode:$('gemMode')?.value||'signboard', voiceType:$('voiceType')?.value||'หญิง', viralTone:$('viralTone')?.value||'ล้างสต๊อก', sceneCount:Number($('sceneCount')?.value||1), duration:Number($('duration')?.value||10) }; }
function saveForm(){ localStorage.setItem(LS_FORM, JSON.stringify(getFormData())); }
function loadForm(){ const raw=localStorage.getItem(LS_FORM); if(!raw) return; try{ const d=JSON.parse(raw); if($('product')) $('product').value=d.product||''; if($('location')) $('location').value=d.location||''; if($('view')) $('view').value=d.view||''; if($('gemMode')) $('gemMode').value=d.gemMode||'signboard'; if($('voiceType')) $('voiceType').value=d.voiceType||'หญิง'; if($('viralTone')) $('viralTone').value=d.viralTone||'ล้างสต๊อก'; if($('sceneCount')) $('sceneCount').value=String(d.sceneCount||1); if($('duration')) $('duration').value=String(d.duration||10); }catch{} }
function formatPerScene(duration,sceneCount){ const v=duration/Math.max(sceneCount,1); return Number.isInteger(v)?`${v}s`:`${v.toFixed(1)}s`; }
function updateSummary(){ const d=getFormData(); if($('summaryPreview')) $('summaryPreview').textContent=[`สินค้า: ${d.product||'-'}`,`สถานที่: ${d.location||'-'}`,`มุมมองสินค้า: ${d.view||'-'}`,`GEM MODE: ${getGemModeConfig(d.gemMode).label}`,`ประเภทเสียงพากย์: ${d.voiceType||'-'}`,`โทนไวรัล: ${d.viralTone||'-'}`,`จำนวน Scene: ${d.sceneCount}`,`เวลาทั้งหมด: ${d.duration} วินาที`,`เวลาเฉลี่ยต่อ Scene: ${formatPerScene(d.duration,d.sceneCount)}`].join('\n'); if($('statScene')) $('statScene').textContent=String(d.sceneCount); if($('statDuration')) $('statDuration').textContent=`${d.duration}s`; if($('statPerScene')) $('statPerScene').textContent=formatPerScene(d.duration,d.sceneCount); }
function saveAndRefresh(){ saveForm(); updateSummary(); }
function validateForm(d){ if(!d.product) return 'กรุณากรอกสินค้า'; if(!d.location) return 'กรุณากรอกสถานที่'; if(!d.view) return 'กรุณากรอกมุมมองสินค้า'; return ''; }
function getPromptElementIds(type){ if(type==='image') return {textarea:'imagePrompt',editBtn:'editImageBtn',saveBtn:'saveImageBtn',editText:'IMAGE'}; if(type==='video') return {textarea:'videoPrompt',editBtn:'editVideoBtn',saveBtn:'saveVideoBtn',editText:'VDO'}; return {textarea:'captionPrompt',editBtn:'editCaptionBtn',saveBtn:'saveCaptionBtn',editText:'CAPTION'}; }
function setPromptEditing(type, editing){ const ids=getPromptElementIds(type); const textarea=$(ids.textarea); const editBtn=$(ids.editBtn); const saveBtn=$(ids.saveBtn); if(!textarea||!editBtn||!saveBtn) return; textarea.readOnly=!editing; textarea.classList.toggle('editing', editing); editBtn.textContent=editing?`ยกเลิก ${ids.editText}`:`แก้ไข ${ids.editText}`; saveBtn.style.display=editing?'inline-flex':'none'; }
function resetPromptEditors(){ setPromptEditing('image',false); setPromptEditing('video',false); setPromptEditing('caption',false); }
function togglePromptEdit(type){ const ids=getPromptElementIds(type); const textarea=$(ids.textarea); if(!textarea||!textarea.value.trim()) return showToast('ยังไม่มี prompt ให้แก้ไข'); if(!textarea.readOnly) return setPromptEditing(type,false); setPromptEditing(type,true); textarea.focus(); }
async function savePromptEdit(type){ const ids=getPromptElementIds(type); const textarea=$(ids.textarea); const value=(textarea?.value||'').trim(); if(!value) return showToast('ข้อความว่างไม่ได้'); try{ if(currentUser && currentHistoryId){ const payload = type==='image'?{imagePrompt:value,updatedAt:serverTimestamp()}: type==='video'?{videoPrompt:value,updatedAt:serverTimestamp()}:{captionHashtags:value,updatedAt:serverTimestamp()}; await updateDoc(doc(db,'promptHistory',currentHistoryId), payload); await renderHistory(); } setPromptEditing(type,false); showToast(`บันทึก ${ids.editText} แล้ว`); }catch(e){ showToast(`บันทึกไม่สำเร็จ: ${e.message}`); } }
function loadExample(type){ const exs={ tissue:{product:'Scott Extra 6-roll tissue packs',location:'ห้างสรรพสินค้าช่วงลดราคา คนเดินพลุกพล่าน',view:'กองทิชชู่สูงเป็นภูเขาใหญ่กลางทางเดินห้าง ซูมป้ายเหลือง 50 บาท มีมือพนักงานแตะกองสินค้า คนเดินผ่านด้านหลังเบลอ กล้องมือถือแบบรีบๆ',gemMode:'signboard',voiceType:'หญิง',viralTone:'คนรุมซื้อ',sceneCount:1,duration:8}, battery:{product:'แบตเตอรี่ GS Tough สีขาวน้ำเงิน',location:'ร้านแบตเตอรี่แน่นสินค้า มีถนนด้านนอกเห็นคนผ่าน',view:'ช่างใส่ถุงมือยกแบตขึ้นโชว์หน้ากล้อง ซูมป้ายเหลืองลดราคา 300 บาท ฉากหลังเต็มไปด้วยแบตเรียงแน่น แสงร้านจริงคมชัด',gemMode:'signboard',voiceType:'ชาย',viralTone:'ของใกล้หมด',sceneCount:1,duration:10}, chair:{product:'เก้าอี้สำนักงานสีดำพนักสูง',location:'ร้านเฟอร์นิเจอร์แสงสว่างจัด เรียงสินค้าเต็มร้าน',view:'เก้าอี้เรียงยาวเต็มร้าน มือคนจับเก้าอี้ตัวหน้า ซูมป้ายเหลืองลดราคา 250 บาท แพนกล้องเข้าอย่างเร็ว คนหลังฉากเบลอเล็กน้อย',gemMode:'signboard',voiceType:'หญิง',viralTone:'ล้างสต๊อก',sceneCount:1,duration:10}}; const ex=exs[type]; if(!ex) return; if($('product')) $('product').value=ex.product; if($('location')) $('location').value=ex.location; if($('view')) $('view').value=ex.view; if($('gemMode')) $('gemMode').value=ex.gemMode||'signboard'; if($('voiceType')) $('voiceType').value=ex.voiceType||'หญิง'; if($('viralTone')) $('viralTone').value=ex.viralTone||'ล้างสต๊อก'; if($('sceneCount')) $('sceneCount').value=String(ex.sceneCount); if($('duration')) $('duration').value=String(ex.duration); saveAndRefresh(); showToast('โหลดตัวอย่างแล้ว'); }
function clearForm(){ ['product','location','view'].forEach(id=>{if($(id)) $(id).value='';}); if($('gemMode')) $('gemMode').value='signboard'; if($('voiceType')) $('voiceType').value='หญิง'; if($('viralTone')) $('viralTone').value='ล้างสต๊อก'; if($('sceneCount')) $('sceneCount').value='1'; if($('duration')) $('duration').value='10'; if($('imagePrompt')) $('imagePrompt').value=''; if($('videoPrompt')) $('videoPrompt').value=''; if($('captionPrompt')) $('captionPrompt').value=''; if($('resultsWrap')) $('resultsWrap').style.display='none'; if($('emptyState')) $('emptyState').style.display='flex'; currentHistoryId=null; resetPromptEditors(); saveAndRefresh(); showToast('ล้างข้อมูลแล้ว'); }
function buildSystemInstruction(){
  const d = getFormData();
  const gem = getGemModeConfig(d.gemMode);
  return `${gem.systemPrompt}

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
- Also generate a Thai caption block with 5 hashtags total: 3 product-related hashtags and 2 currently trending broad Thai social hashtags.
- The caption must be platform-friendly, catchy, and ready to paste after the VDO prompt.
- Keep all outputs fully final and ready to use.`;
}
function buildUserPrompt(d){
  const gem = getGemModeConfig(d.gemMode);
  return `GEM MODE: ${gem.label}
GEM DESCRIPTION: ${gem.description}

Create final production-ready prompts using these inputs.
Product: ${d.product}
Location: ${d.location}
View / shot direction: ${d.view}
Voiceover type: ${d.voiceType}
Viral tone: ${d.viralTone}
Scene count: ${d.sceneCount}
Total duration: ${d.duration} seconds
Average duration per scene: ${formatPerScene(d.duration,d.sceneCount)}

Requirements:
- Return one final image prompt and one final video prompt.
- The image prompt must clearly instruct the model to use the attached/uploaded image as the product reference only.
- The video prompt must include Scene 1 to Scene ${d.sceneCount} in sequence.
- Every scene must include Thai voiceover dialogue, not just visual direction.
- Narration gender must follow the selected voice type: ${d.voiceType}.
- The selling psychology and urgency must follow the selected viral tone: ${d.viralTone}.
- Add exact spoken Thai lines for every scene, ready for voiceover or lip-sync.
- Follow the selected GEM MODE creative strategy closely.
- Also generate caption_hashtags as one final combined block containing: 1 Thai caption + 5 hashtags total.
- Hashtag rule: exactly 3 hashtags about the product and exactly 2 hashtags that are broad/trending style tags.
- Final only.`;
}
function buildResponseSchema(){ return {type:'OBJECT',properties:{image_prompt:{type:'STRING'},video_prompt:{type:'STRING'},caption_hashtags:{type:'STRING'}},required:['image_prompt','video_prompt','caption_hashtags'],propertyOrdering:['image_prompt','video_prompt','caption_hashtags']}; }
async function callGeminiNative(d){ const apiKey=getUserApiKey(); if(!apiKey) throw new Error('ยังไม่มี Gemini API Key กรุณาวาง Key แล้วกดเชื่อมต่อก่อน'); const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`; const payload={ systemInstruction:{parts:[{text:buildSystemInstruction()}]}, contents:[{role:'user',parts:[{text:buildUserPrompt(d)}]}], generationConfig:{temperature:0.85,maxOutputTokens:4096,responseMimeType:'application/json',responseSchema:buildResponseSchema()} }; const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const raw=await res.json().catch(()=>({})); if(!res.ok) throw new Error(raw?.error?.message||`Gemini API Error ${res.status}`); const text=raw?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim(); if(!text) throw new Error('Gemini ไม่ได้ส่งข้อความกลับมา'); let parsed; try{ parsed=JSON.parse(text);}catch{ const m=text.match(/\{[\s\S]*\}/); if(!m) throw new Error('ไม่สามารถแปลงผลลัพธ์เป็น JSON ได้'); parsed=JSON.parse(m[0]); } return { image_prompt:String(parsed.image_prompt||'').trim(), video_prompt:String(parsed.video_prompt||'').trim(), caption_hashtags:String(parsed.caption_hashtags||'').trim() }; }
async function upsertCurrentUser(user){ const email=String(user.email||'').toLowerCase(); const ref=doc(db,'users',user.uid); const snap=await getDoc(ref); const now=serverTimestamp(); const base={uid:user.uid,email,displayName:user.displayName||'',photoURL:user.photoURL||'',lastLoginAt:now,updatedAt:now}; if(hasAdminEmail(email)){ await setDoc(ref,{...base,createdAt:snap.exists()?snap.data().createdAt||now:now,approved:true,role:'admin',approvedAt:now},{merge:true}); } else if(!snap.exists()){ await setDoc(ref,{...base,createdAt:now,approved:false,role:'user'},{merge:true}); } else { await setDoc(ref,base,{merge:true}); } const updated=await getDoc(ref); userDocCache=updated.exists()?updated.data():null; }
function isApproved(){ return !!(userDocCache?.approved || hasAdminEmail(currentUser?.email)); }
function isAdmin(){ return !!(userDocCache?.role==='admin' || hasAdminEmail(currentUser?.email)); }
async function signInGoogle(){ try{ await signInWithPopup(auth, provider);}catch(e){ showError(`เข้าสู่ระบบไม่สำเร็จ: ${e.message}`); showToast('เข้าสู่ระบบไม่สำเร็จ'); } }
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

async function savePromptHistoryRecord(d,result){ const ref=await addDoc(collection(db,'promptHistory'),{ uid:currentUser.uid,email:currentUser.email||'',product:d.product,location:d.location,view:d.view,gemMode:d.gemMode,voiceType:d.voiceType,viralTone:d.viralTone,sceneCount:d.sceneCount,duration:d.duration,imagePrompt:result.image_prompt,videoPrompt:result.video_prompt,captionHashtags:result.caption_hashtags,createdAt:serverTimestamp() }); return ref.id; }
async function generatePrompts(){ showError(''); if(!currentUser) return showToast('กรุณาเข้าสู่ระบบก่อน'); if(!isApproved()) return showToast('บัญชียังไม่ได้รับอนุมัติจากแอดมิน'); const d=getFormData(); const err=validateForm(d); if(err) return showToast(err); try{ setLoading(true); updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • กำลังสร้าง Final Prompt'); const result=await callGeminiNative(d); if($('imagePrompt')) $('imagePrompt').value=result.image_prompt; if($('videoPrompt')) $('videoPrompt').value=result.video_prompt; if($('captionPrompt')) $('captionPrompt').value=result.caption_hashtags; if($('resultsWrap')) $('resultsWrap').style.display='grid'; if($('emptyState')) $('emptyState').style.display='none'; if($('statusPill')) $('statusPill').textContent='Done'; updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • สร้าง Final Prompt สำเร็จแล้ว'); currentHistoryId=await savePromptHistoryRecord(d,result); resetPromptEditors(); await renderHistory(); showToast('สร้าง Final Prompt สำเร็จ'); }catch(e){ if($('statusPill')) $('statusPill').textContent='Error'; updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • เกิดข้อผิดพลาด'); updateGeminiKeyStatus(`เกิดข้อผิดพลาด • ${e.message}`); showError(e.message); showToast(e.message); }finally{ setLoading(false); } }
async function copyBlock(id,btn){ const text=$(id)?.value||''; if(!text.trim()) return showToast('ยังไม่มีข้อความให้คัดลอก'); await navigator.clipboard.writeText(text); const old=btn.textContent; btn.textContent='คัดลอกแล้ว'; setTimeout(()=>{btn.textContent=old;},1200); }
function escapeHtml(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function renderHistoryList(items){ const wrap=$('historyList'); if(!wrap) return; if(!items.length){ wrap.innerHTML='<div class="history-item"><div class="meta">ยังไม่มีประวัติ prompt</div></div>'; return; } wrap.innerHTML=items.map(item=>{ const d=item.createdAt?.toDate?item.createdAt.toDate():null; const when=d?d.toLocaleString('th-TH'):'ล่าสุด'; return `<div class="history-item"><h4>${escapeHtml(item.product||'Untitled')}</h4><div class="meta">${when} • ${escapeHtml(item.location||'-')} • ${item.sceneCount||1} scene • ${item.duration||10}s</div><div class="preview">${escapeHtml(item.imagePrompt||'')}</div></div>`; }).join(''); }
async function renderHistory(){ try{ const ref=collection(db,'promptHistory'); const qy=currentUser?query(ref,where('uid','==',currentUser.uid),orderBy('createdAt','desc'),limit(10)):query(ref,limit(0)); const snap=await getDocs(qy); renderHistoryList(snap.docs.map(d=>d.data())); }catch(e){ if($('historyList')) $('historyList').innerHTML=`<div class="history-item"><div class="meta">โหลดประวัติไม่สำเร็จ: ${escapeHtml(e.message)}</div></div>`; } }
function bindEvents(){ safeBind('deleteModal','click',(e)=>{
  if(e.target?.id === 'deleteModal') closeDeleteModal();
}); safeBind('toggleApiBtn','click',()=>toggleGeminiApiPanel()); safeBind('loginGateBtn','click',signInGoogle); safeBind('closeDeleteBtn','click',closeDeleteModal); safeBind('cancelDeleteBtn','click',closeDeleteModal); safeBind('confirmDeleteBtn','click',deleteKeyNow); safeBind('toggleEyeBtn','click',toggleGeminiKeyVisibility); safeBind('connectKeyBtn','click',connectGeminiKey); safeBind('testKeyBtn','click',testGeminiKey); safeBind('deleteKeyBtn','click',promptDeleteGeminiKey); safeBind('loginBtn','click',signInGoogle); safeBind('logoutBtn','click',()=>signOut(auth)); safeBind('pendingBackToLoginBtn','click', async ()=>{ try{ await signOut(auth); }catch(e){ showToast('ออกจากระบบไม่สำเร็จ'); } }); safeBind('generateBtn','click',generatePrompts); safeBind('copyImageBtn','click',()=>copyBlock('imagePrompt',$('copyImageBtn'))); safeBind('copyVideoBtn','click',()=>copyBlock('videoPrompt',$('copyVideoBtn'))); safeBind('copyCaptionBtn','click',()=>copyBlock('captionPrompt',$('copyCaptionBtn'))); safeBind('editImageBtn','click',()=>togglePromptEdit('image')); safeBind('saveImageBtn','click',()=>savePromptEdit('image')); safeBind('editVideoBtn','click',()=>togglePromptEdit('video')); safeBind('saveVideoBtn','click',()=>savePromptEdit('video')); safeBind('editCaptionBtn','click',()=>togglePromptEdit('caption')); safeBind('saveCaptionBtn','click',()=>savePromptEdit('caption')); safeBind('refreshHistoryBtn','click',renderHistory); safeBind('clearHistoryBtn','click',clearPromptHistory); safeBind('clearBtn','click',clearForm); safeBind('exampleTissueBtn','click',()=>loadExample('tissue')); safeBind('exampleBatteryBtn','click',()=>loadExample('battery')); safeBind('exampleChairBtn','click',()=>loadExample('chair')); ['product','location','view','gemMode','voiceType','viralTone','sceneCount','duration'].forEach(id=>{ safeBind(id,'input',saveAndRefresh); safeBind(id,'change',saveAndRefresh); }); }
async function init(){ bindEvents(); loadForm(); updateSummary(); resetPromptEditors(); toggleGeminiApiPanel(true); setAppAccessLock(true); showLoginGate(true); showPendingGate(false); const savedKey=getUserApiKey(); if(savedKey&&$('userApiKey')){ $('userApiKey').value=savedKey; updateGeminiKeyStatus('พบ API Key ที่บันทึกไว้ในเครื่องนี้ • พร้อมใช้งาน', true); } else { updateGeminiKeyStatus('ยังไม่ได้เชื่อมต่อ Gemini API Key • ระบบจะเก็บ Key ใน localStorage ของเครื่องนี้เท่านั้น', false); } onAuthStateChanged(auth, async (user)=>{ currentUser=user; userDocCache=null; currentHistoryId=null; showError(''); try{ if(user) await upsertCurrentUser(user); }catch(e){ showError(`Sync user ไม่สำเร็จ: ${e.message}`); } await renderAuthState(); }); setInterval(async ()=>{ if(currentUser && !isApproved()){ try{ await refreshCurrentUserDoc(); if(isApproved()){ await renderAuthState(); showToast('บัญชีได้รับอนุมัติแล้ว'); } }catch(e){} } }, 5000); }
init();
