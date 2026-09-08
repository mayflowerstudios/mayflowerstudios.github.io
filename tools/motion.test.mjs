import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../shared.js', import.meta.url), 'utf8');
const start = source.indexOf('  function initReveal()');
const end = source.indexOf('  // ───', start);
function setup({ reduced = false, observer = true, saveData = false } = {}) {
  const classes = new Set(), events = {}, watched = new Set();
  const section = { classList: { add: name => classes.add(name) } };
  let intersect;
  class Observer {
    constructor(callback) { intersect = callback; }
    observe(target) { watched.add(target); }
    unobserve(target) { watched.delete(target); }
  }
  class Image {
    constructor() { this.classes = new Set(); this.classList = { add: name => this.classes.add(name) }; }
    matches() { return true; }
  }
  const context = {
    window: { matchMedia: () => ({ matches: reduced }), ...(observer ? { IntersectionObserver: Observer } : {}) },
    document: {
      documentElement: { matches: () => saveData },
      querySelectorAll: () => [section],
      addEventListener: (name, fn) => { events[name] = fn; },
    },
    IntersectionObserver: Observer, HTMLImageElement: Image,
  };
  vm.runInNewContext(source.slice(start, end) + '\ninitReveal(); initImageMotion();', context);
  return { classes, events, watched, section, Image, enter: () => intersect([{ isIntersecting: true, target: section }]) };
}

test('reveals remain readable without observers and with reduced motion or data saving', () => {
  for (const options of [{ observer: false }, { reduced: true }, { saveData: true }]) {
    const state = setup(options);
    assert.ok(state.classes.has('visible'));
    assert.equal(state.classes.has('mf-arrive'), false);
    assert.equal(state.watched.size, 0);
  }
});

test('entering a section reveals it once and releases its observation', () => {
  const state = setup();
  assert.equal(state.watched.size, 1);
  state.enter();
  assert.ok(state.classes.has('visible'));
  assert.ok(state.classes.has('mf-arrive'));
  assert.equal(state.watched.size, 0);
});

test('keyboard focus reveals legacy sections immediately', () => {
  const state = setup();
  state.events.focusin({ target: { closest: () => state.section } });
  assert.ok(state.classes.has('visible'));
  assert.equal(state.watched.size, 0);
});

test('delegated image load handles later world images without scanning or hiding them', () => {
  const state = setup();
  const image = new state.Image();
  assert.equal(image.classes.size, 0);
  state.events.load({ target: image });
  assert.ok(image.classes.has('mf-image-ready'));
  state.events.load({ target: {} });
});
