// Exercise the production queue handler without a browser or live Firebase writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../watch-together.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('    let advancing = false;'), html.indexOf('    function renderHistory('));
const item = (src, t = 0, kind = 'yt') => ({ kind, src, title: src, t, by: 'Viewer' });

function queueHarness(queue, options = {}) {
  let now = 100000, nextKey = 0, claim = null;
  const timers = [], played = [], messages = [];
  const queuePath = 'watch/test/queue';
  let replays = 0;
  const context = {
    queueCache: structuredClone(queue), queueRef: queuePath,
    currentKind: options.kind || 'yt', currentSrc: 'A', currentTitle: 'A',
    repeatMode: options.repeat || 'all', neverStop: !!options.neverStop,
    FIREBASE_READY: true, db: {}, ROOM: 'test', clientId: 'viewer', myName: 'Viewer',
    Date: { now: () => now }, console,
    setTimeout(fn, delay) { timers.push({ fn, at: now + delay }); },
    ref: (_, path) => path,
    get: async () => ({ val: () => claim }),
    set: async (_, value) => { claim = value; },
    remove: async path => {
      if (path.startsWith(queuePath + '/')) delete context.queueCache[path.slice(queuePath.length + 1)];
      else claim = null;
    },
    push: (_, value) => {
      const entry = { key: 'new-' + (++nextKey) };
      if (value !== undefined) context.queueCache[entry.key] = structuredClone(value);
      return entry;
    },
    update: async (path, changes) => {
      assert.equal(path, queuePath);
      if (options.beforeUpdate) await options.beforeUpdate();
      if (options.failUpdate) throw new Error('Permission denied');
      const next = structuredClone(context.queueCache);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) delete next[key];
        else next[key] = structuredClone(value);
      }
      context.queueCache = next;
    },
    removeQueued: key => context.remove(queuePath + '/' + key),
    startSource: ({ kind, src }) => {
      played.push(src);
      context.currentKind = kind;
      context.currentSrc = src;
      context.currentTitle = src;
      vm.runInContext('lastAdvancedFrom = null;', context);
    },
    toast: message => messages.push(message),
    broadcast() {},
    player: { seekTo() { replays++; }, playVideo() {} },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    context, played, messages,
    get replays() { return replays; },
    end: (src = context.currentSrc) => context.advanceQueue(src),
    queued: () => Object.values(context.queueCache).sort((a, b) => a.t - b.t).map(it => it.src || it.videoId),
    elapse(ms = 5000) {
      now += ms;
      for (const timer of timers.splice(0)) {
        if (timer.at <= now) timer.fn(); else timers.push(timer);
      }
    },
  };
}

test('Repeat All skips a queued copy of the finished video and retains one copy at the back', async () => {
  const h = queueHarness({ duplicate: item('A'), next: item('B', 1), last: item('C', 2) });
  await h.end();
  assert.deepEqual(h.played, ['B']);
  assert.deepEqual(h.queued(), ['C', 'A']);
});

test('Repeat All cycles the full reordered queue even when its timestamps are in the future', async () => {
  const h = queueHarness({ next: item('B', 120000), last: item('C', 140000) });
  for (let i = 0; i < 6; i++) {
    await h.end();
    assert.equal(h.queued().length, 2, 'keep every other video in the cycle');
    h.elapse();
  }
  assert.deepEqual(h.played, ['B', 'C', 'A', 'B', 'C', 'A']);
});

test('Repeat Off consumes duplicates and advances without re-adding the finished video', async () => {
  const h = queueHarness({ duplicate: item('A'), next: item('B', 1) }, { repeat: 'off' });
  await h.end();
  assert.deepEqual(h.played, ['B']);
  assert.deepEqual(h.queued(), []);
  h.elapse();
  await h.end();
  assert.equal(h.replays, 0);
});

test('Repeat One leaves the queue untouched and can replay more than once', async () => {
  const h = queueHarness({ next: item('B') }, { repeat: 'one' });
  for (let i = 0; i < 3; i++) { await h.end(); h.elapse(); }
  assert.equal(h.replays, 3);
  assert.deepEqual(h.queued(), ['B']);
  assert.deepEqual(h.played, []);
});

test('Repeat All with only the current video removes stale duplicates and keeps replaying', async () => {
  const h = queueHarness({ duplicate: item('A'), otherDuplicate: item('A', 1) });
  for (let i = 0; i < 3; i++) { await h.end(); h.elapse(); }
  assert.equal(h.replays, 3);
  assert.deepEqual(h.queued(), []);
  assert.deepEqual(h.played, []);
});

test('legacy video IDs and mixed media still advance in order', async () => {
  const h = queueHarness({ legacy: { videoId: 'B', t: 0 }, file: item('movie.mp4', 1, 'file') });
  await h.end();
  h.elapse();
  await h.end();
  assert.deepEqual(h.played, ['B', 'movie.mp4']);
  assert.equal(h.context.currentKind, 'file');
  assert.deepEqual(h.queued(), ['A', 'B']);
});

test('failed queue writes keep the current video and queue intact and show an error', async () => {
  const h = queueHarness({ next: item('B') }, { failUpdate: true });
  await h.end();
  assert.deepEqual(h.played, []);
  assert.deepEqual(h.queued(), ['B']);
  assert.equal(h.context.currentSrc, 'A');
  assert.equal(h.messages.length, 1);
});

test('queue rotation completes before playback starts and duplicate end events cannot skip ahead', async () => {
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const updating = new Promise(resolve => { entered = resolve; });
  const h = queueHarness({ next: item('B'), last: item('C', 1) }, {
    beforeUpdate: () => { entered(); return gate; },
  });
  const first = h.end();
  await updating;
  await h.end();
  assert.deepEqual(h.played, []);
  assert.deepEqual(h.queued(), ['B', 'C']);
  release();
  await first;
  assert.deepEqual(h.played, ['B']);
  assert.deepEqual(h.queued(), ['C', 'A']);
});
