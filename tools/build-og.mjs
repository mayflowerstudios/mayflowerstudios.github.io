// tools/build-og.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const SITE = "https://mayflowerstudios.net";
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "assets", "og");

const OG_START = "<!-- OG:START -->";
const OG_END = "<!-- OG:END -->";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function escAttr(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getTitle(html, fallback) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return (m?.[1] || fallback).trim();
}

function getDescription(html) {
  const m = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']\s*\/?>/i
  );
  return (m?.[1] || "").trim();
}

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const ent of entries) {
    const p = path.join(dir, ent.name);

    if (ent.isDirectory()) {
      if (ent.name === ".git" || ent.name === "node_modules") continue;
      out.push(...walk(p));
      continue;
    }

    if (!ent.isFile()) continue;
    if (!ent.name.endsWith(".html")) continue;

    // skip admin pages
    if (ent.name.startsWith("admin-")) continue;

    out.push(p);
  }

  return out;
}

function listHtmlPages() {
  return walk(ROOT);
}

function ogMeta({ title, description, url, imageUrl }) {
  return `<!-- OG:START -->
<meta name="description" content="${escAttr(description)}" />
<meta property="og:title" content="${escAttr(title)}" />
<meta property="og:description" content="${escAttr(description)}" />
<meta property="og:url" content="${escAttr(url)}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${escAttr(imageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escAttr(title)}" />
<meta name="twitter:description" content="${escAttr(description)}" />
<meta name="twitter:image" content="${escAttr(imageUrl)}" />
<!-- OG:END -->`;
}

function ogCardHtml({ title, description, pagePath }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root{
    --bg1:#060b14; --bg2:#0b1022;
    --text:#fff2f6; --muted:rgba(255,242,246,.75);
    --accent:#fb7185; --accent2:#a78bfa;
  }
  html,body{margin:0;padding:0;width:1200px;height:630px;}
  body{
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background:
      radial-gradient(900px 600px at 18% 22%, rgba(251,113,133,.35), transparent),
      radial-gradient(900px 600px at 85% 75%, rgba(167,139,250,.25), transparent),
      linear-gradient(180deg,var(--bg1),var(--bg2));
    color:var(--text);
  }
  .wrap{
    padding:70px 72px;
    height:100%;
    box-sizing:border-box;
    display:flex;
    flex-direction:column;
    gap:18px;
  }
  .brand{
    font-weight:800;
    letter-spacing:.08em;
    text-transform:uppercase;
    color:rgba(255,242,246,.72);
    display:flex;
    gap:10px;
    align-items:center;
  }
  .title{
    font-size:64px;
    line-height:1.05;
    margin:0;
    font-weight:900;
  }
  .desc{
    font-size:26px;
    line-height:1.35;
    color:rgba(255,242,246,.78);
    max-width:980px;
  }
  .pill{
    margin-top:auto;
    display:inline-flex;
    gap:12px;
    align-items:center;
    padding:12px 16px;
    border:1px solid rgba(255,255,255,.14);
    border-radius:999px;
    background: rgba(255,255,255,.06);
    width: fit-content;
    font-weight:700;
  }
  .url{
    color:rgba(255,242,246,.7);
    font-weight:700;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">🌸 Mayflower Studios</div>
    <h1 class="title">${escAttr(title)}</h1>
    <div class="desc">${escAttr(description)}</div>
    <div class="pill">✨ ${escAttr(pagePath)} <span class="url">• ${escAttr(
    SITE.replace("https://", "")
  )}</span></div>
  </div>
</body>
</html>`;
}

function makePagePathFromFile(filePathAbs) {
  // Convert absolute path -> repo-relative URL path
  // e.g. /repo/mods/steelhold.html -> /mods/steelhold.html
  const rel = path.relative(ROOT, filePathAbs).replaceAll(path.sep, "/");
  return rel === "index.html" ? "/" : `/${rel}`;
}

function makeSlugFromPagePath(pagePath) {
  // Unique + filesystem-safe:
  // "/" -> "home"
  // "/mods/steelhold.html" -> "mods__steelhold"
  if (pagePath === "/") return "home";
  return pagePath
    .replace(/^\//, "")
    .replace(/\.html$/i, "")
    .replaceAll("/", "__");
}

async function main() {
  ensureDir(OUT_DIR);
  const files = listHtmlPages();

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  for (const filePath of files) {
    const html = fs.readFileSync(filePath, "utf8");

    const pagePath = makePagePathFromFile(filePath);
    const url = `${SITE}${pagePath}`;

    const title = getTitle(html, "Mayflower Studios");
    let description = getDescription(html);

    if (!description) {
      description =
        "Cozy mods, bots, and worlds built with heart — designed for long-term communities.";
    }

    const slug = makeSlugFromPagePath(pagePath);
    const outPngRel = `/assets/og/${slug}.png`;
    const outPngAbs = path.join(OUT_DIR, `${slug}.png`);

    // 1) Render OG image
    await page.setContent(ogCardHtml({ title, description, pagePath }), {
      waitUntil: "load",
    });
    await page.screenshot({ path: outPngAbs, type: "png" });

    // 2) Inject OG tags into HTML head (only if markers exist)
    const imageUrl = `${SITE}${outPngRel}`;
    const block = ogMeta({ title, description, url, imageUrl });

    if (!html.includes(OG_START) || !html.includes(OG_END)) {
      console.warn(
        `[OG] ${pagePath}: missing OG markers, skipping injection (image still generated).`
      );
      console.warn(`     Add these inside <head>: ${OG_START} ... ${OG_END}`);
      continue;
    }

    const updated = html.replace(
      new RegExp(`${OG_START}[\\s\\S]*?${OG_END}`, "m"),
      block
    );

    fs.writeFileSync(filePath, updated, "utf8");
    console.log(`[OG] ${pagePath}: ${outPngRel}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
