// date-night.js — Date Night room logic (Mayflower Studios)
// Uses the same Firebase project as Watch Together / Together room.
// Data namespace: datenight/${ROOM}/... so it never collides with other features.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, onValue, onChildAdded, set, get, update, remove, push,
  onDisconnect, serverTimestamp, query, limitToLast
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
const toastEl = $("toast");
let toastTimer;
function toast(msg){ toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(()=>toastEl.classList.remove("show"), 2400); }

function cleanName(s){ return (s||"").toLowerCase().replace(/[.#$\[\]\/]/g,"").trim().slice(0,40); }
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function timeAgo(ts){
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s/60) + "m ago";
  if (s < 86400) return Math.floor(s/3600) + "h ago";
  const d = Math.floor(s/86400);
  return d === 1 ? "yesterday" : d + "d ago";
}

// Identity comes from the account system (window.MFAuth), set once signed in.
let myId = null;
let displayName = "";

let db = null;
if (FIREBASE_READY){
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getDatabase(app);
  $("connText").textContent = "ready";
} else {
  $("connText").textContent = "offline";
}

let ROOM = null;

// ---------- account gate ----------
// Date Night is an account feature: you must be signed in to use it.
function waitForAuth(cb){
  if (window.MFAuth && MFAuth.isReady()) return cb();
  let n = 0;
  const iv = setInterval(() => {
    if (window.MFAuth && MFAuth.isReady()){ clearInterval(iv); cb(); }
    else if (++n > 100) clearInterval(iv);
  }, 80);
}

let authOK = false;
function refreshIdentity(){
  if (window.MFAuth && MFAuth.uid){
    myId = MFAuth.uid;
    displayName = MFAuth.name() || "someone";
    authOK = true;
  } else {
    authOK = false;
  }
}

// ---------- room entry ----------
const params = new URLSearchParams(location.search);
const presetRoom = cleanName(params.get("room"));
if (presetRoom) $("roomInput").value = presetRoom;

$("enterBtn").addEventListener("click", () => {
  if (!authOK){ promptSignIn(); return; }
  const r = cleanName($("roomInput").value);
  if (!r){ toast("Pick a room name first"); return; }
  enterRoom(r);
});
$("roomInput").addEventListener("keydown", e => { if (e.key === "Enter") $("enterBtn").click(); });
$("leaveBtn").addEventListener("click", () => { location.href = "together.html"; });
$("copyBtn").addEventListener("click", async () => {
  const url = location.origin + location.pathname + "?room=" + encodeURIComponent(ROOM);
  try { await navigator.clipboard.writeText(url); toast("Link copied 🔗"); }
  catch { toast(url); }
});

function promptSignIn(){
  toast("Sign in to open a date night 💕");
  setTimeout(() => { location.href = "/account.html?next=" + encodeURIComponent(location.pathname + location.search); }, 900);
}

function showSignInGate(){
  const gate = $("gateView");
  if (gate) gate.innerHTML = `
    <div class="divider"></div>
    <div class="row" style="flex-direction:column; align-items:flex-start; gap:14px; max-width:480px;">
      <p style="margin:0; opacity:.85; line-height:1.6;">Date Night is a little space tied to your account, so your name and notes follow you. Sign in to open one. 💜</p>
      <a class="btn primary" href="/account.html?next=${encodeURIComponent(location.pathname + location.search)}">Sign in to continue →</a>
    </div>`;
}

waitForAuth(() => {
  if (!window.MFAuth || !MFAuth.isConfigured()){ $("connText").textContent = "offline"; return; }
  MFAuth.onChange(() => {
    refreshIdentity();
    if (authOK){
      // restore the normal gate if it was swapped for a sign-in prompt
      if (roomEntered){ /* already in a room; name updates handled in presence */ }
      if (ROOM){ set(P(`presence/${myId}/name`), displayName); }
      // auto-enter from a shared link now that we're authed
      if (presetRoom && !roomEntered){ try { enterRoom(presetRoom); } catch(err){ console.error(err); } }
    } else {
      showSignInGate();
    }
  });
});

let roomEntered = false;
function enterRoom(room){
  if (!FIREBASE_READY){ toast("Firebase not configured"); return; }
  if (!authOK){ promptSignIn(); return; }
  if (roomEntered) return;
  roomEntered = true;
  ROOM = room;
  $("gateView").style.display = "none";
  $("roomView").style.display = "block";
  $("roomLabel").textContent = room;
  const u = new URL(location.href); u.searchParams.set("room", room); history.replaceState(null,"",u);

  setupTabs();
  setupPresence();
  setupAmbiance();
  setupMusic();
  setupNotes();
  setupJar();
}

const P = (sub) => ref(db, `datenight/${ROOM}/${sub}`);

// ---------- tabs ----------
let tabsReady = false;
function setupTabs(){
  if (tabsReady) return; tabsReady = true;
  const tabs = $("tabs").querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach(t => {
    t.addEventListener("click", () => {
      const name = t.dataset.tab;
      tabs.forEach(x => x.classList.toggle("active", x === t));
      panels.forEach(p => p.classList.toggle("active", p.dataset.panel === name));
    });
  });
}

// Display name comes from the signed-in account (MFAuth); no per-room name input.

// ---------- presence ----------
function setupPresence(){
  const pRef = P(`presence/${myId}`);
  const write = () => { set(pRef, { name: displayName || "someone", t: Date.now() }); onDisconnect(pRef).remove(); };
  write();
  // Heartbeat so we stay "fresh"; stale reload/crash entries age out.
  setInterval(write, 20000);
  onValue(ref(db, ".info/connected"), (snap) => {
    const on = snap.val() === true;
    $("connDot").className = "dot " + (on ? "on" : "off");
    $("connText").textContent = on ? "connected" : "offline";
    if (on) write();
  });
  onValue(P("presence"), (snap) => {
    const raw = snap.val() || {};
    const now = Date.now();
    const all = {};
    Object.keys(raw).forEach(id => {
      const t = (raw[id] && raw[id].t) || 0;
      if (id === myId || (now - t) < 70000) all[id] = raw[id];
      else { try { set(P(`presence/${id}`), null); } catch(_){} }
    });
    const ids = Object.keys(all);
    $("hereCount").textContent = ids.length;
    const note = $("missNote");
    if (ids.length < 2){ note.style.display = "block"; note.textContent = "Waiting for your person to join… share the link with the 🔗 button above. 💕"; }
    else { note.style.display = "none"; }
  });
}

// ============================================================
//  AMBIANCE — shared scene + ambient sound
// ============================================================
const SCENES = [
  { id:"candlelit", icon:"🕯️", label:"Candlelit",     desc:"Warm, flickering, soft.",  grad:"linear-gradient(135deg,#3a1d2e,#1a0f18)", freq:"warm" },
  { id:"rain",      icon:"🌧️", label:"Rainy window",  desc:"Cozy rain, nowhere to be.", grad:"linear-gradient(135deg,#1e2a3a,#0f1722)", freq:"rain" },
  { id:"fireplace", icon:"🔥", label:"Fireplace",     desc:"Crackling and golden.",     grad:"linear-gradient(135deg,#3a2410,#1a1108)", freq:"fire" },
  { id:"starry",    icon:"✨", label:"Starry night",  desc:"Quiet sky, just us.",       grad:"linear-gradient(135deg,#1a1b3a,#0b0f22)", freq:"night" },
  { id:"cafe",      icon:"☕", label:"Cozy cafe",     desc:"Soft hum, warm drinks.",    grad:"linear-gradient(135deg,#2e2418,#17120c)", freq:"cafe" },
  { id:"beach",     icon:"🌊", label:"By the sea",    desc:"Slow waves at dusk.",       grad:"linear-gradient(135deg,#16323a,#0b1820)", freq:"waves" },
];

let ambientAudio = null;      // WebAudio noise generator
let ambientOn = false;
let ambientGain = null;
let ambientCtx = null;
let currentScene = null;

function setupAmbiance(){
  const grid = $("sceneGrid");
  grid.innerHTML = "";
  SCENES.forEach(sc => {
    const card = document.createElement("div");
    card.className = "sceneCard";
    card.dataset.scene = sc.id;
    card.style.background = sc.grad;
    card.innerHTML = `<span class="scIcon">${sc.icon}</span><span class="scLabel">${sc.label}</span>`;
    card.addEventListener("click", () => set(P("scene"), { id: sc.id, by: displayName || "someone", t: Date.now() }));
    grid.appendChild(card);
  });

  onValue(P("scene"), (snap) => {
    const v = snap.val();
    applyScene(v ? v.id : null);
  });

  $("soundToggle").addEventListener("click", toggleSound);
  $("soundVol").addEventListener("input", () => {
    if (ambientGain) ambientGain.gain.value = ($("soundVol").value/100) * 0.4;
  });
}

function applyScene(id){
  currentScene = id;
  document.querySelectorAll(".sceneCard").forEach(c => c.classList.toggle("active", c.dataset.scene === id));
  const sc = SCENES.find(s => s.id === id);
  if (sc){
    $("anIcon").textContent = sc.icon;
    $("anTitle").textContent = sc.label;
    $("anDesc").textContent = sc.desc;
    // tint the page background glow subtly
    document.body.style.transition = "background .8s ease";
    if (ambientOn) startAmbientFor(sc.freq);
  } else {
    $("anIcon").textContent = "🌙";
    $("anTitle").textContent = "No scene yet";
    $("anDesc").textContent = "Pick one above to set the mood for both of you.";
  }
}

// Synthesized ambient sound (no external files) — filtered noise per scene
function ensureCtx(){
  if (!ambientCtx){
    ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
    ambientGain = ambientCtx.createGain();
    ambientGain.gain.value = ($("soundVol").value/100) * 0.4;
    ambientGain.connect(ambientCtx.destination);
  }
}
function makeNoise(){
  const bufferSize = 2 * ambientCtx.sampleRate;
  const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i=0;i<bufferSize;i++) data[i] = Math.random()*2 - 1;
  const node = ambientCtx.createBufferSource();
  node.buffer = buffer; node.loop = true;
  return node;
}
function startAmbientFor(freq){
  ensureCtx();
  stopAmbientNodes();
  const src = makeNoise();
  const filter = ambientCtx.createBiquadFilter();
  // shape the noise differently per scene for distinct moods
  const presets = {
    rain:  { type:"lowpass",  f:1800, q:0.6 },
    fire:  { type:"lowpass",  f:700,  q:0.8 },
    waves: { type:"lowpass",  f:500,  q:1.2 },
    cafe:  { type:"bandpass", f:1000, q:0.5 },
    night: { type:"lowpass",  f:350,  q:0.7 },
    warm:  { type:"lowpass",  f:600,  q:0.6 },
  };
  const p = presets[freq] || presets.warm;
  filter.type = p.type; filter.frequency.value = p.f; filter.Q.value = p.q;
  src.connect(filter); filter.connect(ambientGain);
  src.start();
  ambientAudio = { src, filter };
  // gentle slow LFO on volume for waves/rain to feel alive
  if (freq === "waves" || freq === "rain"){
    const lfo = ambientCtx.createOscillator();
    const lfoGain = ambientCtx.createGain();
    lfo.frequency.value = freq === "waves" ? 0.12 : 0.3;
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain); lfoGain.connect(ambientGain.gain);
    lfo.start();
    ambientAudio.lfo = lfo;
  }
}
function stopAmbientNodes(){
  if (ambientAudio){
    try { ambientAudio.src.stop(); } catch(_){}
    try { if (ambientAudio.lfo) ambientAudio.lfo.stop(); } catch(_){}
    ambientAudio = null;
  }
}
function toggleSound(){
  ambientOn = !ambientOn;
  const btn = $("soundToggle");
  if (ambientOn){
    ensureCtx();
    if (ambientCtx.state === "suspended") ambientCtx.resume();
    const sc = SCENES.find(s => s.id === currentScene);
    startAmbientFor(sc ? sc.freq : "warm");
    btn.textContent = "🔊 Sound on";
    if (!sc) toast("Pick a scene to hear its sound");
  } else {
    stopAmbientNodes();
    btn.textContent = "🔇 Sound off";
  }
}

