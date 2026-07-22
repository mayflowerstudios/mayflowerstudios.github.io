// tools/build-sitemap.mjs
import fs from "node:fs";
import path from "node:path";

const SITE = (process.env.SITE || "https://mayflowerstudios.net").replace(/\/+$/, "");
const ROOT = process.cwd();
const OUT = path.join(ROOT, "sitemap.xml");

// Folders we never want to crawl for pages
const SKIP_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  "tools",
  "partials",
  "assets",
  "data"
]);

// File patterns to exclude (admin, drafts, etc.)
function shouldSkipFile(relPath, fileName, absPath) {
  const rel = relPath.replace(/\\/g, "/");

  // Skip admin pages anywhere
  if (fileName.startsWith("admin-")) return true;
  if (rel.startsWith("admin/")) return true;

  // Skip templates/partials if you have any .html hiding there
  if (rel.startsWith("partials/")) return true;

  // Never list utility / dynamic-app pages we don't want indexed
  const ALWAYS_SKIP = new Set([
    "404.html", "watch.html", "account.html",
    "watch-together.html", "together-room.html", "date-night.html",
  ]);
  if (ALWAYS_SKIP.has(rel)) return true;

  // Auto-skip anything explicitly marked noindex, so the sitemap can never
  // disagree with a page's own robots meta tag.
  try {
    const head = fs.readFileSync(absPath, "utf8").slice(0, 4000);
    if (/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(head)) return true;
  } catch (_) {}

  return false;
}

function walk(dirAbs) {
  const out = [];
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = path.join(dirAbs, entry.name);
    const rel = path.relative(ROOT, abs);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(abs));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".html")) continue;
    if (shouldSkipFile(rel, entry.name, abs)) continue;

    out.push(rel.replace(/\\/g, "/"));
  }
  return out;
}

function toUrl(relPath) {
  // Root index.html becomes site root
  if (relPath === "index.html") return `${SITE}/`;

  // A subfolder's index.html becomes the folder URL (matches canonical tags)
  if (relPath.endsWith("/index.html"))
    return `${SITE}/${relPath.slice(0, -"index.html".length)}`;

  // Any other html file becomes /file.html (or /subdir/file.html)
  return `${SITE}/${relPath}`;
}

function xmlEscape(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSitemap(urls) {
  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);

  for (const u of urls) {
    lines.push(`  <url>`);
    lines.push(`    <loc>${xmlEscape(u)}</loc>`);
    lines.push(`  </url>`);
  }

  lines.push(`</urlset>`);
  lines.push(""); // newline at end
  return lines.join("\n");
}

const files = walk(ROOT)
  // Optional: stable ordering
  .sort((a, b) => a.localeCompare(b, "en"));

const urls = files.map(toUrl);

const xml = buildSitemap(urls);
fs.writeFileSync(OUT, xml, "utf8");

console.log(`✅ Wrote ${path.relative(ROOT, OUT)} with ${urls.length} URLs`);
