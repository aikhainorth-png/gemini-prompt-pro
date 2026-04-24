import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
const ADMIN_EMAILS=['aikhainorth@gmail.com'];
const $=id=>document.getElementById(id);
const app=initializeApp(firebaseConfig);
const auth=getAuth(app); const db=getFirestore(app); const provider=new GoogleAuthProvider();
let currentUser=null; let userDoc=null;
let pendingDeleteUser=null;
function hasAdminEmail(email=''){ return ADMIN_EMAILS.includes(String(email).toLowerCase()); }
function showToast(message){ const t=$('toast'); t.textContent=message; t.classList.add('show'); clearTimeout(showToast._timer); showToast._timer=setTimeout(()=>t.classList.remove('show'),2200); }
async function ensureUser(user){ const email=String(user.email||'').toLowerCase(); const ref=doc(db,'users',user.uid); const snap=await getDoc(ref); const now=serverTimestamp(); const base={uid:user.uid,email,displayName:user.displayName||'',photoURL:user.photoURL||'',lastLoginAt:now,updatedAt:now}; if(hasAdminEmail(email)){ await setDoc(ref,{...base,createdAt:snap.exists()?snap.data().createdAt||now:now,approved:true,role:'admin',approvedAt:now},{merge:true}); } else if(!snap.exists()){ await setDoc(ref,{...base,createdAt:now,approved:false,role:'user'},{merge:true}); } else { await setDoc(ref,base,{merge:true}); } const updated=await getDoc(ref); userDoc=updated.data(); }
function isAdmin(){ return !!(userDoc?.role==='admin' || hasAdminEmail(currentUser?.email)); }
async function signInGoogle(){ try{ await signInWithPopup(auth,provider);}catch(e){ showToast('เข้าสู่ระบบไม่สำเร็จ'); } }
async function renderUsers(){
  const wrap=$('userList');
  if(!isAdmin()){
    wrap.innerHTML='<div class="muted">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>';
    return;
  }

  const snap=await getDocs(query(collection(db,'users'), orderBy('createdAt','desc'), limit(100)));
  const items=snap.docs.map(d=>({id:d.id,...d.data()}));
  $('statUsers').textContent=String(items.length);
  $('statApproved').textContent=String(items.filter(x=>x.approved).length);
  $('statPending').textContent=String(items.filter(x=>!x.approved).length);
  $('adminInfo').textContent=`Admin: ${currentUser?.email||'-'}`;

  wrap.innerHTML=items.map(u=>{
    const created=u.createdAt?.toDate?u.createdAt.toDate().toLocaleString('th-TH'):'-';
    const isSelf = currentUser?.uid === u.id;
    const isProtectedAdmin = u.role === 'admin' || hasAdminEmail(u.email || '');
    const deleteDisabled = isSelf || isProtectedAdmin;
    const statusClass = u.approved ? 'status-ok' : 'status-wait';
    const statusText = u.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ';

    return `<div class="user-card">
      <div class="user-main">
        <div class="user-title">
          <span>${escapeHtml(u.displayName||'-')}</span>
          ${u.role==='admin'?'<span class="admin-badge">ADMIN</span>':''}
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="meta">${escapeHtml(u.email||'')}<br>created: ${created}</div>
      </div>
      <div class="user-actions">
        <button class="btn btn-green approve-btn" data-uid="${u.id}" ${u.approved?'disabled':''}>อนุมัติ</button>
        <button class="btn btn-dark revoke-btn" data-uid="${u.id}">ยกเลิก</button>
        <button class="btn btn-red delete-user-btn" data-uid="${u.id}" data-email="${escapeHtml(u.email||'')}" data-name="${escapeHtml(u.displayName||'-')}" ${deleteDisabled?'disabled title="ไม่สามารถลบ admin หรือบัญชีตัวเอง"':''}>ลบ User</button>
      </div>
    </div>`;
  }).join('') || '<div class="muted">ยังไม่มี user</div>';

  wrap.querySelectorAll('.approve-btn').forEach(btn=>btn.addEventListener('click',()=>setApproval(btn.dataset.uid,true)));
  wrap.querySelectorAll('.revoke-btn').forEach(btn=>btn.addEventListener('click',()=>setApproval(btn.dataset.uid,false)));
  wrap.querySelectorAll('.delete-user-btn').forEach(btn=>btn.addEventListener('click',()=>openDeleteUserModal(btn.dataset.uid, btn.dataset.email, btn.dataset.name)));
}
async function setApproval(uid,approved){ if(!isAdmin()) return showToast('Admin only'); try{ await updateDoc(doc(db,'users',uid),{approved,updatedAt:serverTimestamp(),approvedAt:approved?serverTimestamp():null}); showToast(approved?'อนุมัติผู้ใช้แล้ว':'ยกเลิกสิทธิ์แล้ว'); await renderUsers(); }catch(e){ showToast(`อัปเดตไม่สำเร็จ: ${e.message}`); } }

