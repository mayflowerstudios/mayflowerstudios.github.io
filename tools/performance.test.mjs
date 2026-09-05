// Run with: node --test tools/performance.test.mjs
// Deterministic frame scheduling checks, not wall-clock browser benchmarks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = name => readFileSync(new URL(name, root), 'utf8');
function harness(kind, options = {}) {
  const callbacks = new Map(), events = new Map(), prefs = new Map();
  const classes = new Set(options.reduced ? ['mf-reduce-motion'] : []);
  let time = 0, nextId = 0;
  const counts = { clears: 0, gradients: 0, images: 0 };
  const on = (name, fn) => { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); };
  const emit = name => { for (const fn of events.get(name) || []) fn(); };
  const ctx = {
    clearRect() { counts.clears++; }, createRadialGradient() { counts.gradients++; return { addColorStop() {} }; },
    drawImage() { counts.images++; }, setTransform() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {},
    save() {}, restore() {}, translate() {}, rotate() {}, ellipse() {},
  };
  const makeCanvas = () => ({ style: {}, width: 300, height: 150, getContext: () => ctx });
  const canvas = makeCanvas();
  const motion = { matches: !!options.systemReduced, addEventListener: (_, fn) => on('motion', fn) };
  const document = {
    hidden: !!options.hidden,
    documentElement: { classList: { contains: key => classes.has(key) } },
    getElementById: () => canvas, createElement: makeCanvas, addEventListener: on,
  };
  const window = {
    innerWidth: options.mobile ? 390 : 1280, innerHeight: 800, devicePixelRatio: options.mobile ? 3 : 1,
    addEventListener: on, matchMedia: query => query.includes('reduced-motion') ? motion : { matches: !!options.mobile },
  };
  const sandbox = { window, document, console, performance: { now: () => time },
    localStorage: { getItem: key => prefs.get(key) ?? null },
    requestAnimationFrame: fn => { callbacks.set(++nextId, fn); return nextId; },
    cancelAnimationFrame: id => callbacks.delete(id),
  };
  const js = options.baseline
    ? execFileSync('git', ['show', `HEAD:${kind === 'petals' ? 'shared.js' : 'fireflies.js'}`], { cwd: root, encoding: 'utf8' })
    : source(kind === 'petals' ? 'shared.js' : 'fireflies.js');
  const code = kind === 'petals'
    ? js.slice(js.indexOf('  function startPetals('), js.indexOf('  // ─────', js.indexOf('  function startPetals('))) + '\nstartPetals(document.getElementById("petals"));'
    : js;
  vm.runInNewContext(code, sandbox);
  function frames(seconds = 1, hz = 120) {
    const start = time;
    for (let i = 1; i <= seconds * hz; i++) {
      time = start + i * 1000 / hz;
      const ready = [...callbacks.values()]; callbacks.clear();
      for (const fn of ready) fn(time);
    }
  }
  return { counts, frames, callbacks, classes, prefs, motion, document, window, canvas, emit };
}

for (const kind of ['petals', 'fireflies']) {
  test(`${kind}: at most 30 draws/sec at 60, 120, and 144Hz`, () => {
    for (const hz of [60, 120, 144]) {
      const h = harness(kind); h.frames(2, hz);
      assert.ok(h.counts.clears >= 58 && h.counts.clears <= 60, `${hz}Hz: ${h.counts.clears} draws`);
    }
  });
  test(`${kind}: no scheduled frames when initially hidden or reduced`, () => {
    for (const options of [{ hidden: true }, { reduced: true }, { systemReduced: true }]) {
      const h = harness(kind, options); assert.equal(h.callbacks.size, 0);
    }
  });
  test(`${kind}: changing preferences stops and resumes exactly one loop`, () => {
    const h = harness(kind); h.frames();
    h.classes.add('mf-reduce-motion'); h.emit('mf-appearance-changed');
    assert.equal(h.callbacks.size, 0);
    const paused = h.counts.clears; h.frames(); assert.equal(h.counts.clears, paused);
    h.classes.clear(); h.emit('mf-appearance-changed'); h.emit('mf-appearance-changed');
    assert.equal(h.callbacks.size, 1);
    h.motion.matches = true; h.emit('motion'); assert.equal(h.callbacks.size, 0);
    h.motion.matches = false; h.emit('motion'); assert.equal(h.callbacks.size, 1);
  });
  test(`${kind}: tab restore resizes canvas and resumes one loop`, () => {
    const h = harness(kind); h.document.hidden = true; h.emit('visibilitychange');
    assert.equal(h.callbacks.size, 0);
    h.window.innerWidth = 900; h.emit('resize');
    h.document.hidden = false; h.emit('visibilitychange'); h.emit('visibilitychange');
    assert.equal(h.callbacks.size, 1); assert.equal(h.canvas.width, 900);
  });
  test(`${kind}: mobile canvas resolution is capped`, () => {
    const h = harness(kind, { mobile: true });
    assert.equal(h.canvas.width, 585); assert.equal(h.canvas.height, 1200);
  });
}
test('fireflies: gradients are cached across frames and resize', () => {
  const h = harness('fireflies'); h.frames();
  const gradients = h.counts.gradients;
  assert.ok(gradients > 0 && gradients <= 3);
  h.frames(); h.emit('resize'); h.frames();
  assert.equal(h.counts.gradients, gradients); assert.ok(h.counts.images > 0);
});
test('fireflies: video pause survives tab switching and preference changes', () => {
  const h = harness('fireflies'); h.window.fireflies.pause();
  h.document.hidden = true; h.emit('visibilitychange');
  h.document.hidden = false; h.emit('visibilitychange'); h.emit('mf-appearance-changed');
  assert.equal(h.callbacks.size, 0);
  h.window.fireflies.resume(); assert.equal(h.callbacks.size, 1);
  h.prefs.set('mf_hide_fireflies', '1'); h.emit('mf-appearance-changed');
  assert.equal(h.callbacks.size, 0);
});
test('translation only observes DOM changes while another language is selected', async () => {
  let active = 0;
  const js = source('shared.js');
  const sandbox = {
    navigator: { language: 'en' }, location: { protocol: 'http:' },
    localStorage: { getItem() { return null; }, setItem() {} },
    window: { addEventListener() {}, dispatchEvent() {} },
    document: {
      documentElement: { lang: 'en', setAttribute() {}, removeAttribute() {} },
      body: {}, createTreeWalker: () => ({ nextNode: () => null }),
    },
    NodeFilter: { SHOW_TEXT: 4 }, CustomEvent: class {},
    MutationObserver: class {
      observe() { active++; }
      disconnect() { active--; }
    },
  };
  vm.runInNewContext(js.slice(js.indexOf('  var MFTranslate ='), js.indexOf('  function buildLangPicker()')), sandbox);
  const tr = sandbox.window.MFTranslate;
  tr.init(); assert.equal(active, 0);
  await tr.setLang('es'); assert.equal(active, 1);
  await tr.setLang('fr'); assert.equal(active, 1);
  await tr.setLang('en'); assert.equal(active, 0);
  await tr.setLang('es'); assert.equal(active, 1);
});
// Opt-in diagnostic: MF_PERF_BASELINE=1 compares against the current git HEAD.
test('compare drawing work with the committed baseline', { skip: !process.env.MF_PERF_BASELINE }, () => {
  for (const kind of ['petals', 'fireflies']) {
    const before = harness(kind, { baseline: true }), after = harness(kind);
    before.frames(2); after.frames(2);
    console.log(`${kind}, 2 seconds at 120Hz: before ${JSON.stringify(before.counts)}; after ${JSON.stringify(after.counts)}`);
  }
});
