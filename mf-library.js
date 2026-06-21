/* ============================================================================
   mf-library.js — Plex/Jellyfin-style library picker for Watch Together.

   Talks to your Mayflower Media server (server.js on your gaming PC), renders
   a poster grid in the Enchanted Night Garden aesthetic, and feeds chosen
   titles into the existing synced player + queue via window.MFWatch.

   ---- INSTALL (two small edits to watch-together.html) ----------------------
   1) Just before </body>, add:
        <script src="mf-library.js?v=1"></script>

   2) Expose three existing internal fns so the picker can drive playback.
      Inside the big <script> (anywhere after startSource / addToQueue /
      parseSource are defined — e.g. right after `loadBtn.addEventListener`),
      add:

        window.MFWatch = {
          // play a direct video URL now, synced to the room
          playUrl(url, title) {
            startSource({ kind: "file", src: url, title: title || null });
            if (title) { currentTitle = title; }
            toast("Loaded — everyone will catch up ✨");
          },
          // add a direct video URL to the shared queue
          queueUrl(url, title) {
            if (!FIREBASE_READY || !queueRef) { toast("Queue needs Firebase first"); return; }
            if (isInQueue("file", url)) { toast("Already in the queue"); return; }
            safeWrite(() => push(queueRef, { kind: "file", src: url, title: title || shortName(url), t: Date.now(), by: myName }), "Couldn't add to queue");
            toast("Added to queue 🎞️");
          },
        };

   That's it. A 🎬 Library button appears next to Upload.
   ----------------------------------------------------------------------------
*/

