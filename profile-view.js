/* profile-view.js — Mayflower Studios public profile overlay
   Exposes window.MFProfile.show(uid). Injected on every page by shared.js.
   Reads users/$uid and status/$uid via MFAuth's shared db connection. */
(function () {
  let dbMods = null, db = null, statusUnsub = null;

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
  function lastSeenText(st) {
    if (!st) return "";
    if (st.state === "online") return "online now";
    const t = st.last;
    if (!t) return "offline";
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 90) return "last seen just now";
    if (s < 3600) return "last seen " + Math.floor(s/60) + "m ago";
    if (s < 86400) return "last seen " + Math.floor(s/3600) + "h ago";
    const d = Math.floor(s/86400);
    return "last seen " + (d === 1 ? "yesterday" : d + "d ago");
  }

  function ensureDOM() {
    if (document.getElementById("mfProfOverlay")) return;
    const ov = document.createElement("div");
    ov.id = "mfProfOverlay";
    ov.className = "mf-prof-overlay";
    ov.innerHTML = `<div class="mf-prof-card" id="mfProfCard" role="dialog" aria-modal="true"></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) hide(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  }

  function hide() {
    const ov = document.getElementById("mfProfOverlay");
    if (ov) ov.classList.remove("open");
    if (statusUnsub) { try { statusUnsub(); } catch (_) {} statusUnsub = null; }
  }

  async function show(uid) {
    if (!window.MFAuth || !MFAuth.isConfigured() || !uid) return;
    ensureDOM();
    if (!dbMods) {
      db = MFAuth.db;
      if (!db) { let n=0; while(!MFAuth.db && n++<40){ await new Promise(r=>setTimeout(r,80)); } db = MFAuth.db; }
      if (!db) return;
      dbMods = await import(`https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js`);
    }
    const card = document.getElementById("mfProfCard");
    card.innerHTML = `<div class="mf-prof-loading">Loading…</div>`;
    document.getElementById("mfProfOverlay").classList.add("open");

    let prof = {};
    try {
      const snap = await dbMods.get(dbMods.ref(db, `users/${uid}`));
      prof = snap.exists() ? snap.val() : {};
    } catch (_) {}

    const name = prof.displayName || "someone";
    const accent = (typeof prof.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(prof.accent)) ? prof.accent : "#f9a8d4";
    const a = MFAuth.avatarFor(prof, name);
    const avatarHTML = a.kind === "photo"
      ? `<img src="${esc(a.value)}" alt="">`
      : `<span>${esc(a.value)}</span>`;
    const isMe = MFAuth.uid === uid;

    const bannerStyle = (prof.bannerURL && /^https?:\/\//.test(prof.bannerURL))
      ? ` style="background-image:linear-gradient(to top,rgba(11,17,32,.4),transparent 60%),url('${esc(prof.bannerURL)}');background-size:cover;background-position:center;opacity:1;"`
      : "";

    card.style.setProperty("--prof-accent", accent);
    card.innerHTML = `
      <button class="mf-prof-x" id="mfProfX" aria-label="Close">✕</button>
      <div class="mf-prof-banner"${bannerStyle}></div>
      <div class="mf-prof-avatar">${avatarHTML}</div>
      <div class="mf-prof-body">
        <div class="mf-prof-name">${esc(name)} ${prof.pronouns ? `<span class="mf-prof-pron">${esc(prof.pronouns)}</span>` : ""}</div>
        <div class="mf-prof-presence" id="mfProfPresence"><span class="mf-prof-dot"></span><span id="mfProfPresText">—</span></div>
        ${prof.status ? `<div class="mf-prof-status">“${esc(prof.status)}”</div>` : ""}
        ${prof.bio ? `<p class="mf-prof-bio">${esc(prof.bio)}</p>` : `<p class="mf-prof-bio dim">No bio yet.</p>`}
        <div class="mf-prof-actions" id="mfProfActions">
          ${isMe
            ? `<a class="mf-prof-btn" href="/account.html">Edit your profile</a>`
            : `<span class="mf-prof-dim">…</span>`}
        </div>
      </div>`;

    card.querySelector("#mfProfX").addEventListener("click", hide);

    // Friend-aware action button (only for other people)
    if (!isMe && window.MFAuth && MFAuth.areFriends) {
      const actions = card.querySelector("#mfProfActions");
      MFAuth.areFriends(uid).then(friends => {
        if (friends) {
          actions.innerHTML = `<button class="mf-prof-btn" id="mfProfDM">💌 Message ${esc(name)}</button>`;
          actions.querySelector("#mfProfDM").addEventListener("click", () => { hide(); if (window.MFChat) MFChat.openDM(uid); });
        } else {
          actions.innerHTML = `<button class="mf-prof-btn" id="mfProfAdd">＋ Add ${esc(name)}</button><div class="mf-prof-dim" id="mfProfAddMsg" style="margin-top:8px;"></div>`;
          actions.querySelector("#mfProfAdd").addEventListener("click", async () => {
            const m = card.querySelector("#mfProfAddMsg");
            try {
              if (!prof.username) throw new Error("They haven't set a username yet");
              await MFAuth.sendFriendRequest(prof.username);
              if (m) m.textContent = "Friend request sent ✨";
              const btn = actions.querySelector("#mfProfAdd"); if (btn) btn.disabled = true;
            } catch (e) { if (m) m.textContent = (e && e.message) || "Couldn't send request"; }
          });
        }
      });
    }

    // live presence
    const dot = card.querySelector(".mf-prof-dot");
    const txt = card.querySelector("#mfProfPresText");
    if (MFAuth.watchStatus) {
      statusUnsub = MFAuth.watchStatus(uid, (st) => {
        const online = st && st.state === "online";
        if (dot) dot.classList.toggle("on", online);
        if (txt) txt.textContent = lastSeenText(st);
      });
    }
  }

  window.MFProfile = { show, hide };
})();
