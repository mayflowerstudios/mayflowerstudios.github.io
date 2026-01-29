import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, "data", "changelogs.json");
const TEMPLATE_PATH = path.join(ROOT, "tools", "changelog-template.html");

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function listBlock(label, items) {
  if (!items || items.length === 0) return "";
  const lines = items.map(x => `• ${esc(x)}`).join("<br>\n");
  return `<strong>${label}:</strong> ${lines}<br>\n`;
}

function entryHTML(v) {
  const version = esc(v.version);
  const badge = v.badge ? ` <span class="badge">${esc(v.badge)}</span>` : "";
  const date = v.date ? `<span class="muted" style="margin-left:.5rem;">(${esc(v.date)})</span>` : "";

  const blocks =
    listBlock("Added", v.added) +
    listBlock("Changed", v.changed) +
    listBlock("Fixed", v.fixed) +
    listBlock("Stability", v.stability) +
    listBlock("Known Issues", v.knownIssues);

  const body = blocks.trim().length ? blocks : `<span class="muted">No notes provided.</span>`;

  return `
<h3>v${version}${badge} ${date}</h3>
<p class="muted">
  ${body}
</p>`.trim();
}

function buildForMod(mod, template) {
  const versions = [...(mod.versions ?? [])];

  versions.sort((a, b) => {
    const ad = a.date ? Date.parse(a.date) : NaN;
    const bd = b.date ? Date.parse(b.date) : NaN;
    if (!Number.isNaN(ad) && !Number.isNaN(bd)) return bd - ad;
    return String(b.version).localeCompare(String(a.version), undefined, { numeric: true });
  });

  const entries = versions.map(entryHTML).join("\n<hr class=\"sep\">\n");

  const out = template
    .replaceAll("{{TITLE}}", esc(`${mod.name} Changelog • Mayflower Studios`))
    .replaceAll("{{KICKER}}", esc(mod.kicker ?? "Minecraft Mod"))
    .replaceAll("{{EMOJI}}", esc(mod.emoji ?? "🧾"))
    .replaceAll("{{NAME}}", esc(mod.name ?? mod.id))
    .replaceAll("{{BACK_HREF}}", esc(mod.backHref ?? `${mod.id}.html`))
    .replaceAll("{{DOWNLOAD_HREF}}", esc(mod.downloadHref ?? "#"))
    .replaceAll("{{ENTRIES}}", entries || `<p class="muted">No releases yet.</p>`);

  const outPath = path.join(ROOT, mod.output ?? `${mod.id}changelog.html`);
  fs.writeFileSync(outPath, out, "utf8");
  console.log(`✅ Wrote ${path.relative(ROOT, outPath)}`);
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const mods = data.mods ?? [];
  for (const mod of mods) buildForMod(mod, template);
}

main();
