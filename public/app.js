import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js';
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
import { firebaseConfig } from './firebase-config.js';

const LS_FORM = 'GEMINI_FINAL_PROMPT_PRO_FORM_SPARK_V1';
const LS_KEY = 'userGeminiApiKey';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Spark / No Functions bootstrap admins.
 * แก้เป็นอีเมลแอดมินของคุณได้หลายคน เช่น:
 * ['aikhainorth@gmail.com', 'admin2@gmail.com']
 *
 * สำคัญ:
 * - ต้องแก้รายการนี้ใน app.js และ firestore.rules ให้ตรงกัน
 * - คนในรายการนี้จะเป็น admin อัตโนมัติ
 */
const ADMIN_EMAILS = ['aikhainorth@gmail.com'];

const $ = (id) => document.getElementById(id);
const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (_) {}
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let userDocCache = null;
let currentHistoryId = null;

function el(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

function setDisplay(id, value) {
  const node = el(id);
  if (node) node.style.display = value;
}

function addClass(id, cls, enabled) {
  const node = el(id);
  if (node) node.classList.toggle(cls, !!enabled);
}

function showToast(message) {
  const toast = el('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function setLoading(isLoading) {
  addClass('loadingOverlay', 'show', isLoading);
  const generateBtn = el('generateBtn');
  if (generateBtn) generateBtn.disabled = isLoading;
  setText('statusPill', isLoading ? 'Loading' : 'Ready');
}

function showError(message = '') {
  const banner = el('errorBanner');
  if (!banner) return;
  banner.textContent = message;
  banner.classList.toggle('show', !!message);
}

function showPending(show) {
  addClass('pendingBanner', 'show', show);
}

function lowerEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isBootstrapAdmin(email = currentUser?.email) {
  return ADMIN_EMAILS.includes(lowerEmail(email));
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
  const node = el('geminiKeyStatus');
  if (!node) return;
  node.textContent = message;
  node.style.color = isConnected ? '#9ed2ff' : '#97a2c4';
}

function updateGeminiNativeModeStatus(message) {
  setText('geminiNativeStatus', message);
}

function toggleGeminiApiPanel(forceOpen) {
  const body = el('apiPanelBody');
  const btn = el('toggleApiBtn');
  if (!body || !btn) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : body.style.display === 'none';
  body.style.display = shouldOpen ? 'block' : 'none';
  btn.textContent = shouldOpen ? '▲' : '▼';
}

function toggleGeminiKeyVisibility() {
  const input = el('userApiKey');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function connectGeminiKey() {
  const key = (el('userApiKey')?.value || '').trim();
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
  const key = (el('userApiKey')?.value || '').trim();
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
  const input = el('userApiKey');
  if (input) input.value = '';
  updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode พร้อมใช้งาน');
  updateGeminiKeyStatus('ลบ Gemini API Key แล้ว • ระบบจะรอให้ใส่ Key ใหม่', false);
  showToast('ลบ Gemini API Key แล้ว');
}

function getFormData() {
  return {
    product: el('product')?.value.trim() || '',
    location: el('location')?.value.trim() || '',
    view: el('view')?.value.trim() || '',
    sceneCount: Number(el('sceneCount')?.value || 1),
    duration: Number(el('duration')?.value || 10)
  };
}

function saveForm() {
  localStorage.setItem(LS_FORM, JSON.stringify(getFormData()));
}

function loadForm() {
  const raw = localStorage.getItem(LS_FORM);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (el('product')) el('product').value = data.product || '';
    if (el('location')) el('location').value = data.location || '';
    if (el('view')) el('view').value = data.view || '';
    if (el('sceneCount')) el('sceneCount').value = String(data.sceneCount || 1);
    if (el('duration')) el('duration').value = String(data.duration || 10);
  } catch (error) {
    console.error('Failed to load form', error);
  }
}

function formatPerScene(duration, sceneCount) {
  const val = duration / Math.max(sceneCount, 1);
  return Number.isInteger(val) ? `${val}s` : `${val.toFixed(1)}s`;
}

function updateSummary() {
  const data = getFormData();
  setText('summaryPreview', [
    `สินค้า: ${data.product || '-'}`,
    `สถานที่: ${data.location || '-'}`,
    `มุมมองสินค้า: ${data.view || '-'}`,
    `จำนวน Scene: ${data.sceneCount}`,
    `เวลาทั้งหมด: ${data.duration} วินาที`,
    `เวลาเฉลี่ยต่อ Scene: ${formatPerScene(data.duration, data.sceneCount)}`
  ].join('\n'));

  setText('statScene', String(data.sceneCount));
  setText('statDuration', `${data.duration}s`);
  setText('statPerScene', formatPerScene(data.duration, data.sceneCount));
}

function saveAndRefresh() {
  saveForm();
  updateSummary();
}

function validateForm(data) {
  if (!data.product) return 'กรุณากรอกสินค้า';
  if (!data.location) return 'กรุณากรอกสถานที่';
  if (!data.view) return 'กรุณากรอกมุมมองสินค้า';
  return '';
}

function setPromptEditing(type, editing) {
  const isImage = type === 'image';
  const textarea = el(isImage ? 'imagePrompt' : 'videoPrompt');
  const editBtn = el(isImage ? 'editImageBtn' : 'editVideoBtn');
  const saveBtn = el(isImage ? 'saveImageBtn' : 'saveVideoBtn');
  if (!textarea || !editBtn || !saveBtn) return;
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
  const textarea = el(isImage ? 'imagePrompt' : 'videoPrompt');
  if (!textarea) return;
  const editing = textarea.readOnly;
  if (!textarea.value.trim()) {
    showToast('ยังไม่มี prompt ให้แก้ไข');
    return;
  }
  if (!editing) {
    setPromptEditing(type, false);
    return;
  }
  setPromptEditing(type, true);
  textarea.focus();
}

async function savePromptEdit(type) {
  const isImage = type === 'image';
  const textarea = el(isImage ? 'imagePrompt' : 'videoPrompt');
  const value = (textarea?.value || '').trim();
  if (!value) {
    showToast('ข้อความว่างไม่ได้');
    return;
  }
  try {
    if (currentUser && currentHistoryId) {
      await updateDoc(
        doc(db, 'promptHistory', currentHistoryId),
        isImage
          ? { imagePrompt: value, updatedAt: serverTimestamp() }
          : { videoPrompt: value, updatedAt: serverTimestamp() }
      );
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
  if (el('product')) el('product').value = ex.product;
  if (el('location')) el('location').value = ex.location;
  if (el('view')) el('view').value = ex.view;
  if (el('sceneCount')) el('sceneCount').value = String(ex.sceneCount);
  if (el('duration')) el('duration').value = String(ex.duration);
  saveAndRefresh();
  showToast('โหลดตัวอย่างแล้ว');
}

function clearForm() {
  if (el('product')) el('product').value = '';
  if (el('location')) el('location').value = '';
  if (el('view')) el('view').value = '';
  if (el('sceneCount')) el('sceneCount').value = '1';
  if (el('duration')) el('duration').value = '10';
  if (el('imagePrompt')) el('imagePrompt').value = '';
  if (el('videoPrompt')) el('videoPrompt').value = '';
  setDisplay('resultsWrap', 'none');
  setDisplay('emptyState', 'flex');
  currentHistoryId = null;
  resetPromptEditors();
  saveAndRefresh();
  showToast('ล้างข้อมูลแล้ว');
}

function buildSystemInstruction() {
  return `You are a specialist prompt engineer for Thai viral product content.
Your job is to output FINAL-READY prompts only, not analysis.
Generate two polished deliverables:
1) image_prompt: a single final image generation prompt for a vertical 9:16 promotional image
2) video_prompt: a single final video generation prompt containing all scenes in sequence
Rules:
- Use a Thai retail viral style inspired by real smartphone UGC shopping clips.
- The output must feel like real Thai store content that stops scrolling immediately.
- Prioritize price-shock psychology, scarcity, crowd energy, yellow price sign, raw handheld realism, and product-first framing.
- For the image prompt, explicitly state that any uploaded or attached image must be used as the product reference only. The generated product must match the attached reference image for product identity, packaging, shape, colors, and brand-facing details, while building a new environment around it.
- No subtitles in video prompt.
- If people appear, avoid clear faces; prefer hands, arms, backs, or blurred passersby.
- For video prompt, distribute time naturally across the requested scene count.
- Keep both prompts fully final and ready to use.
- Do not explain, do not use markdown fences, do not add extra keys outside schema.
- The video prompt must include all requested scenes in one cohesive block.
- The image prompt must be a single continuous final prompt paragraph.
- Use Thai voiceover lines inside the video prompt when appropriate.
- Mention a bold yellow sale sign naturally in both outputs when it fits.`;
}

function buildUserPrompt(data) {
  return `Create final production-ready prompts using these inputs.
Product: ${data.product}
Location: ${data.location}
View / shot direction: ${data.view}
Scene count: ${data.sceneCount}
Total duration: ${data.duration} seconds
Average duration per scene: ${formatPerScene(data.duration, data.sceneCount)}
Requirements:
- Return one final image prompt and one final video prompt.
- The image prompt must be vertical 9:16, highly commercial, hyper-realistic smartphone UGC style, and must clearly instruct the model to use the attached/uploaded image as the product reference only.
- The product in the image prompt must match the attached reference image for the product itself while the background, staging, mood, and retail environment can be newly designed.
- The video prompt must include Scene 1 to Scene ${data.sceneCount} in sequence, with strong Thai off-camera voiceover energy, camera movement, sound effects, and rules.
- Make the output feel like a Thai viral shopping clip or promo filmed in a real store.
- Use a strong yellow price sign with realistic Thai price wording when suitable.
- Keep it safe and platform-friendly: no extreme claims, no medical claims, no guaranteed results.
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
  try {
    parsed = JSON.parse(text);
  } catch {
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

  const email = lowerEmail(currentUser.email);
  const displayName = currentUser.displayName || '';
  const photoURL = currentUser.photoURL || '';
  const userRef = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? (snap.data() || {}) : {};
  const bootstrapAdmin = isBootstrapAdmin(email);

  const baseData = {
    email,
    displayName,
    photoURL,
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (!snap.exists()) {
    await setDoc(userRef, {
      ...baseData,
      createdAt: serverTimestamp(),
      approved: bootstrapAdmin,
      role: bootstrapAdmin ? 'admin' : 'user'
    }, { merge: true });
  } else {
    const patch = { ...baseData };
    if (bootstrapAdmin && (existing.role !== 'admin' || !existing.approved)) {
      patch.role = 'admin';
      patch.approved = true;
      patch.approvedAt = serverTimestamp();
    }
    await setDoc(userRef, patch, { merge: true });
  }

  const updated = await getDoc(userRef);
  userDocCache = updated.exists() ? updated.data() : null;
}

function isApproved() {
  return !!(isBootstrapAdmin() || userDocCache?.approved);
}

function isAdmin() {
  return !!(isBootstrapAdmin() || userDocCache?.role === 'admin');
}

async function renderAuthState() {
  if (!currentUser) {
    setText('authPill', 'ยังไม่ได้เข้าสู่ระบบ');
    setDisplay('loginBtn', 'inline-flex');
    setDisplay('logoutBtn', 'none');
    showPending(false);
    addClass('adminPanel', 'show', false);
    await renderHistory();
    return;
  }

  setText('authPill', `${currentUser.email || currentUser.displayName || 'Signed in'}`);
  setDisplay('loginBtn', 'none');
  setDisplay('logoutBtn', 'inline-flex');
  showPending(!isApproved());
  addClass('adminPanel', 'show', isAdmin());
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
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
  if (validationError) {
    showToast(validationError);
    return;
  }
  try {
    setLoading(true);
    updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • กำลังสร้าง Final Prompt');
    const result = await callGeminiNative(data);
    if (el('imagePrompt')) el('imagePrompt').value = result.image_prompt;
    if (el('videoPrompt')) el('videoPrompt').value = result.video_prompt;
    setDisplay('resultsWrap', 'grid');
    setDisplay('emptyState', 'none');
    setText('statusPill', 'Done');
    updateGeminiNativeModeStatus('⚡ Gemini Native Full-Engine Mode • สร้าง Final Prompt สำเร็จแล้ว');
    currentHistoryId = await savePromptHistoryRecord(data, result);
    resetPromptEditors();
    await renderHistory();
    showToast('สร้าง Final Prompt สำเร็จ');
  } catch (error) {
    setText('statusPill', 'Error');
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
  const text = el(id)?.value || '';
  if (!text.trim()) {
    showToast('ยังไม่มีข้อความให้คัดลอก');
    return;
  }
  await navigator.clipboard.writeText(text);
  const old = btn.textContent;
  btn.textContent = 'คัดลอกแล้ว';
  setTimeout(() => { btn.textContent = old; }, 1200);
}

function renderHistoryList(items) {
  const wrap = el('historyList');
  if (!wrap) return;
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
    const wrap = el('historyList');
    if (wrap) {
      wrap.innerHTML = `<div class="history-item"><div class="meta">โหลดประวัติไม่สำเร็จ: ${escapeHtml(error.message)}</div></div>`;
    }
  }
}

async function renderAdminUsers() {
  if (!isAdmin()) return;
  const wrap = el('adminUsers');
  if (!wrap) return;
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
            <button class="btn btn-red revoke-btn" data-uid="${u.id}" ${isBootstrapAdmin(u.email) ? 'disabled' : ''}>ยกเลิก</button>
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
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error('ไม่พบผู้ใช้');
    const current = snap.data() || {};
    const patch = {
      approved,
      updatedAt: serverTimestamp()
    };
    if (approved && !current.approved) patch.approvedAt = serverTimestamp();
    if (isBootstrapAdmin(current.email)) {
      patch.role = 'admin';
      patch.approved = true;
    } else if (!approved && current.role !== 'admin') {
      patch.role = 'user';
    }
    await updateDoc(userRef, patch);
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
  const bind = (id, event, handler) => {
    const node = el(id);
    if (node) node.addEventListener(event, handler);
  };

  bind('toggleApiBtn', 'click', () => toggleGeminiApiPanel());
  bind('toggleEyeBtn', 'click', toggleGeminiKeyVisibility);
  bind('connectKeyBtn', 'click', connectGeminiKey);
  bind('testKeyBtn', 'click', testGeminiKey);
  bind('deleteKeyBtn', 'click', promptDeleteGeminiKey);
  bind('loginBtn', 'click', signInGoogle);
  bind('logoutBtn', 'click', () => signOut(auth));
  bind('generateBtn', 'click', generatePrompts);
  bind('copyImageBtn', 'click', () => copyBlock('imagePrompt', el('copyImageBtn')));
  bind('copyVideoBtn', 'click', () => copyBlock('videoPrompt', el('copyVideoBtn')));
  bind('editImageBtn', 'click', () => togglePromptEdit('image'));
  bind('saveImageBtn', 'click', () => savePromptEdit('image'));
  bind('editVideoBtn', 'click', () => togglePromptEdit('video'));
  bind('saveVideoBtn', 'click', () => savePromptEdit('video'));
  bind('refreshHistoryBtn', 'click', renderHistory);
  bind('refreshAdminBtn', 'click', renderAdminUsers);
  bind('clearBtn', 'click', clearForm);
  bind('exampleTissueBtn', 'click', () => loadExample('tissue'));
  bind('exampleBatteryBtn', 'click', () => loadExample('battery'));
  bind('exampleChairBtn', 'click', () => loadExample('chair'));

  ['product', 'location', 'view', 'sceneCount', 'duration'].forEach((id) => {
    bind(id, 'input', saveAndRefresh);
    bind(id, 'change', saveAndRefresh);
  });
}

async function init() {
  bindEvents();
  loadForm();
  updateSummary();
  resetPromptEditors();
  toggleGeminiApiPanel(true);

  const savedKey = getUserApiKey();
  if (savedKey) {
    if (el('userApiKey')) el('userApiKey').value = savedKey;
    updateGeminiKeyStatus('พบ API Key ที่บันทึกไว้ในเครื่องนี้ • พร้อมใช้งาน', true);
  } else {
    updateGeminiKeyStatus('ยังไม่ได้เชื่อมต่อ Gemini API Key • ระบบจะเก็บ Key ใน localStorage ของเครื่องนี้เท่านั้น', false);
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    userDocCache = null;
    currentHistoryId = null;
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
