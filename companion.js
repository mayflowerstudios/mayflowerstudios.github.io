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
  getDatabase, ref, onValue, onChildAdded, set, get, update, remove,
  push, onDisconnect, serverTimestamp, query, limitToLast
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
const DECAY_PER_HOUR = { hunger:8.3, happy:6, energy:5.4, clean:4.8 };
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
    members:{}, log:[],
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

   Stored stats are kept as floats internally so small per-second
   decay isn't lost to rounding (the old bug: 14/hr ≈ 0.004%/s
   rounded to 0 each tick, so bars looked frozen). The display
   rounds for the % label but uses the float for the bar width, so
   the bars visibly creep down in real time while you sit on the page.
============================================================ */
function applyDecay(p){
  const now = Date.now();
  const hrs = (now - (p.lastTick||now)) / 3.6e6;
  if (hrs > 0 && !p.away){
    for (const k in DECAY_PER_HOUR){
      const v = (typeof p[k]==="number" ? p[k] : 100) - DECAY_PER_HOUR[k]*hrs;
      p[k] = Math.max(0, Math.min(100, v));   // keep as float, don't round here
    }
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
  try {
    // Write only the core pet fields. The togetherness subtrees
    // (presence, pulse, notes, care) are owned by separate writers and
    // must not be clobbered by a full overwrite, so we strip them here.
    const core = { ...pet };
    delete core.presence; delete core.pulse; delete core.notes; delete core.care;
    await update(petRef(bondId), core);
  }
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
    watchMyInvites();
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
      if (!ps.exists()){
        // pet was released (possibly by a partner) — prune the dangling index
        try { await remove(userPetRef(myId, id)); } catch(_){}
        continue;
      }
      const p = applyDecay(ps.val());
      const withUid = all[id].with;
      let withName = withUid ? (nameCache[withUid] || (await safeName(withUid))) : null;
      cards.push({ id, name:p.name, emoji:creatureEmoji(p), level:p.level, withName, withUid });
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
        <span class="row" style="gap:8px;">
          <span class="btn open-bond">Open →</span>
          <span class="btn bond-del" title="Remove this companion" style="padding:8px 11px;">🗑️</span>
        </span>`;
      div.querySelector(".open-bond").onclick = (e)=>{ e.stopPropagation(); enterBond(c.id, c.withName, c.withUid); };
      div.querySelector(".bond-del").onclick = (e)=>{ e.stopPropagation(); confirmDelete(c.id, c.withUid, c.name, !!c.withName); };
      div.onclick = ()=> enterBond(c.id, c.withName, c.withUid);
      wrap.appendChild(div);
    });
  } catch(err){ console.error("listExistingBonds", err); }
}
async function safeName(uid){
  try { const p = await MFAuth.getProfile(uid); const n=(p&&p.displayName)||"friend"; nameCache[uid]=n; return n; }
  catch(_){ return "friend"; }
}

function confirmDelete(id, withUid, petName, shared){
  const msg = shared
    ? `Step away from raising ${petName}?\n\nYour link is removed and you'll stop seeing ${petName}. ${nameCache[withUid]||"Your friend"} keeps the companion unless they leave too. This can't be undone.`
    : `Release ${petName} for good?\n\nThis permanently deletes ${petName} and everything you've raised. This can't be undone.`;
  if (window.confirm(msg)){
    deleteBond(id, withUid, petName);
    // if we're currently inside that bond, exit to the gate
    if (bondId === id){ leaveToGate(); }
  }
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
      <span class="fn">${escapeHtml(nm)}</span><span class="btn">Invite to raise →</span>`;
    row.onclick = ()=> sendPetInvite(uid, nm);
    list.appendChild(row);
  });
}

/* ---------- pet invites (consent flow) ----------
   petInvites/{toUid}/{fromUid} = { name, username, t }
   Mirrors the friendRequests pattern. The recipient must accept
   before the shared bond + indexes are created. */
const inviteRef = (toUid, fromUid)=> ref(getDb(), "petInvites/"+toUid+"/"+fromUid);

async function sendPetInvite(otherUid, otherName){
  try {
    // already share a bond?
    const id = [myId, otherUid].sort().join("_");
    const existing = await get(userPetRef(myId, id));
    if (existing.exists()){ toast("You already share a companion with "+otherName); return; }
    await set(inviteRef(otherUid, myId), {
      name: myName,
      username: (MFAuth.profile && MFAuth.profile.username) || "",
      t: Date.now(),
    });
    toast("Invite sent to "+otherName+" 💌");
  } catch(err){
    console.error("sendPetInvite", err);
    toast("Couldn't send the invite — try again");
  }
}

