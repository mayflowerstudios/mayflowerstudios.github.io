const el = (id) => document.getElementById(id);

function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makeBtn(btn) {
  const a = document.createElement("a");
  a.className = btn.class || "button ghost";
  a.href = btn.href || "#";
  a.textContent = btn.label || "Link";
  return a;
}

function makeProjectCard(p) {
  const div = document.createElement("div");
  div.className = "card";

  // Small badge in the title, matching your existing style
  const badge = p.type === "mod" ? "Minecraft Mod" : (p.type === "bot" ? "Discord Bot" : "");
  const badgeHtml = badge ? ` <span class="badge">${escHtml(badge)}</span>` : "";

  div.innerHTML = `
    <h3>${escHtml(p.title || p.slug)}${badgeHtml}</h3>
    <p class="desc">${escHtml(p.desc || "")}</p>
    <div class="btnrow"></div>
  `;

  const row = div.querySelector(".btnrow");
  (p.links || []).forEach(b => row.appendChild(makeBtn(b)));

  return div;
}

async function loadProjects() {
  const modsGrid = el("modsGrid");
  const botsGrid = el("botsGrid");
  if (!modsGrid || !botsGrid) return;

  try {
    const res = await fetch("/data/projects.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const mods = Array.isArray(data.mods) ? data.mods : [];
    const bots = Array.isArray(data.bots) ? data.bots : [];

    modsGrid.innerHTML = "";
    botsGrid.innerHTML = "";

    mods.forEach(p => modsGrid.appendChild(makeProjectCard(p)));
    bots.forEach(p => botsGrid.appendChild(makeProjectCard(p)));

  } catch (err) {
    // Soft fail: keep page usable.
    console.warn("Projects auto-build failed:", err);
    const msg = document.createElement("div");
    msg.className = "card";
    msg.innerHTML = `
      <h3>⚠️ Couldn’t load the projects index</h3>
      <p class="desc">If you’re seeing this locally, make sure <code>/data/projects.json</code> exists. On GitHub Pages, it will be generated automatically by the workflow.</p>
    `;
    modsGrid?.appendChild(msg.cloneNode(true));
    botsGrid?.appendChild(msg);
  }
}

document.addEventListener("DOMContentLoaded", loadProjects);
