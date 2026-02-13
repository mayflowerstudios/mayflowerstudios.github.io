/* server.js — Mayflower Studios Server Dashboard
   - Loads data/server.json config
   - Pulls worldstate + waystones + modlist + kits
   - Supports maintenance banner + test modpack swapping
*/

(() => {
  // ----------------------------
  // Helpers
  // ----------------------------
  const el = (id) => document.getElementById(id);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  function safeSetText(node, text) {
    if (!node) return;
    node.textContent = (text === null || text === undefined) ? "—" : String(text);
  }

  function withProtocol(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    return "https://" + u;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function formatBytes(bytes) {
    const b = Number(bytes);
    if (!Number.isFinite(b)) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = b;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function formatTimeAgo(epochMs) {
    const t = Number(epochMs);
    if (!Number.isFinite(t) || t <= 0) return "—";
    const delta = Date.now() - t;
    const s = Math.max(0, Math.floor(delta / 1000));
    if (s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  async function fetchJson(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      return JSON.parse(text);
    } finally {
      clearTimeout(t);
    }
  }

  function disableButtonLike(node, reason = "Disabled") {
    if (!node) return;
    node.style.pointerEvents = "none";
    node.style.opacity = "0.55";
    node.style.filter = "grayscale(0.15)";
    node.setAttribute("aria-disabled", "true");
    node.setAttribute("title", reason);
    if (node.tagName === "BUTTON") node.disabled = true;
  }

  function enableButtonLike(node) {
    if (!node) return;
    node.style.pointerEvents = "";
    node.style.opacity = "";
    node.style.filter = "";
    node.removeAttribute("aria-disabled");
    node.removeAttribute("title");
    if (node.tagName === "BUTTON") node.disabled = false;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeCategory(s) {
    const v = String(s || "").trim();
    return v ? v : "Other";
  }

  // ----------------------------
  // Elements (server.html IDs)
  // ----------------------------
  const maintenanceBanner = el("maintenanceBanner");
  const serverTitle = el("serverTitle");
  const serverMotd = el("serverMotd");

  const serverAddress = el("serverAddress");
  const copyIpBtn = el("copyIpBtn");

  const joinLink = el("joinLink");
  const rulesLink = el("rulesLink");
  const discordLink = el("discordLink");
  const openMapBtn = el("openMapBtn");
  const sparkLink = el("sparkLink");

  const modpackCurseforge = el("modpackCurseforge");
  const modpackDirectZip = el("modpackDirectZip"); // <-- keep your edited anchor intact
  const modpackLabel = el("modpackLabel");
  const modpackNote = el("modpackNote");

  const statusDot = el("statusDot");
  const statusText = el("statusText");
  const lastUpdate = el("lastUpdate");
  const refreshIn = el("refreshIn");
  const playersOnlineCountMini = el("playersOnlineCountMini");
  const playersMaxCountMini = el("playersMaxCountMini");

  const worldMoodClock = el("worldMoodClock");
  const worldMoodWeather = el("worldMoodWeather");
  const worldMoodSeason = el("worldMoodSeason");
  const worldMoodMoon = el("worldMoodMoon");
  const worldMoodFooter = el("worldMoodFooter");

  const tpsLine = el("tpsLine");
  const msptLine = el("msptLine");
  const memLine = el("memLine");

  const ae2Pill = el("ae2Pill");
  const ae2Online = el("ae2Online");
  const ae2Offline = el("ae2Offline");
  const ae2Conflicted = el("ae2Conflicted");
  const ae2DimNote = el("ae2DimNote");

  const bluemapFrame = el("bluemapFrame");
  const mapFallback = el("mapFallback");

  const chatList = el("chatList");
  const chatNote = el("chatNote");
  const chatName = el("chatName");
  const chatMsg = el("chatMsg");
  const chatSendBtn = el("chatSendBtn");
  const chatSendStatus = el("chatSendStatus");

  const playersOnlineCount = el("playersOnlineCount");
  const playersMaxCount = el("playersMaxCount");
  const playersGrid = el("playersGrid");
  const playersOnlineNote = el("playersOnlineNote");

  const waystoneSearch = el("waystoneSearch");
  const waystoneMeta = el("waystoneMeta");
  const waystoneList = el("waystoneList");
  const waystoneNote = el("waystoneNote");

  const kitCount = el("kitCount");
  const kitSearch = el("kitSearch");
  const kitFilterRow = el("kitFilterRow");
  const kitList = el("kitList");
  const kitNote = el("kitNote");

  const modCount = el("modCount");
  const modSearch = el("modSearch");
  const categoryRow = el("categoryRow");
  const modTbody = el("modTbody");

  // ----------------------------
  // State
  // ----------------------------
  let cfg = null;

  let refreshSeconds = 10;
  let chatFastSeconds = 2;

  let refreshTicker = null;
  let chatTicker = null;
  let countdownTicker = null;

  let countdown = 0;

  let latestWorldState = null;
  let latestWaystones = [];
  let latestMods = [];
  let latestKits = [];

  let kitCategory = "All";
  let modCategory = "All";

  let lastChatHash = "";
  let chatEnabled = true;

  // ----------------------------
  // Maintenance + Modpack swapping
  // ----------------------------
  function applyMaintenanceFromCfg(config) {
    const maint = config?.maintenance || {};
    const enabled = Boolean(maint?.enabled);

    if (maintenanceBanner) {
      if (enabled) {
        maintenanceBanner.style.display = "";
        const title = maint?.title || "Server Maintenance";
        const msg = maint?.message || "Updates in progress.";

        // Banner markup is fixed in HTML; just update text safely
        const titleEl = maintenanceBanner.querySelector(".maintenanceText");
        const subEl = maintenanceBanner.querySelector(".maintenanceSub");
        if (titleEl) titleEl.textContent = title;
        if (subEl) subEl.textContent = msg;
      } else {
        maintenanceBanner.style.display = "none";
      }
    }

    // If they want to disable join buttons during maintenance, do it,
    // BUT we will NOT disable modpack buttons anymore (per your request).
    if (enabled && maint?.disableJoinButtons) {
      disableButtonLike(joinLink, "Disabled during maintenance");
      disableButtonLike(copyIpBtn, "Disabled during maintenance");
    } else {
      enableButtonLike(joinLink);
      enableButtonLike(copyIpBtn);
    }

    // Chat disable
    chatEnabled = !(enabled && maint?.disableWebChat);
    if (!chatEnabled) {
      disableButtonLike(chatSendBtn, "Chat disabled during maintenance");
      safeSetText(chatSendStatus, "Chat disabled");
      if (chatNote) chatNote.textContent = "Chat is disabled during maintenance.";
    } else {
      enableButtonLike(chatSendBtn);
      if (chatNote) chatNote.textContent = "Read-only feed from your WorldState mod.";
    }
  }

  function setModpackLinks(config) {
    const maint = config?.maintenance || {};
    const testPack = maint?.maintenanceModpack;

    const usingTestPack =
      Boolean(maint?.enabled) &&
      Boolean(testPack?.enabled) &&
      (testPack?.curseforgeUrl || testPack?.directZipUrl);

    const chosen = usingTestPack ? testPack : (config?.modpack || {});
    const label = usingTestPack ? (testPack?.label || "🧪 Test Modpack") : "📦 Main Modpack";
    const note = String(chosen?.note || config?.modpack?.note || "").trim();

    const cf = String(chosen?.curseforgeUrl || "").trim();
    const zip = withProtocol(chosen?.directZipUrl || "");

    safeSetText(modpackLabel, label);
    safeSetText(modpackNote, note || "—");

    if (modpackCurseforge) {
      if (cf) {
        modpackCurseforge.href = cf;
        modpackCurseforge.style.display = "";
      } else {
        modpackCurseforge.style.display = "none";
      }
    }

    if (modpackDirectZip) {
      if (zip) {
        modpackDirectZip.href = zip;
        modpackDirectZip.style.display = "";
      } else {
        modpackDirectZip.style.display = "none";
      }
    }
  }

  // ----------------------------
  // Top links + IP
  // ----------------------------
  function applyStaticLinks(config) {
    const address = String(config?.address || "").trim();
    safeSetText(serverAddress, address || "—");

    if (copyIpBtn && address) {
      copyIpBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(address);
          const old = copyIpBtn.textContent;
          copyIpBtn.textContent = "✅ Copied";
          setTimeout(() => (copyIpBtn.textContent = old), 1100);
        } catch {
          alert("Couldn’t copy automatically.\nCopy this:\n" + address);
        }
      }, { once: true });
    }

    if (serverTitle) safeSetText(serverTitle, `🛰️ ${config?.serverName || "Server Dashboard"}`);

    if (joinLink) joinLink.href = String(config?.howToJoinUrl || "server-info.html");
    if (rulesLink) rulesLink.href = String(config?.links?.rulesUrl || "rules.html");

    if (discordLink) {
      const d = String(config?.discordUrl || "").trim();
      if (d) discordLink.href = d;
    }
    if (sparkLink) {
      const s = String(config?.links?.sparkUrl || "").trim();
      if (s) sparkLink.href = s;
      else sparkLink.style.display = "none";
    }

    // Map open button + iframe
    const mapEmbed = String(config?.mapEmbedUrl || "").trim();
    if (openMapBtn) {
      if (mapEmbed) openMapBtn.href = mapEmbed;
      else openMapBtn.style.display = "none";
    }

    // BlueMap iframe
    if (bluemapFrame) {
      if (mapEmbed) {
        bluemapFrame.src = mapEmbed;
        bluemapFrame.addEventListener("error", () => {
          if (mapFallback) mapFallback.style.display = "";
        });
      } else {
        if (mapFallback) mapFallback.style.display = "";
      }
    }

    refreshSeconds = clamp(Number(config?.refreshSeconds || 10), 3, 120);
    chatFastSeconds = clamp(Number(config?.chatFastSeconds || 2), 1, 60);
  }

  // ----------------------------
  // Worldstate rendering
  // ----------------------------
  function setStatus(online, text) {
    if (statusDot) {
      statusDot.classList.remove("online", "offline");
      statusDot.classList.add(online ? "online" : "offline");
    }
    safeSetText(statusText, text || (online ? "Online" : "Offline"));
  }

  function renderWorldMood(ws) {
    // best-effort support for a "mood" object like:
    // mood: { headline, flavor, timeOfDay, weather, season, moonPhase }
    const mood = ws?.mood || ws?.world?.mood || null;

    // Clock: prefer ws.time / ws.worldTime formatted; fallback to mood.headline split
    const clock = mood?.clock || ws?.clock || ws?.world?.clock || ws?.timeText || mood?.timeOfDay || "—";
    const weather = mood?.weather || ws?.weather || ws?.world?.weather || "—";
    const season = mood?.season || ws?.season || ws?.world?.season || "—";
    const moon = (Number.isFinite(Number(mood?.moonPhase)) ? `Moon ${mood.moonPhase}` : (mood?.moon || ws?.moon || "—"));
    const flavor = mood?.flavor || ws?.flavor || ws?.world?.flavor || "—";

    safeSetText(worldMoodClock, `🕰️ ${clock}`);
    safeSetText(worldMoodWeather, `☁️ ${weather}`);
    safeSetText(worldMoodSeason, `🍃 ${season}`);
    safeSetText(worldMoodMoon, `🌙 ${moon}`);
    safeSetText(worldMoodFooter, flavor);
  }

  function renderPerformance(ws) {
    // Try common fields:
    const perf = ws?.performance || ws?.server?.performance || ws?.server || ws || {};
    const tps = perf?.tps ?? perf?.TPS ?? ws?.tps;
    const mspt = perf?.mspt ?? perf?.MSPT ?? ws?.mspt;
    const memUsed = perf?.memUsed ?? perf?.memoryUsed ?? perf?.memory?.used ?? ws?.memoryUsed;
    const memMax = perf?.memMax ?? perf?.memoryMax ?? perf?.memory?.max ?? ws?.memoryMax;

    safeSetText(tpsLine, Number.isFinite(Number(tps)) ? Number(tps).toFixed(1) : (tps ?? "—"));
    safeSetText(msptLine, Number.isFinite(Number(mspt)) ? Number(mspt).toFixed(1) : (mspt ?? "—"));

    if (Number.isFinite(Number(memUsed)) && Number.isFinite(Number(memMax))) {
      memLine.textContent = `${formatBytes(memUsed)} / ${formatBytes(memMax)}`;
    } else if (memLine) {
      memLine.textContent = "—";
    }
  }

  function renderAE2(ws) {
    // Expecting something like:
    // ae2: { total: { online, offline, conflicted, unknown }, byDimension:[...] }
    const ae2 = ws?.ae2 || ws?.extra?.ae2 || null;

    if (!ae2) {
      if (ae2Pill) ae2Pill.textContent = "🧠 AE2: —";
      safeSetText(ae2Online, "—");
      safeSetText(ae2Offline, "—");
      safeSetText(ae2Conflicted, "—");
      safeSetText(ae2DimNote, "—");
      return;
    }

    const total = ae2.total || {};
    const online = total.online ?? "—";
    const offline = total.offline ?? "—";
    const conflicted = total.conflicted ?? "—";
    const unknown = total.unknown ?? 0;

    safeSetText(ae2Online, online);
    safeSetText(ae2Offline, offline);
    safeSetText(ae2Conflicted, conflicted);

    const ok = (Number(online) > 0) && (Number(unknown) === 0) && (Number(conflicted) === 0);
    if (ae2Pill) ae2Pill.textContent = `🧠 AE2: ${ok ? "Online" : "Check"}`;

    // Small note by dimension (best effort)
    const dims = Array.isArray(ae2.byDimension) ? ae2.byDimension : [];
    if (dims.length) {
      const parts = dims.slice(0, 3).map(d => {
        const dim = d.dimension || "unknown";
        const c = d.controllers || {};
        return `${dim} (${c.online ?? 0} online, ${c.unknown ?? 0} unknown)`;
      });
      safeSetText(ae2DimNote, parts.join(" • "));
    } else {
      safeSetText(ae2DimNote, "—");
    }
  }

  function renderPlayers(ws) {
    // Support fields:
    // players: { online, max, list:[{name,uuid}] } OR ws.playersOnline etc.
    const p = ws?.players || ws?.server?.players || ws || {};
    const online = Number(p?.online ?? ws?.playersOnline ?? ws?.onlinePlayers ?? 0);
    const max = Number(p?.max ?? ws?.playersMax ?? ws?.maxPlayers ?? 0);
    const list = Array.isArray(p?.list) ? p.list
      : Array.isArray(ws?.playerList) ? ws.playerList
      : Array.isArray(ws?.players) ? ws.players
      : [];

    safeSetText(playersOnlineCountMini, Number.isFinite(online) ? online : "—");
    safeSetText(playersMaxCountMini, Number.isFinite(max) && max > 0 ? max : "—");

    safeSetText(playersOnlineCount, Number.isFinite(online) ? online : "—");
    safeSetText(playersMaxCount, Number.isFinite(max) && max > 0 ? max : "—");

    if (!playersGrid) return;

    playersGrid.innerHTML = "";
    const shown = list.slice(0, 50);

    if (!shown.length) {
      if (playersOnlineNote) playersOnlineNote.textContent = "No players online right now.";
      return;
    }
    if (playersOnlineNote) playersOnlineNote.textContent = "Online right now:";

    for (const pl of shown) {
      const name = pl?.name || pl?.username || "Player";
      const uuid = pl?.uuid || pl?.id || "";

      const card = document.createElement("div");
      card.className = "pCard";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      const img = document.createElement("img");
      // Use Crafatar for avatars if uuid present; fallback to a blank block
      if (uuid) img.src = `https://crafatar.com/avatars/${encodeURIComponent(uuid)}?size=64&overlay`;
      img.alt = name;
      avatar.appendChild(img);

      const meta = document.createElement("div");
      meta.className = "pMeta";
      meta.innerHTML = `
        <div class="pName">${escapeHtml(name)}</div>
        <div class="pSub">${uuid ? escapeHtml(uuid.slice(0, 8)) : "—"}</div>
      `;

      card.appendChild(avatar);
      card.appendChild(meta);
      playersGrid.appendChild(card);
    }
  }

  // ----------------------------
  // Waystones
  // ----------------------------
  function renderWaystones(items) {
    const list = Array.isArray(items) ? items : [];
    latestWaystones = list;

    if (waystoneMeta) safeSetText(waystoneMeta, `${list.length} total`);
    if (!waystoneList) return;

    const query = String(waystoneSearch?.value || "").trim().toLowerCase();
    const filtered = query
      ? list.filter(w => String(w?.name || "").toLowerCase().includes(query) || String(w?.dimension || "").toLowerCase().includes(query))
      : list;

    waystoneList.innerHTML = "";

    if (!filtered.length) {
      if (waystoneNote) waystoneNote.textContent = query ? "No waystones match your search." : "No waystones found.";
      return;
    }
    if (waystoneNote) waystoneNote.textContent = "";

    for (const w of filtered.slice(0, 200)) {
      const name = w?.name || "Waystone";
      const dim = w?.dimension || "unknown";
      const x = w?.x ?? w?.pos?.x;
      const y = w?.y ?? w?.pos?.y;
      const z = w?.z ?? w?.pos?.z;

      const coords = (Number.isFinite(Number(x)) && Number.isFinite(Number(y)) && Number.isFinite(Number(z)))
        ? `${x} ${y} ${z}`
        : "";

      const card = document.createElement("div");
      card.className = "wayItem";

      const sub = coords ? `${dim} • ${coords}` : `${dim}`;
      card.innerHTML = `
        <div class="wayName">${escapeHtml(name)}</div>
        <div class="waySub">${escapeHtml(sub)}</div>
        <div class="wayBtns">
          ${coords ? `<button class="btnMini" type="button" data-copy="${escapeHtml(coords)}">📋 Copy Coords</button>` : ``}
        </div>
      `;

      const copyBtn = card.querySelector("button[data-copy]");
      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          const val = copyBtn.getAttribute("data-copy") || "";
          try {
            await navigator.clipboard.writeText(val);
            const old = copyBtn.textContent;
            copyBtn.textContent = "✅ Copied";
            setTimeout(() => (copyBtn.textContent = old), 900);
          } catch {
            alert("Copy failed. Coords:\n" + val);
          }
        });
      }

      waystoneList.appendChild(card);
    }
  }

  async function loadWaystones(config) {
    const url = String(config?.waystonesUrl || "").trim();
    if (!url) {
      renderWaystones([]);
      return;
    }
    try {
      const data = await fetchJson(url, 8000);
      // allow either an array directly, or { waystones:[...] }
      const items = Array.isArray(data) ? data : (Array.isArray(data?.waystones) ? data.waystones : []);
      renderWaystones(items);
    } catch (e) {
      renderWaystones([]);
      if (waystoneNote) waystoneNote.textContent = "Waystones unavailable right now.";
      // console.warn(e);
    }
  }

  // ----------------------------
  // Starter Kits
  // ----------------------------
  function parseKitItems(raw) {
    // Accept a variety of formats, but we mostly just want {count, name}
    // If it's already an array, keep it. If it's a string (NBT-ish), we can't reliably parse.
    if (Array.isArray(raw)) return raw;
    return [];
  }

  function kitCategories(kits) {
    const cats = new Set();
    for (const k of kits) cats.add(normalizeCategory(k?.category || k?.role || k?.type));
    return ["All", ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
  }

  function renderKitCategoryChips(kits) {
    if (!kitFilterRow) return;
    kitFilterRow.innerHTML = "";

    const cats = kitCategories(kits);
    for (const c of cats) {
      const chip = document.createElement("button");
      chip.className = "catChip" + (c === kitCategory ? " active" : "");
      chip.type = "button";
      chip.textContent = c;
      chip.addEventListener("click", () => {
        kitCategory = c;
        renderKitCategoryChips(latestKits);
        renderKits(latestKits);
      });
      kitFilterRow.appendChild(chip);
    }
  }

  function renderKits(kits) {
    const list = Array.isArray(kits) ? kits : [];
    latestKits = list;
    safeSetText(kitCount, list.length);

    renderKitCategoryChips(list);

    if (!kitList) return;
    kitList.innerHTML = "";

    const query = String(kitSearch?.value || "").trim().toLowerCase();
    const filtered = list.filter(k => {
      const name = String(k?.name || "").toLowerCase();
      const desc = String(k?.description || "").toLowerCase();
      const cat = normalizeCategory(k?.category || k?.role || k?.type).toLowerCase();

      const catOk = (kitCategory === "All") || (normalizeCategory(k?.category || k?.role || k?.type) === kitCategory);
      const qOk = !query || name.includes(query) || desc.includes(query) || cat.includes(query);
      return catOk && qOk;
    });

    if (!filtered.length) {
      if (kitNote) kitNote.textContent = query ? "No kits match your search." : "No kits found.";
      return;
    }
    if (kitNote) kitNote.textContent = "";

    for (const k of filtered.slice(0, 200)) {
      const active = (k?.active !== false);
      const name = k?.name || "Kit";
      const desc = k?.description || "";
      const cat = normalizeCategory(k?.category || k?.role || k?.type);

      const items = parseKitItems(k?.items || k?.contents || k?.displayItems);
      const itemChips = (items && items.length)
        ? items.slice(0, 10).map(it => {
            const count = it?.count ?? it?.qty ?? it?.amount ?? 1;
            const iname = it?.name || it?.id || "item";
            return `<span class="itemChip"><span class="count">${escapeHtml(count)}</span><span class="iname">${escapeHtml(iname)}</span></span>`;
          }).join("")
        : `<div class="kitItemsEmpty">Items not listed.</div>`;

      const card = document.createElement("div");
      card.className = "kitCard";
      card.innerHTML = `
        <div class="kitHead">
          <div>
            <div class="kitName">${escapeHtml(name)}</div>
            <div class="kitDesc">${escapeHtml(desc)}</div>
          </div>
          <div class="kitBadge ${active ? "" : "off"}">
            ${active ? "✅ Active" : "⛔ Off"} • ${escapeHtml(cat)}
          </div>
        </div>
        <div class="kitItems">${itemChips}</div>
      `;

      kitList.appendChild(card);
    }
  }

  function extractKitsFromWorldstate(ws) {
    // allow worldstate.extra.starterKits, worldstate.starterKits, etc.
    const raw = ws?.extra?.starterKits ?? ws?.starterKits ?? ws?.kits ?? null;
    if (!raw) return [];
    if (!Array.isArray(raw)) return [];

    // If your worldstate kits are missing "items", you can still display name/desc/category
    return raw.map(k => ({
      name: k?.name,
      description: k?.description,
      active: k?.active,
      category: k?.category || k?.role || k?.type,
      items: k?.items || k?.displayItems || []
    }));
  }

  async function loadKits(config, wsMaybe) {
    // Primary: from worldstate (so it reflects server truth)
    const kitsFromWs = wsMaybe ? extractKitsFromWorldstate(wsMaybe) : [];
    if (kitsFromWs.length) {
      renderKits(kitsFromWs);
      return;
    }

    // Fallback: optional static file if you want it
    // If you don't have this file, it will just fail silently.
    try {
      const data = await fetchJson("data/starterkits.json", 5000);
      const kits = Array.isArray(data) ? data : (Array.isArray(data?.starterKits) ? data.starterKits : []);
      renderKits(kits);
    } catch {
      renderKits([]);
    }
  }

  // ----------------------------
  // Modlist
  // ----------------------------
  function modCategories(mods) {
    const cats = new Set();
    for (const m of mods) cats.add(normalizeCategory(m?.category));
    return ["All", ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
  }

  function renderModCategoryChips(mods) {
    if (!categoryRow) return;
    categoryRow.innerHTML = "";

    const cats = modCategories(mods);
    for (const c of cats) {
      const chip = document.createElement("button");
      chip.className = "catChip" + (c === modCategory ? " active" : "");
      chip.type = "button";
      chip.textContent = c;
      chip.addEventListener("click", () => {
        modCategory = c;
        renderModCategoryChips(latestMods);
        renderMods(latestMods);
      });
      categoryRow.appendChild(chip);
    }
  }

  function renderMods(mods) {
    const list = Array.isArray(mods) ? mods : [];
    latestMods = list;
    safeSetText(modCount, list.length);

    renderModCategoryChips(list);

    if (!modTbody) return;
    modTbody.innerHTML = "";

    const query = String(modSearch?.value || "").trim().toLowerCase();

    const filtered = list.filter(m => {
      const name = String(m?.name || "").toLowerCase();
      const cat = normalizeCategory(m?.category).toLowerCase();
      const side = String(m?.side || m?.clientServer || "").toLowerCase();
      const notes = String(m?.notes || m?.note || "").toLowerCase();

      const catOk = (modCategory === "All") || (normalizeCategory(m?.category) === modCategory);
      const qOk = !query || name.includes(query) || cat.includes(query) || side.includes(query) || notes.includes(query);
      return catOk && qOk;
    });

    for (const m of filtered.slice(0, 800)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(m?.name || "—")}</strong></td>
        <td>${escapeHtml(normalizeCategory(m?.category))}</td>
        <td>${escapeHtml(m?.side || m?.clientServer || "—")}</td>
        <td>${escapeHtml(m?.notes || m?.note || "")}</td>
      `;
      modTbody.appendChild(tr);
    }
  }

  async function loadMods() {
    try {
      const data = await fetchJson("data/modlist.json", 8000);
      const mods = Array.isArray(data) ? data : (Array.isArray(data?.mods) ? data.mods : []);
      renderMods(mods);
    } catch {
      renderMods([]);
    }
  }

  // ----------------------------
  // Chat
  // ----------------------------
  function renderChat(lines) {
    if (!chatList) return;

    const arr = Array.isArray(lines) ? lines : [];
    // Create a quick hash so we don’t rerender constantly
    const hash = JSON.stringify(arr.slice(-30));
    if (hash === lastChatHash) return;
    lastChatHash = hash;

    chatList.innerHTML = "";
    const shown = arr.slice(-120);

    for (const line of shown) {
      const who = line?.name || line?.author || "Server";
      const msg = line?.message || line?.msg || line?.text || "";
      const ts = line?.ts || line?.time || line?.timestamp || null;

      const timeStr = ts ? formatTimeAgo(Number(ts) * (String(ts).length <= 10 ? 1000 : 1)) : "";

      const div = document.createElement("div");
      div.className = "chatLine";
      div.innerHTML = `
        <div class="chatTop">
          <strong>${escapeHtml(who)}</strong>
          <span>${escapeHtml(timeStr)}</span>
        </div>
        <div class="chatMsg">${escapeHtml(msg)}</div>
      `;
      chatList.appendChild(div);
    }

    // keep scrolled to bottom-ish
    chatList.scrollTop = chatList.scrollHeight;
  }

  async function loadChat(config) {
    if (!chatEnabled) return;

    // Prefer a dedicated endpoint if you have it:
    // GET {worldApiBase}/chat.json
    // Fallback: use worldstate.chat if present
    const base = String(config?.worldApiBase || "").trim();
    const token = String(config?.worldStateToken || "").trim();
    const wsUrl = String(config?.worldStateUrl || "").trim();

    // Attempt 1: base/chat.json
    if (base) {
      try {
        const data = await fetchJson(withProtocol(`${base.replace(/\/+$/, "")}/chat.json`), 5000);
        const lines = Array.isArray(data) ? data : (Array.isArray(data?.lines) ? data.lines : (Array.isArray(data?.chat) ? data.chat : []));
        renderChat(lines);
        safeSetText(chatSendStatus, "Connected");
        chatSendStatus?.classList.remove("bad");
        chatSendStatus?.classList.add("good");
        return;
      } catch {
        // fall through
      }
    }

    // Attempt 2: worldstate chat field
    if (wsUrl) {
      try {
        const ws = await fetchJson(wsUrl, 6000);
        const lines = ws?.chat || ws?.extra?.chat || [];
        if (Array.isArray(lines)) renderChat(lines);
        safeSetText(chatSendStatus, "Connected");
        chatSendStatus?.classList.remove("bad");
        chatSendStatus?.classList.add("good");
        return;
      } catch {
        // fall through
      }
    }

    safeSetText(chatSendStatus, "Not connected");
    chatSendStatus?.classList.remove("good");
    chatSendStatus?.classList.add("bad");
  }

  async function sendChat(config) {
    if (!chatEnabled) return;

    const name = String(chatName?.value || "").trim() || "Web";
    const msg = String(chatMsg?.value || "").trim();
    if (!msg) return;

    const base = String(config?.worldApiBase || "").trim();
    const token = String(config?.worldStateToken || "").trim();

    if (!base) {
      alert("Chat send is not configured (worldApiBase is missing).");
      return;
    }
    if (!token) {
      alert("Chat send is not configured (worldStateToken is missing).");
      return;
    }

    const url = withProtocol(`${base.replace(/\/+$/, "")}/chat/send`);

    disableButtonLike(chatSendBtn, "Sending…");
    safeSetText(chatSendStatus, "Sending…");
    chatSendStatus?.classList.remove("bad", "good");
    chatSendStatus?.classList.add("warn");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worldstate-Token": token
        },
        body: JSON.stringify({ name, message: msg })
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

      chatMsg.value = "";
      safeSetText(chatSendStatus, "Sent!");
      chatSendStatus?.classList.remove("warn");
      chatSendStatus?.classList.add("good");
    } catch (e) {
      safeSetText(chatSendStatus, "Send failed");
      chatSendStatus?.classList.remove("warn");
      chatSendStatus?.classList.add("bad");
      alert("Chat send failed:\n" + (e?.message || e));
    } finally {
      enableButtonLike(chatSendBtn);
      setTimeout(() => {
        if (chatEnabled) safeSetText(chatSendStatus, "Connected");
      }, 1200);
    }
  }

  // ----------------------------
  // Worldstate load
  // ----------------------------
  async function loadWorldState(config) {
    const url = String(config?.worldStateUrl || "").trim();
    if (!url) throw new Error("worldStateUrl missing");

    const ws = await fetchJson(url, 8000);
    latestWorldState = ws;

    // online/offline
    const online =
      Boolean(ws?.online ?? ws?.server?.online ?? true) &&
      (ws?.error ? false : true);

    setStatus(online, online ? "Online" : "Offline");

    // last update timestamp
    // try meta.generatedAt (seconds) first
    const genSec = ws?.meta?.generatedAt ?? ws?.generatedAt ?? ws?.ts ?? null;
    if (genSec) {
      const ms = Number(genSec) * (String(genSec).length <= 10 ? 1000 : 1);
      safeSetText(lastUpdate, formatTimeAgo(ms));
    } else {
      safeSetText(lastUpdate, "—");
    }

    // motd
    const motd = ws?.motd || ws?.server?.motd || "";
    safeSetText(serverMotd, motd || "—");

    renderWorldMood(ws);
    renderPerformance(ws);
    renderAE2(ws);
    renderPlayers(ws);

    // kits often live in worldstate
    await loadKits(config, ws);

    return ws;
  }

  // ----------------------------
  // Refresh loops
  // ----------------------------
  function startCountdown() {
    if (countdownTicker) clearInterval(countdownTicker);
    countdown = refreshSeconds;
    safeSetText(refreshIn, `${countdown}s`);
    countdownTicker = setInterval(() => {
      countdown = Math.max(0, countdown - 1);
      safeSetText(refreshIn, `${countdown}s`);
    }, 1000);
  }

  async function refreshAll() {
    if (!cfg) return;
    try {
      await loadWorldState(cfg);
    } catch (e) {
      setStatus(false, "Offline");
      safeSetText(lastUpdate, "—");
      safeSetText(serverMotd, "Worldstate unavailable");
      // console.warn(e);
    }

    // waystones + modlist can refresh less frequently, but it’s fine here
    loadWaystones(cfg);
    // mods are static file; refresh occasionally but cheap
    loadMods();
  }

  function startRefreshLoop() {
    if (refreshTicker) clearInterval(refreshTicker);
    startCountdown();
    refreshAll();
    refreshTicker = setInterval(() => {
      countdown = refreshSeconds;
      refreshAll();
    }, refreshSeconds * 1000);
  }

  function startChatLoop() {
    if (chatTicker) clearInterval(chatTicker);
    loadChat(cfg);
    chatTicker = setInterval(() => loadChat(cfg), chatFastSeconds * 1000);
  }

  // ----------------------------
  // Search handlers
  // ----------------------------
  function wireSearch() {
    if (waystoneSearch) waystoneSearch.addEventListener("input", () => renderWaystones(latestWaystones));
    if (kitSearch) kitSearch.addEventListener("input", () => renderKits(latestKits));
    if (modSearch) modSearch.addEventListener("input", () => renderMods(latestMods));
  }

  function wireChatSend() {
    if (!chatSendBtn) return;
    chatSendBtn.addEventListener("click", () => sendChat(cfg));
    if (chatMsg) {
      chatMsg.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendChat(cfg);
        }
      });
    }
  }

  // ----------------------------
  // Init
  // ----------------------------
  (async function init() {
    wireSearch();
    wireChatSend();

    try {
      cfg = await fetchJson("data/server.json", 8000);
    } catch (e) {
      setStatus(false, "Config error");
      safeSetText(serverMotd, "Could not load data/server.json");
      if (mapFallback) mapFallback.style.display = "";
      return;
    }

    applyStaticLinks(cfg);
    applyMaintenanceFromCfg(cfg);
    setModpackLinks(cfg);

    // Initial load
    await refreshAll();

    // Start loops
    startRefreshLoop();
    startChatLoop();
  })();
})();