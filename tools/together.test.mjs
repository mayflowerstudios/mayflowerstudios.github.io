import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

for (const page of ['together.html', 'watch-together.html']) {
  test(`${page}: inline scripts parse and fixed DOM references exist`, () => {
    const html = read(page);
    const markup = html.slice(0, html.indexOf('<script type="module">'));
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'duplicate element IDs');
    for (const [, js] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
      if (!js.trim()) continue;
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input:js, encoding:'utf8' });
      assert.equal(result.status, 0, result.stderr);
      // Some player overlays are created on first use.
      const dynamic = new Set([...js.matchAll(/(?:\.id\s*=\s*"|\bid=")([^"]+)"/g)].map(m => m[1]));
      for (const [, id] of js.matchAll(/\$\("([^"]+)"\)/g)) {
        assert.ok(ids.includes(id) || dynamic.has(id), `missing #${id}`);
      }
    }
    assert.doesNotMatch(html, /copyRoomBtn|copyLink\(|data-act="copy"/);
  });
}

test('Together only creates and lists watch rooms, with all privacy choices', () => {
  const lobby = read('together.html');
  assert.match(lobby, /type: "watch", vis: selVis/);
  assert.match(lobby, /r\.type === "watch"/);
  assert.match(lobby, /invites\[id\]\.type === "watch"/);
  for (const vis of ['public','friends','private']) assert.ok(lobby.includes(`data-vis="${vis}"`));
  assert.doesNotMatch(lobby, /data-type="(?:games|date|learn)"|href="\/(?:companion|server)\.html"/);
});
