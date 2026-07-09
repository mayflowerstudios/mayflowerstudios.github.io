/* Mayflower Idle RPG live leaderboard */
(function () {
  const DB_URL = "https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const ENTRIES_URL = DB_URL + "/leaderboards/mayflowerIdleRPG/entries.json";
  const MAX_ROWS = 8;

  const statusEl = document.getElementById("idleLeaderboardStatus");

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function num(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(value) {
    return num(value).toLocaleString();
  }

  function hero(entry) {
    const name = entry.characterName || entry.displayName || "Unknown hero";
    const house = entry.bloodlineName ? `House ${entry.bloodlineName}` : "No house";
    return `<strong>${esc(name)}</strong><br><span class="muted small">${esc(house)} • lvl ${fmt(entry.level)} • gen ${fmt(entry.generation || 1)}</span>`;
  }

  function house(entry) {
    const houseName = entry.bloodlineName || entry.characterName || "Unknown house";
    const character = entry.characterName || entry.displayName || "Unknown hero";
    return `<strong>${esc(houseName)}</strong><br><span class="muted small">${esc(character)} • ${esc(entry.status || "Alive")}</span>`;
  }

  function emptyRow(label) {
    return `<tr><td>—</td><td>${esc(label)}</td><td>—</td></tr>`;
  }

  function renderRows(id, rows, labelFn, valueFn, emptyLabel) {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = emptyRow(emptyLabel || "No public entries yet");
      return;
    }
    tbody.innerHTML = rows.slice(0, MAX_ROWS).map((entry, index) => {
      return `<tr><td>#${index + 1}</td><td>${labelFn(entry)}</td><td>${valueFn(entry)}</td></tr>`;
    }).join("");
  }

  function render(entries) {
    const active = entries.filter(e => e && e.id && num(e.score) >= 0);
    const byScore = [...active].sort((a, b) => num(b.score) - num(a.score));
    const byLife = [...active].sort((a, b) => num(b.daysSurvived) - num(a.daysSurvived));
    const byGold = [...active].sort((a, b) => num(b.totalGoldEarned || b.gold) - num(a.totalGoldEarned || a.gold));
    const byAtlas = [...active].sort((a, b) => num(b.generatedPlaces || b.worldExpansionCount) - num(a.generatedPlaces || a.worldExpansionCount));

    renderRows("idleBoardScore", byScore, hero, e => fmt(e.score), "No scores submitted yet");
    renderRows("idleBoardLife", byLife, hero, e => fmt(e.daysSurvived) + " days", "No lives submitted yet");
    renderRows("idleBoardGold", byGold, house, e => fmt(e.totalGoldEarned || e.gold) + " gold", "No legacies submitted yet");
    renderRows("idleBoardAtlas", byAtlas, hero, e => fmt(e.generatedPlaces || e.worldExpansionCount) + " places", "No atlas records yet");

    if (statusEl) {
      const latest = active
        .map(e => Date.parse(e.updatedAtUtc || ""))
        .filter(Boolean)
        .sort((a, b) => b - a)[0];
      statusEl.textContent = active.length
        ? `${active.length} public record${active.length === 1 ? "" : "s"}${latest ? " • updated " + new Date(latest).toLocaleString() : ""}`
        : "No public entries yet";
    }
  }

  async function load() {
    try {
      const res = await fetch(ENTRIES_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      render(Object.values(data || {}));
    } catch (err) {
      if (statusEl) statusEl.textContent = "Leaderboard unavailable. Check Firebase rules.";
      ["idleBoardScore", "idleBoardLife", "idleBoardGold", "idleBoardAtlas"].forEach(id => {
        const tbody = document.getElementById(id);
        if (tbody) tbody.innerHTML = emptyRow("Could not load Firebase records");
      });
      console.warn("Mayflower Idle RPG leaderboard failed:", err);
    }
  }

  load();
  window.setInterval(load, 60000);
})();
