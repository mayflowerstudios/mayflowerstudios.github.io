/* ══════════════════════════════════════════════════════
   Sakari — engine.js

   Universal engine for all Sakari stories.
   Handles hub rendering, story loading, game state,
   scene rendering, spirals, day transitions, epilogue.

   Stories live in sakari/{story-id}/ folders.
   The engine reads sakari/stories.js for the list,
   then loads each story's meta.js for metadata.

   Only edit this file for mechanical changes.
   Story content lives entirely in story folders.
   ══════════════════════════════════════════════════════ */

/* ── GLOBAL NAMESPACE ──────────────────────────────── */
var SAKARI = {
  stories:  {},   // keyed by id, populated by meta.js files
  S:        {},   // live game state
  activeId: null, // story currently playing
  active:   null, // reference to the active story meta object
};

/* Scene / spiral / glossary globals reset per story */
var SCENES = {}, SPIRALS = {}, GLOSSARY = {};

/* ── THEME ─────────────────────────────────────────── */
function skSetTheme(name) {
  document.documentElement.setAttribute('data-theme', name === 'midnight' ? '' : name);
  document.querySelectorAll('.sk-swatch').forEach(function (el) {
    el.classList.toggle('active', el.dataset.theme === name);
  });
  try { localStorage.setItem('sk-theme', name); } catch(e) {}
}

/* ── STATUS ────────────────────────────────────────── */
function depLabel(v) { return v < 25 ? 'low' : v < 45 ? 'mild' : v < 65 ? 'moderate' : v < 80 ? 'high' : 'severe'; }
function anxLabel(v) { return v < 25 ? 'low' : v < 45 ? 'moderate' : v < 70 ? 'high' : 'acute'; }

function updateStatus() {
  var s = SAKARI.S;
  var df = document.getElementById('sk-dep-fill'); if (df) df.style.width = s.dep + '%';
  var af = document.getElementById('sk-anx-fill'); if (af) af.style.width = s.anx + '%';
  var nf = document.getElementById('sk-nrg-fill'); if (nf) nf.style.width = s.nrg + '%';
  var dv = document.getElementById('sk-dep-val');  if (dv) dv.textContent = depLabel(s.dep);
  var av = document.getElementById('sk-anx-val');  if (av) av.textContent = anxLabel(s.anx);
  var nv = document.getElementById('sk-nrg-val');  if (nv) nv.textContent = s.nrg;
}

/* ── SCRIPT LOADER ─────────────────────────────────── */
function loadScript(url, cb) {
  var s = document.createElement('script');
  s.src = url;
  s.onload = cb;
  s.onerror = function () { console.error('Sakari: failed to load ' + url); cb(); };
  document.head.appendChild(s);
}

function loadScriptsSequential(urls, cb) {
  if (!urls.length) { cb(); return; }
  loadScript(urls[0], function () { loadScriptsSequential(urls.slice(1), cb); });
}

/* ── META LOADING ──────────────────────────────────── */
function initEngine() {
  if (typeof SAKARI_STORY_IDS === 'undefined') {
    console.error('Sakari: stories.js not loaded'); return;
  }

  var toLoad = SAKARI_STORY_IDS.length;
  if (toLoad === 0) { renderHub(); return; }

  SAKARI_STORY_IDS.forEach(function (id) {
    loadScript('sakari/' + id + '/meta.js', function () {
      toLoad--;
      if (toLoad === 0) {
        renderHub();
        handleDeepLink();
      }
    });
  });

  // restore theme
  try {
    var saved = localStorage.getItem('sk-theme');
    if (saved) skSetTheme(saved);
  } catch(e) {}
}

/* ── DEEP LINK ─────────────────────────────────────── */
function handleDeepLink() {
  var params = new URLSearchParams(window.location.search);
  var id = params.get('story');
  if (id && SAKARI.stories[id]) openStory(id);
}

