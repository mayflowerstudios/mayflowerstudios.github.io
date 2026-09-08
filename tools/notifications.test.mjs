// No production account or database access. Exercise the actual notification
// handlers with Firebase child events, burst updates, and delayed auth requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../notification-center.js', import.meta.url), 'utf8');
function harness({ page = false } = {}) {
  const elements = new Map(), timers = new Map(), listeners = [], events = new Map(), writes = [];
  let nextTimer = 0;
  function element(id) {
    const e = { id, textContent: '', hidden: false, disabled: false, renders: 0, scrollTop: 0,
      _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; this.renders++; },
      setAttribute(k,v) { this[k] = v; }, querySelectorAll() { return []; },
      addEventListener(type, fn) { this[type] = fn; }, after(other) { elements.set(other.id, other); },
    };
    if (id) elements.set(id, e);
    return e;
  }
  for (const id of ['mfNotifyButton','mfNotifyBadge','mfNotifyPanel','mfNotifyList','mfNotifySummary','mfNotifyMarkAll']) element(id);
  if (page) for (const id of ['mfNotificationPageList','mfNotificationPageCount','mfNotificationPageMarkAll','mfNotificationPrev','mfNotificationNext']) element(id);
  const document = { hidden: false, getElementById: id => elements.get(id), createElement: () => element(), addEventListener(type, fn) { events.set(type, fn); } };
  const listen = kind => (q, fn) => {
    const sub = { kind, q, fn, active: true }; listeners.push(sub);
    return () => { sub.active = false; };
  };
  const firebase = {
    ref: (_, path = '') => path, orderByChild: key => key, query: (path, order) => ({path,order}),
    onChildAdded: listen('add'), onChildChanged: listen('change'), onChildRemoved: listen('remove'),
    set: async (path, value) => { writes.push({path,value}); }, update: async (path, value) => { writes.push({path,value}); },
  };
  const MFAuth = { db: {}, user: {uid:'alice'}, getNotificationPrefs: async () => null };
  const window = { MFAuth, addEventListener(type, fn) { events.set(type, fn); } };
  const code = source.replace(/import\(`https:[^`]+`\)/, 'Promise.resolve(firebase)')
    .replace('if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();',
      'window.test = { readyAuth, draw, drawPage, wirePage, visibleRows, retained: () => records.size };');
  vm.runInNewContext(code, { window, document, MFAuth, firebase, console,
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id),
  });
  const emit = (kind, id, value, uid = 'alice') => {
    for (const s of listeners) if (s.active && s.kind === kind && s.q.path === `notifications/${uid}`) s.fn({key:id,val:()=>value});
  };
  const flush = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); };
  return { api: window.test, publicApi: window.MFNotifications, elements, timers, listeners, firebase, MFAuth, document, emit, flush, events, writes };
}
const row = n => ({title:`Notification ${n}`, createdAt:n, readAt:0, type:'gift'});
const itemCount = node => (node.innerHTML.match(/data-notification-id=/g) || []).length;

test('10,000 history records retain only unread data and do not render a closed bell', async () => {
  const h = harness(); await h.api.readyAuth(h.MFAuth.user);
  for (let i = 0; i < 10000; i++) h.emit('add', `n${i}`, {...row(i), readAt: i % 10 ? 123 : 0});
  assert.equal(h.api.retained(), 1000);
  assert.equal(h.timers.size, 1, 'initial snapshot burst has one scheduled paint');
  h.flush();
  assert.equal(h.elements.get('mfNotifyList').renders, 0);
  assert.equal(h.elements.get('mfNotifyBadge').textContent, '99+');
  h.publicApi.open();
  assert.equal(itemCount(h.elements.get('mfNotifyList')), 30);
  assert.match(h.elements.get('mfNotifySummary').textContent, /1000 unread/);
});

test('full inbox paginates every older unread item with at most 50 rendered rows', async () => {
  const h = harness({page:true}); h.api.wirePage(); await h.api.readyAuth(h.MFAuth.user);
  for (let i = 0; i < 125; i++) h.emit('add', `n${i}`, row(i));
  h.flush(); const list = h.elements.get('mfNotificationPageList');
  assert.equal(itemCount(list), 50); assert.match(list.innerHTML, /data-notification-id="n124"/);
  h.elements.get('mfNotificationNext').click(); assert.equal(itemCount(list), 50);
  h.elements.get('mfNotificationNext').click(); assert.equal(itemCount(list), 25);
  assert.match(list.innerHTML, /data-notification-id="n0"/);
  assert.equal(h.elements.get('mfNotificationNext').disabled, true);
  h.elements.get('mfNotificationPrev').click(); assert.equal(itemCount(list), 50);
});

test('child changes/removals and preference changes update the count without duplicating rows', async () => {
  const h = harness(); await h.api.readyAuth(h.MFAuth.user);
  h.emit('add','a',row(1)); h.emit('add','b',row(2)); h.emit('add','a',row(1)); h.flush();
  assert.equal(h.api.visibleRows().length, 2);
  h.emit('change','a',{...row(1),readAt:10}); h.emit('remove','b',null); h.flush();
  assert.equal(h.api.visibleRows().length, 0); assert.equal(h.api.retained(), 0);
  h.emit('add','c',row(3)); h.flush();
  h.events.get('mf-notification-prefs-changed')({detail:{gifts:false}});
  assert.equal(h.api.visibleRows().length, 0);
  h.events.get('mf-notification-prefs-changed')({detail:{gifts:true}});
  assert.equal(h.api.visibleRows().length, 1);
});

test('profile emissions reuse subscriptions, account switches detach them and reject late events', async () => {
  const h = harness(); await h.api.readyAuth(h.MFAuth.user);
  for (let i = 0; i < 10; i++) await h.api.readyAuth(h.MFAuth.user);
  assert.equal(h.listeners.length, 3);
  const old = h.listeners[0];
  await h.api.readyAuth({uid:'bob'});
  assert.equal(h.listeners.filter(s=>s.active).length, 3);
  old.fn({key:'stale',val:()=>row(99)}); h.flush(); assert.equal(h.api.retained(), 0);
  await h.api.readyAuth(null); assert.equal(h.listeners.filter(s=>s.active).length, 0);
});

test('hidden tabs defer rendering and refresh current data on return', async () => {
  const h = harness({page:true}); await h.api.readyAuth(h.MFAuth.user);
  const list = h.elements.get('mfNotificationPageList'), before = list.renders;
  h.document.hidden = true;
  for (let i = 0; i < 100; i++) h.emit('add',`n${i}`,row(i));
  h.flush(); assert.equal(list.renders, before); assert.equal(h.timers.size, 0);
  h.document.hidden = false; h.api.draw();
  assert.equal(itemCount(list), 50); assert.match(h.elements.get('mfNotificationPageCount').textContent,/100 unread/);
});

test('mark all read includes older unread items and rolls back a failed write', async () => {
  const h = harness(); await h.api.readyAuth(h.MFAuth.user);
  for (let i = 0; i < 125; i++) h.emit('add',`n${i}`,row(i)); h.flush();
  h.firebase.update = async (_, updates) => { assert.equal(Object.keys(updates).length,125); throw Error('offline'); };
  await h.publicApi.markAllRead(); assert.equal(h.api.visibleRows().length, 125);
});

test('a delayed preference response cannot filter another account', async () => {
  const h = harness(); let resolve;
  h.MFAuth.getNotificationPrefs = () => new Promise(r=>{resolve=r;});
  await h.api.readyAuth(h.MFAuth.user);
  h.MFAuth.getNotificationPrefs = async () => ({gifts:true});
  await h.api.readyAuth({uid:'bob'});
  resolve({gifts:false}); await new Promise(setImmediate);
  h.emit('add','b',row(1),'bob'); h.flush(); assert.equal(h.api.visibleRows().length,1);
});