// Live-watch invites addressed to me, render them at the top of the gate.
let invitesLoaded = false;
function watchMyInvites(){
  if (invitesLoaded) return; invitesLoaded = true;
  onValue(ref(getDb(), "petInvites/"+myId), async (snap)=>{
    const raw = snap.exists() ? snap.val() : {};
    const fromUids = Object.keys(raw);
    const box = $("petInvites");
    if (!fromUids.length){ box.classList.add("hide"); box.innerHTML = ""; return; }
    box.classList.remove("hide");
    box.innerHTML = `<label style="font-size:14px; opacity:.85;">Companion invites</label>`;
    const wrap = document.createElement("div");
    wrap.className = "friendList"; wrap.style.marginBottom = "10px";
    for (const fromUid of fromUids){
      const nm = raw[fromUid].name || nameCache[fromUid] || (await safeName(fromUid));
      const row = document.createElement("div");
      row.className = "friendRow";
      row.innerHTML = `<div class="fav">${escapeHtml((nm[0]||"?").toUpperCase())}</div>
        <span class="fn">${escapeHtml(nm)} wants to raise a companion with you</span>
        <span class="row" style="gap:6px;">
          <span class="btn primary inv-accept">Accept</span>
          <span class="btn inv-decline">Decline</span>
        </span>`;
      row.querySelector(".inv-accept").onclick = (e)=>{ e.stopPropagation(); acceptPetInvite(fromUid, nm); };
      row.querySelector(".inv-decline").onclick = (e)=>{ e.stopPropagation(); declinePetInvite(fromUid, nm); };
      wrap.appendChild(row);
    }
    box.appendChild(wrap);
    const div = document.createElement("div"); div.className = "divider"; box.appendChild(div);
  });
}

async function acceptPetInvite(fromUid, fromName){
  try {
    const id = [myId, fromUid].sort().join("_");
    const exists = await get(petRef(id));
    if (!exists.exists()){
      const p = freshPet();
      p.members = { [myId]: true, [fromUid]: true };
      pushLog(p,"🤝", myName+" and "+fromName+" began raising a companion together.");
      await set(petRef(id), p);
    } else {
      // pet already exists (e.g. re-accept) — make sure both are marked members
      await update(ref(getDb()), {
        ["pets/"+id+"/members/"+myId]: true,
        ["pets/"+id+"/members/"+fromUid]: true,
      });
    }
    // index for BOTH, then clear the invite
    await update(ref(getDb()), {
      ["userPets/"+myId+"/"+id]:    { with:fromUid, role:"shared", t:Date.now() },
      ["userPets/"+fromUid+"/"+id]: { with:myId,   role:"shared", t:Date.now() },
      ["petInvites/"+myId+"/"+fromUid]: null,
    });
    toast("You and "+fromName+" now share a companion 🌱");
    enterBond(id, fromName, fromUid);
  } catch(err){
    console.error("acceptPetInvite", err);
    toast("Couldn't accept — try again");
  }
}

async function declinePetInvite(fromUid, fromName){
  try {
    await remove(inviteRef(myId, fromUid));
    toast("Invite from "+fromName+" declined");
  } catch(err){ console.error("declinePetInvite", err); }
}

/* ---------- create / enter bonds ---------- */
async function startSoloBond(){
  bondId = myId;
  const exists = await get(petRef(bondId));
  if (!exists.exists()){
    pet = freshPet();
    pet.members = { [myId]: true };
    pushLog(pet,"✨", myName+" welcomed a new companion into the nest.");
    await set(petRef(bondId), pet);
    await set(userPetRef(myId, bondId), { with:null, role:"solo", t:Date.now() });
  }
  enterBond(bondId, null);
}
$("startSolo").onclick = ()=> startSoloBond().catch(err=>{ console.error(err); toast("Couldn't start — try again"); });

/* ---------- delete / leave a bond ----------
   Solo: delete the pet record + my index outright.
   Shared: remove MY index + my reference on the pet. The pet record is
   only fully deleted once nobody is left raising it (last one out cleans
   up), so one person can't delete a creature the other is still raising. */
