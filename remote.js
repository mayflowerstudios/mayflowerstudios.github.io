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

// Wait for MFAuth, then reveal either the gate or the connect form.
function boot() {
  if (!window.MFAuth || !MFAuth.isConfigured()) {
    setStatus("Sign-in isn't available right now.");
    return;
  }
  MFAuth.onChange((user) => {
    me = user || null;
    if (me) {
      $("remGate").classList.add("rem-hidden");
      $("remConnect").classList.remove("rem-hidden");
      try { db = getDatabase(getApp()); } catch (e) { setStatus("Couldn't reach the database."); }
    } else {
      $("remGate").classList.remove("rem-hidden");
      $("remConnect").classList.add("rem-hidden");
    }
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 0));
} else {
  setTimeout(boot, 0);
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
  pc.ontrack = (e) => { video.srcObject = e.streams[0]; showViewer(); };
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
