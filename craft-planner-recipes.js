/* Mayflower Craft Planner — the shared recipe book, live from Firebase.
   Same idea as the Idle RPG leaderboard: a plain read of a public node, no SDK. */
(function () {
  const DB_URL = "https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const RECIPES_URL = DB_URL + "/craftRecipes.json";

  const statusEl = document.getElementById("recipeStatus");
  const listEl = document.getElementById("recipeList");
  const searchEl = document.getElementById("recipeSearch");

  let items = [];

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* One row per item, with every way of making it underneath. */
  function group(entries) {
    const byName = new Map();
    entries.forEach(e => {
      if (!e || typeof e.output !== "string" || typeof e.needs !== "string") return;
      const name = e.output.trim();
      const needs = e.needs.trim();
      if (!name || !needs) return;
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, { name: name, ways: [] });
      byName.get(key).ways.push({
        needs: needs,
        makes: Number(e.makes) > 1 ? Number(e.makes) : 1,
        where: typeof e.where === "string" ? e.where.trim() : ""
      });
    });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function wayHtml(way) {
    const makes = way.makes > 1 ? `<span class="rMakes">makes ${way.makes}</span>` : "";
    const where = way.where ? `<span class="rWhere">${esc(way.where)}</span>` : "";
    return `<li><span class="rNeeds">${esc(way.needs)}</span>${makes}${where}</li>`;
  }

  function itemHtml(item) {
    const many = item.ways.length > 1
      ? `<span class="rCount">${item.ways.length} ways</span>` : "";
    return `<div class="rItem">
      <h3>${esc(item.name)}${many}</h3>
      <ul class="rWays">${item.ways.map(wayHtml).join("")}</ul>
    </div>`;
  }

  function render() {
    if (!listEl) return;
    const q = (searchEl && searchEl.value ? searchEl.value : "").trim().toLowerCase();
    const shown = q
      ? items.filter(i => i.name.toLowerCase().includes(q)
                       || i.ways.some(w => w.needs.toLowerCase().includes(q)))
      : items;

    if (!items.length) {
      listEl.innerHTML = `<p class="muted">No recipes yet. The first one anybody shares from the app turns up here.</p>`;
      return;
    }
    if (!shown.length) {
      listEl.innerHTML = `<p class="muted">Nothing matches “${esc(q)}”.</p>`;
      return;
    }
    listEl.innerHTML = shown.map(itemHtml).join("");
  }

  async function load() {
    try {
      const res = await fetch(RECIPES_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const entries = Object.values(data || {});
      items = group(entries);
      const ways = items.reduce((n, i) => n + i.ways.length, 0);
      if (statusEl) {
        statusEl.textContent = items.length
          ? `${ways} recipe${ways === 1 ? "" : "s"} for ${items.length} item${items.length === 1 ? "" : "s"}`
          : "Nothing shared yet";
      }
      render();
    } catch (err) {
      if (statusEl) statusEl.textContent = "The recipe list could not be loaded.";
      if (listEl) listEl.innerHTML = `<p class="muted">The shared list is unavailable right now.</p>`;
      console.warn("Craft Planner recipes failed:", err);
    }
  }

  if (searchEl) searchEl.addEventListener("input", render);
  load();
  window.setInterval(load, 120000);
})();
