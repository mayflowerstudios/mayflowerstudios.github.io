// Run with: node --test tools/site.test.mjs
// Exercise the static site's generated routes and data-backed homepage without
// signing into a live account or writing to the production database.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const exists = path => fs.existsSync(new URL(path.replace(/^\//, ''), root));
const retired = /sakari|idle-rpg/i;

function localTargets(html) {
  return [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&'))
    .filter(url => url.startsWith('/') && !url.startsWith('//'));
}
function assertTargets(html) {
  for (const target of localTargets(html)) {
    const url = new URL(target, 'https://mayflowerstudios.net');
    const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    assert.ok(exists(path), `Missing local target: ${target}`);
    assert.doesNotMatch(target, retired, `Retired target: ${target}`);
  }
}
function renderProject(search = '') {
  const html = read('projects.html');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(js => js.includes('function renderIndex'));
  const mount = { innerHTML: '' };
  const document = { getElementById: () => mount, addEventListener() {}, title: '' };
  vm.runInNewContext(script, { document, location: { search }, window: { addEventListener() {}, scrollTo() {} }, URLSearchParams });
  return { html: mount.innerHTML, title: document.title };
}

test('every active project is discoverable and catalogue links resolve', () => {
  const { html } = renderProject();
  for (const name of ['Mayflower Radio','Craft Planner','Steelhold','LogiChest','The Gentle Creeper','Amumu Curse','Farm Challenge','BloomBot']) {
    assert.ok(html.includes(name), `${name} is missing from the catalogue`);
  }
  assert.doesNotMatch(html, retired);
  assertTargets(html);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`), `Missing category ${id}`);
});

for (const slug of ['steelhold','logichest','gentlecreeper','amumucurse']) {
  test(`${slug}: overview and changelog routes still render their project`, () => {
    for (const suffix of ['', '&view=changelog']) {
      const result = renderProject(`?mod=${slug}${suffix}`);
      assert.ok(result.title.includes('Mayflower Studios'));
      assert.match(result.html, /<h1>/);
      assert.match(result.html, /curseforge\.com/);
      assert.doesNotMatch(result.html, retired);
    }
  });
}

test('unknown project routes recover to the active catalogue', () => {
  const { html } = renderProject('?mod=does-not-exist');
  assert.ok(html.includes('project-intro'));
  assertTargets(html);
});

test('main navigation and footer expose only active sections', () => {
  const source = read('shared.js');
  const start = source.indexOf('  function buildNav()');
  const end = source.indexOf('  /* Supports both new', start);
  assert.ok(start >= 0 && end > start);
  for (const key of ['home','worlds','projects','together','radio','contact']) {
    const context = { document: { body: { dataset: { nav: key } } }, buildLangPicker: () => '' };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    const nav = vm.runInContext('buildNav()', context);
    const footer = vm.runInContext('buildFooter()', context);
    assert.equal((nav.match(/aria-current="page"/g) || []).length, 1);
    assertTargets(nav + footer);
    assert.doesNotMatch(nav + footer, retired);
    assert.match(nav, /aria-controls="navLinks"/);
  }
});

test('homepage and shared skin have valid assets, with retired pages unlisted', () => {
  assertTargets(read('index.html'));
  for (const file of ['worlds.html','together.html','contact.html','account.html','radio/index.html']) {
    assert.ok(read(file).includes('/studio.css?v=3'), `${file} is missing the shared theme`);
  }
  assert.doesNotMatch(read('sitemap.xml'), retired);
  assert.doesNotMatch(read('contact.js'), retired);
  for (const file of ['mayflower-idle-rpg.html','sakari.html','sakari/reader.html']) {
    assert.match(read(file), /noindex/);
    assert.match(read(file), /http-equiv="refresh" content="0; url=\/projects.html"/);
    assert.doesNotMatch(read(file), /\.exe|sakari_engine|leaderboard/);
  }
  assert.ok(!exists('downloads/MayflowerIdleRPG_v1.1.0_LivingChronicle.exe'));
});

async function featured(data) {
  const section = { hidden: true }, grid = { innerHTML: '' };
  vm.runInNewContext(read('home-worlds.js'), {
    document: { getElementById: id => id === 'featured-worlds' ? section : grid },
    location: { origin: 'https://mayflowerstudios.net' }, URL, Intl,
    fetch: async () => ({ ok: true, json: async () => data }), console
  });
  await new Promise(setImmediate);
  return { section, html: grid.innerHTML };
}
test('featured worlds handle empty, single, and multiple records without dead slots', async () => {
  assert.equal((await featured(null)).section.hidden, true);
  const data = Object.fromEntries([1,2,3,4].map(n => [`world-${n}`, { title: `World ${n}`, published: true, featured: true, updatedAt: n }]));
  const multiple = await featured(data);
  assert.equal(multiple.section.hidden, false);
  assert.equal((multiple.html.match(/<article/g) || []).length, 3);
  assert.ok(multiple.html.indexOf('World 4') < multiple.html.indexOf('World 3'));
  const single = await featured({ demo: { title: '<Demo>', published: true, featured: true, images: [{ url: 'javascript:alert(1)' }] } });
  assert.equal((single.html.match(/<article/g) || []).length, 1);
  assert.match(single.html, /&lt;Demo&gt;/);
  assert.doesNotMatch(single.html, /javascript:|<Demo>/);
});
