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

  // Global-chat moderation. Ranks are stored by username at /owner and /admins.
  // The database rules remain the final authority; these values only decide
  // whether the moderation button should be shown in the interface.
  let myChatRole = "user";       // "user" | "admin" | "owner"
  let ownerHandle = "";
  let adminHandles = new Set();
  let moderationSeq = 0;
  const uidHandleCache = new Map();
  const uidRoleCache = new Map();

  // Full chat-moderation state. The database rules are authoritative; the
  // client mirrors them so people get clear controls and helpful feedback.
  // Defined in shared.js, which is a blocking script on every page and is what
  // loads this file — so it is always present by the time we get here.
  const CHAT_CONFIG = window.MFChatConfig;
  const DEFAULT_CHAT_SETTINGS = { ...CHAT_CONFIG.settingDefaults };
  let chatSettings = { ...DEFAULT_CHAT_SETTINGS };
  let myRestriction = { blocked: false, mutedUntil: 0, reason: "" };
  let myWarnings = {};
  let lastGlobalPostAt = 0;
  let modWatchUnsubs = [];
  let composerTicker = null;
  const MOD_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

  // Phones get a full-height sheet instead of a floating card, and never get
  // the auto-focus that pops the keyboard open (which used to shove the page
  // around every time the composer re-rendered).
  const isTouch = matchMedia("(hover: none) and (pointer: coarse)").matches;
  const isPhone = () => window.innerWidth <= 520;

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
      <div class="mf-chat-grip" id="mfChatGrip" title="Drag to resize"></div>
      <div class="mf-chat-head">
        <div class="mf-chat-tabs">
          <button class="mf-ct on" data-ctab="global">🌸 Everyone</button>
          <button class="mf-ct" data-ctab="dm">💌 Friends</button>
        </div>
        <div class="mf-chat-headtools">
          <button class="mf-tr-btn" id="mfModBtn" title="Chat moderation" hidden>🛡️</button>
          <button class="mf-tr-btn" id="mfMuteBtn" title="Mute message sounds">🔔</button>
          <button class="mf-tr-btn" id="mfTrBtn" title="Translate messages">🌐</button>
          <button class="mf-chat-x" id="mfChatX" aria-label="Close">✕</button>
        </div>
      </div>
      <div class="mf-chat-subbar" id="mfChatSubbar" hidden>
        <span>🌐 Translating to</span>
        <select class="mf-tr-lang" id="mfTrLang"></select>
      </div>
      <div class="mf-chat-body" id="mfChatBody"></div>
      <div class="mf-chat-foot" id="mfChatFoot"></div>`;

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    applySavedSize(panel);
    wireResize(panel);

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
    const trBar = panel.querySelector("#mfChatSubbar");
    function updateTrUI() {
      if (!TR_OK) { trBtn.textContent = "🌐"; trBtn.title = "Translation isn't available in this browser"; trBtn.disabled = true; trBar.hidden = true; return; }
      trBtn.classList.toggle("on", translateOn);
      trBtn.title = translateOn ? ("Translating to " + (LANG_NAMES[targetLang] || targetLang)) : "Translate messages";
      trBar.hidden = !translateOn;
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

    // Keep the chat translator in sync with the site-wide language picker and
    // with the settings page.
    window.addEventListener("mf-lang-change", (e) => {
      const d = (e && e.detail) || {};
      const lang = d.lang;
      if (!lang || !TR_OK) return;
      targetLang = lang;
      document.querySelectorAll(".mf-msg-text[data-text]").forEach(b => { delete b.dataset.trFor; });
      if (typeof d.on === "boolean") {
        // Settings said so outright. Honour it — including switching translation
        // off while a non-English language is still selected, which the rule
        // below would otherwise undo on the spot.
        translateOn = d.on;
        try { localStorage.setItem("mf_tr_on", d.on ? "1" : "0"); } catch (_) {}
      } else if (lang !== "en") {
        // Came from the header picker: if the whole site is being translated,
        // mirror that in chat automatically.
        translateOn = true;
        try { localStorage.setItem("mf_tr_on", "1"); } catch (_) {}
      }
      updateTrUI();
      if (translateOn) applyTranslations();
      else { document.querySelectorAll(".mf-msg-text[data-text]").forEach(b => { b.innerHTML = linkify(b.dataset.text); delete b.dataset.trFor; }); document.querySelectorAll(".mf-msg-orig").forEach(o => o.remove()); }
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
    // The same switch lives on the settings page; keep an open panel in step.
    window.addEventListener("mf-chat-sound-changed", (e) => {
      muted = !!(e && e.detail && e.detail.muted);
      updateMuteUI();
    });
    updateMuteUI();

    const modBtn = panel.querySelector("#mfModBtn");
    modBtn.addEventListener("click", (e) => { e.stopPropagation(); openChatSettings(); });
    injectModerationStyles();
    trackViewport();
  }

  // ---- panel sizing ----
  // The panel is anchored to the bottom-right, so dragging the top-left grip
  // away from that corner makes it bigger. The size is remembered per device.
  const SIZE_KEY = "mf_chat_size";
  const MIN_W = 320, MIN_H = 360;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const maxW = () => Math.max(MIN_W, window.innerWidth - 40);
  const maxH = () => Math.max(MIN_H, window.innerHeight - 104);

  function applySavedSize(panel) {
    panel.style.removeProperty("--mf-chat-w");
    panel.style.removeProperty("--mf-chat-h");
    if (isPhone()) return;   // phones use the full-height sheet, not a card
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SIZE_KEY) || "null"); } catch (_) {}
    if (!s || !Number.isFinite(s.w) || !Number.isFinite(s.h)) return;
    panel.style.setProperty("--mf-chat-w", clamp(s.w, MIN_W, maxW()) + "px");
    panel.style.setProperty("--mf-chat-h", clamp(s.h, MIN_H, maxH()) + "px");
  }

  function wireResize(panel) {
    const grip = panel.querySelector("#mfChatGrip");
    if (!grip) return;
    let startX = 0, startY = 0, startW = 0, startH = 0, dragging = false;

    const onMove = (e) => {
      if (!dragging) return;
      panel.style.setProperty("--mf-chat-w", clamp(startW + (startX - e.clientX), MIN_W, maxW()) + "px");
      panel.style.setProperty("--mf-chat-h", clamp(startH + (startY - e.clientY), MIN_H, maxH()) + "px");
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("resizing");
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      const r = panel.getBoundingClientRect();
      try { localStorage.setItem(SIZE_KEY, JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) })); } catch (_) {}
    };
    grip.addEventListener("pointerdown", (e) => {
      if (isPhone()) return;
      e.preventDefault();
      const r = panel.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; startW = r.width; startH = r.height;
      dragging = true;
      panel.classList.add("resizing");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
    // double-click the grip to go back to the default size
    grip.addEventListener("dblclick", () => {
      try { localStorage.removeItem(SIZE_KEY); } catch (_) {}
      applySavedSize(panel);
    });
    // A saved size can outgrow a smaller window, and rotating a phone into
    // landscape can cross out of sheet mode — re-settle both on resize.
    window.addEventListener("resize", () => { applySavedSize(panel); lockPageScroll(openPanel); });
  }

  // The on-screen keyboard shrinks the visual viewport without touching the
  // layout viewport, so a sheet sized in vh ends up half-buried behind the
  // keyboard. Mirror the visual viewport into CSS variables and size from those.
  function trackViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      // A zero or nonsense reading would collapse the sheet to nothing, so keep
      // the last good value (or the 100dvh fallback) instead of writing it.
      if (!(vv.height > 160)) return;
      const root = document.documentElement.style;
      root.setProperty("--mf-vvh", vv.height + "px");
      root.setProperty("--mf-vvtop", (vv.offsetTop || 0) + "px");
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    sync();
  }

  // While the sheet is open on a phone, freeze the page behind it. Otherwise
  // opening the keyboard scrolls the page under the chat, and dismissing it
  // leaves you somewhere else on the page entirely.
  let lockedScrollY = 0, pageLocked = false;
  function lockPageScroll(on) {
    if (on && isPhone()) {
      if (pageLocked) return;
      lockedScrollY = window.scrollY || window.pageYOffset || 0;
      const s = document.body.style;
      s.position = "fixed"; s.top = `-${lockedScrollY}px`;
      s.left = "0"; s.right = "0"; s.width = "100%";
      pageLocked = true;
    } else if (pageLocked) {
      pageLocked = false;
      const s = document.body.style;
      s.position = ""; s.top = ""; s.left = ""; s.right = ""; s.width = "";
      window.scrollTo(0, lockedScrollY);
    }
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
    document.body.classList.toggle("mf-chat-open", openPanel);
    lockPageScroll(openPanel);
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
    clearInterval(composerTicker); composerTicker = null;

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
      body.innerHTML = `<div class="mf-global-notices" id="mfGlobalNotices"></div><div class="mf-chat-log" id="mfChatLog"></div>`;
      foot.innerHTML = composerHTML();
      wireComposer("global");
      paintGlobalNotices();
      updateComposerState();
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
      <div class="mf-pickerPop mf-gifPop" id="mfGifPop">
        <div class="mf-gifTop">
          <div class="mf-gifTabs">
            <button type="button" class="mf-gifTab on" data-giftab="trending">🔥 GIFs</button>
            <button type="button" class="mf-gifTab" data-giftab="stickers">🩷 Stickers</button>
            <button type="button" class="mf-gifTab" data-giftab="favs">★ Saved</button>
          </div>
          <div class="mf-gifSearch"><input type="text" id="mfGifSearch" placeholder="Search GIFs…" autocomplete="off" /></div>
        </div>
        <div class="mf-gifGrid" id="mfGifGrid"></div>
        <div class="mf-gifMsg" id="mfGifMsg" hidden></div>
        <div class="mf-gifAttr" id="mfGifAttr"></div>
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
      // Use Firebase's clock for thread activity too. Device clocks can differ
      // by seconds or minutes, which used to make conversations appear out of order.
      const t = mods.serverTimestamp();
      mods.set(mods.ref(db, `dmIndex/${me}/${dmWith}`), { t });
      mods.set(mods.ref(db, `dmIndex/${dmWith}/${me}`), { t });
    }
  }

  function globalPostBlock() {
    if (view !== "global") return null;
    const now = Date.now();
    if (myRestriction && myRestriction.blocked) {
      return { hard: true, text: myRestriction.reason ? `You are blocked from public chat: ${myRestriction.reason}` : "You are blocked from public chat." };
    }
    const until = Number(myRestriction && myRestriction.mutedUntil) || 0;
    if (until > now) {
      const forever = until > 32500000000000;
      return { hard: true, text: forever ? "You are muted from public chat." : `You are muted for ${formatDuration(until - now)}.` };
    }
    if (chatSettings.locked && myChatRole === "user") {
      return { hard: true, text: "Public chat is temporarily locked by the moderation team." };
    }
    const slow = Number(chatSettings.slowSeconds) || 0;
    if (slow > 0 && myChatRole === "user") {
      const left = slow * 1000 - (Date.now() - lastGlobalPostAt);
      if (left > 0) return { hard: false, text: `Slow mode: wait ${Math.ceil(left / 1000)}s before posting again.`, left };
    }
    return null;
  }

  function updateComposerState() {
    const input = document.getElementById("mfChatText");
    const send = document.getElementById("mfChatSend");
    if (!input || !send) return;
    const block = globalPostBlock();
    const disabled = !!(block && block.hard);
    input.disabled = disabled;
    send.disabled = disabled;
    if (disabled) input.placeholder = block.text;
    else if (block && block.left) input.placeholder = block.text;
    else input.placeholder = "Type a message…";
  }

  function canPostNow(showFeedback) {
    const block = globalPostBlock();
    if (!block) return true;
    if (showFeedback) toast(block.text);
    updateComposerState();
    return false;
  }

  async function writeChatMessage(text) {
    // Message ordering must never depend on a visitor's device clock. `t` is
    // server-authored for display/auditing; visual order comes from Firebase
    // push IDs below, which also lets restored messages reuse their old place.
    const clientNow = Date.now();
    const t = mods.serverTimestamp();
    const payload = { uid: me, name: myName || "someone", text, t };
    if (view === "global") {
      if (!canPostNow(true)) throw new Error("blocked");
      const messageKey = mods.push(mods.ref(db, "chat/global")).key;
      const updates = {};
      updates[`chat/global/${messageKey}`] = payload;
      // Keep this in the same atomic update as the message. Firebase resolves
      // both serverTimestamp sentinels to the same authoritative server time.
      updates[`chat/lastPost/${me}`] = t;
      await mods.update(mods.ref(db), updates);
      // Turn @username mentions into best-effort notifications without ever blocking the message itself.
      const mentioned = [...new Set((text.match(/(?:^|\s)@([a-z0-9_]{3,20})/gi) || []).map(x => x.trim().slice(1).toLowerCase()))].slice(0,10);
      for (const handle of mentioned) {
        try {
          const targetSnap = await mods.get(mods.ref(db, `usernames/${handle}`));
          const targetUid = targetSnap.val();
          if (!targetUid || targetUid === me || !MFAuth.createNotification) continue;
          await MFAuth.createNotification(targetUid,{id:`mention_${messageKey}`,type:"mention",title:`${myName || "Someone"} mentioned you`,body:String(text).slice(0,240),icon:"💬",link:"/notifications.html",sourceId:messageKey});
        } catch (_) {}
      }
      lastGlobalPostAt = clientNow;
      updateComposerState();
      return;
    }
    const messageRef = mods.push(chatNode());
    await mods.set(messageRef, payload);
    if (dmWith && dmWith !== me) {
      const nid = `dm_${messageRef.key}`;
      try { await mods.set(mods.ref(db, `notifications/${dmWith}/${nid}`), { type:"direct_message", title:`New message from ${myName || "someone"}`, body:String(text).slice(0,240), icon:"💌", link:"/account.html#friends", actorUid:me, actorName:String(myName || "someone").slice(0,32), actorUsername:String(myHandle || "").slice(0,20), sourceId:messageRef.key, createdAt:t, readAt:0 }); } catch (_) {}
    }
    afterSend();
  }

  function wireComposer(kind) {
    const input = document.getElementById("mfChatText");
    const send = document.getElementById("mfChatSend");
    if (!input || !send) return;
    const go = async () => {
      const text = input.value.trim();
      if (!text) return;
      if (kind === "global" && !canPostNow(true)) return;
      const media = mediaUrlInfo(text);
      if (media) {
        input.value = ""; stopTyping();
        try {
          const dims = await measureRemoteImage(media.url).catch(() => ({}));
          await sendMedia({ kind: media.kind, url: media.url, w: dims.w, h: dims.h });
        } catch (_) { toast("Couldn't send that message"); }
        return;
      }
      input.value = "";
      stopTyping();
      try { await writeChatMessage(text); }
      catch (err) {
        if (err && err.message !== "blocked") {
          input.value = text;
          toast("Couldn't send that message. Check your chat permissions.");
        }
      }
    };
    send.addEventListener("click", go);
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    if (kind === "dm") {
      input.addEventListener("input", () => {
        if (input.value.trim()) pingTyping(); else stopTyping();
      });
      input.addEventListener("blur", stopTyping);
    }
    wirePickers(input);
    updateComposerState();
    clearInterval(composerTicker);
    if (kind === "global") composerTicker = setInterval(updateComposerState, 1000);
    // Never steal focus on a touch device: the composer re-renders on every tab
    // switch and thread open, and each focus would pop the keyboard and jolt
    // the page. Phones can tap the field themselves.
    if (!isTouch) setTimeout(() => { if (!input.disabled) input.focus(); }, 50);
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
  // Giphy share/media/embed links all carry the asset ID, which maps to a
  // direct CDN file at i.giphy.com/<id>.gif. We rewrite those so a pasted
  // Giphy link renders inline instead of staying a plain link.
  //   giphy.com/gifs/<slug>-<id>   media.giphy.com/media/<id>/giphy.gif
  //   giphy.com/embed/<id>         i.giphy.com/media/<id>/giphy.gif
  function giphyDirect(u) {
    const host = u.hostname.toLowerCase();
    if (!/(^|\.)giphy\.com$/i.test(host)) return null;
    const path = u.pathname;
    let id = null;
    let m;
    if ((m = path.match(/\/media\/(?:[^/]+\/)?([A-Za-z0-9]+)/))) id = m[1];      // /media/<id>/giphy.gif
    else if ((m = path.match(/\/embed\/([A-Za-z0-9]+)/))) id = m[1];            // /embed/<id>
    else if ((m = path.match(/\/gifs\/(?:.*-)?([A-Za-z0-9]+)\/?$/))) id = m[1]; // /gifs/<slug>-<id>
    else if ((m = path.match(/\/clips\/(?:.*-)?([A-Za-z0-9]+)\/?$/))) id = m[1];
    if (!id || id.length < 6) return null; // guard against grabbing a slug word
    return "https://i.giphy.com/" + id + ".gif";
  }

  // Detect a message that is nothing but a single image/GIF URL, so it can be
  // posted as inline media. Accepts common image extensions, direct GIF CDNs,
  // and Giphy share/embed links (rewritten to their direct CDN file).
  function mediaUrlInfo(text) {
    if (!/^https?:\/\/\S+$/i.test(text) || /\s/.test(text)) return null;
    let u;
    try { u = new URL(text); } catch (_) { return null; }
    const path = u.pathname.toLowerCase();
    const host = u.hostname.toLowerCase();
    const isGifExt = /\.gif($|\?)/i.test(text) || /\.gif$/i.test(path);
    const isImgExt = /\.(png|jpe?g|webp|bmp|avif)($|\?)/i.test(text) || /\.(png|jpe?g|webp|bmp|avif)$/i.test(path);
    // Direct media CDNs serve the image bytes themselves.
    const isDirectGifHost = /(^|\.)(media\.tenor\.com|c\.tenor\.com)$/i.test(host)
      || /(^|\.)(media\d*\.giphy\.com|i\.giphy\.com)$/i.test(host)
      || /(^|\.)klipy\.(com|co)$/i.test(host);
    // Giphy share/embed pages -> direct CDN gif.
    const gd = giphyDirect(u);
    if (gd) return { kind: "gif", url: gd };
    if (isGifExt || isDirectGifHost) return { kind: "gif", url: text };
    if (isImgExt) return { kind: "image", url: text };
    // Tenor share pages (tenor.com/view/...) don't expose the media GUID in the
    // URL, so there's no reliable static rewrite — they stay as plain links
    // rather than render a broken <img>. (The GIF picker still works for Tenor.)
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
    return writeChatMessage(encodeMedia({ kind, url, w, h }));
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
    let gifTimer = null, gifReq = 0, gifTab = "trending";
    gifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !gifPop.classList.contains("open");
      closePops("gif"); gifPop.classList.toggle("open", open); gifBtn.classList.toggle("on", open);
      if (open) {
        // Focusing here would pop the keyboard on a phone and cover the grid.
        if (!isTouch) { const s = document.getElementById("mfGifSearch"); if (s) s.focus(); }
        // Favourites are local, so they're free to re-read and may have changed.
        if (gifTab === "favs" || !document.getElementById("mfGifGrid").children.length) loadGifs(gifSearch.value.trim());
      }
    });
    const gifSearch = document.getElementById("mfGifSearch");
    gifSearch.addEventListener("input", () => {
      clearTimeout(gifTimer);
      gifTimer = setTimeout(() => loadGifs(gifSearch.value.trim()), gifTab === "favs" ? 0 : 350);
    });
    gifPop.querySelectorAll("[data-giftab]").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation();
      gifTab = b.dataset.giftab;
      gifPop.querySelectorAll("[data-giftab]").forEach(x => x.classList.toggle("on", x === b));
      gifSearch.placeholder = gifTab === "favs" ? "Search what you've saved…"
                            : gifTab === "stickers" ? "Search stickers…" : "Search GIFs…";
      loadGifs(gifSearch.value.trim());
    }));

    // One tile: the GIF itself sends on click, the corner star keeps it.
    function gifTile(it) {
      const cell = document.createElement("div");
      cell.className = "mf-gifCell";
      const im = document.createElement("img");
      // Both services hand us the real dimensions, so the tile can claim its
      // final height before the image arrives. Without this the columns pack
      // themselves around zero-height boxes and then shuffle as each GIF
      // loads, which looks like the grid is fighting you.
      if (Number.isFinite(it.w) && Number.isFinite(it.h) && it.w > 0 && it.h > 0) {
        im.style.aspectRatio = it.w + " / " + it.h;
      }
      im.src = it.preview || it.full; im.loading = "lazy"; im.alt = it.title || "GIF";
      im.addEventListener("click", () => { sendMedia({ kind: "gif", url: it.full, w: it.w, h: it.h }); closePops(); });
      const star = document.createElement("button");
      star.type = "button"; star.className = "mf-gifFav";
      const paint = () => {
        const on = isFavGif(it.full);
        star.classList.toggle("on", on);
        star.textContent = on ? "★" : "☆";
        star.title = on ? "Remove from favourites" : "Save to favourites";
      };
      paint();
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavGif(it);
        // On the favourites tab an unstarred GIF should leave the grid.
        if (gifTab === "favs") loadGifs(gifSearch.value.trim()); else paint();
      });
      cell.append(im, star);
      return cell;
    }

    // Render an array of { preview, full, w, h, title } into the grid.
    function renderGifs(items, reqId, grid, msg) {
      if (reqId !== gifReq) return false;
      msg.hidden = true;
      for (const it of items) {
        if (!it.full) continue;
        grid.appendChild(gifTile(it));
      }
      return grid.children.length > 0;
    }

    // Klipy primary, Giphy fallback: Giphy is only queried if Klipy errors or
    // comes back empty. Per Giphy's terms the two are never mixed in one grid,
    // their media URLs are used verbatim (no stripping of query params), and
    // the credit line names whichever service actually filled the grid.
    function loadGifs(q) {
      const reqId = ++gifReq;
      const grid = document.getElementById("mfGifGrid");
      const msg = document.getElementById("mfGifMsg");
      const attr = document.getElementById("mfGifAttr");
      grid.innerHTML = "";

      if (gifTab === "favs") {
        attr.textContent = "";
        const all = favGifs();
        const needle = q.toLowerCase();
        const list = needle ? all.filter(f => String(f.title || "").toLowerCase().includes(needle)) : all;
        if (!renderGifs(list, reqId, grid, msg)) {
          msg.hidden = false;
          msg.textContent = all.length ? "Nothing saved matches that 🌫️" : "Tap ☆ on any GIF or sticker to keep it here.";
        }
        return;
      }

      msg.hidden = false; msg.textContent = "Loading…";

      // Stickers come from the same key and return the same shape as GIFs, so
      // only the path segment changes. Both services call them "stickers".
      const kind = gifTab === "stickers" ? "stickers" : "gifs";
      const kPath = q ? `${kind}/search?q=${encodeURIComponent(q)}&per_page=24` : `${kind}/trending?per_page=24`;
      const kUrl = `https://api.klipy.com/api/v1/${KLIPY_KEY}/${kPath}&content_filter=${klipyFilter()}`;

      const runGiphy = () => {
        const base = `https://api.giphy.com/v1/${kind}`;
        const gUrl = q
          ? `${base}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&offset=0&rating=pg-13&bundle=messaging_non_clips`
          : `${base}/trending?api_key=${GIPHY_KEY}&limit=24&offset=0&rating=pg-13&bundle=messaging_non_clips`;
        fetch(gUrl).then(r => { if (!r.ok) throw new Error("giphy " + r.status); return r.json(); })
          .then(json => {
            if (reqId !== gifReq) return;
            const results = (json && json.data) || [];
            const items = results.map(g => {
              const im = g.images || {};
              const prev = im.fixed_width || im.fixed_height || im.downsized || {};
              const big = im.downsized_medium || im.downsized || im.original || {};
              return {
                preview: prev.url,          // used verbatim, query params intact
                full: big.url || prev.url,  // used verbatim, query params intact
                w: parseInt(big.width || prev.width, 10) || undefined,
                h: parseInt(big.height || prev.height, 10) || undefined,
                title: g.title
              };
            });
            if (renderGifs(items, reqId, grid, msg)) attr.textContent = "Powered by GIPHY";
            else { attr.textContent = ""; msg.hidden = false; msg.textContent = "No GIFs found 🌫️"; }
          })
          .catch(() => { if (reqId === gifReq) { attr.textContent = ""; msg.hidden = false; msg.textContent = "Couldn't reach the GIF service 🌧️"; } });
      };

      fetch(kUrl).then(r => { if (!r.ok) throw new Error("klipy " + r.status); return r.json(); })
        .then(json => {
          if (reqId !== gifReq) return;
          const results = (json && json.data && json.data.data) || [];
          const items = results.map(g => {
            const { preview, full } = klipyUrls(g); const d = klipyDims(g);
            return { preview, full, w: d[0], h: d[1], title: g.title };
          });
          if (renderGifs(items, reqId, grid, msg)) attr.textContent = "Powered by KLIPY";
          else runGiphy(); // empty Klipy -> fall back
        })
        .catch(runGiphy); // Klipy error -> fall back
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

  // ---- GIF sources: Klipy primary, Giphy fallback ----
  // Both keys are public (client-side) by nature. The Giphy one is a free beta
  // key from developers.giphy.com — rate-limited, but it only ever gets hit
  // when Klipy is down or has nothing for a search.
  const GIPHY_KEY = "XXL2Zso1ejR7BZJD4X5ndTDEw5ckB64g";
  const KLIPY_KEY = "CShaQsI9HgGHkocmgvSz0r8C9Nzzibp2qeAW0XvW4Gq7EF8Pp7nlq9RK6jJvEEG7";
  // The filter level is chosen by the owner on the admin page and stored at
  // chatSettings/global/gifFilter. The list of levels lives in shared.js so the
  // admin page and this file cannot disagree about what is valid.
  //
  // On why the default is "medium": "high" over-filters anything affectionate —
  // a search for two people kissing came back with forehead kisses and a
  // ping-pong table — while making no difference at all to ordinary searches
  // like hug or dance.
  //
  // Validated against the list rather than used raw: this value comes from the
  // database and gets interpolated into the request URL.
  function klipyFilter() {
    const v = String((chatSettings && chatSettings.gifFilter) || "");
    return CHAT_CONFIG.gifFilters.includes(v) ? v : CHAT_CONFIG.gifFilterDefault;
  }

  // ---- saved GIFs and stickers (this device) ----
  // Kept in localStorage rather than the database so the star works instantly
  // and needs no rules change. Newest first, capped so the entry can't grow
  // without bound.
  const GIF_FAV_KEY = "mf_gif_favs", GIF_FAV_MAX = 60;
  let gifFavCache = null;
  function readFavGifs() {
    try {
      const raw = JSON.parse(localStorage.getItem(GIF_FAV_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter(f => f && typeof f.full === "string") : [];
    } catch (_) { return []; }
  }
  // Cached only for the many isFavGif() calls one grid render makes.
  function favGifs() {
    if (!gifFavCache) gifFavCache = readFavGifs();
    return gifFavCache;
  }
  function isFavGif(url) { return favGifs().some(f => f.full === url); }
  function toggleFavGif(it) {
    // Read fresh rather than trusting the cache: another tab may have starred
    // something since this one last looked, and writing the stale copy back
    // would silently drop it.
    const list = readFavGifs();
    const i = list.findIndex(f => f.full === it.full);
    if (i >= 0) list.splice(i, 1);
    else list.unshift({ full: it.full, preview: it.preview || it.full, w: it.w, h: it.h, title: it.title || "" });
    gifFavCache = list.slice(0, GIF_FAV_MAX);
    try { localStorage.setItem(GIF_FAV_KEY, JSON.stringify(gifFavCache)); } catch (_) {}
    return i < 0;
  }
  // Another tab (or clearing site data) changed the list — drop the cache.
  window.addEventListener("storage", e => { if (e.key === GIF_FAV_KEY) gifFavCache = null; });
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
  const LANG_NAMES = { en:"English", es:"Spanish", de:"German", fr:"French", pt:"Português (Brasil)", it:"Italian", nl:"Dutch", ja:"Japanese", ko:"Korean", zh:"Chinese", ru:"Russian" };
  let translateOn = false, targetLang = "en";
  const translationCache = new Map(), translatorPool = new Map();
  function guessLang() { const l = (navigator.language || "en").slice(0,2).toLowerCase(); return LANG_NAMES[l] ? l : "en"; }
  try {
    const savedOn = localStorage.getItem("mf_tr_on");
    targetLang = localStorage.getItem("mf_tr_lang") || guessLang();
    // Older installs may already have a non-English site language saved but
    // no chat toggle yet. Treat that as translation-on. This also avoids an
    // Opera Mobile race where the site-language event can fire before this
    // lazily-loaded script has attached its listener. An explicit saved "0"
    // still wins, so Settings can intentionally leave chat untranslated.
    translateOn = savedOn === "1" || (savedOn === null && targetLang !== "en");
  } catch (_) {
    targetLang = guessLang();
    translateOn = targetLang !== "en";
  }
  const HAS_DEVICE = (typeof self !== "undefined") && ("Translator" in self) && ("LanguageDetector" in self);
  const HAS_SERVER = /^https?:$/.test(location.protocol);
  const TR_MODE = HAS_SERVER ? "server" : (HAS_DEVICE ? "device" : "none");
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
  function onlineTargetLang(tgt) { return tgt === "pt" ? "pt-BR" : tgt; }
  async function serverTranslate(text, tgt) {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + encodeURIComponent(onlineTargetLang(tgt)) + "&dt=t&ie=UTF-8&oe=UTF-8&q=" + encodeURIComponent(text);
    try { const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000); const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(timer); if (!r.ok) return null; const data = await r.json(); const out = (data[0] || []).map(s => s[0]).join(""); const src = String(data[2] || "").toLowerCase().slice(0,2); if (!out) return null; return { text: out, src }; } catch (_) { return null; }
  }
  async function translateText(text, tgt) {
    const ck = tgt + "||" + text;
    if (translationCache.has(ck)) return translationCache.get(ck);
    let out = null;

    // Quality first: use Google's online translation whenever we're online.
    // The browser's on-device model remains an offline/failure fallback.
    if (HAS_SERVER) {
      const r = await serverTranslate(text, tgt);
      if (r) {
        if (r.src && r.src === tgt) { translationCache.set(ck, null); return null; }
        out = r.text;
      }
    }
    if (!out && HAS_DEVICE) {
      const src = await detectLang(text);
      if (src && src === tgt) { translationCache.set(ck, null); return null; }
      if (src) {
        const t = await getTranslator(src, tgt);
        if (t) { try { out = await t.translate(text); } catch (_) { out = null; } }
      }
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

  function cleanHandle(value) {
    return String(value || "").trim().toLowerCase().replace(/^@/, "");
  }

  async function handleForUid(uid) {
    if (!uid || !db || !mods) return "";
    if (uidHandleCache.has(uid)) return uidHandleCache.get(uid);
    const promise = mods.get(mods.ref(db, `users/${uid}/username`))
      .then(snap => cleanHandle(snap.exists() ? snap.val() : ""))
      .catch(() => "");
    uidHandleCache.set(uid, promise);
    const handle = await promise;
    uidHandleCache.set(uid, handle);
    return handle;
  }

  async function roleForUid(uid) {
    if (!uid) return "user";
    if (uid === me) return myChatRole;
    if (uidRoleCache.has(uid)) return uidRoleCache.get(uid);
    const promise = (async () => {
      const handle = await handleForUid(uid);
      if (!handle) return "user";
      if (ownerHandle && handle === ownerHandle) return "owner";
      if (adminHandles.has(handle)) return "admin";
      try {
        const snap = await mods.get(mods.ref(db, `admins/${handle}`));
        if (snap.exists() && snap.val() === true) {
          adminHandles.add(handle);
          return "admin";
        }
      } catch (_) {}
      return "user";
    })();
    uidRoleCache.set(uid, promise);
    const role = await promise;
    uidRoleCache.set(uid, role);
    return role;
  }

  async function canModerateMessage(m) {
    if (view !== "global" || !m || m.uid === me) return false;
    if (myChatRole === "owner") return true;
    if (myChatRole !== "admin") return false;
    return (await roleForUid(m.uid)) === "user";
  }

  function resetModerationState() {
    moderationSeq++;
    myChatRole = "user";
    ownerHandle = "";
    adminHandles = new Set();
    uidRoleCache.clear();
    refreshVisibleActions();
    updateModeratorButton();
    paintGlobalNotices();
    updateComposerState();
  }

  async function refreshModerationState() {
    if (!me || !db || !mods) { resetModerationState(); return; }
    const seq = ++moderationSeq;
    try {
      let myHandle = cleanHandle(MFAuth.profile && MFAuth.profile.username);
      if (!myHandle) myHandle = await handleForUid(me);
      const ownerSnap = await mods.get(mods.ref(db, "owner"));
      const nextOwner = cleanHandle(ownerSnap.exists() ? ownerSnap.val() : "");
      const adminSnap = myHandle
        ? await mods.get(mods.ref(db, `admins/${myHandle}`))
        : null;
      let nextRole = "user";
      if (myHandle && nextOwner && myHandle === nextOwner) nextRole = "owner";
      else if (adminSnap && adminSnap.exists() && adminSnap.val() === true) nextRole = "admin";

      let nextAdmins = new Set();
      if (nextRole === "owner" || nextRole === "admin") {
        try {
          const allAdmins = await mods.get(mods.ref(db, "admins"));
          const values = allAdmins.exists() ? (allAdmins.val() || {}) : {};
          Object.entries(values).forEach(([handle, enabled]) => {
            if (enabled === true) nextAdmins.add(cleanHandle(handle));
          });
        } catch (_) {
          if (nextRole === "admin" && myHandle) nextAdmins.add(myHandle);
        }
      }
      if (seq !== moderationSeq || me == null) return;
      ownerHandle = nextOwner;
      adminHandles = nextAdmins;
      myChatRole = nextRole;
      uidRoleCache.clear();
      uidRoleCache.set(me, myChatRole);
      refreshVisibleActions();
      updateModeratorButton();
      paintGlobalNotices();
      updateComposerState();
    } catch (_) {
      if (seq === moderationSeq) resetModerationState();
    }
  }

  // Map of Firebase message key -> its rendered row and message data, so edits
  // and removals can update exactly one row in place instead of re-rendering.
  let msgRows = new Map();
  let msgData = new Map();

  function subscribeMessages(node) {
    if (unsubscribe) { try { unsubscribe(); } catch (_) {} unsubscribe = null; }
    const log = document.getElementById("mfChatLog");
    if (log) log.innerHTML = "";
    msgRows = new Map();
    msgData = new Map();
    // Always order by Firebase message key, never by a client-supplied clock.
    // Push IDs preserve send order, and restored messages reuse their original
    // key, so a restoration naturally returns to its original position.
    const q = mods.query(node, mods.orderByKey(), mods.limitToLast(100));
    // Only render genuine messages — ignore any stray non-message children
    // (e.g. legacy typing data) so they never appear as garbled messages.
    const isMsg = (m) => m && typeof m === "object" && typeof m.uid === "string" && (typeof m.t === "number");
    const onAdd = (snap) => {
      const m = snap.val();
      if (isMsg(m)) { msgData.set(snap.key, m); renderMsg(snap.key, m); }
    };
    const onChange = (snap) => {
      const m = snap.val();
      if (isMsg(m)) { msgData.set(snap.key, m); renderMsg(snap.key, m); }
    };
    const onRemove = (snap) => {
      const row = msgRows.get(snap.key);
      if (row) row.remove();
      msgRows.delete(snap.key);
      msgData.delete(snap.key);
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

  function compareMessages(aKey, a, bKey, b) {
    // Firebase push keys are lexicographically chronological. Do not use `t`
    // here: older builds wrote `t` from Date.now(), so two devices with clock
    // skew could make later messages jump upward in the chat.
    const ak = String(aKey);
    const bk = String(bKey);
    return ak === bk ? 0 : (ak < bk ? -1 : 1);
  }

  function reorderMessageRows(log) {
    if (!log) return;
    const ordered = [...msgData.entries()]
      .filter(([key]) => msgRows.has(key))
      .sort(([aKey,a],[bKey,b]) => compareMessages(aKey,a,bKey,b));
    const fragment = document.createDocumentFragment();
    ordered.forEach(([key]) => {
      const row = msgRows.get(key);
      if (row) fragment.appendChild(row);
    });
    log.appendChild(fragment);
  }

  // Build OR update the row for a message. Adding and editing share this one
  // path, so an edit re-renders in place and a removal drops the row cleanly.
  function renderMsg(key, m) {
    const log = document.getElementById("mfChatLog");
    if (!log) return;
    const existing = msgRows.get(key);
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;

    const mine = m.uid === me;
    const row = existing || document.createElement("div");
    row.className = "mf-msg " + (mine ? "me" : "them");
    row.dataset.key = key;

    // Hide legacy soft-deleted records too. New deletions remove the database
    // node completely, but old tombstones may still exist from earlier builds.
    if (m.deleted) {
      if (existing) existing.remove();
      msgRows.delete(key);
      msgData.delete(key);
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

    // Your own messages can be edited/deleted. In the global room, admins can
    // remove regular-user messages and the owner can remove any message.
    syncMsgActions(row, key, m, !media);

    const nm = row.querySelector(".mf-msg-name");
    if (nm) nm.addEventListener("click", () => {
      if ((myChatRole === "admin" || myChatRole === "owner") && m.uid !== me) openUserModeration(m.uid, m.name || "someone");
      else if (window.MFProfile) MFProfile.show(m.uid);
    });

    if (!existing) {
      msgRows.set(key, row);
      reorderMessageRows(log);
      // Scroll down for a new message only if you're already at the bottom, or
      // it's your own message — so reading older messages isn't interrupted.
      if (atBottom || mine) log.scrollTop = log.scrollHeight;
      // Translate just THIS bubble (not the whole log) so a busy chat stays fast.
      if (translateOn && !media) {
        const b = row.querySelector(".mf-msg-text[data-text]");
        translateBubble(b).then(() => { if (atBottom || mine) log.scrollTop = log.scrollHeight; });
      }
    } else {
      reorderMessageRows(log);
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

  function removeMsgActions(row) {
    if (!row) return;
    const actions = row.querySelector(".mf-msg-actions");
    if (actions) actions.remove();
    const menu = row.querySelector(".mf-msg-menu");
    if (menu) menu.remove();
    if (!row.classList.contains("me")) row.style.paddingRight = "";
  }

  async function syncMsgActions(row, key, m, canEditOwnText) {
    removeMsgActions(row);
    if (!row || !m) return;
    if (m.uid === me) {
      addMsgActions(row, key, m, canEditOwnText, true);
      return;
    }
    if (!(await canModerateMessage(m))) return;
    // The row may have been replaced while the role lookup was in flight.
    if (!row.isConnected || msgRows.get(key) !== row || row.dataset.key !== key) return;
    addMsgActions(row, key, m, false, true);
  }

  function refreshVisibleActions() {
    for (const [key, m] of msgData.entries()) {
      const row = msgRows.get(key);
      if (!row) continue;
      const canEditOwnText = !decodeMedia(m.text);
      syncMsgActions(row, key, m, canEditOwnText);
    }
  }

  // Attach the small ⋯ menu. Editing is always limited to the author; delete
  // permission is additionally enforced by Firebase rules.
  function addMsgActions(row, key, m, canEdit, canDelete) {
    if (!canEdit && !canDelete) return;
    if (row.querySelector(".mf-msg-actions")) return;
    const btn = document.createElement("button");
    btn.className = "mf-msg-actions";
    btn.type = "button";
    btn.title = canEdit ? "Edit or delete" : "Remove message";
    btn.setAttribute("aria-label", "Message options");
    btn.textContent = "⋯";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMsgMenu(row, key, m, canEdit, canDelete);
    });
    row.appendChild(btn);
    if (!row.classList.contains("me")) row.style.paddingRight = "24px";
  }

  function closeMsgMenu() {
    const open = document.querySelector(".mf-msg-menu");
    if (open) open.remove();
    document.removeEventListener("click", closeMsgMenu);
  }

  function openMsgMenu(row, key, m, canEdit, canDelete) {
    closeMsgMenu();
    const menu = document.createElement("div");
    menu.className = "mf-msg-menu";
    menu.innerHTML =
      (canEdit ? `<button type="button" data-act="edit">✏️ Edit</button>` : "") +
      (canDelete ? `<button type="button" data-act="delete">🗑️ Remove</button>` : "");
    row.appendChild(menu);
    const editBtn = menu.querySelector('[data-act="edit"]');
    if (editBtn) editBtn.addEventListener("click", (e) => {
      e.stopPropagation(); closeMsgMenu(); startEdit(row, key, m);
    });
    const deleteBtn = menu.querySelector('[data-act="delete"]');
    if (deleteBtn) deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation(); closeMsgMenu(); deleteMsg(key, m);
    });
    // close on next outside click
    setTimeout(() => document.addEventListener("click", closeMsgMenu), 0);
  }

  async function deleteMsg(key, m) {
    if (!m) m = msgData.get(key);
    if (!m) return;
    const mine = m.uid === me;
    const excerpt = messageExcerpt(m);
    if (!confirm(mine ? `Delete “${excerpt}”?` : `Remove ${m.name || "this user's"} message: “${excerpt}”?`)) return;
    try {
      if (mine) {
        await mods.remove(msgRef(key));
      } else {
        const reason = prompt("Reason for removal (optional):", "") || "";
        await archiveAndDelete([{ key, message: m }], "delete", reason);
      }
    } catch (_) { toast("Couldn't remove that message"); }
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


  // ---- full moderation suite ------------------------------------------------
  function isModerator() { return myChatRole === "admin" || myChatRole === "owner"; }
  function updateModeratorButton() {
    const btn = document.getElementById("mfModBtn");
    if (btn) btn.hidden = !isModerator();
  }
  function formatDuration(ms) {
    ms = Math.max(0, Number(ms) || 0);
    const mins = Math.ceil(ms / 60000);
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
    const hours = Math.ceil(mins / 60);
    if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
    const days = Math.ceil(hours / 24);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  function messageExcerpt(m) {
    const media = decodeMedia(m && m.text);
    if (media) return media.kind === "gif" ? "GIF" : "image";
    const text = String((m && m.text) || "message").replace(/\s+/g, " ").trim();
    return text.length > 70 ? text.slice(0, 67) + "…" : text;
  }
  function dismissedWarningIds() {
    try { return new Set(JSON.parse(localStorage.getItem("mf_dismissed_warnings") || "[]")); }
    catch (_) { return new Set(); }
  }
  function dismissWarning(id) {
    const set = dismissedWarningIds(); set.add(id);
    try { localStorage.setItem("mf_dismissed_warnings", JSON.stringify([...set].slice(-200))); } catch (_) {}
    paintGlobalNotices();
  }
  function paintGlobalNotices() {
    const box = document.getElementById("mfGlobalNotices");
    if (!box) return;
    const bits = [];
    const dismissed = dismissedWarningIds();
    Object.entries(myWarnings || {}).sort((a,b)=>(b[1].at||0)-(a[1].at||0)).forEach(([id,w]) => {
      if (dismissed.has(id)) return;
      bits.push(`<div class="mf-chat-notice warning"><b>⚠️ Moderator warning</b><span>${esc(w.text || w.reason || "Please review the chat rules.")}</span><small>${w.byName ? `From ${esc(w.byName)} · ` : ""}${w.at ? esc(new Date(w.at).toLocaleString()) : ""}</small><button type="button" data-dismiss-warning="${esc(id)}">Dismiss</button></div>`);
    });
    if (myRestriction.blocked) bits.push(`<div class="mf-chat-notice danger"><b>🚫 Public chat blocked</b><span>${esc(myRestriction.reason || "A moderator blocked this account from public chat.")}</span></div>`);
    else if ((Number(myRestriction.mutedUntil)||0) > Date.now()) bits.push(`<div class="mf-chat-notice danger"><b>🔇 Muted</b><span>${esc(myRestriction.reason || "You cannot post in public chat right now.")} ${myRestriction.mutedUntil < 32500000000000 ? `Ends ${esc(new Date(myRestriction.mutedUntil).toLocaleString())}.` : ""}</span></div>`);
    if (chatSettings.locked) bits.push(`<div class="mf-chat-notice lock"><b>🔒 Chat locked</b><span>${isModerator() ? "Moderators can still post." : "Only moderators can post until it is unlocked."}</span></div>`);
    else if ((Number(chatSettings.slowSeconds)||0) > 0) bits.push(`<div class="mf-chat-notice"><b>⏱️ Slow mode</b><span>Regular users can post once every ${Number(chatSettings.slowSeconds)} seconds.</span></div>`);
    box.innerHTML = bits.join("");
    box.querySelectorAll("[data-dismiss-warning]").forEach(btn => btn.addEventListener("click", () => dismissWarning(btn.dataset.dismissWarning)));
  }
  function stopModerationWatches() {
    modWatchUnsubs.forEach(fn => { try { fn(); } catch (_) {} });
    modWatchUnsubs = [];
    chatSettings = { ...DEFAULT_CHAT_SETTINGS };
    myRestriction = { blocked:false, mutedUntil:0, reason:"" };
    myWarnings = {};
    lastGlobalPostAt = 0;
  }
  function watchModerationEnvironment() {
    stopModerationWatches();
    if (!me || !db || !mods) return;
    const watch = (ref, cb) => { const fn = mods.onValue(ref, cb); modWatchUnsubs.push(() => mods.off(ref, "value", cb)); return fn; };
    const settingsRef = mods.ref(db, "chatSettings/global");
    watch(settingsRef, snap => { chatSettings = { ...DEFAULT_CHAT_SETTINGS, ...(snap.val() || {}) }; paintGlobalNotices(); updateComposerState(); });
    const restrictionRef = mods.ref(db, `chatRestrictions/${me}`);
    watch(restrictionRef, snap => { myRestriction = { blocked:false, mutedUntil:0, reason:"", ...(snap.val() || {}) }; paintGlobalNotices(); updateComposerState(); });
    const warningsRef = mods.ref(db, `chatWarnings/${me}`);
    watch(warningsRef, snap => { myWarnings = snap.val() || {}; paintGlobalNotices(); });
    const lastRef = mods.ref(db, `chat/lastPost/${me}`);
    watch(lastRef, snap => { lastGlobalPostAt = Number(snap.val()) || 0; updateComposerState(); });
  }
  async function canActOnUid(uid, knownRole) {
    if (!isModerator() || !uid || uid === me) return false;
    // Owners can time out and otherwise moderate admins; admins can only act on
    // regular users.
    if (myChatRole === "owner") return true;
    const targetRole = knownRole || await roleForUid(uid);
    return targetRole === "user";
  }
  async function addModerationLog(action, target, extra) {
    const key = mods.push(mods.ref(db, "moderationLog")).key;
    const now = Date.now();
    const rec = {
      action, actorUid: me, actorName: myName || "moderator", actorRole: myChatRole,
      targetUid: (target && target.uid) || "", targetName: (target && target.name) || "",
      at: now, expiresAt: now + MOD_LOG_RETENTION_MS, ...(extra || {})
    };
    await mods.set(mods.ref(db, `moderationLog/${key}`), rec);
    return key;
  }
  async function archiveAndDelete(items, action, reason) {
    const updates = {};
    const now = Date.now();
    const batchId = items.length > 1 ? `${now.toString(36)}-${Math.random().toString(36).slice(2,7)}` : "";
    for (const item of items) {
      const m = item.message;
      const logKey = mods.push(mods.ref(db, "moderationLog")).key;
      updates[`moderationLog/${logKey}`] = {
        action, actorUid: me, actorName: myName || "moderator", actorRole: myChatRole,
        targetUid: m.uid || "", targetName: m.name || "", messageId: item.key,
        messageText: String(m.text || "").slice(0,500), messageTime: Number(m.t)||now,
        reason: String(reason || "").slice(0,200), at: now, expiresAt: now + MOD_LOG_RETENTION_MS,
        ...(batchId ? { batchId } : {})
      };
      updates[`chat/global/${item.key}`] = null;
    }
    await mods.update(mods.ref(db), updates);
  }
  async function setRestriction(uid, name, patch, action, reason) {
    if (!(await canActOnUid(uid))) throw new Error("protected");
    const currentSnap = await mods.get(mods.ref(db, `chatRestrictions/${uid}`));
    const current = currentSnap.val() || {};
    const next = { ...current, ...patch, byUid: me, byName: myName || "moderator", at: Date.now(), reason: String(reason || "").slice(0,200) };
    if (!next.blocked && !(Number(next.mutedUntil) > Date.now())) {
      await mods.remove(mods.ref(db, `chatRestrictions/${uid}`));
    } else await mods.set(mods.ref(db, `chatRestrictions/${uid}`), next);
    await addModerationLog(action, {uid,name}, { reason:String(reason||"").slice(0,200), mutedUntil:Number(next.mutedUntil)||0, blocked:!!next.blocked });
    try {
      const labels = { timeout:"You were timed out", unmute:"Your timeout was removed", block:"You were blocked from public chat", unblock:"Your public-chat block was removed" };
      const bodies = { timeout:(Number(next.mutedUntil)>32500000000000?"Your public-chat timeout is indefinite.":`Your public-chat timeout lasts until ${new Date(Number(next.mutedUntil)||Date.now()).toLocaleString()}.`), unmute:"You may post in public chat again.", block:(reason?String(reason).slice(0,200):"You cannot currently post in public chat."), unblock:"You may post in public chat again." };
      await MFAuth.createNotification(uid,{type:`moderation_${action}`,icon:action==="block"?"🚫":"⚠️",title:labels[action]||"Moderation update",body:bodies[action]||String(reason||""),link:"/notifications.html",sourceId:String(Date.now())});
    } catch (_) {}
  }
  async function warnUser(uid, name) {
    if (!(await canActOnUid(uid))) return toast("That account is protected.");
    const text = prompt(`Private warning for ${name}:`, "");
    if (!text || !text.trim()) return;
    const now = Date.now();
    const key = mods.push(mods.ref(db, `chatWarnings/${uid}`)).key;
    await mods.set(mods.ref(db, `chatWarnings/${uid}/${key}`), { text:text.trim().slice(0,500), byUid:me, byName:myName || myHandle || "moderator", at:Date.now() });
    await addModerationLog("warning", {uid,name}, { reason: text.trim().slice(0,200) });
    try { await MFAuth.createNotification(uid,{id:`warning_${key}`,type:"moderation_warning",icon:"⚠️",title:"Moderator warning",body:text.trim().slice(0,240),link:"/notifications.html",sourceId:key}); } catch (_) {}
    toast("Warning sent privately.");
  }
  async function addAdminNote(uid, name) {
    if (!(await canActOnUid(uid))) return toast("That account is protected.");
    const text = prompt(`Private moderator note for ${name}:`, "");
    if (!text || !text.trim()) return;
    const key = mods.push(mods.ref(db, `moderationNotes/${uid}`)).key;
    await mods.set(mods.ref(db, `moderationNotes/${uid}/${key}`), { text: text.trim().slice(0,1000), byUid: me, byName: myName || "moderator", at: Date.now() });
    await addModerationLog("note", {uid,name}, { reason: text.trim().slice(0,200) });
    toast("Private note saved.");
  }
  async function bulkDeleteForUser(uid, name, amount) {
    if (!(await canActOnUid(uid))) return toast("That account is protected.");
    const snap = await mods.get(mods.query(mods.ref(db, "chat/global"), mods.limitToLast(250)));
    let rows = [];
    snap.forEach(ch => { const m=ch.val(); if (m && m.uid === uid && !m.deleted) rows.push({key:ch.key,message:m}); });
    rows.sort((a,b)=>(b.message.t||0)-(a.message.t||0));
    if (amount !== "all") rows = rows.slice(0, Number(amount)||0);
    if (!rows.length) return toast("No recent messages found for that user.");
    const typed = prompt(`This will permanently remove ${rows.length} recent message${rows.length===1?"":"s"} from ${name}. Type DELETE to continue:`, "");
    if (typed !== "DELETE") return;
    const reason = prompt("Reason for bulk removal (optional):", "") || "";
    for (let i=0;i<rows.length;i+=40) await archiveAndDelete(rows.slice(i,i+40), "bulk_delete", reason);
    toast(`${rows.length} message${rows.length===1?"":"s"} removed.`);
    closeModerationOverlay();
  }
  function closeModerationOverlay() {
    const ov = document.getElementById("mfModOverlay"); if (ov) ov.remove();
  }
  function makeModerationOverlay(title) {
    closeModerationOverlay();
    const ov = document.createElement("div"); ov.id="mfModOverlay"; ov.className="mf-mod-overlay";
    ov.innerHTML = `<div class="mf-mod-card" role="dialog" aria-modal="true"><button class="mf-mod-close" type="button">✕</button><h3>${esc(title)}</h3><div class="mf-mod-content">Loading…</div></div>`;
    document.body.appendChild(ov);
    ov.querySelector(".mf-mod-close").addEventListener("click", closeModerationOverlay);
    ov.addEventListener("click", e => { if(e.target===ov) closeModerationOverlay(); });
    return ov.querySelector(".mf-mod-content");
  }
  async function openUserModeration(uid, fallbackName) {
    if (!isModerator()) { if (window.MFProfile) MFProfile.show(uid); return; }
    const content = makeModerationOverlay(`Moderate ${fallbackName || "user"}`);
    try {
      const [userSnap, restrictSnap, warningsSnap, notesSnap] = await Promise.all([
        mods.get(mods.ref(db, `users/${uid}`)), mods.get(mods.ref(db, `chatRestrictions/${uid}`)),
        mods.get(mods.query(mods.ref(db, `chatWarnings/${uid}`), mods.limitToLast(10))),
        mods.get(mods.query(mods.ref(db, `moderationNotes/${uid}`), mods.limitToLast(10)))
      ]);
      const user = userSnap.val() || {}; const name=user.displayName||fallbackName||"someone"; const handle=cleanHandle(user.username);
      const role = await roleForUid(uid); const allowed = await canActOnUid(uid,role); const r=restrictSnap.val()||{};
      const warnings=[]; warningsSnap.forEach(ch=>warnings.push({id:ch.key,...(ch.val()||{})}));
      const notes=[]; notesSnap.forEach(ch=>notes.push({id:ch.key,...(ch.val()||{})}));
      const protectedText = allowed ? "" : `<div class="mf-mod-protected">🛡️ ${role === "owner" ? "The owner" : "Another admin"} is protected from admin actions.</div>`;
      content.innerHTML = `
        <div class="mf-mod-userhead"><b>${esc(name)}</b>${handle?`<span>@${esc(handle)}</span>`:""}<span class="mf-role-pill ${esc(role)}">${esc(role)}</span></div>
        ${protectedText}
        <div class="mf-mod-grid">
          <button data-mod-act="profile">👤 View profile</button>
          ${allowed?`<button data-mod-act="warn">⚠️ Warn privately</button><button data-mod-act="note">📝 Add private note</button>
          <button data-mod-act="mute10">🔇 Mute 10 minutes</button><button data-mod-act="mute60">🔇 Mute 1 hour</button><button data-mod-act="mute1440">🔇 Mute 24 hours</button><button data-mod-act="muteForever">🔇 Mute indefinitely</button>
          <button data-mod-act="unmute">🔊 Remove timeout</button><button data-mod-act="${r.blocked?"unblock":"block"}">${r.blocked?"✅ Unblock public chat":"🚫 Block public chat"}</button>
          <button data-mod-act="del5">🧹 Delete last 5</button><button data-mod-act="del10">🧹 Delete last 10</button><button data-mod-act="delall" class="danger">🧹 Delete all recent</button>`:""}
          ${myChatRole==="owner" && role!=="owner"?`<button data-mod-act="${role==="admin"?"demote":"promote"}" class="owner-only">👑 ${role==="admin"?"Remove admin":"Make admin"}</button>`:""}
        </div>
        <div class="mf-mod-status"><b>Current restriction</b><span>${r.blocked?"Blocked from public chat":(Number(r.mutedUntil)>Date.now()?`Muted until ${esc(new Date(r.mutedUntil).toLocaleString())}`:"None")}</span>${r.reason?`<small>${esc(r.reason)}</small>`:""}</div>
        <details><summary>Warning history (${warnings.length})</summary><div class="mf-mod-history">${warnings.length?warnings.reverse().map(w=>`<div><b>${esc(w.byName||"moderator")}</b> · ${esc(new Date(w.at||0).toLocaleString())}<br>${esc(w.text||"")}</div>`).join(""):"No warnings."}</div></details>
        <details><summary>Private admin notes (${notes.length})</summary><div class="mf-mod-history">${notes.length?notes.reverse().map(n=>`<div><b>${esc(n.byName||"moderator")}</b> · ${esc(new Date(n.at||0).toLocaleString())}<br>${esc(n.text||"")}</div>`).join(""):"No notes."}</div></details>`;
      content.querySelectorAll("[data-mod-act]").forEach(btn=>btn.addEventListener("click", async()=>{
        const a=btn.dataset.modAct; btn.disabled=true;
        try {
          if(a==="profile") { closeModerationOverlay(); if(window.MFProfile) MFProfile.show(uid); return; }
          if(a==="warn") await warnUser(uid,name);
          else if(a==="note") await addAdminNote(uid,name);
          else if(a.startsWith("mute")) { const mins={mute10:10,mute60:60,mute1440:1440}[a]; const until=mins?Date.now()+mins*60000:32503680000000; const why=prompt("Reason for timeout (optional):","")||""; await setRestriction(uid,name,{mutedUntil:until},"timeout",why); }
          else if(a==="unmute") await setRestriction(uid,name,{mutedUntil:0},"unmute","");
          else if(a==="block") { const why=prompt("Reason for blocking public chat (optional):","")||""; await setRestriction(uid,name,{blocked:true},"block",why); }
          else if(a==="unblock") await setRestriction(uid,name,{blocked:false},"unblock","");
          else if(a==="del5") return bulkDeleteForUser(uid,name,5);
          else if(a==="del10") return bulkDeleteForUser(uid,name,10);
          else if(a==="delall") return bulkDeleteForUser(uid,name,"all");
          else if(a==="promote" || a==="demote") {
            if(myChatRole!=="owner" || !handle) throw new Error("owner only");
            if(!confirm(`${a==="promote"?"Make":"Remove"} @${handle} ${a==="promote"?"an admin":"from the admin team"}?`)) { btn.disabled=false; return; }
            const ref=mods.ref(db,`admins/${handle}`); if(a==="promote") { await mods.set(ref,true); adminHandles.add(handle); } else { await mods.remove(ref); adminHandles.delete(handle); }
            uidRoleCache.delete(uid);
            await addModerationLog(a==="promote"?"promote":"demote",{uid,name},{reason:`@${handle}`});
          }
          toast("Moderation action saved."); closeModerationOverlay();
        } catch(err) { toast(err && err.message==="protected"?"That account is protected.":"That moderation action was refused."); btn.disabled=false; }
      }));
    } catch (_) { content.innerHTML = `<div class="mf-mod-protected">Could not load that account.</div>`; }
  }
  function openChatSettings() {
    if (!isModerator()) return;
    const content = makeModerationOverlay("Chat moderation");
    const canUnlock = myChatRole === "owner" || chatSettings.adminsCanUnlock;
    content.innerHTML = `
      <label class="mf-mod-setting"><span><b>Public chat lock</b><small>Regular users cannot post while locked.</small></span><input type="checkbox" id="mfSetLocked" ${chatSettings.locked?"checked":""} ${chatSettings.locked&&!canUnlock?"disabled":""}></label>
      <label class="mf-mod-setting"><span><b>Slow mode</b><small>Posting delay for regular users.</small></span><select id="mfSetSlow"><option value="0">Off</option><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="300">5 minutes</option></select></label>
      ${myChatRole==="owner"?`<label class="mf-mod-setting"><span><b>Admins may unlock chat</b><small>When off, only the owner can reopen a locked chat.</small></span><input type="checkbox" id="mfAdminsUnlock" ${chatSettings.adminsCanUnlock?"checked":""}></label>`:""}
      ${myChatRole==="owner"?`<label class="mf-mod-setting"><span><b>GIF search filter</b><small>Strictest also hides plain affection; no filtering allows adult results.</small></span><select id="mfGifFilter"><option value="high">Strictest</option><option value="medium">Balanced (default)</option><option value="low">Relaxed</option><option value="off">No filtering</option></select></label>`:""}
      <div class="mf-mod-grid"><a class="mf-mod-link" href="/admin.html#chat-moderation">Open moderation center</a></div>`;
    content.querySelector("#mfSetSlow").value=String(Number(chatSettings.slowSeconds)||0);
    content.querySelector("#mfSetLocked").addEventListener("change", async e=>{
      try { await mods.set(mods.ref(db,"chatSettings/global/locked"),e.target.checked); await addModerationLog(e.target.checked?"lock":"unlock",{uid:"",name:"Public chat"},{}); }
      catch(_){ e.target.checked=!e.target.checked; toast("You are not allowed to change that setting."); }
    });
    content.querySelector("#mfSetSlow").addEventListener("change", async e=>{
      try { const v=Number(e.target.value)||0; await mods.set(mods.ref(db,"chatSettings/global/slowSeconds"),v); await addModerationLog("slow_mode",{uid:"",name:"Public chat"},{slowSeconds:v}); }
      catch(_){ toast("Couldn't change slow mode."); }
    });
    const unlock=content.querySelector("#mfAdminsUnlock"); if(unlock) unlock.addEventListener("change",async e=>{
      try { await mods.set(mods.ref(db,"chatSettings/global/adminsCanUnlock"),e.target.checked); await addModerationLog("unlock_policy",{uid:"",name:"Public chat"},{adminsCanUnlock:e.target.checked}); }
      catch(_){ e.target.checked=!e.target.checked; toast("Only the owner can change that."); }
    });
    const gifF=content.querySelector("#mfGifFilter"); if(gifF){
      gifF.value = klipyFilter();
      gifF.addEventListener("change", async e=>{
        const v = CHAT_CONFIG.gifFilters.includes(e.target.value) ? e.target.value : CHAT_CONFIG.gifFilterDefault;
        try { await mods.set(mods.ref(db,"chatSettings/global/gifFilter"),v); await addModerationLog("gif_filter",{uid:"",name:"Public chat"},{gifFilter:v}); }
        catch(_){ e.target.value = klipyFilter(); toast("Only the owner can change that."); }
      });
    }
  }
  function injectModerationStyles() {
    if (document.getElementById("mfModerationStyles")) return;
    const st=document.createElement("style"); st.id="mfModerationStyles"; st.textContent=`
      .mf-global-notices:empty{display:none}.mf-global-notices{display:grid;gap:6px;padding:8px 9px 0}
      .mf-chat-notice{display:grid;gap:3px;position:relative;padding:8px 34px 8px 10px;border-radius:10px;border:1px solid rgba(196,181,253,.25);background:rgba(196,181,253,.08);font-size:11.5px;line-height:1.35}
      .mf-chat-notice.warning{border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.09)}.mf-chat-notice.danger{border-color:rgba(251,113,133,.36);background:rgba(251,113,133,.09)}.mf-chat-notice.lock{border-color:rgba(148,163,184,.35);background:rgba(148,163,184,.08)}
      .mf-chat-notice small{opacity:.65}.mf-chat-notice button{position:absolute;right:6px;top:6px;border:0;background:transparent;color:inherit;opacity:.7;cursor:pointer;font-size:10px}
      .mf-mod-overlay{position:fixed;inset:0;z-index:100000;background:rgba(5,8,18,.72);display:grid;place-items:center;padding:16px;backdrop-filter:blur(6px)}
      .mf-mod-card{position:relative;width:min(520px,100%);max-height:min(720px,92vh);overflow:auto;border:1px solid rgba(196,181,253,.3);border-radius:18px;background:rgba(18,23,40,.985);color:#f5f1fb;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.55);font:14px/1.45 system-ui,sans-serif}
      .mf-mod-card h3{margin:0 30px 16px 0;font-size:19px}.mf-mod-close{position:absolute;right:12px;top:12px;border:0;background:transparent;color:#ddd;cursor:pointer;font-size:16px}
      .mf-mod-userhead{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.mf-mod-userhead>span{opacity:.7}.mf-role-pill{font-size:10px;text-transform:uppercase;letter-spacing:.08em;border:1px solid rgba(255,255,255,.18);padding:2px 7px;border-radius:999px}.mf-role-pill.admin{color:#c4b5fd}.mf-role-pill.owner{color:#fbbf24}
      .mf-mod-protected{padding:10px;border-radius:10px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);margin-bottom:12px}.mf-mod-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.mf-mod-grid button,.mf-mod-link{font:inherit;text-align:left;color:#eee;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:9px 10px;cursor:pointer;text-decoration:none}.mf-mod-grid button:hover,.mf-mod-link:hover{border-color:#c4b5fd}.mf-mod-grid .danger{border-color:rgba(251,113,133,.35)}.mf-mod-grid .owner-only{border-color:rgba(251,191,36,.35)}
      .mf-mod-status{display:grid;gap:3px;padding:10px;border-radius:10px;background:rgba(255,255,255,.035);margin:10px 0}.mf-mod-status span,.mf-mod-status small{opacity:.75}.mf-mod-card details{border-top:1px solid rgba(255,255,255,.1);padding:10px 0}.mf-mod-card summary{cursor:pointer}.mf-mod-history{display:grid;gap:7px;margin-top:8px}.mf-mod-history>div{padding:8px;border-radius:9px;background:rgba(255,255,255,.035);font-size:12px}
      .mf-mod-setting{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.1)}.mf-mod-setting span{display:grid}.mf-mod-setting small{opacity:.65}.mf-mod-setting select{background:#111827;color:#eee;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px}
      @media(max-width:520px){.mf-mod-grid{grid-template-columns:1fr}.mf-mod-card{padding:17px}}
    `; document.head.appendChild(st);
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
      refreshModerationState();
      watchModerationEnvironment();
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
      if (user && wired) { refreshModerationState(); watchModerationEnvironment(); }
      if (!user) { resetModerationState(); stopModerationWatches(); }
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