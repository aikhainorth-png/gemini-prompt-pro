import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js';
import { firebaseConfig, functionsRegion } from './firebase-config.js';
import { GEM_MODES, getGemModeConfig, getGemModeOptions, autoDetectGemMode, pickRandomFrom, getTextStyleOptions, getTextStyleById, getRecommendedTextStyle, getRecommendedH2Style, buildAutoHookText, buildAutoH2Text } from './gem-modes.js';

const LS_FORM = 'GEMINI_FINAL_PROMPT_PRO_FORM_V2';
const LS_KEY = 'userGeminiApiKey';
const DEFAULT_MODEL = 'gemini-2.5-flash';

const $ = (id) => document.getElementById(id);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, functionsRegion || 'us-central1');
const provider = new GoogleAuthProvider();

let currentUser = null;
let currentClaims = {};
let userDocCache = null;
let currentHistoryId = null;

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function setLoading(isLoading) {
  $('loadingOverlay').classList.toggle('show', isLoading);
  $('generateBtn').disabled = isLoading;
  $('statusPill').textContent = isLoading ? 'Loading' : 'Ready';
}

function showError(message = '') {
  const el = $('errorBanner');
  el.textContent = message;
  el.classList.toggle('show', !!message);
}

function showPending(show) {
  $('pendingBanner').classList.toggle('show', !!show);
}

function saveUserApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem(LS_KEY, key.trim());
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

function getUserApiKey() {
  return localStorage.getItem(LS_KEY) || '';
}

function getActiveApiKey() {
  return getUserApiKey();
}

function updateGeminiKeyStatus(message, isConnected = false) {
  const el = $('geminiKeyStatus');
  el.textContent = message;
  el.style.color = isConnected ? '#9ed2ff' : '#97a2c4';
}

function updateGeminiNativeModeStatus(message) {
  $('geminiNativeStatus').textContent = message;
}

function toggleGeminiApiPanel(forceOpen) {
  const body = $('apiPanelBody');
  const btn = $('toggleApiBtn');
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : body.style.display === 'none';
  body.style.display = shouldOpen ? 'block' : 'none';
  btn.textContent = shouldOpen ? '▲' : '▼';
}

