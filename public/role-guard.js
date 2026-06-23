
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAILS = ["aikhainorth@gmail.com"];

const rolePages = {
  guest: [],
  user: ["index.html"],
  vip: ["index.html","freestyle.html","cartoon.html","finder.html"],
  gold: ["index.html","freestyle.html","cartoon.html","finder.html","story.html"],
  admin: ["*"]
};

function currentPage(){
  return location.pathname.split("/").pop() || "index.html";
}

async function getRole(user){
  try{
    const email = String(user?.email || "").toLowerCase();

    if(ADMIN_EMAILS.includes(email)){
      return "admin";
    }

    const snap = await getDoc(doc(db,"users",user.uid));

    if(!snap.exists()){
      return "guest";
    }

    const data = snap.data() || {};

    if(data.approved === false){
      return "guest";
    }

    return String(data.role || "guest").toLowerCase();

  }catch(err){
    console.error(err);
    return "guest";
  }
}

function canAccess(role,page){
  if(page === "waiting.html") return true;
  if(role === "admin") return true;
  return (rolePages[role] || []).includes(page);
}

function setVisible(el, show){
  if(!el) return;
  el.style.display = show ? "" : "none";
}

function applyMenu(role){

  document.querySelectorAll("[data-role-page], [data-always-show], [data-admin-only]").forEach(el=>{
    el.style.display = "";
  });

  document.querySelectorAll("[data-always-show]").forEach(el=>{
    setVisible(el,true);
  });

  document.querySelectorAll("[data-admin-only]").forEach(el=>{
    setVisible(el, role === "admin");
  });

  document.querySelectorAll("[data-role-page]").forEach(el=>{
    const page = el.getAttribute("data-role-page");
    setVisible(el, canAccess(role,page));
  });
}

onAuthStateChanged(auth, async(user)=>{

  const page = currentPage();

  if(!user){

    applyMenu("guest");

    if(page !== "index.html" && page !== "waiting.html"){
      window.location.replace("./index.html");
      return;
    }

    return;
  }

  const role = await getRole(user);

  applyMenu(role);

  if(!canAccess(role,page)){

    if(role === "guest"){
      window.location.replace("./waiting.html");
      return;
    }

    alert("ไม่มีสิทธิ์เข้าหน้านี้");

    window.location.replace("./index.html");
    return;
  }

});