/* ── HUB RENDERING ─────────────────────────────────── */
function renderHub() {
  var grid = document.getElementById('sk-story-grid');
  if (!grid) return;
  grid.innerHTML = '';

  SAKARI_STORY_IDS.forEach(function (id) {
    var m = SAKARI.stories[id];
    if (!m || m.hidden) return;

    var tags = (m.tags || []).map(function (t) {
      return '<span class="badge' + (t.style ? ' badge-' + t.style : '') + '">' + t.text + '</span>';
    }).join('');

    var card = document.createElement('div');
    card.className = 'story-card';
    card.innerHTML =
      '<div class="story-card-inner">' +
        '<div class="story-card-top">' +
          '<span class="story-card-title">' + m.title + '</span>' +
          '<div class="story-card-tags">' + tags + '</div>' +
        '</div>' +
        '<p class="story-card-desc">' + m.desc + '</p>' +
        (m.note ? '<p class="story-card-note">' + m.note + '</p>' : '') +
        '<div class="story-card-footer">' +
          '<span class="story-cw">⚠ content warnings on the next screen</span>' +
          '<span class="story-enter">read →</span>' +
        '</div>' +
      '</div>';
    card.addEventListener('click', function () { openStory(id); });
    grid.appendChild(card);
  });
}

/* ── STORY OPEN / LOAD ─────────────────────────────── */
function openStory(id) {
  var m = SAKARI.stories[id];
  if (!m) return;

  // update url without reload
  history.pushState({story: id}, '', '?story=' + id);

  if (m.loaded) {
    showSplash(id);
    return;
  }

  // show loading state
  showPlayerView();
  document.getElementById('sk-splash').style.display = 'none';
  document.getElementById('sk-game').style.display = 'none';
  document.getElementById('sk-loading').style.display = 'flex';
  document.getElementById('sk-player-title').textContent = m.title;

  // reset globals before loading
  SCENES = {}; SPIRALS = {}; GLOSSARY = {};

  // collect all files for all days
  var files = [];
  (m.days || []).forEach(function (day) {
    (day.files || []).forEach(function (f) {
      files.push('sakari/' + id + '/' + f);
    });
  });

  loadScriptsSequential(files, function () {
    // cache into story object
    m.scenes   = SCENES;
    m.spirals  = SPIRALS;
    m.glossary = GLOSSARY;
    m.loaded   = true;
    document.getElementById('sk-loading').style.display = 'none';
    showSplash(id);
  });
}

/* ── SPLASH ────────────────────────────────────────── */
function showSplash(id) {
  SAKARI.activeId = id;
  var m = SAKARI.stories[id];

  showPlayerView();
  document.getElementById('sk-game').style.display = 'none';
  document.getElementById('sk-day-transition').style.display = 'none';
  document.getElementById('sk-epilogue').style.display = 'none';
  document.getElementById('sk-loading').style.display = 'none';

  document.getElementById('sk-player-title').textContent = m.title;

  var tags = (m.tags || []).map(function (t) {
    return '<span class="tag">' + t.text + '</span>';
  }).join('');

  var splash = document.getElementById('sk-splash');
  splash.innerHTML =
    '<h1>' + m.title + '</h1>' +
    '<p class="byline">' + (m.subtitle || '') + '</p>' +
    '<div class="tags">' + tags + '</div>' +
    (m.note ? '<p class="splash-note">' + m.note + '</p>' : '') +
    '<div class="theme-row"><span>theme</span>' + buildSwatches() + '</div>' +
    '<p class="cw">' + (m.cw || '') + ' Underlined terms can be clicked for definitions. Not a substitute for professional support.</p>' +
    '<div class="crisis">If you are in crisis: <strong>988 Suicide & Crisis Lifeline</strong> — call or text <a href="tel:988">988</a> (US). International: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a>.</div>' +
    '<button class="start-btn" onclick="startStory()">i understand — begin</button>';

  splash.style.display = 'flex';
}

