/* chat.js — Mayflower Studios universal chat
   Injected on every page by shared.js. Requires window.MFAuth.

   Two modes:
   - Global room: messages at  chat/global/$msg   (any signed-in user)
   - DMs:         messages at  dm/$pairKey/$msg    (only the two participants)
                  pairKey = sorted("uidA__uidB")

   Signed-out users see a prompt to sign in. The bubble is present everywhere.

   DB shapes:
     chat/global/$msg = { uid, name, text, t }
     dm/$pairKey/$msg = { uid, name, text, t }
     users/$uid       = { displayName, photoURL, ... }   (for the people list)
     dmIndex/$uid/$otherUid = { t }                       (who you've talked to)
*/
(function () {
  let db = null, mods = null, me = null, myName = null;
  let view = "global";        // "global" | "dm"
  let dmWith = null;          // uid of the person in current DM
  let openPanel = false;
  let wired = false;
  let unsubscribe = null;
  let unseenGlobal = 0;
  const seenAt = { global: Date.now() };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
  function pairKey(a, b) { return [a, b].sort().join("__"); }
  function timeShort(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // ---- markup injected once ----
  function injectUI() {
    if (document.getElementById("mfChatFab")) return;
    const fab = document.createElement("button");
    fab.id = "mfChatFab";
    fab.className = "mf-chat-fab";
    fab.innerHTML = '💬<span class="mf-chat-badge" id="mfChatBadge"></span>';
    fab.setAttribute("aria-label", "Chat");

    const panel = document.createElement("div");
    panel.id = "mfChatPanel";
    panel.className = "mf-chat-panel";
    panel.innerHTML = `
      <div class="mf-chat-head">
        <div class="mf-chat-tabs">
          <button class="mf-ct on" data-ctab="global">🌸 Everyone</button>
          <button class="mf-ct" data-ctab="dm">💌 Messages</button>
        </div>
        <button class="mf-chat-x" id="mfChatX" aria-label="Close">✕</button>
      </div>
      <div class="mf-chat-body" id="mfChatBody"></div>
      <div class="mf-chat-foot" id="mfChatFoot"></div>`;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    fab.addEventListener("click", () => togglePanel());
    panel.querySelector("#mfChatX").addEventListener("click", () => togglePanel(false));
    panel.querySelectorAll(".mf-ct").forEach(b => {
      b.addEventListener("click", () => {
        panel.querySelectorAll(".mf-ct").forEach(x => x.classList.toggle("on", x === b));
        setView(b.dataset.ctab);
      });
    });
  }

  function togglePanel(force) {
    openPanel = (typeof force === "boolean") ? force : !openPanel;
    document.getElementById("mfChatPanel").classList.toggle("open", openPanel);
    if (openPanel) {
      if (view === "global") { unseenGlobal = 0; seenAt.global = Date.now(); updateBadge(); }
      render();
    }
  }

  function setView(v) {
    view = v;
    render();
  }

  function updateBadge() {
    const b = document.getElementById("mfChatBadge");
    if (!b) return;
    if (unseenGlobal > 0 && !(openPanel && view === "global")) {
      b.textContent = unseenGlobal > 9 ? "9+" : unseenGlobal;
      b.classList.add("show");
    } else b.classList.remove("show");
  }

  // ---- rendering ----
  function render() {
    const body = document.getElementById("mfChatBody");
    const foot = document.getElementById("mfChatFoot");
    if (!body) return;

    if (!me) {
      body.innerHTML = `<div class="mf-chat-empty">
        <div style="font-size:30px">💬</div>
        <p>Sign in to chat with everyone and send messages.</p>
        <a class="mf-chat-cta" href="/account.html?next=${encodeURIComponent(location.pathname)}">Sign in</a>
      </div>`;
      foot.innerHTML = "";
      return;
    }

    if (view === "global") {
      body.innerHTML = `<div class="mf-chat-log" id="mfChatLog"></div>`;
      foot.innerHTML = composerHTML();
      wireComposer("global");
      subscribeMessages(mods.ref(db, "chat/global"));
    } else {
      // DM mode: either a people list, or an open thread
      if (!dmWith) { renderDmList(); foot.innerHTML = ""; }
      else {
        body.innerHTML = `<div class="mf-chat-dmhead" id="mfDmHead"></div><div class="mf-chat-log" id="mfChatLog"></div>`;
        renderDmHead();
        foot.innerHTML = composerHTML();
        wireComposer("dm");
        subscribeMessages(mods.ref(db, `dm/${pairKey(me, dmWith)}`));
      }
    }
  }

  function composerHTML() {
    return `<div class="mf-chat-input">
      <input id="mfChatText" type="text" maxlength="500" placeholder="Type a message…" autocomplete="off" />
      <button id="mfChatSend" aria-label="Send">➤</button>
    </div>`;
  }
  function wireComposer(kind) {
    const input = document.getElementById("mfChatText");
    const send = document.getElementById("mfChatSend");
    if (!input || !send) return;
    const go = () => {
      const text = input.value.trim();
      if (!text) return;
      const node = (kind === "global")
        ? mods.ref(db, "chat/global")
        : mods.ref(db, `dm/${pairKey(me, dmWith)}`);
      mods.push(node, { uid: me, name: myName || "someone", text, t: Date.now() });
      if (kind === "dm") {
        // index both sides so it shows in each person's message list
        mods.set(mods.ref(db, `dmIndex/${me}/${dmWith}`), { t: Date.now() });
        mods.set(mods.ref(db, `dmIndex/${dmWith}/${me}`), { t: Date.now() });
      }
      input.value = "";
    };
    send.addEventListener("click", go);
    input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    setTimeout(() => input.focus(), 50);
  }

  function subscribeMessages(node) {
    if (unsubscribe) { try { unsubscribe(); } catch (_) {} unsubscribe = null; }
    const log = document.getElementById("mfChatLog");
    if (log) log.innerHTML = "";
    const q = mods.query(node, mods.limitToLast(100));
    const handler = (snap) => {
      const m = snap.val(); if (!m) return;
      appendMsg(m);
    };
    mods.onChildAdded(q, handler);
    unsubscribe = () => mods.off(q, "child_added", handler);
  }

  function appendMsg(m) {
    const log = document.getElementById("mfChatLog");
    if (!log) return;
    const mine = m.uid === me;
    const row = document.createElement("div");
    row.className = "mf-msg " + (mine ? "me" : "them");
    const nameHTML = mine ? "" : `<span class="mf-msg-name" data-uid="${m.uid}">${esc(m.name || "someone")}</span>`;
    row.innerHTML = nameHTML
      + `<span class="mf-msg-text">${esc(m.text)}</span>`
      + `<span class="mf-msg-time">${timeShort(m.t)}</span>`;
    const nm = row.querySelector(".mf-msg-name");
    if (nm) nm.addEventListener("click", () => { if (window.MFProfile) MFProfile.show(m.uid); });
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  // ---- DM people list ----
  function renderDmList() {
    const body = document.getElementById("mfChatBody");
    body.innerHTML = `<div class="mf-chat-dmlist" id="mfDmList">
      <div class="mf-chat-empty"><p>Loading people…</p></div></div>`;
    mods.get(mods.ref(db, "users")).then(snap => {
      const users = snap.exists() ? snap.val() : {};
      const ids = Object.keys(users).filter(uid => uid !== me);
      const list = document.getElementById("mfDmList");
      if (!ids.length) {
        list.innerHTML = `<div class="mf-chat-empty"><div style="font-size:28px">🫧</div>
          <p>No one else has signed up yet. When they do, they'll show up here.</p></div>`;
        return;
      }
      // recent first if we have an index
      mods.get(mods.ref(db, `dmIndex/${me}`)).then(idxSnap => {
        const idx = idxSnap.exists() ? idxSnap.val() : {};
        ids.sort((a, b) => ((idx[b] && idx[b].t) || 0) - ((idx[a] && idx[a].t) || 0));
        list.innerHTML = "";
        ids.forEach(uid => {
          const u = users[uid] || {};
          const name = u.displayName || "someone";
          const a = MFAuth.avatarFor(u, name);
          const avInner = a.kind === "photo" ? `<img src="${esc(a.value)}">` : esc(a.value);
          const item = document.createElement("div");
          item.className = "mf-dm-item";
          item.innerHTML = `<span class="mf-dm-av" data-pf="${uid}">${avInner}<i class="mf-dm-dot" id="mfdot_${uid}"></i></span>
            <span class="mf-dm-name">${esc(name)}</span>
            <span class="mf-dm-go">›</span>`;
          item.addEventListener("click", () => { dmWith = uid; render(); });
          // tapping the avatar opens the profile instead of the thread
          const av = item.querySelector(".mf-dm-av");
          av.addEventListener("click", (e) => { e.stopPropagation(); if (window.MFProfile) MFProfile.show(uid); });
          list.appendChild(item);
          // live presence dot
          if (MFAuth.watchStatus) MFAuth.watchStatus(uid, (st) => {
            const d = document.getElementById("mfdot_" + uid);
            if (d) d.classList.toggle("on", !!(st && st.state === "online"));
          });
        });
      });
    });
  }
  function renderDmHead() {
    const head = document.getElementById("mfDmHead");
    if (!head) return;
    mods.get(mods.ref(db, `users/${dmWith}`)).then(snap => {
      const u = snap.exists() ? snap.val() : {};
      const name = u.displayName || "someone";
      const a = MFAuth.avatarFor(u, name);
      const avInner = a.kind === "photo" ? `<img src="${esc(a.value)}">` : esc(a.value);
      head.innerHTML = `<button class="mf-dm-back" id="mfDmBack">‹</button>
        <span class="mf-dm-av sm" id="mfDmHeadAv">${avInner}</span>
        <span class="mf-dm-headname" id="mfDmHeadName">${esc(name)}</span>`;
      head.querySelector("#mfDmBack").addEventListener("click", () => { dmWith = null; render(); });
      const openProf = () => { if (window.MFProfile) MFProfile.show(dmWith); };
      head.querySelector("#mfDmHeadAv").addEventListener("click", openProf);
      head.querySelector("#mfDmHeadName").addEventListener("click", openProf);
    });
  }

  // ---- background: count unseen global messages for the badge ----
  function watchGlobalForBadge() {
    const q = mods.query(mods.ref(db, "chat/global"), mods.limitToLast(30));
    mods.onChildAdded(q, (snap) => {
      const m = snap.val(); if (!m) return;
      if (m.uid === me) return;
      if (m.t && m.t > (seenAt.global || 0) && !(openPanel && view === "global")) {
        unseenGlobal++; updateBadge();
      }
    });
  }

  // ---- boot ----
  function start() {
    db = MFAuth.db;
    if (db) return finishStart();
    // db may not be attached until auth modules finish; poll briefly
    let n = 0;
    const iv = setInterval(() => {
      if (MFAuth.db) { clearInterval(iv); db = MFAuth.db; finishStart(); }
      else if (++n > 100) clearInterval(iv);
    }, 80);
  }
  function finishStart() {
    if (wired) return;
    import(`https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js`).then(m => {
      mods = m;
      wired = true;
      watchGlobalForBadge();
      if (openPanel) render();
    });
  }

  function wireAuth() {
    injectUI();
    MFAuth.onChange((user) => {
      me = user ? user.uid : null;
      myName = MFAuth.name();
      if (user && !wired) start();
      if (document.getElementById("mfChatPanel")) {
        if (!user) { dmWith = null; view = "global"; }
        if (openPanel) render();
      }
    });
  }

  function boot() {
    // Wait for auth.js to define MFAuth (it loads asynchronously).
    if (window.MFAuth) {
      if (!MFAuth.isConfigured()) return; // no accounts → no chat
      wireAuth();
      return;
    }
    let n = 0;
    const iv = setInterval(() => {
      if (window.MFAuth) {
        clearInterval(iv);
        if (MFAuth.isConfigured()) wireAuth();
      } else if (++n > 120) clearInterval(iv);
    }, 80);
  }

  // Public API for other modules (e.g. profile overlay "Message" button)
  window.MFChat = {
    openDM(uid) {
      if (!me || !uid || uid === me) return;
      dmWith = uid;
      view = "dm";
      const panel = document.getElementById("mfChatPanel");
      if (panel) panel.querySelectorAll(".mf-ct").forEach(x => x.classList.toggle("on", x.dataset.ctab === "dm"));
      togglePanel(true);
    },
    open() { togglePanel(true); },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