// ============================================================
//  MUSIC — synced YouTube listening (IFrame API)
// ============================================================
let ytPlayer = null, ytReady = false, ytApiLoading = false;
let musicSuppress = false;   // ignore our own echo when applying remote state
let lastMusicState = null;

function parseYouTube(input){
  if (!input) return null;
  const s = input.trim();
  // plain 11-char id
  if (/^[\w-]{11}$/.test(s)) return { type:"video", id:s };
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) return { type:"video", id:u.pathname.slice(1,12) };
    if (u.searchParams.get("list")) return { type:"list", id:u.searchParams.get("list") };
    const v = u.searchParams.get("v");
    if (v) return { type:"video", id:v.slice(0,11) };
  } catch(_){}
  return null;
}

function loadYTApi(cb){
  if (window.YT && window.YT.Player){ cb(); return; }
  if (ytApiLoading){ const i = setInterval(()=>{ if (window.YT&&window.YT.Player){clearInterval(i); cb();} },120); return; }
  ytApiLoading = true;
  window.onYouTubeIframeAPIReady = cb;
  const s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
}

function setupMusic(){
  $("musicLoad").addEventListener("click", () => {
    const parsed = parseYouTube($("musicUrl").value);
    if (!parsed){ toast("Couldn't read that link"); return; }
    set(P("music"), { ...parsed, state:1, time:0, by: displayName || "someone", t: Date.now() });
    $("musicUrl").value = "";
  });
  $("musicPlay").addEventListener("click", () => pushMusicState(1));
  $("musicPause").addEventListener("click", () => pushMusicState(2));
  $("musicSync").addEventListener("click", () => { if (lastMusicState) applyMusic(lastMusicState, true); });

  onValue(P("music"), (snap) => {
    const v = snap.val();
    if (!v) return;
    lastMusicState = v;
    applyMusic(v, false);
  });
}