function openDeleteUserModal(uid,email,name){
  if(!isAdmin()) return showToast('Admin only');
  if(!uid) return showToast('ไม่พบ UID ของผู้ใช้');
  if(uid === currentUser?.uid) return showToast('ไม่สามารถลบบัญชี admin ที่กำลังใช้งานอยู่');

  pendingDeleteUser={uid,email,name};
  const nameEl=$('deleteUserName');
  const emailEl=$('deleteUserEmail');
  if(nameEl) nameEl.textContent=name || '-';
  if(emailEl) emailEl.textContent=email || '-';
  $('deleteUserModal')?.classList.add('show');
}

function closeDeleteUserModal(){
  pendingDeleteUser=null;
  $('deleteUserModal')?.classList.remove('show');
}

async function confirmDeleteUser(){
  if(!isAdmin()) return showToast('Admin only');
  if(!pendingDeleteUser?.uid) return closeDeleteUserModal();
  if(pendingDeleteUser.uid === currentUser?.uid) return showToast('ไม่สามารถลบบัญชีตัวเอง');

  const btn=$('confirmDeleteUserBtn');
  const oldText=btn?.textContent;
  try{
    if(btn){ btn.disabled=true; btn.textContent='กำลังลบ...'; }
    await deleteDoc(doc(db,'users',pendingDeleteUser.uid));
    showToast('ลบ user เรียบร้อยแล้ว');
    closeDeleteUserModal();
    await renderUsers();
  }catch(e){
    showToast(`ลบไม่สำเร็จ: ${e.message}`);
  }finally{
    if(btn){ btn.disabled=false; btn.textContent=oldText || 'ยืนยันลบ User'; }
  }
}
function escapeHtml(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
$('loginBtn').addEventListener('click', signInGoogle); $('logoutBtn').addEventListener('click', ()=>signOut(auth)); $('refreshBtn').addEventListener('click', renderUsers); $('cancelDeleteUserBtn')?.addEventListener('click', closeDeleteUserModal); $('confirmDeleteUserBtn')?.addEventListener('click', confirmDeleteUser); $('deleteUserModal')?.addEventListener('click', e=>{ if(e.target?.id==='deleteUserModal') closeDeleteUserModal(); });
onAuthStateChanged(auth, async user=>{ currentUser=user; userDoc=null; if(!user){ $('authPill').textContent='ยังไม่ได้เข้าสู่ระบบ'; $('loginBtn').style.display='inline-flex'; $('logoutBtn').style.display='none'; $('userList').innerHTML='<div class="muted">กรุณาเข้าสู่ระบบด้วย Google admin</div>'; return; } await ensureUser(user); $('authPill').textContent=user.email||'signed in'; $('loginBtn').style.display='none'; $('logoutBtn').style.display='inline-flex'; await renderUsers(); });