async function deleteBond(id, withUid, petName){
  try {
    if (!withUid){
      // solo — remove everything
      await update(ref(getDb()), {
        ["pets/"+id]: null,
        ["userPets/"+myId+"/"+id]: null,
      });
      toast(petName+" was released. 🍃");
    } else {
      // shared — read the pet to see who's still a member
      const ps = await get(petRef(id));
      const p = ps.exists() ? ps.val() : null;
      const members = (p && p.members) || {};
      const othersRemain = Object.keys(members).some(uid => uid !== myId && members[uid]);

      if (!p || !othersRemain){
        // I'm the last one — clean up the whole record + my index
        await update(ref(getDb()), {
          ["pets/"+id]: null,
          ["userPets/"+myId+"/"+id]: null,
        });
        toast(petName+" was released. 🍃");
      } else {
        // leave: drop my membership + index, leave a note in the diary
        pushLog(p, "👋", myName+" stepped away from raising "+petName+".");
        await update(ref(getDb()), {
          ["pets/"+id+"/members/"+myId]: null,
          ["pets/"+id+"/log"]: p.log,
          ["userPets/"+myId+"/"+id]: null,
        });
        toast("You stepped away. "+(nameCache[withUid]||"Your friend")+" still has "+petName+".");
      }
    }
  } catch(err){
    console.error("deleteBond", err);
    toast("Couldn't remove — try again");
  }
  listExistingBonds();
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
  // Show the widget + start the local ticker FIRST, so nothing below can
  // prevent them. The togetherness sync is best-effort and must not block UI.
  $("tgWidget").classList.add("shown");
  if (window._cpTick) clearInterval(window._cpTick);
  window._cpTick = setInterval(()=>{ if(pet){ pet = applyDecay(pet); render(); } }, 1000);
  try { tgStart(id); } catch(err){ console.error("tgStart failed:", err); }
  renderPresence();
}

function leaveToGate(){
  if (window._cpTick) clearInterval(window._cpTick);
  if (petUnsub) petUnsub();
  tgStop();
  $("tgWidget").classList.remove("shown","open","active");
  pet = null; bondId = null; partnerUid = null; partnerName = null;
  $("creature").classList.remove("together-glow");
  $("appView").classList.add("hide");
  $("gateView").classList.remove("hide");
  listExistingBonds();
}
$("switchBtn").onclick = leaveToGate;
$("deletePetBtn").onclick = ()=>{
  if (!bondId || !pet) return;
  confirmDelete(bondId, partnerUid, pet.name, !!partnerUid);
};

/* ---------- togetherness widget handlers ---------- */
// Safe attach helper — never throws if an element is absent.
function on(id, evt, fn){ const el = $(id); if (el) el.addEventListener(evt, fn); }