function buildSwatches() {
  var themes = [
    { name: 'midnight', bg: '#2a1e18', label: 'Midnight' },
    { name: 'parchment', bg: '#d0c8b0', label: 'Parchment' },
    { name: 'violet', bg: '#3a2868', label: 'Violet' },
    { name: 'rose', bg: '#6a2040', label: 'Rose' },
    { name: 'paper', bg: '#7a6030', label: 'Candlelight' },
  ];
  return themes.map(function (t) {
    return '<div class="sk-swatch t-swatch" data-theme="' + t.name + '" style="background:' + t.bg + '" title="' + t.label + '" onclick="skSetTheme(\'' + t.name + '\')"></div>';
  }).join('');
}

/* ── SHOW/HIDE VIEWS ───────────────────────────────── */
function showPlayerView() {
  document.getElementById('sk-hub').style.display = 'none';
  document.getElementById('sk-player').style.display = 'block';
}

function showHub() {
  document.getElementById('sk-player').style.display = 'none';
  document.getElementById('sk-hub').style.display = 'block';
  history.pushState({}, '', window.location.pathname);
  // reset active story
  SAKARI.activeId = null;
  SAKARI.active    = null;
  SAKARI.S = {};
  // also hide all player sub-views
  ['sk-splash','sk-game','sk-day-transition','sk-epilogue','sk-loading'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.style.display = 'none';
  });
}

/* ── START STORY ───────────────────────────────────── */
function startStory() {
  var id = SAKARI.activeId;
  var m = SAKARI.stories[id];
  if (!m) return;

  SAKARI.S = {
    dep:         m.initialDep || 55,
    anx:         m.initialAnx || 70,
    nrg:         m.initialNrg || 80,
    dayIndex:    0,
    scene:       null,
    lockedCount: 0,
    choiceCount: 0,
  };

  document.getElementById('sk-splash').style.display = 'none';
  document.getElementById('sk-game').style.display = 'block';
  updateStatus();

  // Pin the active story — all rendering reads from here, never from globals
  SAKARI.active = m;

  var firstScene = m.startScene || (m.scenes ? Object.keys(m.scenes)[0] : null);
  if (!firstScene) { console.error('Sakari: no startScene found for ' + id); return; }
  renderScene(firstScene);
}

