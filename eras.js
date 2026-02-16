/* eras.js — Mayflower Studios Eras page
   - Loads data/server.json config
   - Fetches eras from WorldState (/api/public/eras)
   - Fetches era unlock index (/api/public/era_players)
   - Renders a clean, player-friendly breakdown (no dev-y metadata)
*/
(() => {
  const el = (id) => document.getElementById(id);

  const errBox = el("erasError");
  const note = el("breakdownNote");
  const search = el("eraSearch");
  const refreshBtn = el("refreshBtn");

  const metaUpdated = el("erasUpdated");
  const metaCount = el("erasCount");
  const groupsHost = el("erasGroups");

  let ALL = [];
  let API_BASE = null;

  // eraId -> ["PlayerName", ...]
  let ERA_PLAYERS = {};

  function safeText(node, text) {
    if (!node) return;
    node.textContent = (text === null || text === undefined) ? "—" : String(text);
  }

  function fmtTime(mins) {
    if (mins === null || mins === undefined) return "—";
    const n = Number(mins);
    if (!isFinite(n) || n < 0) return "—";
    const h = Math.floor(n / 60);
    const m = n % 60;
    return (h > 0 ? `${h}h ${m}m` : `${m}m`);
  }

  function fmtDate(epochSec) {
    if (!epochSec) return "—";
    try {
      const d = new Date(Number(epochSec) * 1000);
      return d.toLocaleString();
    } catch (e) {
      return "—";
    }
  }

  function esc(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function titleCase(s) {
    return String(s)
      .split(/\s+/g)
      .filter(Boolean)
      .map(w => w.length ? (w[0].toUpperCase() + w.slice(1)) : w)
      .join(" ");
  }

  function prettyRegistryId(raw) {
    const s = String(raw || "");
    const after = s.includes(":") ? s.split(":").slice(1).join(":") : s;
    const cleaned = after
      .replaceAll("_", " ")
      .replaceAll("/", " ")
      .replaceAll(".", " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned ? titleCase(cleaned) : "—";
  }

  function prettyNamespace(raw) {
    const s = String(raw || "").trim();
    if (!s) return "—";
    return titleCase(s.replaceAll("_", " ").replaceAll("-", " "));
  }

  function pickWorldApiBase(cfg) {
    if (cfg && cfg.worldApiBase) return String(cfg.worldApiBase).replace(/\/+$/, "");
    if (cfg && cfg.worldStateUrl) {
      const u = String(cfg.worldStateUrl);
      return u.replace(/\/worldstate\.json\s*$/i, "").replace(/\/+$/, "");
    }
    return "https://world.mayflowerstudios.net:8446";
  }

  async function loadServerConfig() {
    try {
      const res = await fetch("data/server.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`server.json HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      return {};
    }
  }

  function showError(msg) {
    if (!errBox) return;
    errBox.style.display = "block";
    errBox.textContent = msg;
  }

  function clearError() {
    if (!errBox) return;
    errBox.style.display = "none";
    errBox.textContent = "";
  }

  // Minecraft formatting color codes (the §x strings you store in eras.json)
  const MC_COLOR = {
    "§0": "#000000",
    "§1": "#0000AA",
    "§2": "#00AA00",
    "§3": "#00AAAA",
    "§4": "#AA0000",
    "§5": "#AA00AA",
    "§6": "#FFAA00",
    "§7": "#AAAAAA",
    "§8": "#555555",
    "§9": "#5555FF",
    "§a": "#55FF55",
    "§b": "#55FFFF",
    "§c": "#FF5555",
    "§d": "#FF55FF",
    "§e": "#FFFF55",
    "§f": "#FFFFFF",
  };

  function eraColor(e) {
    const c = String(e?.color || "").trim();
    return MC_COLOR[c] || "rgba(255,255,255,.75)";
  }

  function uniq(list) {
    const out = [];
    const seen = new Set();
    for (const v of (Array.isArray(list) ? list : [])) {
      const s = String(v);
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }

  function renderTagsPretty(list, kind) {
    const arr = uniq(list);
    if (!arr.length) return `<div class="emptyNote">None</div>`;

    const toLabel = (v) => {
      if (kind === "mod") return prettyNamespace(v);
      if (kind === "contains")
        return titleCase(String(v).replaceAll("_", " ").replaceAll("/", " ").trim());
      return prettyRegistryId(v);
    };

    const shown = arr
      .map(v => `<span class="tag">${esc(toLabel(v))}</span>`)
      .join("");

    return `<div class="kv">${shown}</div>`;
  }

  function getBlocked(e) {
    const g = e?.gates || {};
    const mods = uniq([...(g.denyNamespaces || []), ...(g.denyItemNamespaces || [])]);

    const blocks = uniq([...(g.denyBlocks || [])]);
    const blockPatterns = uniq([...(g.denyIfPathContains || [])]);

    const items = uniq([...(g.denyItems || [])]);
    const itemPatterns = uniq([...(g.denyItemIfPathContains || [])]);

    return { mods, blocks, blockPatterns, items, itemPatterns };
  }

  function playersForEra(eraId) {
    if (!eraId) return [];
    const list = ERA_PLAYERS[String(eraId)] || [];
    return uniq(list).sort((a, b) => String(a).localeCompare(String(b)));
  }

  function renderUnlockedBy(eraId) {
    const list = playersForEra(eraId);
    if (!list.length) return `<div class="emptyNote">No one yet (or not indexed yet).</div>`;

    const LIMIT = 18;
    const shown = list.slice(0, LIMIT);
    const rest = list.length - shown.length;

    return `
      <div class="kv">
        ${shown.map(n => `<span class="tag">${esc(n)}</span>`).join("")}
      </div>
      ${rest > 0 ? `<div class="small" style="margin-top:8px; opacity:.75;">+${rest} more…</div>` : ``}
    `;
  }

  function eraCard(e) {
    const title = e.title || e.id || "(untitled)";
    const minsReq = (e.minutesRequired === null || e.minutesRequired === undefined) ? null : Number(e.minutesRequired);
    const manual = !!e.manualOnly;
    const ms = Array.isArray(e.milestones) ? e.milestones : [];

    const style = `--eraColor:${eraColor(e)};`;
    const b = getBlocked(e);

    const badges = [];
    if (manual) badges.push(`🎭 Manual unlock`);
    else if (minsReq == null) badges.push(`⏱️ No time gate`);
    else badges.push(`⏱️ ${fmtTime(minsReq)}`);

    const blockedCount = b.mods.length + b.blocks.length + b.items.length + b.blockPatterns.length + b.itemPatterns.length;

    const unlockedCount = playersForEra(e.id).length;

    return `
      <article class="eraCard" style="${style}">
        <div class="eraHead">
          <div>
            <h3 class="eraTitle">
              <span class="eraDot" aria-hidden="true"></span>
              ${esc(title)}
            </h3>
          </div>
          <div class="eraBadges">
            ${badges.map(b => `<span class="miniPill">${esc(b)}</span>`).join("")}
            <span class="miniPill">🚫 Blocked: ${blockedCount}</span>
            <span class="miniPill">✅ Unlocked: ${unlockedCount}</span>
          </div>
        </div>

        <div style="margin-top:10px; position:relative; z-index:1;">
          <div class="small" style="opacity:.9;"><strong>Unlock milestone</strong> <span style="opacity:.75;">(craft one)</span></div>
          ${ms.length
            ? `<div class="kv">${uniq(ms).slice(0, 18).map(v => `<span class="tag">${esc(prettyRegistryId(v))}</span>`).join("")}</div>`
            : `<div class="emptyNote">No milestone set for this era.</div>`}
          ${ms.length > 18 ? `<div class="small" style="margin-top:8px; opacity:.75;">+${ms.length - 18} more…</div>` : ``}
        </div>

        <details class="eraDetails">
          <summary>
            <span>More details</span>
            <span class="small" style="opacity:.75;">(gates + unlocked by)</span>
          </summary>

          <div class="gatesGrid">
            <div class="gbox">
              <h4>Unlocked by</h4>
              ${renderUnlockedBy(e.id)}
            </div>

            <div class="gbox">
              <h4>Mods blocked</h4>
              ${renderTagsPretty(b.mods, "mod")}
            </div>

            <div class="gbox">
              <h4>Blocks blocked</h4>
              ${renderTagsPretty(b.blocks, "id")}
              ${b.blockPatterns.length ? `<div class="small" style="opacity:.85; margin-top:10px;">Patterns</div>${renderTagsPretty(b.blockPatterns, "contains")}` : ``}
            </div>

            <div class="gbox">
              <h4>Items blocked</h4>
              ${renderTagsPretty(b.items, "id")}
              ${b.itemPatterns.length ? `<div class="small" style="opacity:.85; margin-top:10px;">Patterns</div>${renderTagsPretty(b.itemPatterns, "contains")}` : ``}
            </div>
          </div>
        </details>
      </article>
    `;
  }

  function normalizeList(raw) {
    const list = Array.isArray(raw) ? raw.slice() : [];
    return list.sort((a, b) => {
      const am = !!a?.manualOnly;
      const bm = !!b?.manualOnly;
      if (am !== bm) return am ? 1 : -1;

      const ax = (a?.minutesRequired === null || a?.minutesRequired === undefined) ? 0 : Number(a.minutesRequired);
      const bx = (b?.minutesRequired === null || b?.minutesRequired === undefined) ? 0 : Number(b.minutesRequired);

      const aa = (isFinite(ax) ? ax : 0);
      const bb = (isFinite(bx) ? bx : 0);
      if (aa !== bb) return aa - bb;

      const at = String(a?.title || a?.id || "");
      const bt = String(b?.title || b?.id || "");
      return at.localeCompare(bt);
    });
  }

  function buildGroups(list) {
    const byKey = new Map();
    const manual = [];

    for (const e of list) {
      if (e?.manualOnly) { manual.push(e); continue; }
      const mins = (e?.minutesRequired === null || e?.minutesRequired === undefined) ? 0 : Number(e.minutesRequired);
      const key = isFinite(mins) ? mins : 0;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(e);
    }

    const keys = Array.from(byKey.keys()).sort((a, b) => a - b);

    const groups = keys.map(k => ({
      title: k === 0 ? "Available now" : `Unlocks after ${fmtTime(k)}`,
      meta: k === 0
        ? "Starting eras you can choose right away."
        : "Once your playtime meets the requirement, craft a milestone to unlock one of these eras.",
      items: byKey.get(k)
    }));

    if (manual.length) {
      groups.push({
        title: "Manual unlock only",
        meta: "Special story/admin eras.",
        items: manual
      });
    }

    return groups;
  }

  function applyFilter() {
    const q = String(search?.value || "").trim().toLowerCase();
    const filtered = !q ? ALL : ALL.filter(e => {
      const ms = (e.milestones || []).map(prettyRegistryId).join(" ");
      const blocked = getBlocked(e);
      const unlocked = playersForEra(e.id).join(" ");

      const blob =
        `${e.id||""} ${e.title||""} ${ms} ${unlocked} ` +
        `${blocked.mods.join(" ")} ${blocked.blocks.join(" ")} ${blocked.items.join(" ")} ` +
        `${blocked.blockPatterns.join(" ")} ${blocked.itemPatterns.join(" ")}`;

      return blob.toLowerCase().includes(q);
    });

    safeText(metaCount, filtered.length);
    if (note) note.textContent = filtered.length
      ? `Showing ${filtered.length} era${filtered.length === 1 ? "" : "s"}.`
      : "No eras match your search.";

    const groups = buildGroups(filtered);

    if (!groupsHost) return;
    groupsHost.innerHTML = groups.map(g => `
      <div class="groupWrap">
        <div class="sectionTitle" style="margin:0 0 10px;">
          <div>
            <div class="groupTitle">${esc(g.title)}</div>
            <div class="groupMeta">${esc(g.meta)}</div>
          </div>
          <span>${g.items.length} era${g.items.length === 1 ? "" : "s"}</span>
        </div>
        <div class="eraGrid">
          ${g.items.map(eraCard).join("")}
        </div>
      </div>
    `).join("");
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    if (!payload) throw new Error(`${url} returned empty JSON`);
    return payload;
  }

  async function load() {
    clearError();
    if (note) note.textContent = "Loading…";
    if (groupsHost) groupsHost.innerHTML = "";

    const cfg = await loadServerConfig();
    API_BASE = pickWorldApiBase(cfg);

    const erasUrl = `${API_BASE}/api/public/eras`;
    const eraPlayersUrl = `${API_BASE}/api/public/era_players`;

    try {
      // Load both (eraPlayers is optional — page still works without it)
      const [erasPayload, eraPlayersPayload] = await Promise.all([
        fetchJson(erasUrl),
        fetchJson(eraPlayersUrl).catch(() => null)
      ]);

      if (erasPayload.exists === false) throw new Error("eras.json not found on the server");

      safeText(metaUpdated, fmtDate(erasPayload.lastModified || erasPayload.generatedAt));

      const eras = erasPayload?.data?.eras;
      ALL = normalizeList(Array.isArray(eras) ? eras : []);

      // Era players index shape expected:
      // { byEra: { "artisan": ["Name1","Name2"] ... }, ... }
      ERA_PLAYERS = {};
      if (eraPlayersPayload && eraPlayersPayload.byEra && typeof eraPlayersPayload.byEra === "object") {
        ERA_PLAYERS = eraPlayersPayload.byEra || {};
      }

      applyFilter();
    } catch (e) {
      showError(
        "Couldn’t load eras from the server.\n" +
        "• Make sure WorldState is running\n" +
        "• Make sure /api/public/eras exists\n\n" +
        "Details: " + (e && e.message ? e.message : String(e))
      );
      safeText(metaUpdated, "—");
      safeText(metaCount, "—");
      if (note) note.textContent = "No data.";
    }
  }

  if (search) search.addEventListener("input", () => applyFilter());
  if (refreshBtn) refreshBtn.addEventListener("click", () => load());

  load();
})();