import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHANGELOGS_PATH = path.join(ROOT, "data", "changelogs.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMetaDescription(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : "";
}

function pickFirstHeading(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return m ? stripTags(m[1]) : "";
}

function fileExists(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
}

function buildMods() {
  const dir = path.join(ROOT, "data", "mods");
  if (!fileExists(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  return files.map(f => {
    const p = path.join(dir, f);
    const j = readJson(p);

    const slug = j.slug || path.basename(f, ".json");
    const title = (j.title || slug).replace(/•.*$/, "").trim();
    const emojiName = (j.emojiName || "").trim();
    const display = (emojiName || title);

    // CTAs from the mod page schema
    const ctas = Array.isArray(j.cta) ? j.cta : [];
    const download = ctas.find(x => /curseforge|modrinth|download/i.test(x?.label || "") || /curseforge|modrinth/i.test(x?.href || ""))?.href || "";
    const projectPage = `/mods/${slug}.html`;

    const changelogUrl = `/mods/changelog.html?mod=${slug}`;

    // Only show changelog button if the mod exists in data/changelogs.json (and has at least 1 version).
    let changelog = "";
    try {
      const cl = readJson(CHANGELOGS_PATH);
      const mods = Array.isArray(cl?.mods) ? cl.mods : [];
      const m = mods.find(x => String(x?.id || "").toLowerCase() === String(slug).toLowerCase());
      if (m && Array.isArray(m.versions) && m.versions.length > 0) changelog = changelogUrl;
    } catch {}

    return {
      type: "mod",
      slug,
      title: display,
      desc: j.tagline || stripTags(j.descriptionHtml).slice(0, 160),
      links: [
        { label: "📄 Project Page", href: projectPage, class: "button mods" },
        ...(changelog ? [{ label: "🧾 Changelog", href: changelog, class: "button ghost" }] : []),
        ...(download ? [{ label: "📦 Download", href: download, class: "button ghost" }] : [])
      ]
    };
  });
}

function buildBots() {
  const dir = path.join(ROOT, "bots");
  if (!fileExists(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".html")).sort();
  return files.map(f => {
    const p = path.join(dir, f);
    const html = fs.readFileSync(p, "utf8");

    const slug = path.basename(f, ".html");
    const title = pickFirstHeading(html) || html.match(/<title>([^<]+)<\/title>/i)?.[1]?.replace(/\s*•.*$/, "")?.trim() || slug;
    const desc = pickMetaDescription(html) || "";

    // If the bot page already contains obvious extra links, you can hardcode rules here.
    const links = [{ label: "📄 Info Page", href: `/bots/${slug}.html`, class: "button bots" }];
    if (slug.toLowerCase().includes("echobloom")) {
      links.push({ label: "📜 Lore Page", href: "/lore.html", class: "button ghost" });
    }

    return { type: "bot", slug, title, desc, links };
  });
}

const mods = buildMods();
const bots = buildBots();

const out = {
  generatedAt: new Date().toISOString(),
  mods,
  bots
};

fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data", "projects.json"), JSON.stringify(out, null, 2) + "\n", "utf8");

console.log(`Wrote data/projects.json (${mods.length} mods, ${bots.length} bots)`);