function toggleGeminiKeyVisibility() {
  const input = $('userApiKey');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function connectGeminiKey() {
  const key = ($('userApiKey').value || '').trim();
  if (!key) {
    updateGeminiKeyStatus('กรุณาวาง Gemini API Key ก่อนเชื่อมต่อ', false);
    showToast('กรุณาวาง Gemini API Key ก่อน');
    return;
  }
  saveUserApiKey(key);
  updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • ใช้ Key ส่วนตัวแล้ว');
  updateGeminiKeyStatus('เชื่อมต่อ Key เรียบร้อย • ระบบจะใช้ Key นี้ในการเรียก Gemini', true);
  showToast('เชื่อมต่อ Gemini API Key แล้ว');
}

async function testGeminiKey() {
  const key = ($('userApiKey').value || '').trim();
  if (!key) {
    updateGeminiKeyStatus('กรุณาวาง Gemini API Key ก่อนทดสอบ', false);
    showToast('ยังไม่มี Gemini API Key');
    return;
  }
  updateGeminiKeyStatus('กำลังทดสอบ Gemini API Key...', false);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Gemini API Error ${response.status}`);
    saveUserApiKey(key);
    updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • ทดสอบ Key ผ่านแล้ว');
    updateGeminiKeyStatus('ทดสอบ Key สำเร็จ • พร้อมใช้งานกับ Gemini Native Full-Engine Mode', true);
    showToast('ทดสอบ Gemini API Key สำเร็จ');
  } catch (error) {
    updateGeminiKeyStatus(`ทดสอบ Key ไม่ผ่าน • ${error.message}`, false);
    showToast('ทดสอบ Key ไม่ผ่าน');
  }
}

function promptDeleteGeminiKey() {
  const hasKey = !!getUserApiKey();
  if (!hasKey) {
    updateGeminiKeyStatus('ยังไม่มี Key ให้ลบ', false);
    showToast('ยังไม่มี Key ให้ลบ');
    return;
  }
  const ok = window.confirm('ยืนยันการลบ Gemini API Key ที่เก็บในเครื่องนี้?');
  if (!ok) return;
  saveUserApiKey('');
  $('userApiKey').value = '';
  updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode พร้อมใช้งาน');
  updateGeminiKeyStatus('ลบ Gemini API Key แล้ว • ระบบจะรอให้ใส่ Key ใหม่', false);
  showToast('ลบ Gemini API Key แล้ว');
}

function getFormData() {
  return {
    product: $('product').value.trim(),
    location: $('location').value.trim(),
    view: $('view').value.trim(),
    gemMode: $('gemMode')?.value || 'signboard',
    providerMode: $('providerMode')?.value || 'gemini',
    voiceType: $('voiceType')?.value || 'หญิง',
    viralTone: $('viralTone')?.value || 'ล้างสต๊อก',
    sceneCount: Number($('sceneCount').value || 1),
    duration: Number($('duration').value || 10),
    textOverlayEnabled: !!$('textOverlayEnabled')?.checked,
    textOverlayStyle: $('textOverlayStyle')?.value || getRecommendedTextStyle($('gemMode')?.value || 'signboard'),
    textOverlayScene: $('textOverlayScene')?.value || 'scene_1',
    textOverlayHook: $('textOverlayHook')?.value.trim() || '',
    h2OverlayEnabled: !!$('h2OverlayEnabled')?.checked,
    h2OverlayStyle: $('h2OverlayStyle')?.value || getRecommendedH2Style($('gemMode')?.value || 'signboard'),
    h2OverlayScene: $('h2OverlayScene')?.value || 'scene_1',
    h2OverlayHook: $('h2OverlayHook')?.value.trim() || ''
  };
}

function saveForm() { localStorage.setItem(LS_FORM, JSON.stringify(getFormData())); }
function loadForm() {
  const raw = localStorage.getItem(LS_FORM);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    $('product').value = data.product || '';
    $('location').value = data.location || '';
    $('view').value = data.view || '';
    if ($('gemMode')) $('gemMode').value = data.gemMode || 'signboard';
    if ($('providerMode')) $('providerMode').value = data.providerMode || 'gemini';
    if ($('voiceType')) $('voiceType').value = data.voiceType || 'หญิง';
    if ($('viralTone')) $('viralTone').value = data.viralTone || 'ล้างสต๊อก';
    $('sceneCount').value = String(data.sceneCount || 1);
    $('duration').value = String(data.duration || 10);
    if ($('textOverlayEnabled')) $('textOverlayEnabled').checked = !!data.textOverlayEnabled;
    if ($('textOverlayHook')) $('textOverlayHook').value = data.textOverlayHook || '';
    if ($('h2OverlayEnabled')) $('h2OverlayEnabled').checked = !!data.h2OverlayEnabled;
    if ($('h2OverlayHook')) $('h2OverlayHook').value = data.h2OverlayHook || '';
  } catch (error) {
    console.error('Failed to load form', error);
  }
}

function updateSceneTargetOptions(selectId, selectedValue) {
  const select = $(selectId);
  if (!select) return;
  const count = Number($('sceneCount')?.value || 1);
  const opts = [{ value: 'all', label: 'All Scene' }];
  for (let i = 1; i <= count; i++) opts.push({ value: `scene_${i}`, label: `Scene ${i}` });
  select.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  select.value = opts.some(o => o.value === selectedValue) ? selectedValue : (count > 1 ? 'all' : 'scene_1');
}

function updateTextOverlayStyleOptions() {
  const modeId = $('gemMode')?.value || 'signboard';
  const h1 = $('textOverlayStyle');
  const h2 = $('h2OverlayStyle');
  if (h1) {
    const opts = getTextStyleOptions(modeId, 'h1');
    const current = h1.value || getRecommendedTextStyle(modeId);
    h1.innerHTML = opts.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    h1.value = opts.some(o => o.id === current) ? current : getRecommendedTextStyle(modeId);
  }
  if (h2) {
    const opts = getTextStyleOptions(modeId, 'h2');
    const current = h2.value || getRecommendedH2Style(modeId);
    h2.innerHTML = opts.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    h2.value = opts.some(o => o.id === current) ? current : getRecommendedH2Style(modeId);
  }
}

function updateOverlaySections() {
  const textBody = $('textOverlayBody');
  const h2Body = $('h2OverlayBody');
  if (textBody) textBody.style.display = $('textOverlayEnabled')?.checked ? 'block' : 'none';
  if (h2Body) h2Body.style.display = $('h2OverlayEnabled')?.checked ? 'block' : 'none';
}

function refreshOverlayMenus() {
  updateSceneTargetOptions('textOverlayScene', $('textOverlayScene')?.value);
  updateSceneTargetOptions('h2OverlayScene', $('h2OverlayScene')?.value);
  updateTextOverlayStyleOptions();
  updateOverlaySections();
}

function formatPerScene(duration, sceneCount) {
  const val = duration / Math.max(sceneCount, 1);
  return Number.isInteger(val) ? `${val}s` : `${val.toFixed(1)}s`;
}

function updateSummary() {
  const data = getFormData();
  $('summaryPreview').textContent = [
    `สินค้า: ${data.product || '-'}`,
    `สถานที่: ${data.location || '-'}`,
    `มุมมองสินค้า: ${data.view || '-'}`,
    `GEM MODE: ${getGemModeConfig(data.gemMode).label}`,
    `ประเภทเสียงพากย์: ${data.voiceType || '-'}`,
    `โทนไวรัล: ${data.viralTone || '-'}`,
    `จำนวน Scene: ${data.sceneCount}`,
    `เวลาทั้งหมด: ${data.duration} วินาที`,
    `เวลาเฉลี่ยต่อ Scene: ${formatPerScene(data.duration, data.sceneCount)}`,
    `TEXT OVERLAY: ${data.textOverlayEnabled ? `${data.textOverlayStyle} @ ${data.textOverlayScene}` : 'ปิด'}`,
    `H2: ${data.h2OverlayEnabled ? `${data.h2OverlayStyle} @ ${data.h2OverlayScene}` : 'ปิด'}`
  ].join('\n');
  $('statScene').textContent = String(data.sceneCount);
  $('statDuration').textContent = `${data.duration}s`;
  $('statPerScene').textContent = formatPerScene(data.duration, data.sceneCount);
}

function saveAndRefresh() { saveForm(); updateSummary(); }

function validateForm(data) {
  if (!data.product) return 'กรุณากรอกสินค้า';
  if (!data.location) return 'กรุณากรอกสถานที่';
  if (!data.view) return 'กรุณากรอกมุมมองสินค้า';
  return '';
}

function setPromptEditing(type, editing) {
  const isImage = type === 'image';
  const textarea = $(isImage ? 'imagePrompt' : 'videoPrompt');
  const editBtn = $(isImage ? 'editImageBtn' : 'editVideoBtn');
  const saveBtn = $(isImage ? 'saveImageBtn' : 'saveVideoBtn');
  textarea.readOnly = !editing;
  textarea.classList.toggle('editing', editing);
  editBtn.textContent = editing ? (isImage ? 'ยกเลิก IMAGE' : 'ยกเลิก VDO') : (isImage ? 'แก้ไข IMAGE' : 'แก้ไข VDO');
  saveBtn.style.display = editing ? 'inline-flex' : 'none';
}

function resetPromptEditors() {
  setPromptEditing('image', false);
  setPromptEditing('video', false);
}

function togglePromptEdit(type) {
  const isImage = type === 'image';
  const textarea = $(isImage ? 'imagePrompt' : 'videoPrompt');
  const editing = textarea.readOnly;
  if (!textarea.value.trim()) {
    showToast('ยังไม่มี prompt ให้แก้ไข');
    return;
  }
  if (!editing) {
    // cancel editing and restore current saved value by just disabling edit mode
    setPromptEditing(type, false);
    return;
  }
  setPromptEditing(type, true);
  textarea.focus();
}

async function savePromptEdit(type) {
  const isImage = type === 'image';
  const textarea = $(isImage ? 'imagePrompt' : 'videoPrompt');
  const value = (textarea.value || '').trim();
  if (!value) {
    showToast('ข้อความว่างไม่ได้');
    return;
  }
  try {
    if (currentUser && currentHistoryId) {
      await updateDoc(doc(db, 'promptHistory', currentHistoryId), isImage ? { imagePrompt: value, updatedAt: serverTimestamp() } : { videoPrompt: value, updatedAt: serverTimestamp() });
      await renderHistory();
    }
    setPromptEditing(type, false);
    showToast(isImage ? 'บันทึก IMAGE PROMPT แล้ว' : 'บันทึก VDO PROMPT แล้ว');
  } catch (error) {
    showToast(`บันทึกไม่สำเร็จ: ${error.message}`);
  }
}

function loadExample(type) {
  const examples = {
    tissue: {
      product: 'Scott Extra 6-roll tissue packs',
      location: 'ห้างสรรพสินค้าช่วงลดราคา คนเดินพลุกพล่าน',
      view: 'กองทิชชู่สูงเป็นภูเขาใหญ่กลางทางเดินห้าง ซูมป้ายเหลือง 50 บาท มีมือพนักงานแตะกองสินค้า คนเดินผ่านด้านหลังเบลอ กล้องมือถือแบบรีบๆ',
      sceneCount: 1,
      duration: 8
    },
    battery: {
      product: 'แบตเตอรี่ GS Tough สีขาวน้ำเงิน',
      location: 'ร้านแบตเตอรี่แน่นสินค้า มีถนนด้านนอกเห็นคนผ่าน',
      view: 'ช่างใส่ถุงมือยกแบตขึ้นโชว์หน้ากล้อง ซูมป้ายเหลืองลดราคา 300 บาท ฉากหลังเต็มไปด้วยแบตเรียงแน่น แสงร้านจริงคมชัด',
      sceneCount: 1,
      duration: 10
    },
    chair: {
      product: 'เก้าอี้สำนักงานสีดำพนักสูง',
      location: 'ร้านเฟอร์นิเจอร์แสงสว่างจัด เรียงสินค้าเต็มร้าน',
      view: 'เก้าอี้เรียงยาวเต็มร้าน มือคนจับเก้าอี้ตัวหน้า ซูมป้ายเหลืองลดราคา 250 บาท แพนกล้องเข้าอย่างเร็ว คนหลังฉากเบลอเล็กน้อย',
      sceneCount: 1,
      duration: 10
    }
  };
  const ex = examples[type];
  if (!ex) return;
  $('product').value = ex.product;
  $('location').value = ex.location;
  $('view').value = ex.view;
  $('sceneCount').value = String(ex.sceneCount);
  $('duration').value = String(ex.duration);
  saveAndRefresh();
  showToast('โหลดตัวอย่างแล้ว');
}

function clearForm() {
  $('product').value = '';
  $('location').value = '';
  $('view').value = '';
  $('sceneCount').value = '1';
  $('duration').value = '10';
  if ($('textOverlayEnabled')) $('textOverlayEnabled').checked = false;
  if ($('textOverlayHook')) $('textOverlayHook').value = '';
  if ($('h2OverlayEnabled')) $('h2OverlayEnabled').checked = false;
  if ($('h2OverlayHook')) $('h2OverlayHook').value = '';
  refreshOverlayMenus();
  $('imagePrompt').value = '';
  $('videoPrompt').value = '';
  $('resultsWrap').style.display = 'none';
  $('emptyState').style.display = 'flex';
  currentHistoryId = null;
  resetPromptEditors();
  saveAndRefresh();
  showToast('ล้างข้อมูลแล้ว');
}

function buildSystemInstruction() {
  return `You are a specialist prompt engineer for Thai viral product content.
Your job is to output FINAL-READY prompts only, not analysis.
Generate two polished deliverables:
1) image_prompt: a final image generation prompt for a vertical 9:16 promotional image
2) video_prompt: a final video generation prompt containing all scenes in sequence
Rules:
- Use a Thai retail viral style inspired by real smartphone UGC shopping clips.
- The output must feel like real Thai store content that stops scrolling immediately.
- For the image prompt, explicitly state that any uploaded or attached image must be used as the product reference only.
- If scene count is greater than 1, split image_prompt into clear scene blocks using these headers exactly: SCENE_1_IMAGE_PROMPT:, SCENE_2_IMAGE_PROMPT:, and so on.
- If scene count is greater than 1, split video_prompt into clear scene blocks using these headers exactly: SCENE_1_VIDEO_PROMPT:, SCENE_2_VIDEO_PROMPT:, and so on.
- Respect optional [TEXT OVERLAY] and [H2 OVERLAY] instructions when they are provided.
- Keep both prompts fully final and ready to use.`;
}

function buildUserPrompt(data) {
  const mode = getGemModeConfig(data.gemMode);
  const h1Text = data.textOverlayHook || buildAutoHookText(data.product, data.gemMode, data.viralTone);
  const h2Text = data.h2OverlayHook || buildAutoH2Text(data.product, data.gemMode);
  const h1Style = getTextStyleById(data.textOverlayStyle);
  const h2Style = getTextStyleById(data.h2OverlayStyle);
  return `GEM MODE: ${mode.label}
