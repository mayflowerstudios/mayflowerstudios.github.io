/* profile-view.js — Mayflower Studios public profile overlay
   Exposes window.MFProfile.show(uid). Injected on every page by shared.js.
   Adds relationship status, gifts, and guestbook to public profiles. */
(function () {
  let dbMods = null, db = null, statusUnsub = null;
  let liveUnsubs = [];

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
  function niceDate(t) {
    if (!t) return "";
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function timeAgo(t) {
    if (!t) return "";
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s/60) + "m ago";
    if (s < 86400) return Math.floor(s/3600) + "h ago";
    const d = Math.floor(s/86400);
    return d === 1 ? "yesterday" : d + "d ago";
  }
  function sortNewest(obj) {
    return Object.entries(obj || {}).map(([id, v]) => ({ id, ...(v || {}) })).sort((a,b) => (b.t || 0) - (a.t || 0));
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
    liveUnsubs.forEach(fn => { try { fn(); } catch (_) {} });
    liveUnsubs = [];
  }

  function renderGifts(uid, gifts) {
    const recent = document.getElementById("mfProfGiftRecent");
    const collection = document.getElementById("mfProfGiftCollection");
    if (!recent || !collection) return;
    const list = sortNewest(gifts);
    const counts = {};
    list.forEach(g => {
      const key = (g.emoji || "🎁") + " " + (g.name || "Gift");
      counts[key] = (counts[key] || 0) + 1;
    });
    collection.innerHTML = Object.keys(counts).length
      ? Object.entries(counts).map(([k, n]) => `<span class="mf-prof-pill">${esc(k)} ×${n}</span>`).join("")
      : `<span class="mf-prof-dim">No gifts yet.</span>`;
    recent.innerHTML = list.slice(0, 5).map(g => `
      <div class="mf-prof-line">
        <b>${esc(g.emoji || "🎁")}</b>
        <span>${esc(g.fromName || "Someone")} sent ${esc(g.name || "a gift")}${g.note ? `<em>“${esc(g.note)}”</em>` : ""}</span>
        <small>${esc(timeAgo(g.t))}</small>
      </div>`).join("") || `<div class="mf-prof-empty">Be the first to send something sweet.</div>`;
  }

  function renderGuestbook(uid, posts) {
    const box = document.getElementById("mfProfGuestPosts");
    if (!box) return;
    const list = sortNewest(posts);
    box.innerHTML = list.slice(0, 12).map(p => {
      const canDelete = MFAuth.uid === uid || MFAuth.uid === p.fromUid;
      return `<div class="mf-prof-gbpost" data-post="${esc(p.id)}">
        <div><b>${esc(p.fromName || "Someone")}</b><small>${esc(timeAgo(p.t))}</small></div>
        <p>${esc(p.text || "")}</p>
        ${canDelete ? `<button class="mf-prof-mini" data-del="${esc(p.id)}">Delete</button>` : ""}
      </div>`;
    }).join("") || `<div class="mf-prof-empty">No guestbook notes yet.</div>`;
    box.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", async () => {
      try { await MFAuth.deleteGuestbookPost(uid, btn.getAttribute("data-del")); } catch (_) {}
    }));
  }

  function giftPicker(uid) {
    const catalog = (MFAuth && MFAuth.giftCatalog) || {};
    return `<div class="mf-prof-giftpick" id="mfProfGiftPick">
      ${Object.entries(catalog).map(([id, g]) => `<button type="button" data-gift="${esc(id)}" title="${esc(g.name)}">${esc(g.emoji)}</button>`).join("")}
      <input id="mfProfGiftNote" maxlength="160" placeholder="optional note…" />
    </div>`;
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
    hide();
    const card = document.getElementById("mfProfCard");
    card.innerHTML = `<div class="mf-prof-loading">Loading…</div>`;
    document.getElementById("mfProfOverlay").classList.add("open");

    let prof = {};
    try {
      const snap = await dbMods.get(dbMods.ref(db, `users/${uid}`));
      prof = snap.exists() ? snap.val() : {};
    } catch (_) {}

    const rel = MFAuth.getRelationship ? await MFAuth.getRelationship(uid) : null;
    const name = prof.displayName || "someone";
    const accent = (typeof prof.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(prof.accent)) ? prof.accent : "#f9a8d4";
    const a = MFAuth.avatarFor(prof, name);
    const avatarHTML = a.kind === "photo" ? `<img src="${esc(a.value)}" alt="">` : `<span>${esc(a.value)}</span>`;
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
        ${rel ? `<div class="mf-prof-rel">♡ In a relationship with <b>${esc(rel.partnerName || "someone")}</b><span>Since ${esc(niceDate(rel.startedAt))}</span></div>` : ""}
        ${prof.status ? `<div class="mf-prof-status">“${esc(prof.status)}”</div>` : ""}
        ${prof.bio ? `<p class="mf-prof-bio">${esc(prof.bio)}</p>` : `<p class="mf-prof-bio dim">No bio yet.</p>`}
        <div class="mf-prof-actions" id="mfProfActions">
          ${isMe ? `<a class="mf-prof-btn" href="/account.html">Edit your profile</a>` : `<span class="mf-prof-dim">…</span>`}
        </div>

        <div class="mf-prof-section">
          <h3>🎁 Gifts</h3>
          ${!isMe ? giftPicker(uid) : ""}
          <div class="mf-prof-collection" id="mfProfGiftCollection"><span class="mf-prof-dim">Loading…</span></div>
          <div id="mfProfGiftRecent"></div>
          <div class="mf-prof-dim" id="mfProfGiftMsg"></div>
        </div>

        <div class="mf-prof-section">
          <h3>📝 Guestbook</h3>
          <div class="mf-prof-gbform">
            <textarea id="mfProfGuestText" maxlength="500" rows="2" placeholder="Leave a sweet note…"></textarea>
            <button class="mf-prof-btn" id="mfProfGuestSend" type="button">Post</button>
          </div>
          <div class="mf-prof-dim" id="mfProfGuestMsg"></div>
          <div id="mfProfGuestPosts"></div>
        </div>
      </div>`;

    card.querySelector("#mfProfX").addEventListener("click", hide);

    if (!isMe && MFAuth.giftCatalog) {
      card.querySelectorAll("[data-gift]").forEach(btn => btn.addEventListener("click", async () => {
        const m = card.querySelector("#mfProfGiftMsg");
        const note = (card.querySelector("#mfProfGiftNote") || {}).value || "";
        try { await MFAuth.sendGift(uid, btn.getAttribute("data-gift"), note); if (m) m.textContent = "Gift sent ✨"; const inp = card.querySelector("#mfProfGiftNote"); if (inp) inp.value = ""; }
        catch (e) { if (m) m.textContent = (e && e.message) || "Couldn't send gift"; }
      }));
    }
    const gbBtn = card.querySelector("#mfProfGuestSend");
    if (gbBtn) gbBtn.addEventListener("click", async () => {
      const ta = card.querySelector("#mfProfGuestText");
      const m = card.querySelector("#mfProfGuestMsg");
      try { await MFAuth.postGuestbook(uid, ta.value); ta.value = ""; if (m) m.textContent = "Posted 🌸"; }
      catch (e) { if (m) m.textContent = (e && e.message) || "Couldn't post"; }
    });

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

    liveUnsubs.push(MFAuth.watchGifts ? MFAuth.watchGifts(uid, g => renderGifts(uid, g)) : () => {});
    liveUnsubs.push(MFAuth.watchGuestbook ? MFAuth.watchGuestbook(uid, p => renderGuestbook(uid, p)) : () => {});

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
