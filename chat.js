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
  let unseenDM = 0;             // unread DM messages (across friend threads)
  let reqCount = 0;             // pending friend requests
  const seenAt = { dm: {} };    // per-friend last-seen timestamp
  const friendsUnsub = { req: null, list: null, dmWatch: {} };
  let muted = false;
  try { muted = localStorage.getItem("mf_chat_muted") === "1"; } catch (_) {}
  let audioCtx = null;
  let myFriends = {};           // uid -> {t}, kept current for DM watchers
  // DM header status + typing indicator state
  let headStatusUnsub = null, headTypingUnsub = null;
  let lastStatus = null, peerTyping = false;
  // outgoing typing throttle
  let typingActive = false, typingStopTimer = null, lastTypingPing = 0;

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  // Escape text AND turn URLs into safe, clickable links. Used wherever a
  // message's text is rendered so links work in both original and translated
  // messages. Plain text is always escaped first, so this is injection-safe.
  function linkify(text) {
    const raw = String(text ?? "");
    // Match http(s):// URLs and bare www. URLs, stopping at whitespace.
    const re = /\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,!?;:'")\]}])/gi;
    let out = "", last = 0, m;
    while ((m = re.exec(raw)) !== null) {
      out += esc(raw.slice(last, m.index));   // escape the text before the URL
      const url = m[0];
      const href = /^https?:\/\//i.test(url) ? url : "https://" + url;
      out += `<a href="${esc(href)}" class="mf-link" target="_blank" rel="noopener noreferrer nofollow">${esc(url)}</a>`;
      last = m.index + url.length;
    }
    out += esc(raw.slice(last));               // escape the trailing text
    return out;
  }
  function pairKey(a, b) { return [a, b].sort().join("__"); }

  // Lightweight toast. Reuses a page-level #toast element if one exists,
  // otherwise creates its own — so chat feedback works on any page.
  let _toastEl = null, _toastTimer = null;
  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      if (!_toastEl) {
        _toastEl = document.createElement("div");
        _toastEl.id = "mfChatToast";
        _toastEl.style.cssText =
          "position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);" +
          "background:rgba(20,26,46,.96);color:#f3eefb;padding:10px 16px;border-radius:12px;" +
          "font:14px/1.4 system-ui,sans-serif;border:1px solid rgba(196,181,253,.3);" +
          "box-shadow:0 8px 30px rgba(0,0,0,.4);opacity:0;transition:opacity .2s,transform .2s;z-index:99999;pointer-events:none;";
        document.body.appendChild(_toastEl);
      }
      el = _toastEl;
    }
    el.textContent = msg;
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(20px)";
    }, 2600);
  }

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
    fab.innerHTML = '💬'
      + '<span class="mf-chat-badge mf-badge-dm" id="mfDmBadge"></span>'
      + '<span class="mf-chat-badge mf-badge-req" id="mfReqBadge" title="Friend requests"></span>';
    fab.setAttribute("aria-label", "Chat");

    const panel = document.createElement("div");
    panel.id = "mfChatPanel";
    panel.className = "mf-chat-panel";
    panel.innerHTML = `
      <div class="mf-chat-head">
        <div class="mf-chat-tabs">
          <button class="mf-ct on" data-ctab="global">🌸 Everyone</button>
          <button class="mf-ct" data-ctab="dm">💌 Friends</button>
        </div>
        <div class="mf-chat-headtools">
          <button class="mf-tr-btn" id="mfMuteBtn" title="Mute message sounds">🔔</button>
          <button class="mf-tr-btn" id="mfTrBtn" title="Translate messages">🌐</button>
          <select class="mf-tr-lang" id="mfTrLang" hidden></select>
          <button class="mf-chat-x" id="mfChatX" aria-label="Close">✕</button>
        </div>
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

    // translate control
    const trBtn = panel.querySelector("#mfTrBtn");
    const trLang = panel.querySelector("#mfTrLang");
    trLang.innerHTML = Object.entries(LANG_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    function updateTrUI() {
      if (!TR_OK) { trBtn.textContent = "🌐"; trBtn.title = "Translation isn't available in this browser"; trBtn.disabled = true; trLang.hidden = true; return; }
      trBtn.classList.toggle("on", translateOn);
      trBtn.title = translateOn ? ("Translating to " + (LANG_NAMES[targetLang] || targetLang)) : "Translate messages";
      trLang.hidden = !translateOn;
      trLang.value = targetLang;
    }
    trBtn.addEventListener("click", () => {
      if (!TR_OK) return;
      translateOn = !translateOn;
      try { localStorage.setItem("mf_tr_on", translateOn ? "1" : "0"); } catch (_) {}
      updateTrUI();
      if (translateOn) applyTranslations();
      else { document.querySelectorAll(".mf-msg-text[data-text]").forEach(b => { b.innerHTML = linkify(b.dataset.text); delete b.dataset.trFor; }); document.querySelectorAll(".mf-msg-orig").forEach(o => o.remove()); }
    });
    trLang.addEventListener("change", () => {
      targetLang = trLang.value;
      try { localStorage.setItem("mf_tr_lang", targetLang); } catch (_) {}
      document.querySelectorAll(".mf-msg-text[data-text]").forEach(b => { delete b.dataset.trFor; });
      updateTrUI();
      if (translateOn) applyTranslations();
    });
    updateTrUI();

    // Keep the chat translator in sync with the site-wide language picker.
    window.addEventListener("mf-lang-change", (e) => {
      const lang = e && e.detail && e.detail.lang;
      if (!lang || !TR_OK) return;
      targetLang = lang;
      document.querySelectorAll(".mf-msg-text[data-text]").forEach(b => { delete b.dataset.trFor; });
      // If the whole site is being translated, mirror that in chat automatically.
      if (lang !== "en") {
        translateOn = true;
        try { localStorage.setItem("mf_tr_on", "1"); } catch (_) {}
      }
      updateTrUI();
      if (translateOn) applyTranslations();
    });
    const muteBtn = panel.querySelector("#mfMuteBtn");
    function updateMuteUI() {
      muteBtn.textContent = muted ? "🔕" : "🔔";
      muteBtn.title = muted ? "Message sounds are muted" : "Mute message sounds";
      muteBtn.classList.toggle("on", !muted);
    }
    muteBtn.addEventListener("click", () => {
      muted = !muted;
      try { localStorage.setItem("mf_chat_muted", muted ? "1" : "0"); } catch (_) {}
      updateMuteUI();
      // tapping unmute is a user gesture — unlock audio and give a tiny preview
      if (!muted) { unlockAudio(); playChime(); }
    });
    updateMuteUI();

  }

  // ---- DM chime (a soft two-note ping; synthesized, no audio file) ----
  // Mobile browsers (esp. iOS Safari) only allow audio after a user gesture and
  // keep the AudioContext suspended otherwise. So we create + unlock it on the
  // first tap/click/keypress anywhere, then chimes work even from background
  // events like an incoming message.
  let audioUnlocked = false;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; }
    }
    return audioCtx;
  }
  function unlockAudio() {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") { ctx.resume().catch(() => {}); }
    // Play a near-silent buffer to satisfy iOS's "must start in a gesture" rule.
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(ctx.destination); src.start(0);
    } catch (_) {}
    audioUnlocked = true;
  }
  // Arm the unlock on the first interaction (covers desktop + mobile).
  ["pointerdown", "touchstart", "click", "keydown"].forEach(ev => {
    document.addEventListener(ev, function once() {
      unlockAudio();
      ["pointerdown", "touchstart", "click", "keydown"].forEach(e2 => document.removeEventListener(e2, once));
    }, { once: false, passive: true });
  });

  function playChime() {
    if (muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    // If the context got suspended (tab refocus, mobile), try to resume; this
    // succeeds when called close to a gesture, and is harmless otherwise.
    if (ctx.state === "suspended") { ctx.resume().catch(() => {}); }
    try {
      const now = ctx.currentTime;
      const notes = [880, 1175]; // A5 -> D6, gentle
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f;
        const t0 = now + i * 0.12;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.2, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0); o.stop(t0 + 0.34);
      });
    } catch (_) {}
  }

  function togglePanel(force) {
    openPanel = (typeof force === "boolean") ? force : !openPanel;
    document.getElementById("mfChatPanel").classList.toggle("open", openPanel);
    if (openPanel) render();
  }

  function setView(v) {
    view = v;
    // entering the Friends tab clears the request glance; opening a DM clears its unread
    render();
  }

  function markDmSeen(fid) {
    seenAt.dm[fid] = Date.now();
    // We show a single combined DM badge; opening a thread clears the glance.
    unseenDM = 0;
    updateBadges();
  }

  function updateBadges() {
    const dm = document.getElementById("mfDmBadge");
    if (dm) {
      if (unseenDM > 0) { dm.textContent = unseenDM > 9 ? "9+" : unseenDM; dm.classList.add("show"); }
      else dm.classList.remove("show");
    }
    const rq = document.getElementById("mfReqBadge");
    if (rq) {
      if (reqCount > 0) { rq.textContent = reqCount > 9 ? "9+" : reqCount; rq.classList.add("show"); }
      else rq.classList.remove("show");
    }
  }

  // ---- rendering ----
  function render() {
    const body = document.getElementById("mfChatBody");
    const foot = document.getElementById("mfChatFoot");
    if (!body) return;

    // tear down DM header watchers + stop broadcasting typing; they re-arm below
    stopTyping();
    if (headStatusUnsub) { try { headStatusUnsub(); } catch (_) {} headStatusUnsub = null; }
    if (headTypingUnsub) { try { headTypingUnsub(); } catch (_) {} headTypingUnsub = null; }
    lastStatus = null; peerTyping = false;

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
        // opening this thread marks it seen; recompute the DM badge
        markDmSeen(dmWith);
        body.innerHTML = `<div class="mf-chat-dmhead" id="mfDmHead"></div><div class="mf-chat-log" id="mfChatLog"></div>`;
        renderDmHead();
        foot.innerHTML = composerHTML();
        wireComposer("dm");
        subscribeMessages(mods.ref(db, `dm/${pairKey(me, dmWith)}`));
      }
    }
  }

  function composerHTML() {
    return `
      <div class="mf-pickerPop" id="mfEmojiPop"></div>
      <div class="mf-pickerPop" id="mfGifPop">
        <div class="mf-gifSearch"><input type="text" id="mfGifSearch" placeholder="Search GIFs…" autocomplete="off" /></div>
        <div class="mf-gifGrid" id="mfGifGrid"></div>
        <div class="mf-gifMsg" id="mfGifMsg" hidden></div>
        <div class="mf-gifAttr">Powered by Klipy</div>
      </div>
      <div class="mf-chat-tools">
        <button class="mf-tool" id="mfEmojiBtn" title="Emoji" type="button">😊</button>
        <button class="mf-tool" id="mfGifBtn" title="GIF" type="button">GIF</button>
        <button class="mf-tool" id="mfImgBtn" title="Send a picture" type="button">🖼️</button>
        <input type="file" id="mfImgInput" accept="image/*" hidden />
      </div>
      <div class="mf-chat-input">
        <input id="mfChatText" type="text" maxlength="500" placeholder="Type a message…" autocomplete="off" />
        <button id="mfChatSend" aria-label="Send">➤</button>
      </div>`;
  }

  function chatNode() {
    return (view === "global")
      ? mods.ref(db, "chat/global")
      : mods.ref(db, `dm/${pairKey(me, dmWith)}`);
  }
  function afterSend() {
    if (view === "dm") {
      mods.set(mods.ref(db, `dmIndex/${me}/${dmWith}`), { t: Date.now() });
      mods.set(mods.ref(db, `dmIndex/${dmWith}/${me}`), { t: Date.now() });
    }
  }

  function wireComposer(kind) {
    const input = document.getElementById("mfChatText");
    const send = document.getElementById("mfChatSend");
    if (!input || !send) return;
    const go = () => {
      const text = input.value.trim();
      if (!text) return;
      // If the whole message is just an image/GIF URL, send it as inline media
      // instead of a plain text link so it renders in the chat.
      const media = mediaUrlInfo(text);
      if (media) {
        input.value = ""; stopTyping();
        measureRemoteImage(media.url).then((dims) => {
          sendMedia({ kind: media.kind, url: media.url, w: dims.w, h: dims.h });
        }).catch(() => {
          sendMedia({ kind: media.kind, url: media.url });
        });
        return;
      }
      mods.push(chatNode(), { uid: me, name: myName || "someone", text, t: Date.now() });
      afterSend();
      input.value = "";
      stopTyping();
    };
    send.addEventListener("click", go);
    input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    // typing indicator (DM only) — ping on input, throttled; auto-stop when idle
    if (kind === "dm") {
      input.addEventListener("input", () => {
        if (input.value.trim()) pingTyping(); else stopTyping();
      });
      input.addEventListener("blur", stopTyping);
    }
    wirePickers(input);
    setTimeout(() => input.focus(), 50);
  }

  // Broadcast "I'm typing" to the current DM peer, throttled to ~1 write/2.5s,
  // and schedule an auto-stop ~3.5s after the last keystroke.
  function pingTyping() {
    if (view !== "dm" || !dmWith || !MFAuth.user || !MFAuth.setTyping) return;
    const pk = pairKey(MFAuth.user.uid, dmWith);
    const now = Date.now();
    if (!typingActive || now - lastTypingPing > 2500) {
      MFAuth.setTyping(pk, true);
      typingActive = true; lastTypingPing = now;
    }
    if (typingStopTimer) clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(stopTyping, 3500);
  }
  function stopTyping() {
    if (typingStopTimer) { clearTimeout(typingStopTimer); typingStopTimer = null; }
    if (!typingActive) return;
    typingActive = false;
    if (dmWith && MFAuth.user && MFAuth.setTyping) {
      MFAuth.setTyping(pairKey(MFAuth.user.uid, dmWith), false);
    }
  }

  // Push a media (image/GIF) message. Encoded into the `text` field with an
  // invisible marker so the DB shape stays identical to a text message.
  const MEDIA_PREFIX = "\u0001mfmedia:";
  function encodeMedia({ kind, url, w, h }) {
    const p = { k: kind, u: url };
    if (Number.isFinite(w)) p.w = w;
    if (Number.isFinite(h)) p.h = h;
    return MEDIA_PREFIX + JSON.stringify(p);
  }
  function decodeMedia(text) {
    if (typeof text !== "string" || !text.startsWith(MEDIA_PREFIX)) return null;
    try {
      const p = JSON.parse(text.slice(MEDIA_PREFIX.length));
      if (!p || !p.u) return null;
      return { kind: p.k === "gif" ? "gif" : "image", url: p.u, w: p.w, h: p.h };
    } catch (_) { return null; }
  }
  // Detect a message that is nothing but a single image/GIF URL, so it can be
  // posted as inline media. Accepts common image extensions plus the popular
  // GIF hosts (Giphy/Tenor/Klipy) whose share links don't end in .gif.
  function mediaUrlInfo(text) {
    if (!/^https?:\/\/\S+$/i.test(text) || /\s/.test(text)) return null;
    let u;
    try { u = new URL(text); } catch (_) { return null; }
    const path = u.pathname.toLowerCase();
    const host = u.hostname.toLowerCase();
    const isGifExt = /\.gif($|\?)/i.test(text) || /\.gif$/i.test(path);
    const isImgExt = /\.(png|jpe?g|webp|bmp|avif)($|\?)/i.test(text) || /\.(png|jpe?g|webp|bmp|avif)$/i.test(path);
    // Direct media CDNs serve the image bytes themselves; their share-page
    // counterparts (e.g. tenor.com/view/..., giphy.com/gifs/...) do NOT and
    // would just 404 in an <img>, so those stay as plain links.
    const isDirectGifHost = /(^|\.)(media\.tenor\.com|c\.tenor\.com)$/i.test(host)
      || /(^|\.)(media\d*\.giphy\.com|i\.giphy\.com)$/i.test(host)
      || /(^|\.)klipy\.(com|co)$/i.test(host);
    if (isGifExt || isDirectGifHost) return { kind: "gif", url: text };
    if (isImgExt) return { kind: "image", url: text };
    return null;
  }
  // Load a remote image just to read its natural dimensions (best-effort).
  function measureRemoteImage(url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; reject(new Error("timeout")); } }, 6000);
      im.onload = () => { if (done) return; done = true; clearTimeout(t); resolve({ w: im.naturalWidth || undefined, h: im.naturalHeight || undefined }); };
      im.onerror = () => { if (done) return; done = true; clearTimeout(t); reject(new Error("load")); };
      im.src = url;
    });
  }

  function sendMedia({ kind, url, w, h }) {
    if (!url) return Promise.reject();
    return Promise.resolve(
      mods.push(chatNode(), { uid: me, name: myName || "someone", text: encodeMedia({ kind, url, w, h }), t: Date.now() })
    ).then(afterSend);
  }

  // ---- Emoji / GIF / image pickers ----
  const EMOJI = {
    "Smileys": ["😀","😁","😂","🤣","😊","😇","🙂","😉","😍","🥰","😘","😋","😜","🤪","😎","🤩","🥳","😏","😴","🤤","😢","😭","😤","😡","🥺","😳","🤔","🤗","🤭","🫢","😬","🙄","😩","🤯","🥶","🥵","😱","🤫","🫠","👀"],
    "Hearts": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💖","💗","💓","💞","💕","💔","❣️","💘","💝","💟","♥️"],
    "Hands": ["👍","👎","👌","🤌","✌️","🤞","🫶","🙌","👏","🙏","💪","🫂","🤝","👋","🤙","🫰","✊","👊","🤟","🤙"],
    "Cozy": ["🌸","🌺","🌷","🌹","🌻","🌼","🌙","⭐","✨","💫","🔥","🦊","🐾","🍃","🌿","☕","🍵","🕯️","🫖","🍰","🎀","🎬","🍿","🎮","💌","🌈"],
    "Misc": ["🎉","🎊","🥂","🍻","🎵","🎶","💤","💯","✅","❌","⚡","💥","💦","🌟","👻","💀","🤡","🎃","🐱","🍒"]
  };
  let pickersBuilt = false;
  function wirePickers(input) {
    const emojiBtn = document.getElementById("mfEmojiBtn");
    const gifBtn = document.getElementById("mfGifBtn");
    const imgBtn = document.getElementById("mfImgBtn");
    const emojiPop = document.getElementById("mfEmojiPop");
    const gifPop = document.getElementById("mfGifPop");
    const imgInput = document.getElementById("mfImgInput");
    if (!emojiBtn) return;

    // build emoji grid once per composer render
    let html = "";
    for (const [cat, list] of Object.entries(EMOJI)) {
      html += `<div class="mf-emojiCat">${cat}</div><div class="mf-emojiGrid">`;
      html += list.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join("");
      html += `</div>`;
    }
    emojiPop.innerHTML = html;

    function closePops(except) {
      if (except !== "emoji") { emojiPop.classList.remove("open"); emojiBtn.classList.remove("on"); }
      if (except !== "gif")   { gifPop.classList.remove("open"); gifBtn.classList.remove("on"); }
    }
    // outside-click close (one listener)
    if (!wirePickers._docClose) {
      wirePickers._docClose = (e) => {
        const ep = document.getElementById("mfEmojiPop"), eb = document.getElementById("mfEmojiBtn");
        const gp = document.getElementById("mfGifPop"), gb = document.getElementById("mfGifBtn");
        if (ep && (ep.contains(e.target) || (eb && eb.contains(e.target)))) return;
        if (gp && (gp.contains(e.target) || (gb && gb.contains(e.target)))) return;
        if (ep) ep.classList.remove("open"); if (eb) eb.classList.remove("on");
        if (gp) gp.classList.remove("open"); if (gb) gb.classList.remove("on");
      };
      document.addEventListener("click", wirePickers._docClose);
    }

    emojiPop.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-emoji]"); if (!b) return;
      const emoji = b.dataset.emoji;
      const s = input.selectionStart ?? input.value.length;
      const en = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, s) + emoji + input.value.slice(en);
      const pos = s + emoji.length; input.focus();
      try { input.setSelectionRange(pos, pos); } catch (_) {}
    });
    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !emojiPop.classList.contains("open");
      closePops("emoji"); emojiPop.classList.toggle("open", open); emojiBtn.classList.toggle("on", open);
    });

    // GIF
    let gifTimer = null, gifReq = 0;
    gifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !gifPop.classList.contains("open");
      closePops("gif"); gifPop.classList.toggle("open", open); gifBtn.classList.toggle("on", open);
      if (open) {
        const s = document.getElementById("mfGifSearch"); if (s) s.focus();
        if (!document.getElementById("mfGifGrid").children.length) loadGifs("");
      }
    });
    const gifSearch = document.getElementById("mfGifSearch");
    gifSearch.addEventListener("input", () => {
      clearTimeout(gifTimer);
      gifTimer = setTimeout(() => loadGifs(gifSearch.value.trim()), 350);
    });
    function loadGifs(q) {
      const reqId = ++gifReq;
      const grid = document.getElementById("mfGifGrid");
      const msg = document.getElementById("mfGifMsg");
      grid.innerHTML = ""; msg.hidden = false; msg.textContent = "Loading…";
      const path = q ? `gifs/search?q=${encodeURIComponent(q)}&per_page=24` : `gifs/trending?per_page=24`;
      const url = `https://api.klipy.com/api/v1/${KLIPY_KEY}/${path}&content_filter=high`;
      fetch(url).then(r => { if (!r.ok) throw new Error("klipy " + r.status); return r.json(); })
        .then(json => {
          if (reqId !== gifReq) return;
          const results = (json && json.data && json.data.data) || [];
          if (!results.length) { msg.textContent = "No GIFs found 🌫️"; return; }
          msg.hidden = true;
          for (const g of results) {
            const { preview, full } = klipyUrls(g); if (!full) continue;
            const d = klipyDims(g);
            const im = document.createElement("img");
            im.src = preview || full; im.loading = "lazy"; im.alt = g.title || "GIF";
            im.addEventListener("click", () => { sendMedia({ kind: "gif", url: full, w: d[0], h: d[1] }); closePops(); });
            grid.appendChild(im);
          }
          if (!grid.children.length) { msg.hidden = false; msg.textContent = "No GIFs found 🌫️"; }
        })
        .catch(() => { if (reqId === gifReq) { msg.hidden = false; msg.textContent = "Couldn't reach the GIF service 🌧️"; } });
    }

    // Image upload
    imgBtn.addEventListener("click", () => { closePops(); imgInput.click(); });
    imgInput.addEventListener("change", async () => {
      const file = imgInput.files && imgInput.files[0];
      imgInput.value = "";
      if (!file) return;
      if (!/^image\//i.test(file.type)) { return; }
      if (file.size > 12 * 1024 * 1024) { alert("That image is too big (limit 12 MB)"); return; }
      const isGif = /gif$/i.test(file.type);
      imgBtn.disabled = true; const old = imgBtn.textContent; imgBtn.textContent = "…";
      let dims = {};
      try { dims = await readImageDims(file); } catch (_) {}
      try {
        const url = await uploadChatImage(file);
        await sendMedia({ kind: isGif ? "gif" : "image", url, w: dims.w, h: dims.h });
      } catch (err) { console.error("[chat img]", err); alert("Couldn't send that picture"); }
      imgBtn.disabled = false; imgBtn.textContent = old;
    });
  }

  function readImageDims(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { res({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(u); };
      im.onerror = () => { rej(new Error("img read")); URL.revokeObjectURL(u); };
      im.src = u;
    });
  }

  // Upload a chat picture to Storage under chatmedia/{uid}/...
  let storageMod = null, storage = null;
  async function uploadChatImage(file) {
    if (!storageMod) storageMod = await import(`https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js`);
    if (!storage) storage = MFAuth._app ? storageMod.getStorage(MFAuth._app) : storageMod.getStorage();
    const ext = (/\.([a-z0-9]{2,5})$/i.exec(file.name)?.[1] || "png").toLowerCase();
    const path = `chatmedia/${me}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const sref = storageMod.ref(storage, path);
    await storageMod.uploadBytes(sref, file, { contentType: file.type || "image/png" });
    return storageMod.getDownloadURL(sref);
  }

  // ---- Klipy GIF helpers (same API as the watch room) ----
  const KLIPY_KEY = "CShaQsI9HgGHkocmgvSz0r8C9Nzzibp2qeAW0XvW4Gq7EF8Pp7nlq9RK6jJvEEG7";
  function klipyUrls(item) {
    const f = item.file || item.files || {};
    const pick = (sz) => { const s = f[sz] || {}; return (s.gif && (s.gif.url || s.gif)) || (s.webp && (s.webp.url || s.webp)) || null; };
    const small = pick("sm") || pick("xs") || pick("md");
    const big = pick("hd") || pick("md") || small;
    const flat = typeof item.url === "string" ? item.url : null;
    return { preview: small || big || flat, full: big || small || flat };
  }
  function klipyDims(item) {
    const f = item.file || item.files || {};
    const s = f.md || f.hd || f.sm || {};
    const g = s.gif || {};
    return [g.width || item.width, g.height || item.height];
  }

  // ---- Translation engine (two-tier: on-device, then free server fallback) ----
  const LANG_NAMES = { en:"English", es:"Spanish", de:"German", fr:"French", pt:"Portuguese", it:"Italian", nl:"Dutch", ja:"Japanese", ko:"Korean", zh:"Chinese", ru:"Russian" };
  let translateOn = false, targetLang = "en";
  const translationCache = new Map(), translatorPool = new Map();
  function guessLang() { const l = (navigator.language || "en").slice(0,2).toLowerCase(); return LANG_NAMES[l] ? l : "en"; }
  try { translateOn = localStorage.getItem("mf_tr_on") === "1"; targetLang = localStorage.getItem("mf_tr_lang") || guessLang(); } catch (_) { targetLang = guessLang(); }
  const HAS_DEVICE = (typeof self !== "undefined") && ("Translator" in self) && ("LanguageDetector" in self);
  const HAS_SERVER = /^https?:$/.test(location.protocol);
  const TR_MODE = HAS_DEVICE ? "device" : (HAS_SERVER ? "server" : "none");
  const TR_OK = TR_MODE !== "none";
  async function getTranslator(src, tgt) {
    const key = src + "->" + tgt;
    if (translatorPool.has(key)) return translatorPool.get(key);
    const p = (async () => { try { const a = await self.Translator.availability({ sourceLanguage: src, targetLanguage: tgt }); if (a === "unavailable") return null; return await self.Translator.create({ sourceLanguage: src, targetLanguage: tgt }); } catch (_) { return null; } })();
    translatorPool.set(key, p); return p;
  }
  async function detectLang(text) {
    try { if ("LanguageDetector" in self) { const d = await self.LanguageDetector.create(); const res = await d.detect(text); if (res && res.length) { const top = res.find(r => r.detectedLanguage && r.detectedLanguage !== "und"); if (top && top.confidence > 0.15) return top.detectedLanguage.slice(0,2); } } } catch (_) {}
    return null;
  }
  async function serverTranslate(text, tgt) {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + encodeURIComponent(tgt) + "&dt=t&q=" + encodeURIComponent(text);
    try { const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000); const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(timer); if (!r.ok) return null; const data = await r.json(); const out = (data[0] || []).map(s => s[0]).join(""); const src = (data[2] || "").slice(0,2); if (!out) return null; return { text: out, src }; } catch (_) { return null; }
  }
  async function translateText(text, tgt) {
    const ck = tgt + "||" + text;
    if (translationCache.has(ck)) return translationCache.get(ck);
    let out = null;
    if (TR_MODE === "device") {
      const src = await detectLang(text);
      if (src && src === tgt) { translationCache.set(ck, null); return null; }
      if (src) { const t = await getTranslator(src, tgt); if (t) { try { out = await t.translate(text); } catch (_) { out = null; } } }
      if (!out && HAS_SERVER) { const r = await serverTranslate(text, tgt); if (r) { if (r.src && r.src === tgt) { translationCache.set(ck, null); return null; } out = r.text; } }
    } else if (TR_MODE === "server") {
      const r = await serverTranslate(text, tgt);
      if (r) { if (r.src && r.src === tgt) { translationCache.set(ck, null); return null; } out = r.text; }
    }
    translationCache.set(ck, out || null);
    return out || null;
  }
  // Translate ONE bubble in place. Cheap and idempotent (the trFor guard means
  // calling it again for the same language is a no-op).
  async function translateBubble(b) {
    if (!translateOn || !TR_OK || !b) return;
    if (b.dataset.trFor === targetLang) return;
    const original = b.dataset.text;
    const translated = await translateText(original, targetLang);
    b.dataset.trFor = targetLang;
    if (translated && translated !== original) {
      b.innerHTML = linkify(translated);
      const row = b.closest(".mf-msg");
      if (row && !row.querySelector(".mf-msg-orig")) {
        const o = document.createElement("span"); o.className = "mf-msg-orig"; o.textContent = "original: " + original;
        b.after(o);
      }
    }
  }

  // Full-log pass — used only when translation is toggled on or the language
  // changes, NOT on every incoming message (that would re-scan the whole log
  // each time and make a busy chat lag). New messages translate just their own
  // bubble via translateBubble().
  async function applyTranslations() {
    if (!translateOn || !TR_OK) return;
    const log = document.getElementById("mfChatLog"); if (!log) return;
    const bubbles = log.querySelectorAll(".mf-msg-text[data-text]");
    for (const b of bubbles) await translateBubble(b);
  }

  // Map of Firebase message key -> its rendered row element, so edits and
  // deletes can update exactly one row in place (O(1)) instead of re-rendering.
  let msgRows = new Map();

  function subscribeMessages(node) {
    if (unsubscribe) { try { unsubscribe(); } catch (_) {} unsubscribe = null; }
    const log = document.getElementById("mfChatLog");
    if (log) log.innerHTML = "";
    msgRows = new Map();
    const q = mods.query(node, mods.limitToLast(100));
    // Only render genuine messages — ignore any stray non-message children
    // (e.g. legacy typing data) so they never appear as garbled messages.
    const isMsg = (m) => m && typeof m === "object" && typeof m.uid === "string" && (typeof m.t === "number");
    const onAdd = (snap) => { const m = snap.val(); if (isMsg(m)) renderMsg(snap.key, m); };
    const onChange = (snap) => { const m = snap.val(); if (isMsg(m)) renderMsg(snap.key, m); };
    const onRemove = (snap) => {
      // Hard removal from the DB (rare — we soft-delete instead). Drop the row.
      const row = msgRows.get(snap.key);
      if (row) { row.remove(); msgRows.delete(snap.key); }
    };
    mods.onChildAdded(q, onAdd);
    mods.onChildChanged(q, onChange);
    mods.onChildRemoved(q, onRemove);
    unsubscribe = () => {
      mods.off(q, "child_added", onAdd);
      mods.off(q, "child_changed", onChange);
      mods.off(q, "child_removed", onRemove);
    };
  }

  // Build OR update the row for a message. Adding and editing share this one
  // path, so an edit re-renders in place and a delete shows a tombstone.
  function renderMsg(key, m) {
    const log = document.getElementById("mfChatLog");
    if (!log) return;
    const existing = msgRows.get(key);
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;

    const mine = m.uid === me;
    const row = existing || document.createElement("div");
    row.className = "mf-msg " + (mine ? "me" : "them");
    row.dataset.key = key;

    if (m.deleted) {
      row.classList.add("deleted");
      row.innerHTML =
        (mine ? "" : `<span class="mf-msg-name" data-uid="${m.uid}">${esc(m.name || "someone")}</span>`)
        + `<span class="mf-msg-text mf-msg-tomb">🥀 message deleted</span>`
        + `<span class="mf-msg-time">${timeShort(m.t)}</span>`;
      if (!existing) { log.appendChild(row); msgRows.set(key, row); }
      return;
    }

    const nameHTML = mine ? "" : `<span class="mf-msg-name" data-uid="${m.uid}">${esc(m.name || "someone")}</span>`;
    const editedTag = m.edited ? ` <span class="mf-msg-edited" title="${m.editedAt ? timeShort(m.editedAt) : ""}">(edited)</span>` : "";
    const media = decodeMedia(m.text);

    if (media) {
      const w = (Number.isFinite(media.w) && media.w) ? ` width="${Math.min(220, media.w)}"` : "";
      row.innerHTML = nameHTML
        + `<span class="mf-media"><img src="${esc(media.url)}" alt="${media.kind === "gif" ? "GIF" : "image"}" loading="lazy"${w}></span>`
        + `<span class="mf-msg-time">${timeShort(m.t)}</span>`;
      const img = row.querySelector(".mf-media img");
      if (img) {
        img.addEventListener("click", () => openLightbox(media.url));
        const rescroll = () => { if (atBottom) log.scrollTop = log.scrollHeight; };
        if (img.complete) rescroll();
        else { img.addEventListener("load", rescroll); img.addEventListener("error", rescroll); }
      }
    } else {
      row.innerHTML = nameHTML
        + `<span class="mf-msg-text" data-text="${esc(m.text)}">${linkify(m.text)}</span>${editedTag}`
        + `<span class="mf-msg-time">${timeShort(m.t)}</span>`;
    }

    // Your own messages get an edit/delete affordance (edit is text-only).
    if (mine) addMsgActions(row, key, m, !media);

    const nm = row.querySelector(".mf-msg-name");
    if (nm) nm.addEventListener("click", () => { if (window.MFProfile) MFProfile.show(m.uid); });

    if (!existing) {
      log.appendChild(row);
      msgRows.set(key, row);
      // Scroll down for a new message only if you're already at the bottom, or
      // it's your own message — so reading older messages isn't interrupted.
      if (atBottom || mine) log.scrollTop = log.scrollHeight;
      // Translate just THIS bubble (not the whole log) so a busy chat stays fast.
      if (translateOn && !media) {
        const b = row.querySelector(".mf-msg-text[data-text]");
        translateBubble(b).then(() => { if (atBottom || mine) log.scrollTop = log.scrollHeight; });
      }
    } else {
      // An edit/delete landed — re-translate only this one bubble.
      if (translateOn && !media) {
        const b = row.querySelector(".mf-msg-text[data-text]");
        if (b) { delete b.dataset.trFor; translateBubble(b); }
      }
      if (atBottom) log.scrollTop = log.scrollHeight;
    }
  }

  // The RTDB ref for a specific message in the current view (global or DM).
  function msgRef(key) {
    return (view === "global")
      ? mods.ref(db, `chat/global/${key}`)
      : mods.ref(db, `dm/${pairKey(me, dmWith)}/${key}`);
  }

  // Attach a small ⋯ menu (Edit / Delete) to one of your own text messages.
  function addMsgActions(row, key, m, canEdit) {
    if (row.querySelector(".mf-msg-actions")) return; // already wired (edit re-render)
    const btn = document.createElement("button");
    btn.className = "mf-msg-actions";
    btn.type = "button";
    btn.title = "Edit or delete";
    btn.setAttribute("aria-label", "Message options");
    btn.textContent = "⋯";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMsgMenu(row, key, m, canEdit);
    });
    row.appendChild(btn);
  }

  function closeMsgMenu() {
    const open = document.querySelector(".mf-msg-menu");
    if (open) open.remove();
    document.removeEventListener("click", closeMsgMenu);
  }

  function openMsgMenu(row, key, m, canEdit) {
    closeMsgMenu();
    const menu = document.createElement("div");
    menu.className = "mf-msg-menu";
    menu.innerHTML =
      (canEdit ? `<button type="button" data-act="edit">✏️ Edit</button>` : "") +
      `<button type="button" data-act="delete">🗑️ Delete</button>`;
    row.appendChild(menu);
    const editBtn = menu.querySelector('[data-act="edit"]');
    if (editBtn) editBtn.addEventListener("click", (e) => {
      e.stopPropagation(); closeMsgMenu(); startEdit(row, key, m);
    });
    menu.querySelector('[data-act="delete"]').addEventListener("click", (e) => {
      e.stopPropagation(); closeMsgMenu(); deleteMsg(key);
    });
    // close on next outside click
    setTimeout(() => document.addEventListener("click", closeMsgMenu), 0);
  }

  function deleteMsg(key) {
    // Soft delete: keep the node but blank the text and flag it, so both sides
    // show "message deleted" rather than the message silently vanishing.
    mods.update(msgRef(key), { text: "", deleted: true, editedAt: Date.now() })
      .catch(() => toast("Couldn't delete that message"));
  }

  function startEdit(row, key, m) {
    const textSpan = row.querySelector(".mf-msg-text");
    if (!textSpan) return;
    const current = m.text || "";
    const editor = document.createElement("div");
    editor.className = "mf-msg-editing";
    editor.innerHTML =
      `<input type="text" maxlength="500" class="mf-msg-editfield" />` +
      `<div class="mf-msg-editbtns">` +
        `<button type="button" data-act="save" title="Save">✓</button>` +
        `<button type="button" data-act="cancel" title="Cancel">✕</button>` +
      `</div>`;
    const field = editor.querySelector(".mf-msg-editfield");
    field.value = current;
    // hide the static text + actions while editing
    textSpan.style.display = "none";
    const actions = row.querySelector(".mf-msg-actions");
    if (actions) actions.style.display = "none";
    row.insertBefore(editor, row.querySelector(".mf-msg-time"));
    field.focus();
    field.setSelectionRange(current.length, current.length);

    const finish = (save) => {
      const val = field.value.trim();
      editor.remove();
      textSpan.style.display = "";
      if (actions) actions.style.display = "";
      if (!save) return;
      if (!val) { toast("Empty message — use delete instead"); return; }
      if (val === current) return; // no change
      mods.update(msgRef(key), { text: val, edited: true, editedAt: Date.now() })
        .catch(() => toast("Couldn't save the edit"));
    };
    editor.querySelector('[data-act="save"]').addEventListener("click", (e) => { e.stopPropagation(); finish(true); });
    editor.querySelector('[data-act="cancel"]').addEventListener("click", (e) => { e.stopPropagation(); finish(false); });
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  // ---- lightbox ----
  function openLightbox(url) {
    let lb = document.getElementById("mfLightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "mfLightbox"; lb.className = "mf-lightbox";
      lb.innerHTML = `<img alt="">`;
      document.body.appendChild(lb);
      lb.addEventListener("click", () => { lb.classList.remove("open"); lb.querySelector("img").src = ""; });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && lb.classList.contains("open")) { lb.classList.remove("open"); lb.querySelector("img").src = ""; } });
    }
    lb.querySelector("img").src = url;
    lb.classList.add("open");
  }

  // ---- DM people list ----
  function renderDmList() {
    const body = document.getElementById("mfChatBody");
    body.innerHTML = `
      <div class="mf-friends">
        <div class="mf-addfriend">
          <span class="mf-at">@</span>
          <input id="mfAddInput" type="text" maxlength="20" placeholder="add a friend by username" autocomplete="off" spellcheck="false" />
          <button id="mfAddBtn">Add</button>
        </div>
        <div class="mf-addmsg" id="mfAddMsg"></div>
        <div id="mfReqSection"></div>
        <div class="mf-friends-label" id="mfFriendsLabel" hidden>Friends</div>
        <div class="mf-friends-list" id="mfFriendsList">
          <div class="mf-chat-empty"><p>Loading…</p></div>
        </div>
      </div>`;

    const addInput = document.getElementById("mfAddInput");
    const addBtn = document.getElementById("mfAddBtn");
    const addMsg = document.getElementById("mfAddMsg");
    const sendReq = async () => {
      const v = addInput.value.trim();
      if (!v) return;
      addBtn.disabled = true; addMsg.className = "mf-addmsg"; addMsg.textContent = "";
      try {
        await MFAuth.sendFriendRequest(v);
        addMsg.className = "mf-addmsg ok"; addMsg.textContent = "Request sent ✨";
        addInput.value = "";
      } catch (e) { addMsg.className = "mf-addmsg err"; addMsg.textContent = (e && e.message) || "Couldn't send request"; }
      addBtn.disabled = false;
    };
    addBtn.addEventListener("click", sendReq);
    addInput.addEventListener("keydown", e => { if (e.key === "Enter") sendReq(); });

    // incoming requests (live)
    if (friendsUnsub.req) { try { friendsUnsub.req(); } catch (_) {} }
    friendsUnsub.req = MFAuth.watchFriendRequests((reqs) => {
      const sec = document.getElementById("mfReqSection");
      if (!sec) return;
      const ids = Object.keys(reqs || {});
      if (!ids.length) { sec.innerHTML = ""; return; }
      sec.innerHTML = `<div class="mf-friends-label">Requests</div>`;
      ids.forEach(uid => {
        const r = reqs[uid] || {};
        const row = document.createElement("div");
        row.className = "mf-req-item";
        row.innerHTML = `
          <span class="mf-dm-name">${esc(r.name || "someone")}${r.username ? ` <span class="mf-dim">@${esc(r.username)}</span>` : ""}</span>
          <span class="mf-req-actions">
            <button class="mf-req-yes" title="Accept">✓</button>
            <button class="mf-req-no" title="Decline">✕</button>
          </span>`;
        row.querySelector(".mf-req-yes").addEventListener("click", async () => { try { await MFAuth.acceptFriendRequest(uid); } catch (_) {} });
        row.querySelector(".mf-req-no").addEventListener("click", async () => { try { await MFAuth.declineFriendRequest(uid); } catch (_) {} });
        sec.appendChild(row);
      });
    });

    // friends (live)
    if (friendsUnsub.list) { try { friendsUnsub.list(); } catch (_) {} }
    friendsUnsub.list = MFAuth.watchFriends((friends) => {
      const list = document.getElementById("mfFriendsList");
      const label = document.getElementById("mfFriendsLabel");
      if (!list) return;
      const ids = Object.keys(friends || {});
      if (label) label.hidden = !ids.length;
      if (!ids.length) {
        list.innerHTML = `<div class="mf-chat-empty"><div style="font-size:26px">👋</div>
          <p>No friends yet. Add someone by their @username to start a chat.</p></div>`;
        return;
      }
      list.innerHTML = "";
      ids.forEach(uid => {
        mods.get(mods.ref(db, `users/${uid}`)).then(s => {
          const u = s.exists() ? s.val() : {};
          const name = u.displayName || "someone";
          const a = MFAuth.avatarFor(u, name);
          const avInner = a.kind === "photo" ? `<img src="${esc(a.value)}">` : esc(a.value);
          const item = document.createElement("div");
          item.className = "mf-dm-item";
          item.innerHTML = `<span class="mf-dm-av">${avInner}<i class="mf-dm-dot" id="mfdot_${uid}"></i></span>
            <span class="mf-dm-name">${esc(name)}${u.username ? ` <span class="mf-dim">@${esc(u.username)}</span>` : ""}</span>
            <span class="mf-dm-go">›</span>`;
          item.addEventListener("click", () => { dmWith = uid; render(); });
          const av = item.querySelector(".mf-dm-av");
          av.addEventListener("click", (e) => { e.stopPropagation(); if (window.MFProfile) MFProfile.show(uid); });
          list.appendChild(item);
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
        <span class="mf-dm-av sm" id="mfDmHeadAv">${avInner}<i class="mf-dm-dot" id="mfHeadDot"></i></span>
        <span class="mf-dm-headwrap">
          <span class="mf-dm-headname" id="mfDmHeadName">${esc(name)}</span>
          <span class="mf-dm-headstatus" id="mfHeadStatus"></span>
        </span>`;
      head.querySelector("#mfDmBack").addEventListener("click", () => { dmWith = null; render(); });
      const openProf = () => { if (window.MFProfile) MFProfile.show(dmWith); };
      head.querySelector("#mfDmHeadAv").addEventListener("click", openProf);
      head.querySelector("#mfDmHeadName").addEventListener("click", openProf);

      // live online status + last seen in the header
      if (headStatusUnsub) { try { headStatusUnsub(); } catch (_) {} headStatusUnsub = null; }
      if (MFAuth.watchStatus) {
        headStatusUnsub = MFAuth.watchStatus(dmWith, (st) => {
          lastStatus = st;
          paintHeadStatus();
        });
      }
      // live typing indicator
      if (headTypingUnsub) { try { headTypingUnsub(); } catch (_) {} headTypingUnsub = null; }
      if (MFAuth.watchTyping && MFAuth.user) {
        const pk = pairKey(MFAuth.user.uid, dmWith);
        headTypingUnsub = MFAuth.watchTyping(pk, dmWith, (typing) => {
          peerTyping = typing;
          paintHeadStatus();
        });
      }
    });
  }
  // Paint the header sub-line: "typing…" wins, else Online / last seen.
  function paintHeadStatus() {
    const el = document.getElementById("mfHeadStatus");
    const dot = document.getElementById("mfHeadDot");
    if (!el) return;
    const online = !!(lastStatus && lastStatus.state === "online");
    if (dot) dot.classList.toggle("on", online);
    if (peerTyping) {
      el.textContent = "typing…";
      el.className = "mf-dm-headstatus typing";
      return;
    }
    el.className = "mf-dm-headstatus";
    if (online) { el.textContent = "Online"; }
    else if (lastStatus && lastStatus.last) { el.textContent = "last seen " + timeAgoShort(lastStatus.last); }
    else { el.textContent = "Offline"; }
  }
  function timeAgoShort(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }

  // ---- background: count unseen global messages for the badge ----
  // Watch all friend DM threads for new incoming messages → chime + DM badge.
  // Re-armed whenever the friends list changes.
  function rearmDmWatchers() {
    if (!mods || !me) return;
    Object.keys(myFriends || {}).forEach(fid => {
      if (friendsUnsub.dmWatch[fid]) return; // already watching
      const node = mods.query(mods.ref(db, `dm/${pairKey(me, fid)}`), mods.limitToLast(1));
      const handler = (snap) => {
        const m = snap.val(); if (!m) return;
        if (m.uid === me) return;                       // our own message
        const seen = seenAt.dm[fid] || 0;
        if (!m.t || m.t <= seen) return;                // already accounted for
        seenAt.dm[fid] = m.t;
        // Chime on every incoming DM — open or closed, any tab.
        playChime();
        // Only bump the unread badge if you're NOT actively reading this thread.
        const viewingThis = openPanel && view === "dm" && dmWith === fid;
        if (!viewingThis) { unseenDM++; updateBadges(); }
      };
      mods.onChildAdded(node, handler);
      friendsUnsub.dmWatch[fid] = () => mods.off(node, "child_added", handler);
    });
  }

  // Pending friend-request count → request badge.
  function watchRequestCount() {
    if (!MFAuth.watchFriendRequests) return;
    MFAuth.watchFriendRequests((reqs) => {
      reqCount = Object.keys(reqs || {}).length;
      updateBadges();
    });
  }

  // Keep the friends map current so DM watchers cover every thread.
  function watchFriendsForWatchers() {
    if (!MFAuth.watchFriends) return;
    MFAuth.watchFriends((friends) => {
      myFriends = friends || {};
      // prime seenAt for brand-new friends so old history doesn't chime
      Object.keys(myFriends).forEach(fid => { if (!(fid in seenAt.dm)) seenAt.dm[fid] = Date.now(); });
      rearmDmWatchers();
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
      watchRequestCount();
      watchFriendsForWatchers();
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
    async openDM(uid) {
      if (!me || !uid || uid === me) return;
      // DMs are friends-only — verify before opening
      const ok = await MFAuth.areFriends(uid);
      const panel = document.getElementById("mfChatPanel");
      if (!ok) {
        view = "dm"; dmWith = null;
        if (panel) panel.querySelectorAll(".mf-ct").forEach(x => x.classList.toggle("on", x.dataset.ctab === "dm"));
        togglePanel(true);
        return;
      }
      dmWith = uid;
      view = "dm";
      if (panel) panel.querySelectorAll(".mf-ct").forEach(x => x.classList.toggle("on", x.dataset.ctab === "dm"));
      togglePanel(true);
    },
    open() { togglePanel(true); },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();