GEM DESCRIPTION: ${mode.description}
Create final production-ready prompts using these inputs.
Product: ${data.product}
Location: ${data.location}
View / shot direction: ${data.view}
Voiceover type: ${data.voiceType}
Viral tone: ${data.viralTone}
Scene count: ${data.sceneCount}
Total duration: ${data.duration} seconds
Average duration per scene: ${formatPerScene(data.duration, data.sceneCount)}

TEXT OVERLAY SETTINGS:
- TEXT OVERLAY enabled: ${data.textOverlayEnabled ? 'YES' : 'NO'}
- TEXT OVERLAY target: ${data.textOverlayScene}
- TEXT OVERLAY hook text: ${h1Text}
- TEXT OVERLAY style: ${h1Style.id} — ${h1Style.label}
- TEXT OVERLAY prompt: ${h1Style.prompt}

H2 OVERLAY SETTINGS:
- H2 enabled: ${data.h2OverlayEnabled ? 'YES' : 'NO'}
- H2 target: ${data.h2OverlayScene}
- H2 text: ${h2Text}
- H2 style: ${h2Style.id} — ${h2Style.label}
- H2 prompt: ${h2Style.prompt}

Requirements:
- Return one final image prompt and one final video prompt.
- The image prompt must be vertical 9:16 and clearly instruct the model to use the attached/uploaded image as the product reference only.
- If scene count is 1, return one clean image prompt paragraph.
- If scene count is greater than 1, split image_prompt into SCENE_N_IMAGE_PROMPT blocks.
- If scene count is greater than 1, split video_prompt into SCENE_N_VIDEO_PROMPT blocks.
- When TEXT OVERLAY is enabled, add a [TEXT OVERLAY] block inside the target scene image prompt(s).
- When H2 is enabled, add a [H2 OVERLAY] block inside the target scene image prompt(s).
- Final only.`;
}

function buildResponseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      image_prompt: { type: 'STRING', description: 'Single final image generation prompt ready to use.' },
      video_prompt: { type: 'STRING', description: 'Single final video generation prompt containing all scenes in one block.' }
    },
    required: ['image_prompt', 'video_prompt'],
    propertyOrdering: ['image_prompt', 'video_prompt']
  };
}

function buildOverlayBlock(kind, text, styleId, position='auto', size='auto') {
  const style = getTextStyleById(styleId);
  return `[${kind}]
