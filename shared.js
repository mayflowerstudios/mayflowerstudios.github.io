/* shared.js — Mayflower Studios */
(function () {

  function localPref(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (_) { return fallback; } }
  function applyLocalAppearance() {
    const reduce = localPref('mf_reduce_motion', '0') === '1';
    document.documentElement.classList.toggle('mf-reduce-motion', reduce);
  }
  applyLocalAppearance();

  function injectBg() {
    if (document.querySelector('.bg-scene')) return;
    const s1 = document.createElement('div'); s1.className = 'bg-scene';
    const s2 = document.createElement('div'); s2.className = 'bg-glow';
    document.body.prepend(s2);
    document.body.prepend(s1);
  }

  function injectFavicon() {
    if (document.querySelector('link[rel="icon"]')) return;
    // A tab icon draws at 16-32px and a home-screen icon at 180px, so these
    // point at files that size rather than the full-resolution artwork.
    const l = document.createElement('link'); l.rel = 'icon'; l.type = 'image/png'; l.sizes = '32x32'; l.href = '/assets/icons/favicon-32.png?v=4';
    const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = '/assets/icons/favicon-180.png?v=4';
    document.head.appendChild(l); document.head.appendChild(a);
  }

  function injectFireflies() {
    if (document.getElementById('fireflies') || localPref('mf_hide_fireflies','0') === '1') return;
    const c = document.createElement('canvas'); c.id = 'fireflies';
    document.body.prepend(c);
  }

  function injectPetals() {
    if (document.getElementById('petals')) return;
    const c = document.createElement('canvas'); c.id = 'petals';
    document.body.prepend(c);
    startPetals(c);
  }

  function startPetals(canvas) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('mf-reduce-motion')) return;
    const ctx = canvas.getContext('2d');
    let W, H, petals = [], DPR = 1;
    const COLORS = ['rgba(249,168,212,', 'rgba(251,207,232,', 'rgba(196,181,253,', 'rgba(253,242,248,'];
    function resize() {
      DPR = window.devicePixelRatio || 1; W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function Petal(initial) {
      this.x = Math.random() * W;
      this.y = initial ? Math.random() * H : -20;
      this.size = 2.5 + Math.random() * 4;
      this.vy = 0.22 + Math.random() * 0.42;
      this.vx = (Math.random() - .5) * .35;
      this.rot = Math.random() * Math.PI * 2;
      this.rs = (Math.random() - .5) * .011;
      this.swing = Math.random() * Math.PI * 2;
      this.ss = .008 + Math.random() * .012;
      this.sa = .4 + Math.random() * .8;
      this.a = .15 + Math.random() * .45;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    Petal.prototype.update = function () {
      this.swing += this.ss;
      this.x += this.vx + Math.sin(this.swing) * this.sa;
      this.y += this.vy; this.rot += this.rs;
      if (this.y > H + 30) { this.x = Math.random() * W; this.y = -20; }
    };
    Petal.prototype.draw = function () {
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
      ctx.fillStyle = this.color + this.a + ')';
      ctx.beginPath(); ctx.ellipse(0, 0, this.size, this.size * 1.7, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    };
    function init() {
      petals = [];
      const n = Math.min(55, Math.floor(W / 30));
      for (let i = 0; i < n; i++) petals.push(new Petal(true));
    }
    let raf;
    function animate() {
      ctx.clearRect(0, 0, W, H);
      petals.forEach(p => { p.update(); p.draw(); });
      raf = requestAnimationFrame(animate);
    }
    resize(); init(); animate();
    window.addEventListener('resize', () => { resize(); init(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
      else if (!raf) animate();
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  SITE-WIDE TRANSLATION
  //  A self-contained page translator that walks the DOM, swaps text
  //  in place, and keeps originals so it can revert / re-translate.
  //  Two-tier engine: Google online translation first → on-device fallback.
  //  Shares the localStorage key "mf_tr_lang" with the chat translator.
  // ─────────────────────────────────────────────────────────────
  var MFTranslate = (function () {
    const LANG_NAMES = {
      en: "English", es: "Español", de: "Deutsch", fr: "Français",
      pt: "Português (Brasil)", it: "Italiano", nl: "Nederlands", ja: "日本語",
      ko: "한국어", zh: "中文", ru: "Русский"
    };

    const HAS_DEVICE = (typeof self !== "undefined") && ("Translator" in self) && ("LanguageDetector" in self);
    const HAS_SERVER = /^https?:$/.test(location.protocol);
    const TR_MODE = HAS_SERVER ? "server" : (HAS_DEVICE ? "device" : "none");
    const TR_OK = TR_MODE !== "none";

    function guessLang() {
      const l = (navigator.language || "en").slice(0, 2).toLowerCase();
      return LANG_NAMES[l] ? l : "en";
    }
    let targetLang = "en";
    try { targetLang = localStorage.getItem("mf_tr_lang") || guessLang(); } catch (_) { targetLang = guessLang(); }
    // If the saved language is "en" we don't translate; that's the original.

    // ---- persistent translation cache ----
    // Translations are deterministic for a given (text -> language), so we keep
    // them in localStorage. Repeat visits then translate from cache instantly
    // and only fetch strings we've never seen before.
    const CACHE_KEY = "mf_tr_cache_v2";  // bump the v# to invalidate all cached translations
    const CACHE_MAX = 4000;              // entry ceiling so we never blow the ~5MB quota
    const cache = new Map();             // key `${tgt}||${text}` -> translated string (or null)
    let cacheDirty = false;

    (function loadCache() {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (obj && obj.e) for (const k in obj.e) cache.set(k, obj.e[k]);
      } catch (_) { /* corrupt cache — ignore, it'll be rebuilt */ }
    })();

    let saveTimer = null;
    function persistCache() {
      // Debounced + size-bounded write so we don't thrash localStorage.
      if (saveTimer) return;
      saveTimer = setTimeout(() => {
        saveTimer = null;
        if (!cacheDirty) return;
        cacheDirty = false;
        try {
          let entries = [...cache.entries()];
          if (entries.length > CACHE_MAX) entries = entries.slice(entries.length - CACHE_MAX); // keep newest
          const e = {};
          for (const [k, v] of entries) e[k] = v;
          localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, e }));
        } catch (_) {
          // quota exceeded — drop half and retry once
          try {
            const entries = [...cache.entries()].slice(-Math.floor(CACHE_MAX / 2));
            cache.clear(); for (const [k, v] of entries) cache.set(k, v);
            const e = {}; for (const [k, v] of entries) e[k] = v;
            localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, e }));
          } catch (_) {}
        }
      }, 1200);
    }
    function cacheSet(key, val) { cache.set(key, val); cacheDirty = true; persistCache(); }

    const translatorPool = new Map();
    const originals = new WeakMap(); // textNode -> original nodeValue
    const trDone = new WeakMap();    // textNode -> language it currently displays
    const tracked = new Set();       // text nodes we've touched (for revert)
    let busy = false;
    let observer = null;
    let pageSrcLang = (document.documentElement.lang || "en").slice(0, 2).toLowerCase() || "en";

    // ---- engine ----
    async function getTranslator(src, tgt) {
      const key = src + "->" + tgt;
      if (translatorPool.has(key)) return translatorPool.get(key);
      const p = (async () => {
        try {
          const a = await self.Translator.availability({ sourceLanguage: src, targetLanguage: tgt });
          if (a === "unavailable") return null;
          return await self.Translator.create({ sourceLanguage: src, targetLanguage: tgt });
        } catch (_) { return null; }
      })();
      translatorPool.set(key, p);
      return p;
    }

    function onlineTargetLang(tgt) {
      // The site's Portuguese option is specifically Brazilian Portuguese.
      return tgt === "pt" ? "pt-BR" : tgt;
    }

    async function serverTranslate(text, tgt) {
      const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
        encodeURIComponent(onlineTargetLang(tgt)) + "&dt=t&ie=UTF-8&oe=UTF-8&q=" + encodeURIComponent(text);
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 9000);
        const r = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!r.ok) return null;
        const data = await r.json();
        const out = (data[0] || []).map(s => s[0]).join("");
        const src = String(data[2] || "").toLowerCase().slice(0, 2);
        if (!out) return null;
        return { text: out, src };
      } catch (_) { return null; }
    }

    async function translateOne(text, tgt) {
      const ck = tgt + "||" + text;
      if (cache.has(ck)) return cache.get(ck);
      let out = null;

      // Prefer Google's online engine for quality and use the smaller local
      // browser model only as an offline/failure fallback.
      if (HAS_SERVER) {
        const r = await serverTranslate(text, tgt);
        if (r) out = r.text;
      }
      if (!out && HAS_DEVICE) {
        const t = await getTranslator(pageSrcLang, tgt);
        if (t) { try { out = await t.translate(text); } catch (_) { out = null; } }
      }

      cacheSet(ck, out || null);
      return out || null;
    }

    // server fallback can batch many strings in one request using a separator
    const SEP = "\n\u241F\n"; // unit-separator unlikely to appear in real copy
    async function translateBatchServer(texts, tgt) {
      const joined = texts.join(SEP);
      // Google endpoint handles long q reasonably; keep batches modest (caller chunks).
      const r = await serverTranslate(joined, tgt);
      if (!r) return null;
      const parts = r.text.split(/\s*\u241F\s*/);
      if (parts.length === texts.length) return parts;
      return null; // separator got mangled; caller falls back to per-string
    }

    // ---- DOM walking ----
    const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "KBD", "SAMP"]);
    function isTranslatableNode(node) {
      const v = node.nodeValue;
      if (!v || !v.trim()) return false;
      if (!/[A-Za-zÀ-ÿ]/.test(v)) return false; // skip pure numbers / symbols / emoji
      let el = node.parentElement;
      while (el) {
        if (SKIP_TAGS.has(el.tagName)) return false;
        if (el.getAttribute && el.getAttribute("data-no-translate") !== null) return false;
        if (el.isContentEditable) return false;
        el = el.parentElement;
      }
      return true;
    }

    function collectTextNodes(root) {
      const out = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => isTranslatableNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      });
      let n;
      while ((n = walker.nextNode())) out.push(n);
      return out;
    }

    function snapshotOriginal(node) {
      if (!originals.has(node)) { originals.set(node, node.nodeValue); tracked.add(node); }
    }
    // Mark which language a node currently displays, so we never translate
    // already-translated text a second time (which would stack "[es][es]…").
    function markDone(node, lang) { trDone.set(node, lang); }
    function alreadyDone(node) { return trDone.get(node) === targetLang; }

    async function translateNodes(nodes) {
      if (!nodes.length || targetLang === "en" || !TR_OK) return;
      // Build a unique list of trimmed strings to translate.
      const jobs = [];      // { node, lead, trail, core }
      const need = new Map(); // core -> array of jobs
      for (const node of nodes) {
        if (alreadyDone(node)) continue;              // node already shows the target language
        // Source text = the recorded original if we've touched this node, else its current value.
        const raw = originals.has(node) ? originals.get(node) : node.nodeValue;
        const core = raw.trim();
        if (!core) continue;
        const lead = raw.slice(0, raw.indexOf(core[0]));
        const trail = raw.slice(raw.indexOf(core[0]) + core.length);
        const job = { node, lead, trail, core };
        jobs.push(job);
        if (!need.has(core)) need.set(core, []);
        need.get(core).push(job);
      }
      const uniques = [...need.keys()];

      // Resolve translations for each unique string (cache-aware).
      const uncached = uniques.filter(u => !cache.has(targetLang + "||" + u));
      if (uncached.length) {
        if (TR_MODE === "server") {
          // chunk into batches to keep URLs sane
          const CHUNK = 40;
          for (let i = 0; i < uncached.length; i += CHUNK) {
            const slice = uncached.slice(i, i + CHUNK);
            let res = await translateBatchServer(slice, targetLang);
            if (!res) { // fallback: per-string
              res = [];
              for (const s of slice) res.push(await translateOne(s, targetLang));
            }
            slice.forEach((s, idx) => cacheSet(targetLang + "||" + s, res[idx] || null));
          }
        } else {
          // device mode: translate individually (API is local & fast, runs concurrently-ish)
          await Promise.all(uncached.map(async (s) => {
            const out = await translateOne(s, targetLang);
            cacheSet(targetLang + "||" + s, out || null);
          }));
        }
      }

      // Apply.
      for (const job of jobs) {
        const tr = cache.get(targetLang + "||" + job.core);
        if (tr && tr !== job.core) {
          snapshotOriginal(job.node);
          job.node.nodeValue = job.lead + tr + job.trail;
        }
        markDone(job.node, targetLang);
      }
    }

    function revertAll() {
      for (const node of tracked) {
        const orig = originals.get(node);
        if (orig != null && node.parentNode) node.nodeValue = orig;
        trDone.delete(node);
      }
    }

    // Instant pass: swap in only translations we ALREADY have cached, with no
    // network and no awaiting. On a repeat visit this paints the page in the
    // chosen language immediately; the async translatePage() then mops up any
    // strings that are new since last time.
    function applyCachedSync(root) {
      if (targetLang === "en" || !TR_OK) return 0;
      let hits = 0;
      const nodes = collectTextNodes(root || document.body);
      for (const node of nodes) {
        if (alreadyDone(node)) continue;
        const raw = originals.has(node) ? originals.get(node) : node.nodeValue;
        const core = raw.trim();
        if (!core) continue;
        const tr = cache.get(targetLang + "||" + core);
        if (tr && tr !== core) {
          const lead = raw.slice(0, raw.indexOf(core[0]));
          const trail = raw.slice(raw.indexOf(core[0]) + core.length);
          snapshotOriginal(node);
          node.nodeValue = lead + tr + trail;
          markDone(node, targetLang);
          hits++;
        }
      }
      return hits;
    }

    // ---- public actions ----
    let runToken = 0;
    async function translatePage() {
      if (targetLang === "en" || !TR_OK) return;
      busy = true;
      const myToken = ++runToken;
      document.documentElement.setAttribute("data-mf-translating", "1");
      try {
        const nodes = collectTextNodes(document.body);
        await translateNodes(nodes);
      } catch (_) {}
      if (myToken === runToken) document.documentElement.removeAttribute("data-mf-translating");
      busy = false;
    }

    function startObserver() {
      if (observer) return;
      observer = new MutationObserver((muts) => {
        if (targetLang === "en" || !TR_OK) return;
        const fresh = [];
        for (const m of muts) {
          m.addedNodes && m.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              if (isTranslatableNode(node)) fresh.push(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              collectTextNodes(node).forEach(n => fresh.push(n));
            }
          });
        }
        if (fresh.length) {
          // Skip nodes already showing the target language.
          const todo = fresh.filter(n => !alreadyDone(n));
          if (todo.length) {
            // Instantly swap any cached strings, then async-fetch the rest.
            for (const n of todo) {
              const raw = originals.has(n) ? originals.get(n) : n.nodeValue;
              const core = raw.trim();
              if (!core) continue;
              const tr = cache.get(targetLang + "||" + core);
              if (tr && tr !== core) {
                const lead = raw.slice(0, raw.indexOf(core[0]));
                const trail = raw.slice(raw.indexOf(core[0]) + core.length);
                snapshotOriginal(n);
                n.nodeValue = lead + tr + trail;
                markDone(n, targetLang);
              }
            }
            translateNodes(todo).catch(() => {});
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    async function setLang(lang) {
      if (!LANG_NAMES[lang]) lang = "en";
      if (lang === targetLang) return;
      const prev = targetLang;
      targetLang = lang;
      try {
        localStorage.setItem("mf_tr_lang", lang);
        // The header language picker also controls chat translation. Persist
        // that state instead of relying only on the mf-lang-change event: on
        // some mobile browsers (notably Opera Mobile) chat.js is loaded during
        // an idle callback and can miss the event entirely.
        localStorage.setItem("mf_tr_on", lang === "en" ? "0" : "1");
      } catch (_) {}
      // keep chat translator in sync even when it loaded after the picker
      if (lang === "en") {
        revertAll();
        document.documentElement.lang = pageSrcLang;
      } else {
        document.documentElement.lang = lang;
        await translatePage();
      }
      // notify any listeners (e.g. chat) that language changed
      try { window.dispatchEvent(new CustomEvent("mf-lang-change", { detail: { lang, prev } })); } catch (_) {}
    }

    function current() { return targetLang; }
    function names() { return LANG_NAMES; }
    function available() { return TR_OK; }
    function mode() { return TR_MODE; }

    function init() {
      if (!TR_OK) return;
      startObserver();
      if (targetLang !== "en") {
        document.documentElement.lang = targetLang;
        // Instant: paint anything we already have cached, synchronously.
        applyCachedSync(document.body);
        // Then fill in anything new (or everything, on a first visit) off the main thread.
        (window.requestIdleCallback || window.requestAnimationFrame || setTimeout)(() => translatePage());
      }
    }

    function clearCache() {
      cache.clear();
      try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
    }

    return { init, setLang, current, names, available, mode, translatePage, revertAll, clearCache };
  })();
  window.MFTranslate = MFTranslate;

  function buildLangPicker() {
    if (!MFTranslate.available()) return "";
    const names = MFTranslate.names();
    const cur = MFTranslate.current();
    const opts = Object.keys(names)
      .map(k => `<option value="${k}"${k === cur ? " selected" : ""}>${names[k]}</option>`)
      .join("");
    return `<label class="nav-lang" data-no-translate title="Translate this site">
        <span class="nav-lang-ic" aria-hidden="true">🌐</span>
        <select id="navLangSelect" aria-label="Site language">${opts}</select>
      </label>`;
  }

  function wireLangPicker() {
    const sel = document.getElementById("navLangSelect");
    if (!sel) return;
    sel.addEventListener("change", () => { MFTranslate.setLang(sel.value); });
  }

  function buildNav() {
    // Normalize legacy data-nav values to the canonical six groups
    // Canonical sections. Aliases map section-specific data-nav values.
    const ALIAS = {
      'together-room': 'together',
      'watch': 'together',
      'watch-together': 'together',
      'server': 'together',
      'sakari': 'stories',
      'mods': 'projects',
      'bots': 'projects',
    };
    const raw = document.body.dataset.nav || '';
    const key = ALIAS[raw] || raw;
    const links = [
      { href: '/',              label: 'Home',     key: 'home'     },
      { href: '/together.html', label: 'Together', key: 'together' },
      { href: '/sakari.html',   label: 'Stories',  key: 'stories'  },
      { href: '/projects.html', label: 'Projects', key: 'projects' },
      { href: '/radio/',        label: 'Radio',    key: 'radio'    },
      { href: '/contact.html',  label: 'Contact',  key: 'contact'  },
    ];
    const linksHtml = links.map(l =>
      `<a href="${l.href}"${l.key === key ? ' class="nav-active"' : ''}>${l.label}</a>`
    ).join('');
    return `<nav class="site-nav">
        <div class="nav-inner">
          <a href="/" class="nav-brand" data-no-translate>
            <strong>Mayflower Studios</strong>
          </a>
          <button class="nav-mob-btn" id="navToggle" aria-label="Menu">☰</button>
          <div class="nav-links" id="navLinks">
            ${linksHtml}
            ${buildLangPicker()}
            <button type="button" class="mf-notify-button" id="mfNotifyButton" aria-label="Notifications" aria-expanded="false" hidden data-no-translate>
              <span aria-hidden="true">🔔</span><span class="mf-notify-badge" id="mfNotifyBadge" hidden></span>
            </button>
            <a href="/account.html" class="nav-account" id="navAccount" data-nav="account">Sign in</a>
          </div>
        </div>
      </nav>`;
  }

  function buildFooter() {
    return `<footer class="site-footer">
        <span class="footer-brand" data-no-translate>Mayflower Studios</span>
        <div class="footer-links">
          <a href="/together.html">Together</a>
          <a href="/sakari.html">Stories</a>
          <a href="/projects.html">Projects</a>
          <a href="/contact.html">Contact</a>
          <a href="https://ko-fi.com/mayflowerstudiosteam" target="_blank" rel="noopener">Support ↗</a>
          <a href="/settings.html">Settings</a>
          <a href="/privacy.html">Privacy</a>
          <a href="/tos.html">Terms</a>
          <a href="/copyright.html">Copyright &amp; IP</a>
        </div>
        <p class="footer-copy">© <span class="footer-year"></span> Mayflower Studios. All rights reserved. — made with <span class="footer-flower" role="button" tabindex="-1" aria-label="🌸" title="🌸" data-no-translate style="cursor:default;display:inline-block;user-select:none;">🌸</span> and fireflies</p>
      </footer>`;
  }

  /* Supports both new (#site-nav) and legacy (#shared-nav) selectors */
  function injectNav() {
    const html = buildNav();
    ['#site-nav', '#shared-nav'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    });
    const toggle = document.getElementById('navToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.getElementById('navLinks').classList.toggle('open');
      });
    }
    injectSkipLink();
    wireLangPicker();
  }

  // A keyboard or screen-reader user otherwise has to tab through the whole nav
  // on every page. Injected here rather than added to each page's markup so it
  // covers all of them, including any added later.
  function injectSkipLink() {
    if (document.querySelector('.mf-skip')) return;   // page supplied its own
    const nav = document.querySelector('#site-nav, #shared-nav');
    if (!nav) return;
    // Find where the page's real content starts: a <main>, else the first
    // meaningful sibling after the nav.
    let target = document.querySelector('main');
    if (!target) {
      let n = nav.nextElementSibling;
      while (n && (n.id === 'site-footer' || n.id === 'shared-footer' || n.tagName === 'SCRIPT')) n = n.nextElementSibling;
      target = n;
    }
    if (!target) return;
    if (!target.id) target.id = 'mf-main';
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    const a = document.createElement('a');
    a.className = 'mf-skip';
    a.href = '#' + target.id;
    a.textContent = 'Skip to content';
    nav.parentNode.insertBefore(a, nav);
  }

  function injectFooter() {
    const html = buildFooter();
    ['#site-footer', '#shared-footer'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    });
    document.querySelectorAll('.footer-year').forEach(el => {
      el.textContent = new Date().getFullYear();
    });
  }

  function initReveal() {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.07 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  // ───────────────────────────────────────────────────────────────
  //  🐝 Easter egg — a hidden path to /bee.html
  //  Two cute ways in, both hard to find by accident:
  //   1) Type the word "bee" anywhere on the site.
  //   2) Click the little footer flower (🌸) five times — petals flutter,
  //      then a bee drifts out and carries you there.
  //  When triggered, a bee buzzes across the screen and then flies to the
  //  page. Respects prefers-reduced-motion (skips the animation, still works).
  // ───────────────────────────────────────────────────────────────
  function initBeeEgg() {
    if (window._beeEggReady) return;
    window._beeEggReady = true;
    var BEE_URL = '/bee.html';
    var triggered = false;

    function flyToBee() {
      if (triggered) return;
      triggered = true;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { window.location.href = BEE_URL; return; }

      var bee = document.createElement('div');
      bee.textContent = '🐝';
      bee.setAttribute('aria-hidden', 'true');
      bee.style.cssText =
        'position:fixed;left:-60px;top:60%;font-size:34px;z-index:99999;' +
        'pointer-events:none;will-change:transform,opacity;' +
        'filter:drop-shadow(0 2px 6px rgba(246,197,71,.5));';
      document.body.appendChild(bee);

      var W = window.innerWidth, H = window.innerHeight;
      var t0 = performance.now();
      var dur = 4200;
      function frame(now) {
        var p = Math.min(1, (now - t0) / dur);
        // ease across the screen with a gentle sine bob, like a real bee
        var ease = 1 - Math.pow(1 - p, 2);
        var x = -60 + ease * (W + 120);
        var y = (H * 0.6) + Math.sin(p * Math.PI * 3) * 42 - ease * (H * 0.18);
        var flip = Math.sin(p * Math.PI * 3) > 0 ? 1 : -1;
        bee.style.transform = 'translate(' + x + 'px,' + (y - H * 0.6) + 'px) scaleX(' + flip + ')';
        if (p >= 1) { window.location.href = BEE_URL; return; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    window._flyToBee = flyToBee;

    // 1) Type "bee" anywhere (ignore while typing in a field).
    var buf = '';
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key && e.key.length === 1) {
        buf = (buf + e.key.toLowerCase()).slice(-3);
        if (buf === 'bee') { buf = ''; flyToBee(); }
      }
    });

    // 2) The footer flower: 5 clicks within a short window.
    var clicks = 0, clickTimer = null;
    document.addEventListener('click', function (e) {
      var flower = e.target.closest && e.target.closest('.footer-flower');
      if (!flower) return;
      e.preventDefault();
      clicks++;
      // little wiggle each click
      flower.style.display = 'inline-block';
      flower.style.transition = 'transform .15s var(--ease)';
      flower.style.transform = 'scale(1.3) rotate(' + (clicks * 14) + 'deg)';
      setTimeout(function () { flower.style.transform = ''; }, 160);
      clearTimeout(clickTimer);
      clickTimer = setTimeout(function () { clicks = 0; }, 1400);
      if (clicks >= 5) { clicks = 0; spawnPetals(flower); setTimeout(flyToBee, 500); }
    });

    function spawnPetals(origin) {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return;
      var r = origin.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (var i = 0; i < 8; i++) {
        (function (i) {
          var pet = document.createElement('div');
          pet.textContent = '🌸';
          pet.setAttribute('aria-hidden', 'true');
          pet.style.cssText =
            'position:fixed;left:' + cx + 'px;top:' + cy + 'px;font-size:16px;' +
            'z-index:99998;pointer-events:none;will-change:transform,opacity;';
          document.body.appendChild(pet);
          var ang = (Math.PI * 2 * i) / 8 + Math.random();
          var dist = 50 + Math.random() * 50;
          var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist + 40;
          var st = performance.now(), d = 900 + Math.random() * 400;
          (function fall(now) {
            var p = Math.min(1, (now - st) / d);
            pet.style.transform = 'translate(' + (dx * p) + 'px,' + (dy * p) + 'px) rotate(' + (p * 320) + 'deg)';
            pet.style.opacity = String(1 - p);
            if (p >= 1) { pet.remove(); return; }
            requestAnimationFrame(fall);
          })(st);
        })(i);
      }
    }
  }

  function loadFireflies() {
    // _firefliesLoaded belongs to fireflies.js and means "I have started".
    // Setting it here used to raise it *before* the script was fetched, so the
    // script then saw its own guard already true and did nothing at all —
    // which is why the fireflies never appeared while the petals did. Track
    // the request separately and leave that flag to fireflies.js.
    if (window._firefliesRequested || window._firefliesLoaded) return;
    if (localPref('mf_hide_fireflies', '0') === '1') return;
    window._firefliesRequested = true;
    const s = document.createElement('script');
    s.src = '/fireflies.js?v=' + MF_ASSET_VER;
    document.body.appendChild(s);
  }

  // Bump this whenever auth.js / chat.js / profile-view.js change, so browsers
  // and the GitHub Pages CDN fetch the new version instead of a cached copy.
  var MF_ASSET_VER = '63';

  // ─────────────────────────────────────────────────────────────
  //  Chat + moderation config, shared by chat.js and admin-moderation.js.
  //  Both used to keep their own copies of these, which meant adding one GIF
  //  filter level or one chat setting had to be done twice and stayed correct
  //  only by luck. This lives in shared.js because shared.js is a blocking
  //  script on every page, so it has always run before chat.js (which it loads
  //  itself) and before admin-moderation.js.
  // ─────────────────────────────────────────────────────────────
  window.MFChatConfig = Object.freeze({
    // Klipy's content filter, strongest to weakest. The owner picks one on the
    // admin page; it is stored at chatSettings/global/gifFilter.
    gifFilters: Object.freeze(['high', 'medium', 'low', 'off']),
    gifFilterDefault: 'medium',
    // Defaults for chatSettings/global, used until the real values arrive.
    settingDefaults: Object.freeze({
      locked: false, slowSeconds: 0, adminsCanUnlock: false, gifFilter: 'medium'
    })
  });

  function loadScript(src, attrs) {
    if (document.querySelector(`script[data-mf-src="${src}"]`)) return;
    const s = document.createElement('script');
    s.src = src + (src.indexOf('?') === -1 ? '?v=' : '&v=') + MF_ASSET_VER;
    s.setAttribute('data-mf-src', src);
    if (attrs) Object.keys(attrs).forEach(k => s.setAttribute(k, attrs[k]));
    document.body.appendChild(s);
  }

  // Run a job when the browser is next idle, so these scripts stop competing
  // with the page's own first paint. Falls back to a short timeout where
  // requestIdleCallback isn't available (Safari until fairly recently).
  function whenIdle(fn) {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 2000 });
    else setTimeout(fn, 200);
  }

  function loadAuthAndChat() {
    // auth.js defines window.MFAuth (universal identity). The nav's account
    // link and the notification bell both wait on it, so it stays eager.
    if (!window.MFAuth) loadScript('/auth.js', { 'data-mf-auth': '1' });
    // notification-center.js owns the bell, unread badge, dropdown, and full
    // page — part of the nav, so it is eager too.
    loadScript('/notification-center.js', { 'data-mf-notifications': '1' });

    // rooms.js defines window.MFRooms (unified activity room registry). Only
    // the room pages touch it, so it is opt-in via <body data-rooms="1">
    // rather than 16KB parsed on every page that will never call it.
    if (document.body.dataset.rooms === '1') loadScript('/rooms.js', { 'data-mf-rooms': '1' });

    // The rest mount their own UI (chat bubble, announcement banners) and are
    // never needed for first paint, so they wait for an idle moment.
    whenIdle(function () {
      // profile-view.js defines window.MFProfile (public profile overlay).
      loadScript('/profile-view.js', { 'data-mf-profile': '1' });
      // chat.js injects the universal floating chat once MFAuth is ready.
      loadScript('/chat.js', { 'data-mf-chat': '1' });
      // announcement-center.js renders scheduled site announcements for the right audience.
      loadScript('/announcement-center.js', { 'data-mf-announcements': '1' });
    });
  }

  function initAccountNav() {
    function whenAuth(cb) {
      if (window.MFAuth) return cb();
      let n = 0;
      const iv = setInterval(() => {
        if (window.MFAuth) { clearInterval(iv); cb(); }
        else if (++n > 80) clearInterval(iv);
      }, 80);
    }
    whenAuth(() => {
      if (!MFAuth.isConfigured()) return;
      MFAuth.onChange((user) => {
        const el = document.getElementById('navAccount');
        if (!el) return;
        if (user) {
          const name = MFAuth.name() || 'Account';
          el.textContent = '👤 ' + name;
          el.classList.add('nav-signed-in');
        } else {
          el.textContent = 'Sign in';
          el.classList.remove('nav-signed-in');
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectFavicon();
    injectBg();
    injectFireflies();
    injectPetals();
    injectNav();
    injectFooter();
    initReveal();
    loadFireflies();
    loadAuthAndChat();
    initAccountNav();
    MFTranslate.init();
    initBeeEgg();
  });

})();