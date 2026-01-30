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
  a.className = btn.class || "btn ghost";
  a.href = btn.href || "#";
  a.textContent = btn.label || "Link";
  return a;
}

function makeTile(t) {
  const div = document.createElement("div");
  div.className = "tile";
  div.innerHTML = `<strong>${escHtml(t.title)}</strong><p>${escHtml(t.body)}</p>`;
  return div;
}

function makeCardBlock(card) {
  const div = document.createElement("div");
  div.className = "card";
  const badge = card.badge ? ` <span class="badge">${escHtml(card.badge)}</span>` : "";
  const bullets = (card.bullets || []).map(b => `<li>${escHtml(b)}</li>`).join("");
  div.innerHTML = `
    <h3>${escHtml(card.title)}${badge}</h3>
    <p class="desc">${escHtml(card.desc || "")}</p>
    ${bullets ? `<ul>${bullets}</ul>` : ""}
  `;
  return div;
}

function makeSimpleCard(card) {
  const div = document.createElement("div");
  div.className = "card";
  const bullets = (card.bullets || []).map(b => `<li>${escHtml(b)}</li>`).join("");
  div.innerHTML = `
    <h3>${escHtml(card.title)}</h3>
    <p class="desc">${escHtml(card.desc || "")}</p>
    ${bullets ? `<ul>${bullets}</ul>` : ""}
  `;
  return div;
}

function makeRecipeCard(r) {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <h3>${escHtml(r.title)}</h3>
    <p class="desc">${escHtml(r.desc || "")}</p>
    <div class="codebox" style="margin-top:10px;">
      <code>${escHtml(r.code || "")}</code>
    </div>
    ${r.note ? `<p class="muted small" style="margin:8px 0 0;">${r.note}</p>` : ""}
  `;
  return div;
}

function renderMedia(media) {
  const host = el("mediaBlock");
  if (!host) return;

  const shots = (media?.shots || []).map(s => `
    <div class="shot">
      <img src="${escHtml(s.src)}" alt="${escHtml(s.alt || "")}" />
      <div class="cap">${escHtml(s.cap || "")}</div>
    </div>
  `).join("");

  host.innerHTML = `
    <div class="mediaHeader">
      <img class="projectIcon" src="${escHtml(media?.icon || "")}" alt="${escHtml(media?.name || "icon")}" />
      <div class="mediaMeta">
        <strong>${escHtml(media?.name || "")}</strong>
        <span>${escHtml(media?.subtitle || "")}</span>
      </div>
    </div>
    <div class="gallery">${shots}</div>
  `;
}

function renderInstall(install) {
  const host = el("installBlock");
  if (!host) return;

  const buttons = (install?.buttons || []).map(b => {
    const cls = b.class || "button ghost";
    return `<a class="${escHtml(cls)}" href="${escHtml(b.href)}">${escHtml(b.label)}</a>`;
  }).join("");

  host.innerHTML = `
    <div class="callout">
      <strong>${escHtml(install?.calloutTitle || "")}</strong>
      <p class="muted small">${escHtml(install?.calloutBody || "")}</p>
    </div>
    <div class="codebox" style="margin-top:12px;">
      <code>${escHtml(install?.stepsCode || "")}</code>
    </div>
    <div class="btnrow" style="margin-top:12px;">
      ${buttons}
    </div>
  `;
}

function renderCommands(data) {
  const host = el("commandsBlock");
  if (!host) return;

  host.innerHTML = `
    <p class="desc" style="margin-top:0;">${escHtml(data.commandsIntro || "")}</p>

    <div class="codebox" style="margin-top:10px;">
      <code>${escHtml(data.commandsCode || "")}</code>
    </div>

    ${
      data.commandsCalloutTitle
        ? `<div class="callout" style="margin-top:12px;">
            <strong>${escHtml(data.commandsCalloutTitle)}</strong>
            <p class="muted small" style="margin:6px 0 0;">${data.commandsCalloutBody || ""}</p>
          </div>`
        : ""
    }
  `;
}

async function main() {
  const jsonPath = document.body.getAttribute("data-mod-json");
  if (!jsonPath) return;

  const res = await fetch(jsonPath, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load JSON: ${jsonPath}`);
  const data = await res.json();

  if (data.title) document.title = data.title;

  if (el("modKicker")) el("modKicker").textContent = data.kicker || "";
  if (el("modName")) el("modName").textContent = data.emojiName || data.name || "";
  if (el("modTagline")) el("modTagline").textContent = data.tagline || "";

  // CTAs
  const ctasHost = el("modCtas");
  if (ctasHost) {
    ctasHost.innerHTML = "";
    (data.cta || []).forEach(btn => ctasHost.appendChild(makeBtn(btn)));
  }

  // Hero tiles
  const tilesHost = el("heroTiles");
  if (tilesHost) {
    tilesHost.innerHTML = "";
    (data.heroTiles || []).forEach(t => tilesHost.appendChild(makeTile(t)));
  }

  // Description (HTML snippets so you keep your exact formatting)
  const descHost = el("descriptionBlock");
  if (descHost) {
    descHost.innerHTML = (data.descriptionHtml || []).join("\n");
  }

  // Features
  const featHost = el("featuresGrid");
  if (featHost) {
    featHost.innerHTML = "";
    (data.features || []).forEach(f => featHost.appendChild(makeCardBlock(f)));
  }

  // How-to
  const howHost = el("howToGrid");
  if (howHost) {
    howHost.innerHTML = "";
    (data.howTo || []).forEach(h => howHost.appendChild(makeSimpleCard(h)));
  }

  // Commands
  renderCommands(data);

  // Recipes
  const recipesHost = el("recipesGrid");
  if (recipesHost) {
    recipesHost.innerHTML = "";
    (data.recipes || []).forEach(r => recipesHost.appendChild(makeRecipeCard(r)));
  }

  // Media + Install
  renderMedia(data.media);
  renderInstall(data.install);
}

main().catch(err => {
  console.error(err);
  alert(err.message || String(err));
});
