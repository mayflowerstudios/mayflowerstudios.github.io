// companion.js — Companion: a shared virtual pet (Mayflower Studios)
// Uses the same Firebase project as the rest of the site, and the account
// system (window.MFAuth) for identity + the existing friends graph.
//
// Data model (Realtime DB):
//   pets/{bondId}            -> the pet record (see freshPet)
//   userPets/{uid}/{bondId}  -> { with, role, t }  index so each user lists their bonds
//
//   Solo bond:   bondId = uid
//   Shared bond: bondId = [uidA, uidB].sort().join("_")   (deterministic — both
//                resolve the same pet, no invite codes needed since they're friends)

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, onValue, set, get, update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVJ0Tiq0gimaB-epcD9HQlVBrOWHq-IXI",
  authDomain: "watchtogether-95d7d.firebaseapp.com",
  databaseURL: "https://watchtogether-95d7d-default-rtdb.firebaseio.com",
  projectId: "watchtogether-95d7d",
  storageBucket: "watchtogether-95d7d.firebasestorage.app",
};
const FIREBASE_READY = !firebaseConfig.apiKey.startsWith("REPLACE");

const $ = (id) => document.getElementById(id);
let toastTimer;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2600); }
function escapeHtml(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function timeAgo(t){ if(!t) return ""; const s=(Date.now()-t)/1000;
  if(s<60)return "just now"; if(s<3600)return Math.floor(s/60)+"m ago";
  if(s<86400)return Math.floor(s/3600)+"h ago"; const d=Math.floor(s/86400); return d===1?"yesterday":d+"d ago"; }

/* ---------- shared db (reuse MFAuth's connection if present) ---------- */
let db = null;
function getDb(){
  if (db) return db;
  if (window.MFAuth && MFAuth.db) { db = MFAuth.db; return db; }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getDatabase(app); return db;
}

/* ============================================================
   TUNABLES + STATIC DATA
============================================================ */
const DECAY_PER_HOUR = { hunger:14, happy:10, energy:9, clean:8 };
const RUNAWAY_GRACE_HOURS = 48;
const STAGES = [
  { key:"egg",   name:"Hatchling", minLevel:1,  emoji:"🥚" },
  { key:"baby",  name:"Sprout",    minLevel:2,  emoji:"🐣" },
  { key:"child", name:"Kit",       minLevel:5,  emoji:"🦊" },
  { key:"teen",  name:"Wanderer",  minLevel:10, emoji:"🌟" },
  { key:"adult", name:"Spirit",    minLevel:18, emoji:"🦄" },
];
const ADULT_FORMS = { fed:"🐉", played:"🦋", cared:"🦄" };

const SHOP = [
  { id:"berry",    e:"🍓", nm:"Berry",         pr:0,   type:"food", restore:18, def:true },
  { id:"honey",    e:"🍯", nm:"Honey",         pr:20,  type:"food", restore:34 },
  { id:"feast",    e:"🍰", nm:"Moon Cake",     pr:60,  type:"food", restore:60 },
  { id:"bg_garden",e:"🌸", nm:"Garden Scene",  pr:120, type:"scene", scene:"garden" },
  { id:"bg_night", e:"🌌", nm:"Starfall Scene",pr:180, type:"scene", scene:"night" },
  { id:"hat",      e:"🎀", nm:"Ribbon",        pr:90,  type:"cosmetic" },
  { id:"crown",    e:"👑", nm:"Tiny Crown",    pr:250, type:"cosmetic" },
];
const SCENES = {
  default:"radial-gradient(600px 300px at 50% 0%, rgba(157,123,224,.18), transparent 60%)",
  garden:"radial-gradient(600px 320px at 50% 10%, rgba(232,160,196,.28), transparent 65%), linear-gradient(180deg, rgba(143,224,192,.12), transparent)",
  night:"radial-gradient(500px 300px at 70% 0%, rgba(110,79,176,.35), transparent 60%), radial-gradient(300px 200px at 20% 20%, rgba(243,217,160,.18), transparent 60%)",
};

const clamp = (n)=> Math.max(0, Math.min(100, Math.round(n)));

/* ============================================================
   STATE
============================================================ */
let myId = null, myName = "someone";
let friends = {};            // uid -> {t}, from MFAuth.watchFriends
let nameCache = {};          // uid -> displayName
let bondId = null, pet = null, partnerName = null, partnerUid = null;
let petUnsub = null;
let suppressWrite = false;   // guard so incoming snapshots don't echo back

function freshPet(){
  const t = Date.now();
  return {
    name:"Pip", bornAt:t, lastTick:t,
    level:1, xp:0, coins:0,
    hunger:100, happy:100, energy:100, clean:100,
    away:false, lowSince:null,
    feedCount:0, playCount:0, careSum:0, careN:0,
    inventory:{}, activeScene:"default", cosmetic:null,
    log:[],
  };
}
function logEntry(icon,text){ return { icon, text, at:Date.now() }; }
function pushLog(p, icon, text){
  p.log = p.log || [];
  p.log.unshift(logEntry(icon, text));
  if (p.log.length > 60) p.log.length = 60;
}

/* ============================================================
   TIME PASSAGE — decay + neglect/runaway
   Computed from lastTick so the pet "lives" while nobody's online.
============================================================ */
function applyDecay(p){
  const now = Date.now();
  const hrs = (now - (p.lastTick||now)) / 3.6e6;
  if (hrs > 0 && !p.away){
    for (const k in DECAY_PER_HOUR) p[k] = clamp(p[k] - DECAY_PER_HOUR[k]*hrs);
    const avg = (p.hunger+p.happy+p.energy+p.clean)/4;
    if (avg < 12){
      if (!p.lowSince) p.lowSince = now;
      else if ((now - p.lowSince)/3.6e6 > RUNAWAY_GRACE_HOURS){
        p.away = true;
        pushLog(p,"🌫️","Feeling forgotten, "+p.name+" wandered off into the night…");
      }
    } else { p.lowSince = null; }
  }
  p.lastTick = now;
  return p;
}

/* ---------- evolution / leveling ---------- */
function currentStage(p){ let s=STAGES[0]; for(const st of STAGES) if(p.level>=st.minLevel) s=st; return s; }
function creatureEmoji(p){
  if (p.away) return "🍃";
  const st = currentStage(p);
  if (st.key !== "adult") return st.emoji;
  const avgCare = p.careN ? p.careSum/p.careN : 50;
  if (p.feedCount > p.playCount && p.feedCount > 20) return ADULT_FORMS.fed;
  if (p.playCount > p.feedCount && p.playCount > 20) return ADULT_FORMS.played;
  if (avgCare > 70) return ADULT_FORMS.cared;
  return st.emoji;
}
function xpForLevel(lvl){ return 100 + (lvl-1)*60; }
function gainXp(p, amt){
  p.xp += amt;
  while (p.xp >= xpForLevel(p.level)){
    p.xp -= xpForLevel(p.level); p.level++;
    const st = currentStage(p);
    pushLog(p,"🌟", p.name+" grew! Now level "+p.level+(st.minLevel===p.level ? " — evolved into a "+st.name+"!" : ""));
    toast("🌟 "+p.name+" reached level "+p.level+"!");
  }
}

/* ============================================================
   FIREBASE PERSISTENCE
============================================================ */
const petRef     = (id)=> ref(getDb(), "pets/"+id);
const userPetRef = (uid,id)=> ref(getDb(), "userPets/"+uid+"/"+id);

async function savePet(){
  if (!bondId || !pet) return;
  suppressWrite = true;
  try { await set(petRef(bondId), pet); }
  finally { setTimeout(()=>{ suppressWrite = false; }, 200); }
}

// Watch the pet live; apply decay locally on each tick + on every remote change.
function watchPet(id){
  if (petUnsub) petUnsub();
  const r = petRef(id);
  const off = onValue(r, (snap)=>{
    if (suppressWrite) return;            // our own write echoing back
    const incoming = snap.val();
    if (!incoming) return;
    pet = applyDecay(incoming);
    render();
  });
  petUnsub = ()=> off();
}

/* ============================================================
   AUTH GATE
============================================================ */
function waitForAuth(cb){
  if (window.MFAuth && MFAuth.isReady()) return cb();
  let n=0; const iv=setInterval(()=>{
    if (window.MFAuth && MFAuth.isReady()){ clearInterval(iv); cb(); }
    else if (++n>250) clearInterval(iv);
  },80);
}

function showSignedOut(){
  $("gateSignedOut").classList.remove("hide");
  $("gateSignedIn").classList.add("hide");
  $("appView").classList.add("hide");
  $("gateView").classList.remove("hide");
  $("gateSignInBtn").onclick = ()=>{
    location.href = "/account.html?next=" + encodeURIComponent(location.pathname + location.search);
  };
}

waitForAuth(()=>{
  if (!window.MFAuth || !MFAuth.isConfigured()){ showSignedOut(); return; }
  MFAuth.onChange((user)=>{
    if (user && MFAuth.uid){
      myId = MFAuth.uid;
      myName = MFAuth.name() || "someone";
      nameCache[myId] = myName;
      onSignedIn();
    } else {
      myId = null;
      showSignedOut();
    }
  });
});

/* ---------- once signed in: friends + existing bonds ---------- */
let friendsLoaded = false;
function onSignedIn(){
  $("gateSignedOut").classList.add("hide");
  $("gateSignedIn").classList.remove("hide");

  // live friends list (reuses the account system's friend graph)
  if (!friendsLoaded){
    friendsLoaded = true;
    MFAuth.watchFriends(async (f)=>{
      friends = f || {};
      // resolve names for nicer display
      await Promise.all(Object.keys(friends).map(async uid=>{
        if (nameCache[uid]) return;
        try { const p = await MFAuth.getProfile(uid); nameCache[uid] = (p && p.displayName) || "friend"; }
        catch(_){ nameCache[uid] = "friend"; }
      }));
      renderFriendPicker();
    });
    listExistingBonds();
  }
}

async function listExistingBonds(){
  try {
    const snap = await get(ref(getDb(), "userPets/"+myId)); // userPets/{uid}
    const all = snap.exists() ? snap.val() : {};
    const ids = Object.keys(all);
    if (!ids.length){ $("existingBonds").classList.add("hide"); return; }
    const cards = [];
    for (const id of ids){
      const ps = await get(petRef(id));
      if (!ps.exists()){ continue; }
      const p = applyDecay(ps.val());
      const withUid = all[id].with;
      let withName = withUid ? (nameCache[withUid] || (await safeName(withUid))) : null;
      cards.push({ id, name:p.name, emoji:creatureEmoji(p), level:p.level, withName });
    }
    if (!cards.length){ $("existingBonds").classList.add("hide"); return; }
    $("existingBonds").classList.remove("hide");
    const wrap = $("bondCards"); wrap.innerHTML = "";
    cards.forEach(c=>{
      const div = document.createElement("div");
      div.className = "bondCard";
      div.innerHTML = `<div class="em">${c.emoji}</div>
        <div class="bn"><b>${escapeHtml(c.name)}</b>
        <span>Level ${c.level} · ${c.withName ? "with "+escapeHtml(c.withName) : "just you"}</span></div>
        <span class="btn">Open →</span>`;
      div.onclick = ()=> enterBond(c.id, c.withName);
      wrap.appendChild(div);
    });
  } catch(err){ console.error("listExistingBonds", err); }
}
async function safeName(uid){
  try { const p = await MFAuth.getProfile(uid); const n=(p&&p.displayName)||"friend"; nameCache[uid]=n; return n; }
  catch(_){ return "friend"; }
}

/* ---------- gate: mode toggle ---------- */
$("seg").addEventListener("click",(e)=>{
  const b = e.target.closest("button"); if(!b) return;
  const mode = b.dataset.mode;
  [...$("seg").children].forEach(x=>x.classList.toggle("on", x===b));
  $("paneSolo").classList.toggle("hide", mode!=="solo");
  $("paneFriend").classList.toggle("hide", mode!=="friend");
});

function renderFriendPicker(){
  const ids = Object.keys(friends);
  const list = $("friendList");
  if (!ids.length){ $("friendsWrap").classList.add("hide"); $("noFriends").classList.remove("hide"); return; }
  $("friendsWrap").classList.remove("hide"); $("noFriends").classList.add("hide");
  list.innerHTML = "";
  ids.forEach(uid=>{
    const nm = nameCache[uid] || "friend";
    const row = document.createElement("div");
    row.className = "friendRow";
    row.innerHTML = `<div class="fav">${escapeHtml((nm[0]||"?").toUpperCase())}</div>
      <span class="fn">${escapeHtml(nm)}</span><span class="btn">Raise together →</span>`;
    row.onclick = ()=> createSharedBond(uid, nm);
    list.appendChild(row);
  });
}

/* ---------- create / enter bonds ---------- */
async function startSoloBond(){
  bondId = myId;
  const exists = await get(petRef(bondId));
  if (!exists.exists()){
    pet = freshPet();
    pushLog(pet,"✨", myName+" welcomed a new companion into the nest.");
    await set(petRef(bondId), pet);
    await set(userPetRef(myId, bondId), { with:null, role:"solo", t:Date.now() });
  }
  enterBond(bondId, null);
}
$("startSolo").onclick = ()=> startSoloBond().catch(err=>{ console.error(err); toast("Couldn't start — try again"); });

async function createSharedBond(otherUid, otherName){
  const id = [myId, otherUid].sort().join("_");
  bondId = id;
  const exists = await get(petRef(id));
  if (!exists.exists()){
    pet = freshPet();
    pushLog(pet,"🤝", myName+" and "+otherName+" began raising a companion together.");
    await set(petRef(id), pet);
  }
  // index for BOTH users so it shows in each person's list
  await update(ref(getDb()), {
    ["userPets/"+myId+"/"+id]:    { with:otherUid, role:"shared", t:Date.now() },
    ["userPets/"+otherUid+"/"+id]:{ with:myId,    role:"shared", t:Date.now() },
  });
  enterBond(id, otherName, otherUid);
}

function enterBond(id, withName, withUid){
  bondId = id; partnerName = withName || null; partnerUid = withUid || null;
  $("gateView").classList.add("hide");
  $("appView").classList.remove("hide");
  $("bondLabel").textContent = withName ? ("with "+withName) : "just you";
  $("whoPill").textContent = withName ? (myName+" · "+withName) : myName;
  $("withBadge").textContent = withName ? ("🤝 Raised together with "+withName) : "";
  buildShop();
  watchPet(id);
  // local decay ticker (visual cadence; authoritative decay also runs on each snapshot)
  if (window._cpTick) clearInterval(window._cpTick);
  window._cpTick = setInterval(()=>{ if(pet){ pet = applyDecay(pet); render(); } }, 1000);
}

$("switchBtn").onclick = ()=>{
  if (window._cpTick) clearInterval(window._cpTick);
  if (petUnsub) petUnsub();
  pet = null; bondId = null;
  $("appView").classList.add("hide");
  $("gateView").classList.remove("hide");
  listExistingBonds();
};

/* ============================================================
   RENDER
============================================================ */
function avgStat(p){ return (p.hunger+p.happy+p.energy+p.clean)/4; }
function moodText(p){
  if (p.hunger<25) return p.name+" is really hungry…";
  if (p.clean<25)  return p.name+" could use a bath.";
  if (p.energy<25) return p.name+" is sleepy.";
  if (p.happy<25)  return p.name+" seems a little lonely.";
  if (avgStat(p)>80) return p.name+" is glowing with joy! ✨";
  return p.name+" is content.";
}
function setStat(label,val){
  const map={Hunger:["vHunger","bHunger"],Happy:["vHappy","bHappy"],Energy:["vEnergy","bEnergy"],Clean:["vClean","bClean"]};
  const [v,b]=map[label]; $(v).textContent=val+"%"; const bar=$(b);
  bar.style.width=val+"%"; bar.parentElement.classList.toggle("low", val<25);
}

function render(){
  if (!pet) return;
  if (pet.away){ renderAway(); return; }
  $("petNameText").textContent = pet.name;
  $("stageBadge").textContent = currentStage(pet).name;
  const cr = $("creature"); cr.textContent = creatureEmoji(pet);
  cr.classList.toggle("sad", avgStat(pet)<30);
  setStat("Hunger",pet.hunger); setStat("Happy",pet.happy); setStat("Energy",pet.energy); setStat("Clean",pet.clean);
  $("lvl").textContent = pet.level;
  $("xpTxt").textContent = pet.xp+" / "+xpForLevel(pet.level)+" xp";
  $("xpBar").style.width = (100*pet.xp/xpForLevel(pet.level))+"%";
  $("coins").textContent = pet.coins;
  $("mood").textContent = moodText(pet);
  $("sceneBg").style.background = SCENES[pet.activeScene] || SCENES.default;
  $("feedItem").textContent = bestFood(pet).nm;
  renderLog();
}
function renderAway(){
  $("stageBadge").textContent = "Away";
  $("petNameText").textContent = pet.name;
  $("creature").textContent = "🍃";
  $("mood").innerHTML = pet.name+' has wandered off… <u id="searchLink" style="cursor:pointer;color:#f9a8d4">Go search for them</u>';
  ["Hunger","Happy","Energy","Clean"].forEach(k=> setStat(k,0));
  const sl = $("searchLink"); if (sl) sl.onclick = searchForPet;
}

/* ============================================================
   ACTIONS  (each mutates pet, logs, saves -> live-syncs to partner)
============================================================ */
function bestFood(p){
  const owned = SHOP.filter(s=>s.type==="food" && (s.def || (p.inventory && p.inventory[s.id]>0)));
  return owned.sort((a,b)=>b.restore-a.restore)[0] || SHOP[0];
}
function bumpCare(p){ p.careSum += avgStat(p); p.careN++; }
function pop(emoji){
  const s=document.querySelector(".stage"); const el=document.createElement("div");
  el.className="floatup"; el.textContent=emoji; el.style.left=(40+Math.random()*20)+"%"; el.style.top="42%";
  s.appendChild(el); setTimeout(()=>el.remove(),1100);
}
function bounce(){ const c=$("creature"); c.classList.remove("idle"); c.classList.add("happy");
  setTimeout(()=>{ c.classList.remove("happy"); c.classList.add("idle"); },560); }

function act(fn){ if(!pet||pet.away) return; fn(pet); render(); savePet(); }

$("aFeed").onclick = ()=> act(p=>{
  const f = bestFood(p);
  if (!f.def){ p.inventory[f.id]--; }
  p.hunger = clamp(p.hunger + f.restore); p.feedCount++; bumpCare(p);
  gainXp(p,6); p.coins += 2; pop("🍓"); bounce();
  pushLog(p,"🍓", myName+" fed "+p.name+" a "+f.nm.toLowerCase()+".");
});
$("aPlay").onclick = ()=>{
  if (pet && pet.energy<10){ toast(pet.name+" is too tired to play — let them rest."); return; }
  act(p=>{ p.happy=clamp(p.happy+22); p.energy=clamp(p.energy-8); p.playCount++; bumpCare(p);
    gainXp(p,7); p.coins+=3; pop("🪁"); bounce(); pushLog(p,"🪁", myName+" played with "+p.name+"."); });
};
$("aSleep").onclick = ()=> act(p=>{ p.energy=clamp(p.energy+30); bumpCare(p); gainXp(p,3); pop("💤");
  pushLog(p,"💤", p.name+" took a cozy nap."); });
$("aClean").onclick = ()=> act(p=>{ p.clean=clamp(p.clean+34); bumpCare(p); gainXp(p,4); p.coins+=2; pop("🫧"); bounce();
  pushLog(p,"🫧", myName+" gave "+p.name+" a bath."); });

$("renameBtn").onclick = ()=>{
  if (!pet) return;
  const n = prompt("Name your companion:", pet.name);
  if (n && n.trim()){ act(p=>{ p.name=n.trim().slice(0,18); pushLog(p,"✎", myName+" named the companion "+p.name+"."); }); }
};

function searchForPet(){
  act(p=>{ p.away=false; p.lowSince=null; p.hunger=40; p.happy=40; p.energy=40; p.clean=40;
    pushLog(p,"🌿", myName+" found "+p.name+" curled under a fern and brought them home."); });
  toast("You found "+pet.name+" 🌿");
}

/* ============================================================
   TABS / SHOP / DIARY
============================================================ */
document.querySelectorAll(".tab").forEach(t=> t.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x===t));
  const tab=t.dataset.tab;
  $("tabGames").classList.toggle("hide",tab!=="games");
  $("tabShop").classList.toggle("hide",tab!=="shop");
  $("tabLog").classList.toggle("hide",tab!=="log");
});