function pushMusicState(state){
  if (!ytPlayer || !ytReady) return;
  const time = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
  update(P("music"), { state, time, t: Date.now(), by: displayName || "someone" });
}

function applyMusic(v, force){
  const placeholder = $("ytPlaceholder");
  if (placeholder) placeholder.style.display = "none";

  const ensurePlayer = (cb) => {
    if (ytPlayer && ytReady){ cb(); return; }
    loadYTApi(() => {
      ytPlayer = new YT.Player("ytEmbed", {
        width:"100%", height:"100%",
        playerVars:{ rel:0, modestbranding:1 },
        events:{
          onReady: () => { ytReady = true; cb(); },
          onStateChange: (e) => {
            if (musicSuppress) return;
            if (e.data === YT.PlayerState.PLAYING) pushMusicState(1);
            else if (e.data === YT.PlayerState.PAUSED) pushMusicState(2);
          }
        }
      });
    });
  };

  ensurePlayer(() => {
    musicSuppress = true;
    const loadedId = ytPlayer._dnId;
    if (v.type === "list"){
      if (loadedId !== "list:"+v.id){ ytPlayer.loadPlaylist({ list:v.id }); ytPlayer._dnId = "list:"+v.id; }
    } else {
      if (loadedId !== v.id){ ytPlayer.loadVideoById(v.id, v.time||0); ytPlayer._dnId = v.id; }
    }
    // sync time if drifted more than 2.5s
    setTimeout(() => {
      try {
        if (typeof v.time === "number" && ytPlayer.getCurrentTime){
          const drift = Math.abs(ytPlayer.getCurrentTime() - v.time);
          if (drift > 2.5 || force) ytPlayer.seekTo(v.time, true);
        }
        if (v.state === 1) ytPlayer.playVideo();
        else if (v.state === 2) ytPlayer.pauseVideo();
      } catch(_){}
      setTimeout(()=>{ musicSuppress = false; }, 600);
    }, 350);
    $("musicNow").textContent = v.by ? `loaded by ${escapeHtml(v.by)}` : "";
  });
}

