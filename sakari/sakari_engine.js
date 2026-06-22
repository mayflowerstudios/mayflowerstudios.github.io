/* ══════════════════════════════════════════════════════════════════
   Sakari Engine v1 — generic interactive-fiction runtime
   --------------------------------------------------------------------
   Plays a .sakari story object. No subject-matter assumptions: stats,
   themes, glossary, spirals are all author-defined. Pure logic layer —
   the DOM rendering lives in the reader HTML and calls into this.

   Exposed as a UMD-ish module: window.SakariEngine in a browser, or
   module.exports under Node (so the logic can be unit-tested headlessly).
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SakariEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SPECIAL = { '__epilogue__': 1, '__nextChapter__': 1, '__end__': 1 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ── Build fast lookup maps from the (array-based) story file ─────── */
  function index(story) {
    var ix = { scenes: {}, spirals: {}, glossary: {}, stats: {}, statOrder: [], langs: {} };
    (story.scenes || []).forEach(function (s) { ix.scenes[s.id] = s; });
    (story.spirals || []).forEach(function (s) { ix.spirals[s.key] = s; });
    (story.glossary || []).forEach(function (g) { ix.glossary[g.key] = g; });
    (story.stats || []).forEach(function (st) { ix.stats[st.key] = st; ix.statOrder.push(st.key); });
    (story.languages || []).forEach(function (l) { ix.langs[l.code] = l; });
    return ix;
  }

  /* ── A play session ───────────────────────────────────────────────── */
  function Session(story, opts) {
    opts = opts || {};
    this.story = story;
    this.ix = index(story);
    this.lang = opts.lang || story.primaryLang || 'en';
    this.reset();
  }

  Session.prototype.reset = function () {
    var S = { stats: {}, vars: {}, scene: null, chapterIndex: 0,
              lockedCount: 0, choiceCount: 0, seen: {}, lockedAt: [] };
    (this.story.stats || []).forEach(function (st) { S.stats[st.key] = st.initial; });
    var v = this.story.variables || {};
    Object.keys(v).forEach(function (k) { S.vars[k] = v[k]; });
    this.S = S;
    return S;
  };

  /* ── Value lookup for conditions: stat first, then variable ───────── */
  Session.prototype.valueOf = function (key) {
    var S = this.S;
    if (key in S.stats) return S.stats[key];
    if (key in S.vars) return S.vars[key];
    return 0;
  };

  Session.prototype.condHolds = function (cond) {
    var val = this.valueOf(cond.key);
    var min = (cond.min === undefined || cond.min === null) ? -Infinity : cond.min;
    var max = (cond.max === undefined || cond.max === null) ? Infinity : cond.max;
    // JSON may carry the named literal "Infinity"; coerce strings.
    if (min === 'Infinity') min = Infinity; if (min === '-Infinity') min = -Infinity;
    if (max === 'Infinity') max = Infinity; if (max === '-Infinity') max = -Infinity;
    return val >= min && val <= max;
  };

  Session.prototype.allHold = function (conds) {
    if (!conds || !conds.length) return true;
    for (var i = 0; i < conds.length; i++) if (!this.condHolds(conds[i])) return false;
    return true;
  };

  /* ── Apply a map of stat deltas ───────────────────────────────────── */
  Session.prototype.applyDeltas = function (deltas) {
    if (!deltas) return;
    var S = this.S, ix = this.ix;
    Object.keys(deltas).forEach(function (k) {
      if (!(k in S.stats)) { S.stats[k] = 0; }
      var def = ix.stats[k] || { min: 0, max: 100 };
      S.stats[k] = clamp(S.stats[k] + deltas[k], def.min, def.max);
    });
  };

  Session.prototype.applySetVars = function (setVars) {
    if (!setVars) return;
    var S = this.S;
    Object.keys(setVars).forEach(function (k) { S.vars[k] = setVars[k]; });
  };

  /* ── Enter a scene (applies entry deltas unless skipDelta) ────────── */
  Session.prototype.enterScene = function (id, skipDelta) {
    var sc = this.ix.scenes[id];
    if (!sc) { return { error: 'scene not found: ' + id }; }
    this.S.scene = id;
    if (!skipDelta) {
      this.applyDeltas(sc.enter);
      this.applySetVars(sc.setVars);
    }
    return { scene: sc };
  };

  /* ── Resolve a choice's lock state in the current run ─────────────── */
  Session.prototype.lockState = function (choice) {
    if (choice.locked) return { locked: true, reason: choice.reason || '' };
    if (choice.gateStat && this.valueOf(choice.gateStat) < (choice.gateBelow || 0))
      return { locked: true, gate: true, reason: choice.reason || '' };
    if (choice.lockIf && choice.lockIf.length && this.allHold(choice.lockIf))
      return { locked: true, reason: choice.reason || '' };
    return { locked: false };
  };

  Session.prototype.choiceVisible = function (choice) {
    return this.allHold(choice.showIf);
  };

  /* ── Tally a choice for the epilogue stats (once per slot) ────────── */
  Session.prototype.tally = function (sceneId, choiceIndex, choice, locked) {
    var key = sceneId + '#' + choiceIndex;
    if (this.S.seen[key]) return;
    this.S.seen[key] = true;
    this.S.choiceCount++;
    if (locked) {
      this.S.lockedCount++;
      var sc = this.ix.scenes[sceneId];
      this.S.lockedAt.push({ scene: (sc && sc.label) || sceneId, text: choice.text });
    }
  };

  /* ── Pick a choice. Returns an action descriptor for the renderer ── */
  Session.prototype.pick = function (choice) {
    if (choice.spiral) return { type: 'spiral', key: choice.spiral };
    if (choice.wanted) {
      // renderer shows the reveal, then calls commit()
      return { type: 'reveal', wanted: choice.wanted, sent: choice.text,
               commit: this.commit.bind(this, choice) };
    }
    return this.commit(choice);
  };

  Session.prototype.commit = function (choice) {
    this.applyDeltas(choice.deltas);
    this.applySetVars(choice.setVars);
    var next = choice.next || '__end__';
    if (next === '__epilogue__' || next === '__end__') return { type: 'epilogue' };
    if (next === '__nextChapter__') return { type: 'nextChapter' };
    var r = this.enterScene(next);
    return r.error ? { type: 'error', error: r.error } : { type: 'scene', scene: r.scene };
  };

  /* ── Derived run summary for the epilogue ─────────────────────────── */
  Session.prototype.summary = function () {
    var S = this.S;
    var pct = Math.round((S.lockedCount / Math.max(S.choiceCount, 1)) * 100);
    var lines = [];
    (this.story.reflections || []).forEach(function (r) {
      var ok = this.allHold(r.when);
      if (ok && r.lockedPctMin >= 0 && pct < r.lockedPctMin) ok = false;
      if (ok && r.lockedPctMax >= 0 && pct > r.lockedPctMax) ok = false;
      if (ok) lines.push(r.text);
    }, this);
    var moment = null;
    if (S.lockedAt.length) moment = S.lockedAt[Math.floor(S.lockedAt.length / 2)];
    return { lockedCount: S.lockedCount, choiceCount: S.choiceCount,
             lockedPct: pct, stats: S.stats, lines: lines, moment: moment };
  };

  /* ── Band/number label for a stat value ───────────────────────────── */
  Session.prototype.statLabel = function (key) {
    var def = this.ix.stats[key]; if (!def) return '';
    var v = this.S.stats[key];
    if (!def.bands || !def.bands.length) return String(Math.round(v));
    var span = (def.max - def.min) / def.bands.length;
    var idx = clamp(Math.floor((v - def.min) / span), 0, def.bands.length - 1);
    return def.bands[idx];
  };

  Session.prototype.statPct = function (key) {
    var def = this.ix.stats[key]; if (!def) return 0;
    var v = this.S.stats[key];
    return clamp(((v - def.min) / (def.max - def.min)) * 100, 0, 100);
  };

  /* ── Validate a story graph: broken/unreachable scenes ────────────── */
  function validate(story) {
    var ix = index(story);
    var problems = [];
    var start = story.startScene || (story.scenes[0] && story.scenes[0].id);
    var reachable = {}, queue = [start], guard = 0;
    while (queue.length && guard++ < 20000) {
      var cur = queue.shift();
      if (!cur || SPECIAL[cur] || reachable[cur]) continue;
      if (!ix.scenes[cur]) continue;
      reachable[cur] = true;
      (ix.scenes[cur].choices || []).forEach(function (c) {
        if (c.next && !SPECIAL[c.next] && !ix.scenes[c.next])
          problems.push('broken next: ' + cur + ' -> ' + c.next);
        if (c.next) queue.push(c.next);
        if (c.spiral) { if (!ix.spirals[c.spiral]) problems.push('missing spiral: ' + cur + ' -> ' + c.spiral); queue.push(cur); }
      });
    }
    (story.scenes || []).forEach(function (s) {
      if (!reachable[s.id]) problems.push('unreachable scene: ' + s.id);
    });
    return problems;
  }

  /* ── Apply a language pack onto a story, returning a localized copy ── */
  function localize(story, code) {
    if (!code || code === (story.primaryLang || 'en')) return story;
    var pack = (story.languages || []).filter(function (l) { return l.code === code; })[0];
    if (!pack) return story;
    var s = JSON.parse(JSON.stringify(story)); // deep clone; never mutate source
    if (pack.meta) ['title', 'subtitle', 'desc', 'note', 'cw'].forEach(function (k) {
      if (pack.meta[k] != null) s[k] = pack.meta[k];
    });
    (s.scenes || []).forEach(function (sc) {
      var p = pack.scenes && pack.scenes[sc.id]; if (!p) return;
      if (p.label) sc.label = p.label;
      if (p.prose) p.prose.forEach(function (t, i) { if (sc.prose[i] && t) sc.prose[i].text = t; });
      if (p.choices) p.choices.forEach(function (t, i) { if (sc.choices[i] && t) sc.choices[i].text = t; });
    });
    if (pack.glossary) (s.glossary || []).forEach(function (g) {
      var t = pack.glossary[g.key]; if (t) { if (t.title) g.title = t.title; if (t.body) g.body = t.body; }
    });
    if (pack.spirals) (s.spirals || []).forEach(function (sp) {
      var t = pack.spirals[sp.key]; if (t && t.lines) { sp.lines = t.lines; if (t.dismiss) sp.dismiss = t.dismiss; if (t.note) sp.note = t.note; }
    });
    return s;
  }

  return { Session: Session, validate: validate, localize: localize, index: index, SPECIAL: SPECIAL };
});