function buildShop(){
  const g=$("shopGrid"); g.innerHTML="";
  SHOP.filter(s=>!s.def).forEach(s=>{
    const owned = (s.type==="scene" && pet && pet.activeScene===s.scene) ||
                  (s.type==="cosmetic" && pet && pet.cosmetic===s.id);
    const div=document.createElement("div");
    div.className="shopItem"+(owned?" owned":"");
    div.innerHTML=`<div class="e">${s.e}</div><div class="nm">${s.nm}</div>
      <div class="pr">✦ ${s.pr}</div>
      <button ${(pet && pet.coins<s.pr)?"disabled":""}>${labelFor(s)}</button>`;
    div.querySelector("button").onclick=()=>buy(s);
    g.appendChild(div);
  });
}
function labelFor(s){
  if (s.type==="food") return "Buy";
  if (s.type==="scene") return (pet && pet.activeScene===s.scene)?"Active":"Use";
  if (s.type==="cosmetic") return (pet && pet.cosmetic===s.id)?"On":"Wear";
}
function buy(s){
  if (!pet) return;
  if (pet.coins<s.pr){ toast("Not enough ✦ — care for "+pet.name+" to earn more"); return; }
  act(p=>{
    p.coins-=s.pr;
    if (s.type==="food"){ p.inventory[s.id]=(p.inventory[s.id]||0)+1; toast("Bought "+s.nm+" ×1"); }
    if (s.type==="scene"){ p.activeScene=s.scene; toast("Scene changed to "+s.nm); }
    if (s.type==="cosmetic"){ p.cosmetic=(p.cosmetic===s.id?null:s.id); toast(p.name+" tried on the "+s.nm); }
    pushLog(p,"🛍️", myName+" got "+s.nm+" for "+p.name+".");
  });
  buildShop();
}