// ============================================================
//  LOVE NOTES — persistent shared wall
// ============================================================
function setupNotes(){
  $("noteAdd").addEventListener("click", addNote);
  const wall = $("notesWall");

  onValue(P("notes"), (snap) => {
    const all = snap.val() || {};
    const ids = Object.keys(all).sort((a,b) => (all[b].t||0) - (all[a].t||0));
    wall.innerHTML = "";
    if (!ids.length){
      wall.innerHTML = `<div class="notesEmpty">No notes yet — be the first to pin one. 🌸</div>`;
      return;
    }
    ids.forEach(id => {
      const n = all[id];
      const card = document.createElement("div");
      card.className = "noteCard";
      const mine = n.by === (displayName || "someone");
      card.innerHTML = `<div>${escapeHtml(n.text)}</div>
        <div class="nMeta"><span>— ${escapeHtml(n.by||"someone")} · ${timeAgo(n.t)}</span>
        <button class="nDel" title="Remove">🗑</button></div>`;
      card.querySelector(".nDel").addEventListener("click", () => remove(P(`notes/${id}`)));
      wall.appendChild(card);
    });
  });
}
function addNote(){
  const text = $("noteBox").value.trim();
  if (!text){ toast("Write something first 💭"); return; }
  push(P("notes"), { text, by: displayName || "someone", t: Date.now() });
  $("noteBox").value = "";
  toast("Pinned 💞");
}

// ============================================================
//  REASONS JAR
// ============================================================
let jarReasons = {};
function setupJar(){
  $("jarAdd").addEventListener("click", addReason);
  $("jarInput").addEventListener("keydown", e => { if (e.key==="Enter") addReason(); });
  $("jarPull").addEventListener("click", pullReason);

  onValue(P("reasons"), (snap) => {
    jarReasons = snap.val() || {};
    const n = Object.keys(jarReasons).length;
    $("jarCount").textContent = n === 1 ? "1 in the jar" : `${n} in the jar`;
  });
  // shared "currently drawn" reason so both see the same pull
  onValue(P("drawn"), (snap) => {
    const v = snap.val();
    if (!v || !v.text) return;
    showReason(v.text);
  });
}
function addReason(){
  const text = $("jarInput").value.trim();
  if (!text){ toast("Type a reason first"); return; }
  push(P("reasons"), { text, t: Date.now() });
  $("jarInput").value = "";
  toast("Added to the jar 🫙");
}
function pullReason(){
  const ids = Object.keys(jarReasons);
  if (!ids.length){ toast("The jar is empty — add a few reasons first 💕"); return; }
  const pick = jarReasons[ids[Math.floor(Math.random()*ids.length)]];
  set(P("drawn"), { text: pick.text, t: Date.now() });
}
function showReason(text){
  const jar = $("jarIcon");
  jar.classList.remove("shake"); void jar.offsetWidth; jar.classList.add("shake");
  const card = $("reasonCard");
  card.classList.remove("empty");
  card.textContent = "“" + text + "”";
}