// If the page's HTML predates the widget (stale deploy/cache), build it now
// so the feature works regardless of which companion.html is live.
function ensureWidget(){
  if ($("tgWidget")) return;
  const w = document.createElement("div");
  w.className = "tg-widget"; w.id = "tgWidget";
  w.innerHTML = `
    <button class="tg-fab" id="tgToggle" aria-label="Together panel">
      <span class="tg-dot off" id="tgPresenceDot"></span>
      <span class="tg-fab-emoji">💞</span>
    </button>
    <div class="tg-panel">
      <div class="tg-row tg-presence">
        <span class="tg-dot off" id="tgPresenceDot2"></span>
        <span id="tgPresenceText">Just you right now</span>
      </div>
      <div class="tg-streak" id="tgStreak"></div>
      <div class="tg-actions">
        <button class="tg-btn" id="sendHeartBtn">💗 Send a heart</button>
        <button class="tg-btn hide" id="petTogetherBtn">🫶 Pet together</button>
      </div>
      <div class="tg-notes">
        <div class="tg-notes-head">💌 Notes <span class="tg-notes-count" id="tgNotesCount"></span></div>
        <div class="tg-notes-list" id="tgNotesList"></div>
        <div class="tg-note-compose">
          <input class="tg-note-field" id="tgNoteInput" type="text" maxlength="200" placeholder="Leave a note…" />
          <button class="tg-note-send" id="tgNoteSend">Send</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(w);
  ensureWidgetStyles();
}

// Inject the widget CSS too, in case a stale stylesheet lacks it.
function ensureWidgetStyles(){
  if (document.getElementById("tgWidgetStyles")) return;
  const css = `
  .tg-widget{ position:fixed; right:20px; bottom:20px; z-index:9999; font-family:var(--font-b,sans-serif); display:none; }
  .tg-widget.shown{ display:block; }
  .tg-fab{ position:relative; width:58px; height:58px; border-radius:50%; cursor:pointer;
    border:1px solid var(--border-2,rgba(249,168,212,.2)); background:linear-gradient(135deg, rgba(249,168,212,.22), rgba(196,181,253,.22));
    backdrop-filter:blur(12px); box-shadow:0 10px 30px rgba(0,0,0,.4); display:flex; align-items:center; justify-content:center; }
  .tg-fab:hover{ transform:translateY(-2px); }
  .tg-fab-emoji{ font-size:24px; }
  .tg-widget.active .tg-fab{ box-shadow:0 0 0 3px rgba(249,168,212,.3), 0 10px 30px rgba(0,0,0,.4); }
  .tg-dot{ width:9px; height:9px; border-radius:50%; display:inline-block; flex-shrink:0; }
  .tg-dot.on{ background:#6ee7b7; box-shadow:0 0 8px rgba(110,231,183,.8); }
  .tg-dot.off{ background:#8d86a8; opacity:.5; }
  .tg-fab .tg-dot{ position:absolute; top:9px; right:9px; }
  .tg-panel{ position:absolute; right:0; bottom:70px; width:300px; max-width:84vw;
    border:1px solid var(--border-2,rgba(249,168,212,.2)); border-radius:18px; background:var(--glass,rgba(11,17,32,.92));
    backdrop-filter:blur(16px); box-shadow:0 18px 50px rgba(0,0,0,.5); padding:16px;
    display:none; flex-direction:column; gap:12px; color:var(--text,#f3eefb); }
  .tg-widget.open .tg-panel{ display:flex; }
  .tg-row{ display:flex; align-items:center; gap:9px; font-size:13.5px; }
  .tg-presence{ color:var(--text-2,#c9c2e0); } .tg-presence b{ color:var(--text,#fff); }
  .tg-streak{ display:flex; flex-direction:column; gap:3px; font-size:12.5px; }
  .tg-flame{ font-weight:700; color:#fbbf86; } .tg-flame.off{ color:#8d86a8; font-weight:500; }
  .tg-last{ color:#8d86a8; font-size:11.5px; }
  .tg-actions{ display:flex; gap:8px; flex-wrap:wrap; }
  .tg-btn{ flex:1; min-width:120px; padding:10px; border-radius:12px; cursor:pointer; font:inherit; font-weight:600; font-size:13px;
    border:1px solid var(--border-2,rgba(249,168,212,.2)); background:rgba(255,255,255,.05); color:inherit; }
  .tg-btn:hover{ background:rgba(255,255,255,.1); }
  #petTogetherBtn{ background:linear-gradient(120deg,#f9a8d4,#c4b5fd); color:#241233; border-color:transparent; }
  .tg-notes-head{ font-size:12.5px; font-weight:700; color:var(--text-2,#c9c2e0); display:flex; align-items:center; gap:6px; }
  .tg-notes-count{ font-size:11px; color:#241233; background:#f9a8d4; border-radius:10px; padding:0 7px; font-weight:700; }
  .tg-notes-list{ display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto; }
  .tg-note-empty{ font-size:12px; color:#8d86a8; line-height:1.5; padding:4px 0; }
  .tg-note-item{ position:relative; padding:9px 11px; border-radius:12px; background:rgba(255,255,255,.04); border:1px solid rgba(249,168,212,.1); }
  .tg-note-item.mine{ background:rgba(249,168,212,.08); border-color:rgba(249,168,212,.18); }
  .tg-note-meta{ display:flex; justify-content:space-between; font-size:10.5px; color:#8d86a8; margin-bottom:3px; }
  .tg-note-meta b{ color:var(--text-2,#c9c2e0); }
  .tg-note-text{ font-size:13px; line-height:1.45; word-wrap:break-word; }
  .tg-note-del{ position:absolute; top:6px; right:9px; cursor:pointer; color:#8d86a8; font-size:15px; line-height:1; }
  .tg-note-del:hover{ color:#f9a8d4; }
  .tg-note-compose{ display:flex; gap:7px; }
  .tg-note-field{ flex:1; padding:9px 11px; border-radius:11px; border:1px solid var(--border-2,rgba(249,168,212,.2));
    background:rgba(0,0,0,.25); color:inherit; font:inherit; font-size:13px; outline:none; }
  .tg-note-send{ padding:9px 13px; border-radius:11px; border:none; cursor:pointer; font:inherit; font-weight:700; font-size:13px;
    background:linear-gradient(120deg,#f9a8d4,#c4b5fd); color:#241233; }
  .creature.together-glow{ filter:drop-shadow(0 0 18px rgba(249,168,212,.55)) drop-shadow(0 14px 26px rgba(0,0,0,.5)); }
  .tg-widget.solo #petTogetherBtn, .tg-widget.solo #sendHeartBtn, .tg-widget.solo .tg-notes{ display:none; }
  .hide{ display:none !important; }`;
  const style = document.createElement("style");
  style.id = "tgWidgetStyles"; style.textContent = css;
  document.head.appendChild(style);
}

ensureWidget();   // build it now if the page didn't ship it

on("tgToggle","click", ()=>{ $("tgWidget").classList.toggle("open"); });
on("sendHeartBtn","click", ()=>{ emitPulse("heart","💗","sent a heart"); });
on("petTogetherBtn","click", tryPetTogether);
on("tgNoteSend","click", sendNote);
on("tgNoteInput","keydown", (e)=>{ if (e.key==="Enter"){ e.preventDefault(); sendNote(); } });
on("creature","click", ()=>{ if (pet && !pet.away){ emitPulse("boop","👉","booped "+pet.name); } });

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
  const [v,b]=map[label];
  const pct = Math.max(0, Math.min(100, val));
  $(v).textContent = Math.round(pct)+"%";          // label: clean integer
  const bar=$(b);
  bar.style.width = pct.toFixed(2)+"%";             // bar: fractional, so it visibly creeps
  bar.parentElement.classList.toggle("low", pct<25);
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

/* ---------- anti-spam: cooldowns + need-based rewards ----------
   You only earn XP/coins for actually meeting a need. Acting on an
   already-satisfied stat does little and earns nothing, so mashing a
   full pet is pointless. A short cooldown also stops rapid-fire taps. */
const COOLDOWN_MS = 1500;
const lastActionAt = { feed:0, play:0, sleep:0, clean:0 };

function onCooldown(key){
  const now = Date.now();
  const left = COOLDOWN_MS - (now - (lastActionAt[key]||0));
  if (left > 0) return true;
  lastActionAt[key] = now;
  return false;
}
// reward scales with how "needed" the action was: full stat -> ~0, empty -> full.
function needFactor(statVal){ return Math.max(0, Math.min(1, (100 - statVal) / 100)); }
function scaledXp(base, statVal){ return Math.round(base * needFactor(statVal)); }

$("aFeed").onclick = ()=>{
  if (!pet || pet.away) return;
  if (pet.hunger >= 95){ toast(pet.name+" is full right now 🍓"); return; }
  if (onCooldown("feed")){ return; }
  const before = pet.hunger;
  const f = bestFood(pet);
  act(p=>{
    if (!f.def){ p.inventory[f.id]--; }
    p.hunger = clamp(p.hunger + f.restore); p.feedCount++; bumpCare(p);
    const xp = scaledXp(6, before); gainXp(p, xp); p.coins += (xp>0?2:0);
    pop("🍓"); bounce();
    pushLog(p,"🍓", myName+" fed "+p.name+" a "+f.nm.toLowerCase()+".");
  });
  emitPulse("action","🍓","fed "+pet.name); markCaredToday();
};
$("aPlay").onclick = ()=>{
  if (!pet || pet.away) return;
  if (pet.energy<10){ toast(pet.name+" is too tired to play — let them rest."); return; }
  if (pet.happy >= 95){ toast(pet.name+" is having a great time already 🪁"); return; }
  if (onCooldown("play")){ return; }
  const before = pet.happy;
  act(p=>{ p.happy=clamp(p.happy+22); p.energy=clamp(p.energy-8); p.playCount++; bumpCare(p);
    const xp = scaledXp(7, before); gainXp(p, xp); p.coins += (xp>0?3:0);
    pop("🪁"); bounce(); pushLog(p,"🪁", myName+" played with "+p.name+"."); });
  emitPulse("action","🪁","played with "+pet.name); markCaredToday();
};
$("aSleep").onclick = ()=>{
  if (!pet || pet.away) return;
  if (pet.energy >= 95){ toast(pet.name+" is wide awake 💤"); return; }
  if (onCooldown("sleep")){ return; }
  const before = pet.energy;
  act(p=>{ p.energy=clamp(p.energy+30); bumpCare(p); gainXp(p, scaledXp(3, before)); pop("💤");
    pushLog(p,"💤", p.name+" took a cozy nap."); });
  emitPulse("action","💤","put "+pet.name+" down for a nap"); markCaredToday();
};
$("aClean").onclick = ()=>{
  if (!pet || pet.away) return;
  if (pet.clean >= 95){ toast(pet.name+" is squeaky clean 🫧"); return; }
  if (onCooldown("clean")){ return; }
  const before = pet.clean;
  act(p=>{ p.clean=clamp(p.clean+34); bumpCare(p); const xp=scaledXp(4, before); gainXp(p, xp); p.coins += (xp>0?2:0); pop("🫧"); bounce();
    pushLog(p,"🫧", myName+" gave "+p.name+" a bath."); });
  emitPulse("action","🫧","bathed "+pet.name); markCaredToday();
};

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
   TOGETHERNESS LAYER
   Presence, live action feed, reactions/nudges, notes, care
   streak, and "pet together". All live under pets/{bondId}/* as
   sibling subtrees that savePet() never overwrites.
============================================================ */
const TG = {
  clientId: Math.random().toString(36).slice(2,10),  // this tab/session
  presence: {},          // uid -> {name, t}
  unsubs: [],
  lastPulseT: Date.now(),// ignore pulses older than join time
  petTogether: { armed:false, mine:0, theirs:0 },
};
const todayKey = ()=>{ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };

function tgStart(id){
  tgStop();
  const db = getDb();

  // --- presence: write mine + onDisconnect cleanup, watch everyone's ---
  const myPres = ref(db, "pets/"+id+"/presence/"+myId);
  const writePres = ()=>{ set(myPres, { name: myName, client: TG.clientId, t: Date.now() }); onDisconnect(myPres).remove(); };
  writePres();
  const presHb = setInterval(writePres, 20000);
  onValue(ref(db, ".info/connected"), (s)=>{ if (s.val()===true) writePres(); });
  const offPres = onValue(ref(db, "pets/"+id+"/presence"), (snap)=>{
    TG.presence = snap.exists() ? snap.val() : {};
    renderPresence();
  });

  // --- live pulses (actions, hearts, boops, pet-together) ---
  const pulsesQ = query(ref(db, "pets/"+id+"/pulse"), limitToLast(8));
  const offPulse = onChildAdded(pulsesQ, (snap)=>{
    const ev = snap.val(); if (!ev) return;
    if (ev.t < TG.lastPulseT - 1500) return;      // skip backlog from before we joined
    handlePulse(ev, snap.key);
  });

  // --- notes ---
  const offNotes = onValue(ref(db, "pets/"+id+"/notes"), (snap)=>{
    const raw = snap.exists() ? snap.val() : {};
    renderNotes(raw);
  });

  // --- care map (for the streak) ---
  const offCare = onValue(ref(db, "pets/"+id+"/care"), (snap)=>{
    renderStreak(snap.exists() ? snap.val() : {});
  });

  TG.unsubs = [ ()=>clearInterval(presHb), offPres, offPulse, offNotes, offCare, ()=>{ try{ remove(myPres); }catch(_){} } ];
  TG.lastPulseT = Date.now();
}
function tgStop(){ TG.unsubs.forEach(fn=>{ try{ fn(); }catch(_){} }); TG.unsubs = []; }

/* ---------- emit a pulse (ephemeral live event) ---------- */
function emitPulse(kind, emoji, label){
  if (!bondId) return;
  const db = getDb();
  const pRef = push(ref(db, "pets/"+bondId+"/pulse"));
  const ev = { kind, emoji: emoji||"", label: label||"", uid: myId, name: myName, client: TG.clientId, t: Date.now() };
  set(pRef, ev);
  // auto-expire so the node doesn't grow forever
  setTimeout(()=>{ try{ remove(pRef); }catch(_){} }, 12000);
}

/* ---------- receive a pulse ---------- */
function handlePulse(ev, key){
  const mine = ev.uid === myId && ev.client === TG.clientId;

  if (ev.kind === "pet-together"){
    handlePetTogetherPulse(ev, mine);
    return;
  }

  // float an emoji on the stage for everyone
  if (ev.emoji) floatEmoji(ev.emoji, mine);

  if (ev.kind === "heart" || ev.kind === "boop"){
    if (ev.kind === "boop") bounce();
    if (!mine) toast((ev.name||"Your partner")+(ev.kind==="heart" ? " sent a heart 💗" : " booped "+(pet?pet.name:"your pet")+" 👉"));
    return;
  }

  // action pulses: only announce the partner's (you already saw your own)
  if (ev.kind === "action" && !mine){
    toast((ev.name||"Your partner")+" "+(ev.label||"did something"));
  }
}

/* ---------- presence UI ---------- */
function presentOthers(){
  return Object.keys(TG.presence).filter(uid => uid !== myId && TG.presence[uid]);
}
function bothHere(){ return presentOthers().length > 0; }

function renderPresence(){
  const w = $("tgWidget"); if (!w) return;
  const others = presentOthers();
  const dot = $("tgPresenceDot"), dot2 = $("tgPresenceDot2"), txt = $("tgPresenceText");
  if (others.length){
    const nm = TG.presence[others[0]].name || partnerName || "Your partner";
    if (dot) dot.className = "tg-dot on";
    if (dot2) dot2.className = "tg-dot on";
    txt.innerHTML = `<b>${escapeHtml(nm)}</b> is here too 💞`;
    $("creature").classList.add("together-glow");
    $("petTogetherBtn").classList.remove("hide");
    $("tgWidget").classList.add("active");
  } else {
    if (dot) dot.className = "tg-dot off";
    if (dot2) dot2.className = "tg-dot off";
    txt.textContent = partnerUid ? ((partnerName||"Your partner")+" isn’t here right now") : "Just you right now";
    $("creature").classList.remove("together-glow");
    $("petTogetherBtn").classList.add("hide");
    $("tgWidget").classList.remove("active");
    TG.petTogether.armed = false;
  }
  $("tgWidget").classList.toggle("solo", !partnerUid);
}

/* ---------- notes ---------- */
function sendNote(){
  const input = $("tgNoteInput");
  const text = (input.value||"").trim().slice(0,200);
  if (!text){ return; }
  const db = getDb();
  const nRef = push(ref(db, "pets/"+bondId+"/notes"));
  set(nRef, { uid: myId, name: myName, text, t: Date.now() });
  input.value = "";
  // also drop a gentle line in the diary
  if (pet){ act(p=> pushLog(p,"💌", myName+" left a note.")); }
  toast("Note left for "+(partnerName||"your partner")+" 💌");
}
function renderNotes(raw){
  const list = $("tgNotesList"); if (!list) return;
  const notes = Object.entries(raw).map(([id,n])=>({id,...n})).sort((a,b)=>b.t-a.t).slice(0,12);
  $("tgNotesCount").textContent = notes.length ? String(notes.length) : "";
  if (!notes.length){ list.innerHTML = `<div class="tg-note-empty">No notes yet — leave one for ${escapeHtml(partnerName||"your partner")}.</div>`; return; }
  list.innerHTML = "";
  notes.forEach(n=>{
    const fromMe = n.uid === myId;
    const div = document.createElement("div");
    div.className = "tg-note-item"+(fromMe?" mine":"");
    div.innerHTML = `<div class="tg-note-meta"><b>${escapeHtml(fromMe?"You":(n.name||"Partner"))}</b><span>${timeAgo(n.t)}</span></div>
      <div class="tg-note-text">${escapeHtml(n.text)}</div>
      ${fromMe?'<span class="tg-note-del" title="delete">×</span>':''}`;
    const del = div.querySelector(".tg-note-del");
    if (del) del.onclick = ()=>{ try{ remove(ref(getDb(),"pets/"+bondId+"/notes/"+n.id)); }catch(_){} };
    list.appendChild(div);
  });
}

/* ---------- care streak ----------
   care/{dayKey}/{uid} = t. A day counts if EITHER caretaker tended.
   Streak = consecutive days (ending today or yesterday) with any care. */
function markCaredToday(){
  if (!bondId) return;
  try { set(ref(getDb(), "pets/"+bondId+"/care/"+todayKey()+"/"+myId), Date.now()); } catch(_){}
}
function renderStreak(care){
  const el = $("tgStreak"); if (!el) return;
  const days = Object.keys(care||{});
  // compute consecutive-day streak ending today or yesterday
  const has = (d)=> !!care[d];
  const fmt = (date)=> date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
  let streak = 0; let cur = new Date();
  if (!has(fmt(cur))) cur.setDate(cur.getDate()-1); // allow streak to count through yesterday
  while (has(fmt(cur))){ streak++; cur.setDate(cur.getDate()-1); }

  // "last tended by"
  let lastBy = null, lastT = 0;
  for (const d of days){
    for (const uid of Object.keys(care[d])){
      const t = care[d][uid];
      if (t > lastT){ lastT = t; lastBy = uid; }
    }
  }
  let lastStr = "";
  if (lastBy){
    const who = lastBy === myId ? "You" : (TG.presence[lastBy]?.name || partnerName || nameCache[lastBy] || "Partner");
    lastStr = "Last tended by "+who+" "+timeAgo(lastT);
  }
  el.innerHTML = (streak>0 ? `<span class="tg-flame">🔥 ${streak} day${streak>1?"s":""}</span>` : `<span class="tg-flame off">No streak yet</span>`)
    + (lastStr ? `<span class="tg-last">${escapeHtml(lastStr)}</span>` : "");
}

/* ---------- pet together ----------
   Both online, both tap within the window -> bonus + special moment. */
const PET_TOGETHER_WINDOW = 4000;
function tryPetTogether(){
  if (!bothHere()){ toast("This is a moment for when you’re both here 💞"); return; }
  emitPulse("pet-together", "🫧", "wants to pet "+(pet?pet.name:"the pet")+" together");
  TG.petTogether.armed = true;
  TG.petTogether.mine = Date.now();
  $("petTogetherBtn").classList.add("waiting");
  $("petTogetherBtn").textContent = "waiting for "+(partnerName||"them")+"…";
  // resolve if partner already tapped
  maybeResolvePetTogether();
  // reset prompt after the window
  setTimeout(()=>{
    if ($("petTogetherBtn")){ $("petTogetherBtn").classList.remove("waiting"); $("petTogetherBtn").textContent = "🫶 Pet together"; }
  }, PET_TOGETHER_WINDOW+500);
}
function handlePetTogetherPulse(ev, mine){
  if (mine) return;
  TG.petTogether.theirs = Date.now();
  if (!TG.petTogether.armed){
    // they initiated — nudge me to join
    toast((ev.name||"Your partner")+" wants to pet "+(pet?pet.name:"the pet")+" together 🫶");
    const btn = $("petTogetherBtn");
    if (btn){ btn.classList.add("pulse-invite"); setTimeout(()=>btn.classList.remove("pulse-invite"), 4000); }
  }
  maybeResolvePetTogether();
}
function maybeResolvePetTogether(){
  const { mine, theirs } = TG.petTogether;
  if (mine && theirs && Math.abs(mine - theirs) <= PET_TOGETHER_WINDOW){
    const iApply = mine <= theirs;   // earlier tapper writes the bonus; both still celebrate
    TG.petTogether = { armed:false, mine:0, theirs:0 };
    const btn = $("petTogetherBtn");
    if (btn){ btn.classList.remove("waiting","pulse-invite"); btn.textContent = "🫶 Pet together"; }
    celebrateTogether();
    if (iApply){
      act(p=>{ p.happy=clamp(p.happy+18); p.coins+=8; gainXp(p,10);
        pushLog(p,"🫶", myName+" and "+(partnerName||"partner")+" pet "+p.name+" together."); });
      markCaredToday();
    }
  }
}
function celebrateTogether(){
  for (let i=0;i<10;i++) setTimeout(()=> floatEmoji(["💞","✨","🫧","💗"][i%4], i%2===0), i*90);
  bounce();
  toast("You pet "+(pet?pet.name:"your companion")+" together 💞");
}

/* ---------- shared float helper ---------- */
function floatEmoji(emoji, fromMe){
  const s = document.querySelector(".stage"); if (!s) return;
  const el = document.createElement("div");
  el.className = "floatup"; el.textContent = emoji;
  el.style.left = (fromMe ? 38+Math.random()*10 : 52+Math.random()*10)+"%";
  el.style.top = "44%";
  s.appendChild(el); setTimeout(()=>el.remove(), 1200);
}


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
      const reached = seq.length;
      // reward only really kicks in past round 1, so an instant fail isn't farmable
      const reward = reached <= 1 ? 1 : reached*4;
      $("mgStatus").innerHTML="Oops — "+pet.name+" giggled. You reached round <b>"+reached+"</b>.";
      act(p=>{
        p.coins+=reward;
        // happiness from play still respects the "already happy" ceiling
        const gain = Math.round(reached*3 * needFactor(p.happy));
        p.happy=clamp(p.happy+gain);
        gainXp(p, reached<=1 ? 0 : reached*2);
        pushLog(p,"🎲", myName+" played Memory Bloom — earned ✦"+reward+".");
      });
      seq=[]; return;
    }
    if(input.length===seq.length){ $("mgStatus").innerHTML="Nice! Next round…"; setTimeout(next,800); }
  }
  $("mgStart").onclick=start; build();
})();

/* ---------- not configured fallback ---------- */
if (!FIREBASE_READY){ showSignedOut(); }