function renderLog(){
  const l=$("logList"); if(!l) return; l.innerHTML="";
  (pet.log||[]).slice(0,40).forEach(e=>{
    const d=document.createElement("div"); d.className="logItem";
    d.innerHTML=`<span class="t">${timeAgo(e.at)}</span>${e.icon} ${escapeHtml(e.text)}`;
    l.appendChild(d);
  });
}

/* ============================================================
   MINI GAME — Memory Bloom
============================================================ */
(function memoryBloom(){
  let seq=[], input=[], showing=false; const cells=[];
  const grid=$("mgGrid");
  function build(){ grid.innerHTML=""; for(let i=0;i<9;i++){ const c=document.createElement("div");
    c.className="cell"; c.textContent="🌸"; c.onclick=()=>press(i); grid.appendChild(c); cells[i]=c; } }
  function start(){ if(showing) return; seq=[]; input=[]; next(); }
  function next(){ input=[]; seq.push(Math.random()*9|0); $("mgStatus").innerHTML="Watch closely…"; showSeq(); }
  function showSeq(){ showing=true; let i=0; const iv=setInterval(()=>{
    if(i>0) cells[seq[i-1]].classList.remove("lit");
    if(i>=seq.length){ clearInterval(iv); showing=false; $("mgStatus").innerHTML="Your turn — repeat it!"; return; }
    cells[seq[i]].classList.add("lit"); i++; },620); }
  function press(i){
    if(showing||seq.length===0||!pet) return;
    cells[i].classList.add("lit"); setTimeout(()=>cells[i].classList.remove("lit"),200);
    input.push(i); const idx=input.length-1;
    if(input[idx]!==seq[idx]){
      const reward=seq.length*4;
      $("mgStatus").innerHTML="Oops — "+pet.name+" giggled. You reached round <b>"+seq.length+"</b>.";
      act(p=>{ p.coins+=reward; p.happy=clamp(p.happy+seq.length*3); gainXp(p,seq.length*2);
        pushLog(p,"🎲", myName+" played Memory Bloom — earned ✦"+reward+"."); });
      seq=[]; return;
    }
    if(input.length===seq.length){ $("mgStatus").innerHTML="Nice! Next round…"; setTimeout(next,800); }
  }
  $("mgStart").onclick=start; build();
})();

/* ---------- not configured fallback ---------- */
if (!FIREBASE_READY){ showSignedOut(); }
