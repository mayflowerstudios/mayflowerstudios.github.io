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
  const LS_BASE = 'mf_media_base_v1';   // remembered server address (kept even when locked)
  function loadConn() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
    catch (_) { return null; }
  }
  function saveConn(c) {
    try {
      if (c) {
        localStorage.setItem(LS_KEY, JSON.stringify(c));
        localStorage.setItem(LS_BASE, c.base);   // keep the address around
      } else {
        // "lock" / token rejected: forget the token but REMEMBER the address
        localStorage.removeItem(LS_KEY);
      }
    } catch (_) {}
  }
  function loadBase() {
    try { return localStorage.getItem(LS_BASE) || ''; } catch (_) { return ''; }
  }
  function forgetServer() {
    try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_BASE); } catch (_) {}
  }
  let conn = loadConn(); // { base, token }

  // ---- url builders --------------------------------------------------------
  function api(pathAndQuery) {
    const sep = pathAndQuery.includes('?') ? '&' : '?';
    return `${conn.base}${pathAndQuery}${sep}token=${encodeURIComponent(conn.token)}`;
  }
  function streamUrl(id) { return api(`/stream?id=${encodeURIComponent(id)}`); }
  // Transcode-needed files play via HLS (.m3u8) for reliable relay streaming;
  // direct-play files use the plain /stream endpoint with range support.
  function playUrlFor(item) {
    return item.direct
      ? api(`/stream?id=${encodeURIComponent(item.id)}`)
      : api(`/hls/index.m3u8?id=${encodeURIComponent(item.id)}`);
  }
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
  #mfLib .mfl-changeaddr{ display:block; margin:14px auto 0; font-size:11px; color:var(--text-3);
    background:none; border:none; cursor:pointer; }
  #mfLib .mfl-changeaddr:hover{ color:var(--text-2); text-decoration:underline; }
  #mfLib .mfl-showhead{ display:flex; align-items:center; gap:14px; margin-bottom:16px; }
  #mfLib .mfl-back{ background:var(--glass-2,rgba(255,255,255,.04)); border:1px solid var(--border-2,rgba(249,168,212,.2));
    color:var(--text,#faf5ff); border-radius:9px; padding:7px 14px; cursor:pointer; font-family:var(--font-b); font-size:13px; }
  #mfLib .mfl-back:hover{ background:#24ffffff; }
  #mfLib .mfl-showtitle{ font-family:var(--font-d,'Cormorant Garamond',serif); font-size:22px; color:var(--text,#faf5ff); }
  #mfLib .mfl-playall{ margin-left:auto; min-width:auto; }
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
          <button class="mfl-forget" title="Lock the library (keeps the server address)">lock</button>
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
      conn = null; saveConn(null); renderSetup();   // lock: keep address, drop token
    });
    searchInput.addEventListener('input', () => { query = searchInput.value.toLowerCase(); drillShow = null; render(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('open')) close();
    });
  }

  // ---- setup (connect) view ------------------------------------------------
  function renderSetup(prefillErr) {
    tabsEl.style.display = 'none';
    searchInput.parentElement.style.visibility = 'hidden';
    root.querySelector('.mfl-forget').style.visibility = 'hidden';

    const savedBase = loadBase();
    const known = !!savedBase;   // we already know the address -> just unlock

    body.innerHTML = known ? `
      <div class="mfl-setup">
        <h3>Unlock the library</h3>
        <p>Connecting to <code>${escapeHTML(savedBase)}</code>.<br/>
           Enter your access code to unlock.</p>
        <input id="mflTok" type="password" placeholder="access code" autofocus />
        <button class="mfl-connect">Unlock</button>
        <div class="mfl-status ${prefillErr ? 'err' : ''}">${prefillErr || ''}</div>
        <button class="mfl-changeaddr">use a different server</button>
      </div>` : `
      <div class="mfl-setup">
        <h3>Connect your media server</h3>
        <p>Paste the server address and your access code.
           For the relay (works from anywhere) use the media subdomain ending in <code>/m</code>.
           On the same network you can use <code>http://&lt;pc-ip&gt;:8722</code> instead.</p>
        <input id="mflBase" type="text" placeholder="https://media.mayflowerstudios.net/m" />
        <input id="mflTok" type="password" placeholder="access code" />
        <button class="mfl-connect">Connect</button>
        <div class="mfl-status ${prefillErr ? 'err' : ''}">${prefillErr || ''}</div>
      </div>`;

    const baseI = body.querySelector('#mflBase');   // null when known
    const tokI = body.querySelector('#mflTok');
    const statusEl = body.querySelector('.mfl-status');

    const changeAddr = body.querySelector('.mfl-changeaddr');
    if (changeAddr) changeAddr.addEventListener('click', () => { forgetServer(); renderSetup(); });

    async function attempt() {
      let base = known ? savedBase : (baseI.value.trim().replace(/\/+$/, ''));
      const token = tokI.value.trim();
      if (!known && !/^https?:\/\//.test(base)) base = 'http://' + base;
      if (!base) { statusEl.className = 'mfl-status err'; statusEl.textContent = 'Need a server address.'; return; }
      if (!token) { statusEl.className = 'mfl-status err'; statusEl.textContent = 'Enter your access code.'; return; }
      statusEl.className = 'mfl-status'; statusEl.textContent = known ? 'Unlocking…' : 'Connecting…';
      try {
        const ping = await fetch(base + '/ping').then(r => r.json());
        if (!ping || !ping.ok) throw new Error('not a Mayflower Media server');
        if (ping.hostOnline === false) throw new Error('the host PC is offline — ask them to open Mayflower Media');
        const r = await fetch(`${base}/api/library?token=${encodeURIComponent(token)}`);
        if (r.status === 401) throw new Error('that code didn\'t work');
        if (r.status === 503) throw new Error('host PC offline');
        if (!r.ok) throw new Error('server error ' + r.status);
        conn = { base, token }; saveConn(conn);
        statusEl.className = 'mfl-status ok'; statusEl.textContent = 'Connected ✨';
        await loadLibrary();
      } catch (err) {
        statusEl.className = 'mfl-status err';
        statusEl.textContent = (err.message || String(err));
      }
    }

    body.querySelector('.mfl-connect').addEventListener('click', attempt);
    tokI.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
    if (baseI) tokI.value = '';
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
      b.addEventListener('click', () => { activeTab = b.dataset.tab; drillShow = null; buildTabs(); render(); }));
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

  // group episodes by show, each sorted by season then episode
  function showsFrom(items) {
    const map = new Map();
    items.forEach((it) => {
      if (it.kind !== 'episode') return;
      const key = it.show || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    for (const eps of map.values()) {
      eps.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
    }
    return map;
  }

  let drillShow = null;   // when set, we're viewing one show's episodes

  function render() {
    // drilled into a single show?
    if (drillShow) return renderShow(drillShow);

    const items = visibleItems();
    if (!items.length) {
      body.innerHTML = `<div class="mfl-empty">${query ? 'Nothing matches that.' : 'No videos found in your folders.'}</div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'mfl-grid';

    // movies (and, in All view, movies show alongside show-folders)
    const movies = items.filter(i => i.kind === 'movie');
    const shows = showsFrom(items);

    // show "folder" cards first when there are any
    if ((activeTab === 'all' || activeTab === 'episode')) {
      for (const [showName, eps] of [...shows.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) {
        grid.appendChild(showCard(showName, eps));
      }
    }
    if (activeTab !== 'episode') {
      for (const m of movies) grid.appendChild(itemCard(m, /*isEpisode*/false));
    }

    if (!grid.children.length) {
      body.innerHTML = `<div class="mfl-empty">${query ? 'Nothing matches that.' : 'Nothing here.'}</div>`;
      return;
    }
    body.innerHTML = '';
    body.appendChild(grid);
  }

  // a card representing a whole show; click to drill in
  function showCard(showName, eps) {
    const card = document.createElement('div');
    card.className = 'mfl-card';
    card.innerHTML = `
      <div class="mfl-poster">
        <div class="mfl-ph">${escapeHTML(showName)}</div>
        <div class="mfl-badge">📺 ${eps.length} ep${eps.length === 1 ? '' : 's'}</div>
      </div>
      <div class="mfl-meta">
        <div class="mfl-name">${escapeHTML(showName)}</div>
        <div class="mfl-sub">TV series</div>
      </div>`;
    // poster from the first episode
    lazyPoster(card.querySelector('.mfl-poster'), eps[0].id);
    card.addEventListener('click', () => { drillShow = showName; render(); });
    return card;
  }

  // episodes view for one show
  function renderShow(showName) {
    const eps = showsFrom(allItems).get(showName) || [];
    const wrap = document.createElement('div');

    const head = document.createElement('div');
    head.className = 'mfl-showhead';
    head.innerHTML = `
      <button class="mfl-back">← All</button>
      <span class="mfl-showtitle">${escapeHTML(showName)}</span>
      <button class="mfl-act play mfl-playall">▶ Play all in order</button>`;
    head.querySelector('.mfl-back').addEventListener('click', () => { drillShow = null; render(); });
    head.querySelector('.mfl-playall').addEventListener('click', () => playFromEpisode(eps, 0));
    wrap.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'mfl-grid';
    eps.forEach((ep, idx) => {
      const card = itemCard(ep, /*isEpisode*/true, () => playFromEpisode(eps, idx));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    body.innerHTML = '';
    body.appendChild(wrap);
  }

  // play one episode now, and auto-queue everything after it (continuous play)
  function playFromEpisode(eps, idx) {
    if (!window.MFWatch) return alert('Player bridge missing — add the MFWatch snippet to watch-together.html');
    const first = eps[idx];
    window.MFWatch.playUrl(playUrlFor(first), first.title);
    const rest = eps.slice(idx + 1).map(e => ({ url: playUrlFor(e), title: e.title }));
    if (rest.length && window.MFWatch.queueMany) window.MFWatch.queueMany(rest);
    close();
  }

  // a normal media card (movie, or a single episode inside a show)
  function itemCard(it, isEpisode, onPlay) {
    const card = document.createElement('div');
    card.className = 'mfl-card';
    const badge = it.direct ? '' : `<div class="mfl-badge">↻ transcode</div>`;
    const epLabel = isEpisode && it.season != null
      ? `S${String(it.season).padStart(2,'0')}E${String(it.episode).padStart(2,'0')}`
      : '';
    const displayName = isEpisode && epLabel ? epLabel : it.title;
    card.innerHTML = `
      <div class="mfl-poster">
        <div class="mfl-ph">${escapeHTML(displayName)}</div>
        ${badge}
        <div class="mfl-actions">
          <button class="mfl-act play">▶ Play${isEpisode ? ' from here' : ' now'}</button>
          <button class="mfl-act queue">＋ Add to queue</button>
        </div>
      </div>
      <div class="mfl-meta">
        <div class="mfl-name">${escapeHTML(displayName)}</div>
        <div class="mfl-sub">${it.folder ? escapeHTML(it.folder) + ' · ' : ''}${fmtSize(it.size)}</div>
      </div>`;
    lazyPoster(card.querySelector('.mfl-poster'), it.id);

    card.querySelector('.play').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onPlay) { onPlay(); return; }
      if (!window.MFWatch) return alert('Player bridge missing — add the MFWatch snippet to watch-together.html');
      window.MFWatch.playUrl(playUrlFor(it), it.title);
      close();
    });
    card.querySelector('.queue').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!window.MFWatch) return;
      window.MFWatch.queueUrl(playUrlFor(it), it.title);
      const b = e.target; const old = b.textContent;
      b.textContent = '✓ Queued'; setTimeout(() => b.textContent = old, 1200);
    });
    return card;
  }

  function lazyPoster(posterBox, id) {
    const img = new Image();
    img.onload = () => {
      const ph = posterBox.querySelector('.mfl-ph');
      if (ph) ph.remove();
      img.style.position = 'absolute'; img.style.inset = '0';
      posterBox.insertBefore(img, posterBox.firstChild);
    };
    img.src = posterUrl(id);
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