(function () {
  'use strict';

  // ---- persisted connection (server URL + token) ---------------------------
  // We can't use localStorage inside some sandboxes, but a normal page is fine.
  const LS_KEY = 'mf_media_server_v1';
  function loadConn() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
    catch (_) { return null; }
  }
  function saveConn(c) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch (_) {}
  }
  let conn = loadConn(); // { base, token }

  // ---- url builders --------------------------------------------------------
  function api(pathAndQuery) {
    const sep = pathAndQuery.includes('?') ? '&' : '?';
    return `${conn.base}${pathAndQuery}${sep}token=${encodeURIComponent(conn.token)}`;
  }
  function streamUrl(id) { return api(`/stream?id=${encodeURIComponent(id)}`); }
  function posterUrl(id) { return api(`/api/poster?id=${encodeURIComponent(id)}`); }

  // ---- styles (scoped under #mfLib) ---------------------------------------
  const css = `
  #mfLibBtn{}
  #mfLib{ position:fixed; inset:0; z-index:9999; display:none; }
  #mfLib.open{ display:block; }
  #mfLib .mfl-scrim{ position:absolute; inset:0; background:rgba(6,9,18,.72);
    backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
  #mfLib .mfl-sheet{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
    width:min(1100px,94vw); height:min(86vh,900px); display:flex; flex-direction:column;
    background:linear-gradient(180deg, rgba(17,24,39,.96), rgba(11,17,32,.98));
    border:1px solid var(--border-2,rgba(249,168,212,.2)); border-radius:var(--r-lg,22px);
    box-shadow:0 30px 90px rgba(0,0,0,.6), 0 0 0 1px rgba(196,181,253,.06) inset;
    overflow:hidden; }
  #mfLib .mfl-head{ display:flex; align-items:center; gap:14px; padding:18px 22px;
    border-bottom:1px solid var(--border,rgba(249,168,212,.1)); }
  #mfLib .mfl-title{ font-family:var(--font-d,'Cormorant Garamond',serif); font-size:26px;
    color:var(--text,#faf5ff); display:flex; align-items:center; gap:10px; }
  #mfLib .mfl-title small{ font-family:var(--font-b); font-size:12px; color:var(--text-3,rgba(250,245,255,.38));
    letter-spacing:.04em; text-transform:uppercase; }
  #mfLib .mfl-search{ flex:1 1 auto; }
  #mfLib .mfl-search input{ width:100%; padding:10px 14px; border-radius:var(--r-sm,10px);
    background:var(--glass-2,rgba(255,255,255,.04)); border:1px solid var(--border-2,rgba(249,168,212,.2));
    color:var(--text,#faf5ff); font-family:var(--font-b); font-size:14px; outline:none; }
  #mfLib .mfl-search input::placeholder{ color:var(--text-3,rgba(250,245,255,.38)); }
  #mfLib .mfl-x{ cursor:pointer; border:none; background:transparent; color:var(--text-2);
    font-size:22px; line-height:1; padding:6px 10px; border-radius:10px; }
  #mfLib .mfl-x:hover{ background:var(--glass-2); color:var(--text); }
  #mfLib .mfl-tabs{ display:flex; gap:6px; padding:12px 22px 0; }
  #mfLib .mfl-tab{ cursor:pointer; border:none; background:transparent; color:var(--text-2);
    font-family:var(--font-b); font-size:13px; padding:7px 14px; border-radius:999px; }
  #mfLib .mfl-tab.on{ background:linear-gradient(135deg,var(--rose-deep,#ec4899),var(--violet-deep,#8b5cf6));
    color:#fff; }
  #mfLib .mfl-body{ flex:1 1 auto; overflow-y:auto; padding:18px 22px 26px; }
  #mfLib .mfl-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:18px; }
  #mfLib .mfl-card{ cursor:pointer; border-radius:var(--r-md,16px); overflow:hidden;
    background:var(--glass-2,rgba(255,255,255,.04)); border:1px solid var(--border,rgba(249,168,212,.1));
    transition:transform .18s var(--ease,ease), border-color .18s, box-shadow .18s; position:relative; }
  #mfLib .mfl-card:hover{ transform:translateY(-4px); border-color:var(--border-2,rgba(249,168,212,.2));
    box-shadow:0 14px 34px rgba(0,0,0,.45); }
  #mfLib .mfl-poster{ aspect-ratio:2/3; background:linear-gradient(160deg,#1b2540,#0d1322);
    display:flex; align-items:center; justify-content:center; position:relative; }
  #mfLib .mfl-poster img{ width:100%; height:100%; object-fit:cover; }
  #mfLib .mfl-poster .mfl-ph{ font-family:var(--font-d); font-size:15px; color:var(--text-3);
    padding:14px; text-align:center; line-height:1.3; }
  #mfLib .mfl-badge{ position:absolute; top:8px; right:8px; font-size:10px; font-family:var(--font-m,monospace);
    padding:3px 7px; border-radius:999px; background:rgba(6,9,18,.7); color:var(--gold,#fde68a);
    border:1px solid rgba(253,230,138,.25); letter-spacing:.03em; }
  #mfLib .mfl-meta{ padding:10px 12px 12px; }
  #mfLib .mfl-name{ font-size:13.5px; color:var(--text); line-height:1.3;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  #mfLib .mfl-sub{ font-size:11px; color:var(--text-3); margin-top:3px; }
  #mfLib .mfl-actions{ position:absolute; inset:0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:10px; opacity:0;
    background:linear-gradient(180deg,rgba(6,9,18,.2),rgba(6,9,18,.78)); transition:opacity .18s; }
  #mfLib .mfl-card:hover .mfl-actions{ opacity:1; }
  #mfLib .mfl-act{ border:none; cursor:pointer; font-family:var(--font-b); font-size:13px;
    padding:9px 16px; border-radius:999px; color:#fff; min-width:120px; }
  #mfLib .mfl-act.play{ background:linear-gradient(135deg,var(--rose-deep,#ec4899),var(--violet-deep,#8b5cf6)); }
  #mfLib .mfl-act.queue{ background:var(--glass,rgba(11,17,32,.55)); border:1px solid var(--border-2);
    color:var(--text); }
  #mfLib .mfl-empty{ text-align:center; color:var(--text-3); font-family:var(--font-d);
    font-size:20px; padding:60px 20px; }
  /* connection setup card */
  #mfLib .mfl-setup{ max-width:480px; margin:8% auto 0; text-align:center; }
  #mfLib .mfl-setup h3{ font-family:var(--font-d); font-size:28px; color:var(--text); margin-bottom:6px; }
  #mfLib .mfl-setup p{ color:var(--text-2); font-size:14px; margin-bottom:18px; line-height:1.6; }
  #mfLib .mfl-setup input{ width:100%; padding:12px 14px; margin-bottom:10px; border-radius:var(--r-sm);
    background:var(--glass-2); border:1px solid var(--border-2); color:var(--text); font-family:var(--font-b);
    font-size:14px; outline:none; }
  #mfLib .mfl-setup .mfl-connect{ width:100%; padding:12px; border:none; cursor:pointer; border-radius:var(--r-sm);
    background:linear-gradient(135deg,var(--rose-deep),var(--violet-deep)); color:#fff;
    font-family:var(--font-b); font-size:15px; }
  #mfLib .mfl-status{ font-size:12px; margin-top:12px; min-height:16px; }
  #mfLib .mfl-status.ok{ color:var(--emerald,#6ee7b7); }
  #mfLib .mfl-status.err{ color:#fca5a5; }
  #mfLib .mfl-forget{ margin-left:auto; font-size:11px; color:var(--text-3); cursor:pointer;
    background:none; border:none; }
  #mfLib .mfl-forget:hover{ color:var(--text-2); text-decoration:underline; }
  `;

  function injectCSS() {
    if (document.getElementById('mfLibCSS')) return;
    const s = document.createElement('style');
    s.id = 'mfLibCSS'; s.textContent = css;
    document.head.appendChild(s);
  }

  // ---- DOM shell -----------------------------------------------------------
  let root, body, searchInput, tabsEl;
  let allItems = [];
  let activeTab = 'all';
  let query = '';

  function buildShell() {
    root = document.createElement('div');
    root.id = 'mfLib';
    root.innerHTML = `
      <div class="mfl-scrim" data-close></div>
      <div class="mfl-sheet">
        <div class="mfl-head">
          <div class="mfl-title">🎬 Library <small>Mayflower Media</small></div>
          <div class="mfl-search"><input type="text" placeholder="Search your library…" /></div>
          <button class="mfl-forget" title="Disconnect this server">change server</button>
          <button class="mfl-x" data-close title="Close">✕</button>
        </div>
        <div class="mfl-tabs"></div>
        <div class="mfl-body"></div>
      </div>`;
    document.body.appendChild(root);
    body = root.querySelector('.mfl-body');
    searchInput = root.querySelector('.mfl-search input');
    tabsEl = root.querySelector('.mfl-tabs');

    root.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', close));
    root.querySelector('.mfl-forget').addEventListener('click', () => {
      conn = null; saveConn(null); renderSetup();
    });
    searchInput.addEventListener('input', () => { query = searchInput.value.toLowerCase(); render(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('open')) close();
    });
  }

  // ---- setup (connect) view ------------------------------------------------
  function renderSetup(prefillErr) {
    tabsEl.style.display = 'none';
    searchInput.parentElement.style.visibility = 'hidden';
    root.querySelector('.mfl-forget').style.visibility = 'hidden';
    body.innerHTML = `
      <div class="mfl-setup">
        <h3>Connect your media server</h3>
        <p>Open <strong>Mayflower Media</strong> on the host PC, then paste the address and token below.
           For the relay (works from anywhere) use your media subdomain ending in <code>/m</code>.
           On the same network you can use <code>http://&lt;pc-ip&gt;:8722</code> instead.</p>
        <input id="mflBase" type="text" placeholder="https://media.mayflowerstudios.net/m" />
        <input id="mflTok" type="password" placeholder="your token (from the app)" />
        <button class="mfl-connect">Connect</button>
        <div class="mfl-status ${prefillErr ? 'err' : ''}">${prefillErr || ''}</div>
      </div>`;
    const baseI = body.querySelector('#mflBase');
    const tokI = body.querySelector('#mflTok');
    const statusEl = body.querySelector('.mfl-status');
    if (conn) { baseI.value = conn.base; tokI.value = conn.token; }
    body.querySelector('.mfl-connect').addEventListener('click', async () => {
      let base = baseI.value.trim().replace(/\/+$/, '');
      const token = tokI.value.trim();
      if (!/^https?:\/\//.test(base)) base = 'http://' + base;
      if (!base || !token) { statusEl.className = 'mfl-status err'; statusEl.textContent = 'Need both a server address and a token.'; return; }
      statusEl.className = 'mfl-status'; statusEl.textContent = 'Connecting…';
      try {
        const ping = await fetch(base + '/ping').then(r => r.json());
        if (!ping || !ping.ok) throw new Error('not a Mayflower Media server');
        if (ping.hostOnline === false) throw new Error('relay is up but the PC app is offline — open Mayflower Media on the host PC');
        // verify token via a tiny library call
        const r = await fetch(`${base}/api/library?token=${encodeURIComponent(token)}`);
        if (r.status === 401) throw new Error('token rejected');
        if (r.status === 503) throw new Error('host PC offline — open Mayflower Media on it');
        if (!r.ok) throw new Error('server error ' + r.status);
        conn = { base, token }; saveConn(conn);
        statusEl.className = 'mfl-status ok'; statusEl.textContent = 'Connected ✨';
        await loadLibrary();
      } catch (err) {
        statusEl.className = 'mfl-status err';
        statusEl.textContent = 'Could not connect: ' + (err.message || err) +
          '. Check the address, token, and that the server is running.';
      }
    });
  }

  // ---- library load + render ----------------------------------------------
  async function loadLibrary(refresh) {
    body.innerHTML = `<div class="mfl-empty">Gathering your library…</div>`;
    try {
      const r = await fetch(api('/api/library' + (refresh ? '?refresh=1' : '')));
      if (r.status === 401) { conn = null; saveConn(null); return renderSetup('Token rejected — reconnect.'); }
      const data = await r.json();
      allItems = data.items || [];
      tabsEl.style.display = 'flex';
      searchInput.parentElement.style.visibility = 'visible';
      root.querySelector('.mfl-forget').style.visibility = 'visible';
      buildTabs();
      render();
    } catch (err) {
      body.innerHTML = `<div class="mfl-empty">Lost the server. ${err.message || ''}</div>`;
    }
  }

  function buildTabs() {
    const hasMovies = allItems.some(i => i.kind === 'movie');
    const hasTV = allItems.some(i => i.kind === 'episode');
    const tabs = [['all', 'All']];
    if (hasMovies) tabs.push(['movie', 'Movies']);
    if (hasTV) tabs.push(['episode', 'TV']);
    tabsEl.innerHTML = tabs.map(([k, label]) =>
      `<button class="mfl-tab ${k === activeTab ? 'on' : ''}" data-tab="${k}">${label}</button>`).join('');
    tabsEl.querySelectorAll('.mfl-tab').forEach(b =>
      b.addEventListener('click', () => { activeTab = b.dataset.tab; buildTabs(); render(); }));
  }

  function visibleItems() {
    return allItems.filter(i => {
      if (activeTab !== 'all' && i.kind !== activeTab) return false;
      if (query && !(`${i.title} ${i.name} ${i.show || ''}`.toLowerCase().includes(query))) return false;
      return true;
    });
  }

  function fmtSize(b) {
    if (!b) return '';
    const gb = b / 1e9; if (gb >= 1) return gb.toFixed(1) + ' GB';
    return Math.round(b / 1e6) + ' MB';
  }

  function render() {
    const items = visibleItems();
    if (!items.length) {
      body.innerHTML = `<div class="mfl-empty">${query ? 'Nothing matches that.' : 'No videos found in your folders.'}</div>`;
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'mfl-grid';
    for (const it of items) {
      const card = document.createElement('div');
      card.className = 'mfl-card';
      const badge = it.direct ? '' : `<div class="mfl-badge">↻ transcode</div>`;
      card.innerHTML = `
        <div class="mfl-poster">
          <div class="mfl-ph">${escapeHTML(it.title)}</div>
          ${badge}
          <div class="mfl-actions">
            <button class="mfl-act play">▶ Play now</button>
            <button class="mfl-act queue">＋ Add to queue</button>
          </div>
        </div>
        <div class="mfl-meta">
          <div class="mfl-name">${escapeHTML(it.title)}</div>
          <div class="mfl-sub">${it.folder ? escapeHTML(it.folder) + ' · ' : ''}${fmtSize(it.size)}</div>
        </div>`;
      // lazy poster
      const posterBox = card.querySelector('.mfl-poster');
      const img = new Image();
      img.onload = () => {
        const ph = posterBox.querySelector('.mfl-ph');
        if (ph) ph.remove();
        img.style.position = 'absolute'; img.style.inset = '0';
        posterBox.insertBefore(img, posterBox.firstChild);
      };
      img.src = posterUrl(it.id);

      card.querySelector('.play').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!window.MFWatch) return alert('Player bridge missing — add the MFWatch snippet to watch-together.html');
        window.MFWatch.playUrl(streamUrl(it.id), it.title);
        close();
      });
      card.querySelector('.queue').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!window.MFWatch) return;
        window.MFWatch.queueUrl(streamUrl(it.id), it.title);
        const b = e.target; const old = b.textContent;
        b.textContent = '✓ Queued'; setTimeout(() => b.textContent = old, 1200);
      });
      grid.appendChild(card);
    }
    body.innerHTML = '';
    body.appendChild(grid);
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- open / close --------------------------------------------------------
  function open() {
    root.classList.add('open');
    if (!conn) { renderSetup(); }
    else { loadLibrary(); }
  }
  function close() { root.classList.remove('open'); }

  // ---- button wiring -------------------------------------------------------
  function addButton() {
    // Put a Library button next to the existing Upload button if we can find it,
    // else float one bottom-right.
    const uploadBtn = document.getElementById('uploadBtn');
    const btn = document.createElement('button');
    btn.id = 'mfLibBtn';
    btn.className = uploadBtn ? uploadBtn.className : 'btn';
    btn.textContent = '🎬 Library';
    btn.title = 'Browse your self-hosted movies & shows';
    btn.addEventListener('click', open);
    if (uploadBtn && uploadBtn.parentElement) {
      uploadBtn.parentElement.insertBefore(btn, uploadBtn.nextSibling);
    } else {
      btn.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9000;';
      document.body.appendChild(btn);
    }
  }

  function init() {
    injectCSS();
    buildShell();
    addButton();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