/* ── SCENE RENDERING ───────────────────────────────── */
function renderScene(id) {
  if (id === '__epilogue__') { showEpilogue(); return; }
  if (id === '__next_day__') { startNextDay(); return; }

  var sc = SAKARI.active && SAKARI.active.scenes ? SAKARI.active.scenes[id] : SCENES[id];
  if (!sc) { console.error('Sakari: scene not found:', id); return; }

  var S = SAKARI.S;
  S.scene = id;
  if (sc.dep) S.dep = Math.max(0, Math.min(100, S.dep + sc.dep));
  if (sc.anx) S.anx = Math.max(0, Math.min(100, S.anx + sc.anx));
  if (sc.nrg) S.nrg = Math.max(0, Math.min(100, S.nrg + sc.nrg));
  updateStatus();

  var m = SAKARI.stories[SAKARI.activeId];
  var dayLabel = (m && m.days && m.days[S.dayIndex]) ? m.days[S.dayIndex].label : '';
  document.getElementById('sk-scene-label').textContent = (sc.label || '') + (dayLabel ? ' · ' + dayLabel : '');

  var proseEl = document.getElementById('sk-prose');
  proseEl.innerHTML = '';

  if (S.nrg < 30) {
    var ew = document.createElement('div');
    ew.className = 'energy-warning';
    ew.textContent = 'your energy is very low. some options are unavailable.';
    proseEl.appendChild(ew);
  }

  (sc.prose || []).forEach(function (p) {
    var d = document.createElement('div');
    if (p.type === 'thought') {
      d.className = 'thought'; d.textContent = p.text;
    } else if (p.type === 'msg') {
      d.className = 'msg-block' + (p.cold ? ' cold' : '');
      d.innerHTML = '<div class="msg-name">' + (p.name || '') + '</div>' + p.text;
    } else if (p.type === 'wanted') {
      d.className = 'wanted-block';
      d.innerHTML =
        (p.wanted ? '<div class="wb-label">what you wanted to say</div><div class="wb-text">' + p.wanted + '</div>' : '') +
        (p.sent   ? '<div class="wb-label sent">what you sent</div><div class="wb-text sent">' + p.sent + '</div>' : '');
    } else {
      d.innerHTML = '<p>' + p.text + '</p>';
    }
    proseEl.appendChild(d);
  });

  document.getElementById('sk-spiral').className = '';
  document.getElementById('sk-spiral').innerHTML = '';

  var cWrap = document.getElementById('sk-choices-wrap');
  var cEl   = document.getElementById('sk-choices');
  cEl.innerHTML = '';
  cWrap.style.display = 'block';

  (sc.choices || []).forEach(function (c) {
    var isEGate  = c.egGate && S.nrg < c.egGate;
    var isLocked = c.locked || isEGate;
    if (isLocked) S.lockedCount++;
    S.choiceCount++;

    var item = document.createElement('div');
    item.className = 'choice-item';

    if (isLocked) {
      var reason = isEGate ? "you don't have the energy for this right now." : (c.reason || '');
      item.innerHTML =
        '<span class="choice-link locked"><span class="ct">' + c.text + '</span>' +
        (c.note ? '<span class="choice-note">' + c.note + '</span>' : '') +
        '</span>' +
        (reason ? '<span class="choice-reason">' + reason + '</span>' : '');
    } else {
      var btn = document.createElement('button');
      btn.className = 'choice-link';
      btn.innerHTML = '<span class="ct">' + c.text + '</span>' +
        (c.note ? '<span class="choice-note">' + c.note + '</span>' : '');
      item.appendChild(btn);
      (function (choice, it) {
        it.querySelector('button').addEventListener('click', function () { pick(choice, it); });
      })(c, item);
    }
    cEl.appendChild(item);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
  setupTerms();
}

/* ── PICK ──────────────────────────────────────────── */
function pick(c, itemEl) {
  if (c.spiral) { triggerSpiral(c.spiral); return; }

  var S = SAKARI.S;

  if (c.wanted) {
    document.querySelectorAll('.choice-item').forEach(function (it) {
      it.classList.add(it === itemEl ? 'chosen' : 'dimmed');
    });
    var btn = itemEl.querySelector('button');
    if (btn) btn.style.display = 'none';
    var rev = document.createElement('div');
    rev.className = 'wanted-block inline-reveal';
    rev.innerHTML =
      '<div class="wb-label">what you wanted to say</div><div class="wb-text">' + c.wanted + '</div>' +
      '<div class="wb-label sent">what you sent</div><div class="wb-text sent">' + c.text + '</div>';
    itemEl.appendChild(rev);
    setTimeout(function () { rev.classList.add('show'); }, 40);
    setTimeout(function () {
      applyDeltas(c);
      transitionTo(c.next);
    }, 2200);
    return;
  }

  applyDeltas(c);
  transitionTo(c.next);
}

function applyDeltas(c) {
  var S = SAKARI.S;
  if (c.nrg) S.nrg = Math.max(0, Math.min(100, S.nrg + c.nrg));
  if (c.dep) S.dep = Math.max(0, Math.min(100, S.dep + c.dep));
  if (c.anx) S.anx = Math.max(0, Math.min(100, S.anx + c.anx));
  updateStatus();
}

function transitionTo(next) {
  var prose = document.getElementById('sk-prose');
  prose.style.opacity = '0';
  document.getElementById('sk-choices-wrap').style.display = 'none';
  setTimeout(function () {
    prose.style.opacity = '1';
    renderScene(next);
  }, 350);
}

/* ── SPIRAL ────────────────────────────────────────── */
function triggerSpiral(key) {
  document.getElementById('sk-choices-wrap').style.display = 'none';
  var el = document.getElementById('sk-spiral');
  el.innerHTML = ''; el.className = 'on';
  var _spirals = SAKARI.active && SAKARI.active.spirals ? SAKARI.active.spirals : SPIRALS;
  var sp = _spirals[key] || { lines: [], dismiss: 'breathe. come back.' };
  var lines       = Array.isArray(sp) ? sp           : (sp.lines   || []);
  var dismissText = Array.isArray(sp) ? 'breathe. come back.' : (sp.dismiss || 'breathe. come back.');
  var noteText    = Array.isArray(sp) ? ''            : (sp.note    || '');

  lines.forEach(function (t, i) {
    var d = document.createElement('div');
    d.className = 'spiral-line'; d.textContent = t;
    el.appendChild(d);
    setTimeout(function () { d.classList.add('show'); }, i * 600 + 200);
  });

  if (noteText) {
    var nd = document.createElement('div');
    nd.className = 'spiral-note'; nd.textContent = noteText;
    el.appendChild(nd);
    setTimeout(function () { nd.classList.add('show'); }, lines.length * 600 + 400);
  }

  var btn = document.createElement('button');
  btn.id = 'sk-spiral-dismiss'; btn.textContent = dismissText;
  btn.onclick = dismissSpiral;
  el.appendChild(btn);
}

function dismissSpiral() {
  document.getElementById('sk-spiral').className = '';
  renderScene(SAKARI.S.scene);
}

/* ── DAY TRANSITION ────────────────────────────────── */
function startNextDay() {
  var id = SAKARI.activeId;
  var m  = SAKARI.stories[id];
  var S  = SAKARI.S;
  S.dayIndex++;

  var nextDay = m.days[S.dayIndex];
  if (!nextDay) { showEpilogue(); return; }

  // show transition screen
  document.getElementById('sk-game').style.display = 'none';
  var dt = document.getElementById('sk-day-transition');
  dt.style.display = 'flex';
  dt.innerHTML =
    '<div class="day-transition-inner">' +
      '<div class="day-transition-label">end of day ' + S.dayIndex + '</div>' +
      '<div class="day-transition-next">' + nextDay.label + '</div>' +
      '<button class="start-btn" onclick="loadNextDay()">continue →</button>' +
    '</div>';
}

function loadNextDay() {
  var id  = SAKARI.activeId;
  var m   = SAKARI.stories[id];
  var day = m.days[SAKARI.S.dayIndex];
  if (!day) return;

  document.getElementById('sk-day-transition').style.display = 'none';

  // clear current scenes/spirals (keep glossary)
  SCENES  = {};
  SPIRALS = {};

  var files = (day.files || []).filter(function (f) { return f !== 'glossary.js'; });
  var paths = files.map(function (f) { return 'sakari/' + id + '/' + f; });

  loadScriptsSequential(paths, function () {
    // merge new scenes into story cache
    Object.assign(m.scenes,  SCENES);
    Object.assign(m.spirals, SPIRALS);
    document.getElementById('sk-game').style.display = 'block';
    var firstScene = Object.keys(SCENES)[0];
    renderScene(firstScene);
  });
}

/* ── EPILOGUE ──────────────────────────────────────── */
function showEpilogue() {
  document.getElementById('sk-choices-wrap').style.display = 'none';
  document.getElementById('sk-prose-wrap').style.display = 'none';
  document.getElementById('sk-scene-label').textContent = '';

  var el = document.getElementById('sk-epilogue');
  el.style.display = 'block';

  var S = SAKARI.S;
  var m = SAKARI.stories[SAKARI.activeId];
  var pct = Math.round((S.lockedCount / Math.max(S.choiceCount, 1)) * 100);

  var blocksHtml = (m.epilogue || []).map(function (b) {
    if (b.type === 'thought') return '<p class="thought">' + b.text + '</p>';
    return '<p>' + b.text + '</p>';
  }).join('');

  el.innerHTML =
    '<h2>that\'s all for now.</h2>' +
    '<div class="epi-block">' + blocksHtml + '</div>' +
    '<div class="epi-stats">' +
      '<div class="epi-stat"><div class="n">' + S.lockedCount + '</div><div class="l">choices unavailable</div></div>' +
      '<div class="epi-stat"><div class="n">' + pct + '%</div><div class="l">options locked</div></div>' +
      '<div class="epi-stat"><div class="n">' + S.nrg + '</div><div class="l">energy remaining</div></div>' +
    '</div>' +
    '<div class="epi-resources">' +
      '<strong style="display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;font-weight:400">if you need support</strong>' +
      '988 Suicide & Crisis Lifeline: call or text <a href="tel:988">988</a> (US) &nbsp;·&nbsp; ' +
      'International: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a><br>' +
      'BPD information: <a href="https://www.nami.org/About-Mental-Illness/Mental-Health-Conditions/Borderline-Personality-Disorder" target="_blank">NAMI</a> &nbsp;·&nbsp; ' +
      'DBT skills: <a href="https://dialecticalbehaviortherapy.com" target="_blank">dialecticalbehaviortherapy.com</a>' +
    '</div>' +
    '<button class="epi-restart-btn" onclick="restartStory()">play again</button>';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function restartStory() {
  var id = SAKARI.activeId;
  SAKARI.active = null; // clear so next startStory re-pins correctly
  document.getElementById('sk-epilogue').style.display = 'none';
  document.getElementById('sk-prose-wrap').style.display = 'block';
  showSplash(id);
}

/* ── TOOLTIPS ──────────────────────────────────────── */
function setupTerms() {
  var tip = document.getElementById('sk-tooltip');
  document.querySelectorAll('.term').forEach(function (el) {
    el.addEventListener('mouseenter', function (e) {
      var _gl = SAKARI.active && SAKARI.active.glossary ? SAKARI.active.glossary : GLOSSARY;
      var g = _gl[el.dataset.key]; if (!g) return;
      tip.innerHTML = '<strong>' + g.title + '</strong>' + g.body;
      tip.classList.add('show'); positionTip(e, el);
    });
    el.addEventListener('mousemove', function (e) { positionTip(e, el); });
    el.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
    el.addEventListener('click', function (e) {
      var _gl2 = SAKARI.active && SAKARI.active.glossary ? SAKARI.active.glossary : GLOSSARY;
      var g = _gl2[el.dataset.key]; if (!g) return;
      tip.innerHTML = '<strong>' + g.title + '</strong>' + g.body;
      tip.classList.add('show'); positionTip(e, el); e.stopPropagation();
    });
  });
  document.addEventListener('click', function () { tip.classList.remove('show'); });
}

function positionTip(e, targetEl) {
  var tip = document.getElementById('sk-tooltip');
  var vw = window.innerWidth, vh = window.innerHeight;
  var TW = Math.min(300, vw - 32);
  var tipH = tip.scrollHeight || 180;
  var x, y;
  if (vw < 640 || (e && e.type === 'click')) {
    var rect = (targetEl || e.target).getBoundingClientRect();
    x = Math.max(16, Math.min(vw - TW - 16, rect.left + rect.width / 2 - TW / 2));
    y = rect.bottom + 10;
    if (y + tipH > vh - 8) y = Math.max(8, rect.top - tipH - 10);
  } else {
    x = e.clientX + 14; y = e.clientY + 14;
    if (x + TW > vw) x = e.clientX - TW - 8;
    if (y + tipH > vh) y = e.clientY - tipH - 8;
    if (x < 8) x = 8;
  }
  tip.style.maxWidth = TW + 'px';
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

/* ── BOOT ──────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEngine);
} else {
  initEngine();
}

window.addEventListener('popstate', function (e) {
  if (e.state && e.state.story) {
    openStory(e.state.story);
  } else {
    showHub();
  }
});
