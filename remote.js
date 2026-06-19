// remote.js — connect/client side. Owner-locked: only the signed-in owner can
// touch the room (enforced by RTDB rules). Signaling rides on the existing
// Firebase app the site already initialized via auth.js. No passphrase.
//
// Signaling tree (under /remote/<room>/):
//   owner                     : owner uid (written by host)
//   hostOnline                : boolean
//   host/offer/<clientId>     : host SDP offer for a client
//   host/ice/<clientId>/*     : host ICE candidates
//   clients/<clientId>/uid    : this client's uid (must equal auth.uid)
//   clients/<clientId>/answer : this client's SDP answer
//   clients/<clientId>/ice/*  : this client's ICE candidates
//   clients/<clientId>/screen : requested screen id
//   clients/<clientId>/input  : forwarded input events

import {
  getDatabase, ref, set, onValue, onChildAdded, push, remove, get, onDisconnect,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const $ = (id) => document.getElementById(id);
const statusEl = $("remStatus");
const video = $("remVideo");

let db = null;
let me = null;          // current user
let pc = null;
let room = null;
let clientId = null;
let detachers = [];

const setStatus = (t) => { statusEl.textContent = t; };

// We need window.MFAuth (from auth.js). On normal pages shared.js injects it,
// but to be self-sufficient this page loads it directly if it's not present.
// Then we wait until MFAuth reports ready before deciding signed-in vs not.
function ensureAuthScript() {
  if (window.MFAuth) return;
  if (document.querySelector('script[data-mf-src="/auth.js"]') ||
      document.querySelector('script[data-mf-auth]')) return; // already loading
  const s = document.createElement("script");
  // Match shared.js's cache-busting query if present, else load plain.
  const ver = (window.MF_ASSET_VER || "").toString();
  s.src = "/auth.js" + (ver ? "?v=" + ver : "");
  s.setAttribute("data-mf-src", "/auth.js");
  s.setAttribute("data-mf-auth", "1");
  document.body.appendChild(s);
}

function wireAuth() {
  // onChange fires immediately if MFAuth is already ready, otherwise when it
  // becomes ready — covering both load orders.
  MFAuth.onChange((user) => {
    me = user || null;
    $("remChecking").classList.add("rem-hidden");
    if (me) {
      $("remGate").classList.add("rem-hidden");
      $("remConnect").classList.remove("rem-hidden");
      if (!db) { try { db = getDatabase(getApp()); } catch (e) { setStatus("Couldn't reach the database."); } }
    } else {
      $("remGate").classList.remove("rem-hidden");
      $("remConnect").classList.add("rem-hidden");
    }
  });
}

function boot() {
  ensureAuthScript();
  let waited = 0;
  const tick = () => {
    // Wait for MFAuth to exist AND finish its async init (isReady), so we don't
    // read a transient signed-out state before the session restores.
    if (window.MFAuth && typeof MFAuth.onChange === "function" && MFAuth.isReady && MFAuth.isReady()) {
      wireAuth();
      return;
    }
    // If MFAuth exists but has no isReady (older build), just wire it.
    if (window.MFAuth && typeof MFAuth.onChange === "function" && !MFAuth.isReady) {
      wireAuth();
      return;
    }
    waited += 100;
    if (waited >= 10000) {
      const c = $("remChecking");
      const present = !!window.MFAuth;
      console.warn("[remote] auth gate timed out. window.MFAuth present:", present,
        present ? { isConfigured: MFAuth.isConfigured && MFAuth.isConfigured(), isReady: MFAuth.isReady && MFAuth.isReady() } : "(auth.js never loaded)");
      if (c) c.querySelector(".rem-gate").innerHTML = present
        ? 'Sign-in is taking too long. Try a hard refresh (Ctrl/Cmd+Shift+R). If it persists, check the console.'
        : 'Sign-in didn\u2019t load on this page. Make sure auth.js is deployed, then hard-refresh. <a href="/account.html">Sign in here</a>.';
      return;
    }
    setTimeout(tick, 100);
  };
  tick();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

$("remConnectBtn").onclick = connect;

async function connect() {
  if (!me || !db) { setStatus("You need to be signed in."); return; }
  room = ($("remRoom").value || "").trim().toLowerCase();
  if (!room) { setStatus("Enter a room name."); return; }

  $("remConnectBtn").disabled = true;
  setStatus("Checking room…");

  // The rules only let the owner read this, so a successful read also proves
  // we own it. If the host isn't online, bail early.
  let snap;
  try {
    snap = await get(ref(db, `remote/${room}`));
  } catch (e) {
    setStatus("That room isn't yours, or it doesn't exist.");
    $("remConnectBtn").disabled = false;
    return;
  }
  const val = snap.val();
  if (!val) { setStatus("No such room. Start sharing it from the host first."); $("remConnectBtn").disabled = false; return; }
  if (val.owner !== me.uid) { setStatus("That room belongs to another account."); $("remConnectBtn").disabled = false; return; }
  if (val.hostOnline !== true) { setStatus("The host isn't online right now."); $("remConnectBtn").disabled = false; return; }

  clientId = push(ref(db, `remote/${room}/clients`)).key;
  const myRef = ref(db, `remote/${room}/clients/${clientId}`);
  await set(myRef, { uid: me.uid, joinedAt: Date.now() });
  onDisconnect(myRef).remove();

  setStatus("Connecting…");
  $("remRoomLabel").textContent = room;

  pc = new RTCPeerConnection(RTC_CONFIG);

  // Build our own MediaStream from incoming tracks rather than trusting
  // e.streams[0], which can be empty depending on how the host added them.
  const inboundStream = new MediaStream();
  pc.ontrack = (e) => {
    if (e.streams && e.streams[0]) {
      video.srcObject = e.streams[0];
    } else {
      inboundStream.addTrack(e.track);
      video.srcObject = inboundStream;
    }
    showViewer();
    // Autoplay of a freshly assigned srcObject is often blocked; force it.
    video.play().catch((err) => {
      console.warn("[remote] autoplay blocked:", err);
      setStatus("Tap the video to start playback.");
      video.addEventListener("click", () => video.play().catch(()=>{}), { once: true });
    });
  };

  pc.oniceconnectionstatechange = () => {
    console.log("[remote] ICE state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "failed") {
      setStatus("Connection failed — likely a network that needs a TURN server.");
    } else if (pc.iceConnectionState === "disconnected") {
      setStatus("Connection dropped.");
    }
  };
  pc.onconnectionstatechange = () => console.log("[remote] PC state:", pc.connectionState);

  pc.ondatachannel = (e) => {
    e.channel.onmessage = (m) => {
      const p = JSON.parse(m.data);
      if (p.type === "screens") populateScreens(p.list);
    };
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) push(ref(db, `remote/${room}/clients/${clientId}/ice`), e.candidate.toJSON());
  };

  // Wait for the host's offer.
  detachers.push(onValue(ref(db, `remote/${room}/host/offer/${clientId}`), async (s) => {
    const offer = s.val();
    if (!offer || pc.currentRemoteDescription) return;
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await set(ref(db, `remote/${room}/clients/${clientId}/answer`), { type: answer.type, sdp: answer.sdp });
  }));

  // Host ICE candidates.
  detachers.push(onChildAdded(ref(db, `remote/${room}/host/ice/${clientId}`), (s) => {
    const c = s.val();
    if (c) pc.addIceCandidate(c).catch(() => {});
  }));

  setStatus("Waiting for the host's stream…");
}

function showViewer() {
  $("remConnect").classList.add("rem-hidden");
  $("remViewer").classList.remove("rem-hidden");
  $("remDot").classList.add("on");
  setStatus("Live.");
}

function populateScreens(list) {
  const sel = $("remScreenSelect");
  sel.innerHTML = "";
  for (const s of list) {
    const o = document.createElement("option");
    o.value = s.id; o.textContent = s.label;
    sel.appendChild(o);
  }
  sel.disabled = list.length < 2;
}

$("remScreenSelect").onchange = (e) => {
  if (room && clientId) set(ref(db, `remote/${room}/clients/${clientId}/screen`), e.target.value);
};
$("remFs").onclick = () => { if (video.requestFullscreen) video.requestFullscreen(); };
$("remLeave").onclick = leave;

async function leave() {
  for (const d of detachers) { try { d(); } catch {} }
  detachers = [];
  if (pc) pc.close();
  if (db && room && clientId) { try { await remove(ref(db, `remote/${room}/clients/${clientId}`)); } catch {} }
  location.reload();
}

// --- Remote input forwarding (normalized 0..1) ---
$("remControl").onchange = (e) => { e.target.checked ? attachInput() : detachInput(); };
function relPos(ev) {
  const r = video.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
}
function pushInput(event) {
  if (db && room && clientId) push(ref(db, `remote/${room}/clients/${clientId}/input`), { ...event, t: Date.now() });
}
const onMove = (ev) => pushInput({ kind: "move", ...relPos(ev) });
const onDown = (ev) => pushInput({ kind: "down", button: ev.button, ...relPos(ev) });
const onUp = (ev) => pushInput({ kind: "up", button: ev.button, ...relPos(ev) });
const onKey = (ev) => { pushInput({ kind: ev.type, key: ev.key, code: ev.code }); ev.preventDefault(); };
function attachInput() {
  video.addEventListener("mousemove", onMove);
  video.addEventListener("mousedown", onDown);
  video.addEventListener("mouseup", onUp);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
}
function detachInput() {
  video.removeEventListener("mousemove", onMove);
  video.removeEventListener("mousedown", onDown);
  video.removeEventListener("mouseup", onUp);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("keyup", onKey);
}