text: "${text}"
style: ${style.id} — ${style.label}
style_prompt: ${style.prompt.replace('[HOOK TEXT]', text)}
position: ${position}
size: ${size}`;
}

function shouldApplyScene(target, sceneNo){
  return target === 'all' || target === `scene_${sceneNo}`;
}

function injectOverlayIntoSceneBlock(block, sceneNo, data){
  let out = block.trim();
  const h1Text = data.textOverlayHook || buildAutoHookText(data.product, data.gemMode, data.viralTone);
  const h2Text = data.h2OverlayHook || buildAutoH2Text(data.product, data.gemMode);
  if (data.textOverlayEnabled && shouldApplyScene(data.textOverlayScene, sceneNo)) {
    out += `

${buildOverlayBlock('TEXT OVERLAY', h1Text, data.textOverlayStyle)}`;
  }
  if (data.h2OverlayEnabled && shouldApplyScene(data.h2OverlayScene, sceneNo)) {
    out += `

${buildOverlayBlock('H2 OVERLAY', h2Text, data.h2OverlayStyle)}`;
  }
  return out;
}

function applyOverlayToImagePrompt(imagePrompt, data) {
  const src = String(imagePrompt || '').trim();
  if (!src) return src;
  const sceneCount = Number(data.sceneCount || 1);
  if (sceneCount <= 1) {
    return injectOverlayIntoSceneBlock(src, 1, { ...data, textOverlayScene: data.textOverlayScene === 'all' ? 'scene_1' : data.textOverlayScene, h2OverlayScene: data.h2OverlayScene === 'all' ? 'scene_1' : data.h2OverlayScene });
  }
  const sceneRegex = /SCENE_(\d+)_IMAGE_PROMPT\s*:\s*([\s\S]*?)(?=SCENE_\d+_IMAGE_PROMPT\s*:|$)/gi;
  let matched = false;
  const rebuilt = src.replace(sceneRegex, (_, num, body) => {
    matched = true;
    const n = Number(num);
    return `SCENE_${n}_IMAGE_PROMPT: ${injectOverlayIntoSceneBlock(body, n, data)}`;
  }).trim();
  if (matched) return rebuilt;
  const parts = [];
  for (let i = 1; i <= sceneCount; i++) parts.push(`SCENE_${i}_IMAGE_PROMPT: ${injectOverlayIntoSceneBlock(src, i, data)}`);
  return parts.join('\n\n');
}

async function callGeminiNative(data) {
  const apiKey = getActiveApiKey();
  if (!apiKey) throw new Error('ยังไม่มี Gemini API Key กรุณาวาง Key แล้วกดเชื่อมต่อก่อน');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(data) }] }],
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema()
    }
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(raw?.error?.message || `Gemini API Error ${response.status}`);
  const text = raw?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini ไม่ได้ส่งข้อความกลับมา');
  let parsed;
  try { parsed = JSON.parse(text); }
  catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('ไม่สามารถแปลงผลลัพธ์เป็น JSON ได้');
    parsed = JSON.parse(jsonMatch[0]);
  }
  return {
    image_prompt: String(parsed.image_prompt || '').trim(),
    video_prompt: String(parsed.video_prompt || '').trim()
  };
}

async function signInGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    showError(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
    showToast('เข้าสู่ระบบไม่สำเร็จ');
  }
}

async function syncCurrentUser() {
  if (!currentUser) return;
  const syncUser = httpsCallable(functions, 'syncUser');
  await syncUser();
  const tokenResult = await currentUser.getIdTokenResult(true);
  currentClaims = tokenResult.claims || {};
  const userRef = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(userRef);
  userDocCache = snap.exists() ? snap.data() : null;
}

function isApproved() {
  return !!(currentClaims.approved || userDocCache?.approved);
}
function isAdmin() {
  return !!(currentClaims.admin || userDocCache?.role === 'admin');
}

async function renderAuthState() {
  if (!currentUser) {
    $('authPill').textContent = 'ยังไม่ได้เข้าสู่ระบบ';
    $('loginBtn').style.display = 'inline-flex';
    $('logoutBtn').style.display = 'none';
    showPending(false);
    $('adminPanel').classList.remove('show');
    await renderHistory();
    return;
  }
  $('authPill').textContent = `${currentUser.email || currentUser.displayName || 'Signed in'}`;
  $('loginBtn').style.display = 'none';
  $('logoutBtn').style.display = 'inline-flex';
  showPending(!isApproved());
  $('adminPanel').classList.toggle('show', isAdmin());
  if (isAdmin()) await renderAdminUsers();
  await renderHistory();
}

async function savePromptHistoryRecord(data, result) {
  const ref = await addDoc(collection(db, 'promptHistory'), {
    uid: currentUser.uid,
    email: currentUser.email || '',
    product: data.product,
    location: data.location,
    view: data.view,
    sceneCount: data.sceneCount,
    duration: data.duration,
    imagePrompt: result.image_prompt,
    videoPrompt: result.video_prompt,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

async function generatePrompts() {
  showError('');
  if (!currentUser) {
    showToast('กรุณาเข้าสู่ระบบก่อน');
    return;
  }
  if (!isApproved()) {
    showToast('บัญชียังไม่ได้รับอนุมัติจากแอดมิน');
    return;
  }
  const data = getFormData();
  const validationError = validateForm(data);
  if (validationError) { showToast(validationError); return; }
  try {
    setLoading(true);
    updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • กำลังสร้าง Final Prompt');
    const result = await callGeminiNative(data);
    result.image_prompt = applyOverlayToImagePrompt(result.image_prompt, data);
    $('imagePrompt').value = result.image_prompt;
    $('videoPrompt').value = result.video_prompt;
    $('resultsWrap').style.display = 'grid';
    $('emptyState').style.display = 'none';
    $('statusPill').textContent = 'Done';
    updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • สร้าง Final Prompt สำเร็จแล้ว');
    currentHistoryId = await savePromptHistoryRecord(data, result);
    resetPromptEditors();
    await renderHistory();
    showToast('สร้าง Final Prompt สำเร็จ');
  } catch (error) {
    $('statusPill').textContent = 'Error';
    updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • เกิดข้อผิดพลาด');
    updateGeminiKeyStatus(`เกิดข้อผิดพลาด • ${error.message}`, false);
    showError(error.message);
    showToast(error.message);
    console.error(error);
  } finally {
    setLoading(false);
  }
}

async function copyBlock(id, btn) {
  const text = $(id).value || '';
  if (!text.trim()) return showToast('ยังไม่มีข้อความให้คัดลอก');
  await navigator.clipboard.writeText(text);
  const old = btn.textContent;
  btn.textContent = 'คัดลอกแล้ว';
  setTimeout(() => { btn.textContent = old; }, 1200);
}

function renderHistoryList(items) {
  const wrap = $('historyList');
  if (!items.length) {
    wrap.innerHTML = '<div class="history-item"><div class="meta">ยังไม่มีประวัติ prompt</div></div>';
    return;
  }
  wrap.innerHTML = items.map((item) => {
    const d = item.createdAt?.toDate ? item.createdAt.toDate() : null;
    const when = d ? d.toLocaleString('th-TH') : 'ล่าสุด';
    return `
      <div class="history-item">
        <h4>${escapeHtml(item.product || 'Untitled')}</h4>
        <div class="meta">${when} • ${escapeHtml(item.location || '-')} • ${item.sceneCount || 1} scene • ${item.duration || 10}s</div>
        <div class="preview">${escapeHtml(item.imagePrompt || '')}</div>
      </div>`;
  }).join('');
}

async function renderHistory() {
  try {
    const ref = collection(db, 'promptHistory');
    const qy = currentUser
      ? query(ref, where('uid', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(10))
      : query(ref, limit(0));
    const snap = await getDocs(qy);
    renderHistoryList(snap.docs.map((d) => d.data()));
  } catch (error) {
    $('historyList').innerHTML = `<div class="history-item"><div class="meta">โหลดประวัติไม่สำเร็จ: ${escapeHtml(error.message)}</div></div>`;
  }
}

async function renderAdminUsers() {
  if (!isAdmin()) return;
  const wrap = $('adminUsers');
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!items.length) {
      wrap.innerHTML = '<div class="admin-user"><div class="meta">ยังไม่มี user</div></div>';
      return;
    }
    wrap.innerHTML = items.map((u) => {
      const createdAt = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleString('th-TH') : '-';
      return `
        <div class="admin-user">
          <div>
            <div style="font-weight:800">${escapeHtml(u.displayName || '-')}${u.role === 'admin' ? ' • ADMIN' : ''}</div>
            <div class="meta">${escapeHtml(u.email || '')}<br>approved: ${u.approved ? 'yes' : 'no'}<br>created: ${createdAt}</div>
          </div>
          <div class="row" style="max-width:270px">
            <button class="btn btn-green approve-btn" data-uid="${u.id}" ${u.approved ? 'disabled' : ''}>อนุมัติ</button>
            <button class="btn btn-red revoke-btn" data-uid="${u.id}">ยกเลิก</button>
          </div>
        </div>`;
    }).join('');

    wrap.querySelectorAll('.approve-btn').forEach((btn) => btn.addEventListener('click', () => updateUserApproval(btn.dataset.uid, true)));
    wrap.querySelectorAll('.revoke-btn').forEach((btn) => btn.addEventListener('click', () => updateUserApproval(btn.dataset.uid, false)));
  } catch (error) {
    wrap.innerHTML = `<div class="admin-user"><div class="meta">โหลดรายชื่อไม่สำเร็จ: ${escapeHtml(error.message)}</div></div>`;
  }
}

async function updateUserApproval(uid, approved) {
  try {
    const callable = httpsCallable(functions, 'setUserApproval');
    await callable({ uid, approved });
    showToast(approved ? 'อนุมัติผู้ใช้แล้ว' : 'ยกเลิกสิทธิ์แล้ว');
    await renderAdminUsers();
  } catch (error) {
    showToast(error.message || 'อัปเดตสิทธิ์ไม่สำเร็จ');
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function bindEvents() {
  $('toggleApiBtn').addEventListener('click', () => toggleGeminiApiPanel());
  $('toggleEyeBtn').addEventListener('click', toggleGeminiKeyVisibility);
  $('connectKeyBtn').addEventListener('click', connectGeminiKey);
  $('testKeyBtn').addEventListener('click', testGeminiKey);
  $('deleteKeyBtn').addEventListener('click', promptDeleteGeminiKey);
  $('loginBtn').addEventListener('click', signInGoogle);
  $('logoutBtn').addEventListener('click', () => signOut(auth));
  $('generateBtn').addEventListener('click', generatePrompts);
  $('copyImageBtn').addEventListener('click', () => copyBlock('imagePrompt', $('copyImageBtn')));
  $('copyVideoBtn').addEventListener('click', () => copyBlock('videoPrompt', $('copyVideoBtn')));
  $('editImageBtn').addEventListener('click', () => togglePromptEdit('image'));
  $('saveImageBtn').addEventListener('click', () => savePromptEdit('image'));
  $('editVideoBtn').addEventListener('click', () => togglePromptEdit('video'));
  $('saveVideoBtn').addEventListener('click', () => savePromptEdit('video'));
  $('refreshHistoryBtn').addEventListener('click', renderHistory);
  $('refreshAdminBtn').addEventListener('click', renderAdminUsers);
  $('clearBtn').addEventListener('click', clearForm);
  $('exampleTissueBtn').addEventListener('click', () => loadExample('tissue'));
  $('exampleBatteryBtn').addEventListener('click', () => loadExample('battery'));
  $('exampleChairBtn').addEventListener('click', () => loadExample('chair'));
  if ($('gemMode')) $('gemMode').addEventListener('change', () => { updateTextOverlayStyleOptions(); saveAndRefresh(); });
  if ($('textOverlayEnabled')) $('textOverlayEnabled').addEventListener('change', () => { updateOverlaySections(); saveAndRefresh(); });
  if ($('h2OverlayEnabled')) $('h2OverlayEnabled').addEventListener('change', () => { updateOverlaySections(); saveAndRefresh(); });
  ['product', 'location', 'view', 'sceneCount', 'duration', 'gemMode', 'providerMode', 'voiceType', 'viralTone', 'textOverlayStyle', 'textOverlayScene', 'textOverlayHook', 'h2OverlayStyle', 'h2OverlayScene', 'h2OverlayHook'].forEach((id) => {
    const el = $(id); if (!el) return;
    el.addEventListener('input', () => { if (id === 'sceneCount') refreshOverlayMenus(); saveAndRefresh(); });
    el.addEventListener('change', () => { if (id === 'sceneCount') refreshOverlayMenus(); saveAndRefresh(); });
  });
}

async function init() {
  bindEvents();
  loadForm();
  populateGemModeOptions($('gemMode')?.value || 'signboard');
  updateTextOverlayStyleOptions();
  refreshOverlayMenus();
  updateSummary();
  resetPromptEditors();
  toggleGeminiApiPanel(true);
  const savedKey = getUserApiKey();
  if (savedKey) {
    $('userApiKey').value = savedKey;
    updateGeminiKeyStatus('พบ API Key ที่บันทึกไว้ในเครื่องนี้ • พร้อมใช้งาน', true);
  } else {
    updateGeminiKeyStatus('ยังไม่ได้เชื่อมต่อ Gemini API Key • ระบบจะเก็บ Key ใน localStorage ของเครื่องนี้เท่านั้น', false);
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    userDocCache = null;
    currentClaims = {};
    if (!user) currentHistoryId = null;
    showError('');
    try {
      if (user) {
        await syncCurrentUser();
      }
    } catch (error) {
      showError(`Sync user ไม่สำเร็จ: ${error.message}`);
    }
    await renderAuthState();
  });
}

init();
