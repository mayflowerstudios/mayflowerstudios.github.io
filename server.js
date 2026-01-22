(async function () {
  const el = (id) => document.getElementById(id);

  // -----------------------------
  // Core UI elements
  // -----------------------------
  const statusDot = el("statusDot");
  const statusText = el("statusText");
  const refreshIn = el("refreshIn");
  const lastUpdate = el("lastUpdate");

  const serverAddress = el("serverAddress");
  const playersLine = el("playersLine");
  const versionLine = el("versionLine");
  const pingLine = el("pingLine");

  const playerTags = el("playerTags");

  const copyIpBtn = el("copyIpBtn");
  const joinLink = el("joinLink");
  const discordLink = el("discordLink");

  const modpackCurseforge = el("modpackCurseforge");
  const modpackDirect = el("modpackDirect");
  const modpackNote = el("modpackNote");

  const sparkLink = el("sparkLink");
  const rulesLink = el("rulesLink");
  const changelogLink = el("changelogLink");

  const openMapBtn = el("openMapBtn");
  const openMapBtn2 = el("openMapBtn2");
  const mapHint = el("mapHint");

  const modSearch = el("modSearch");
  const categoryRow = el("categoryRow");
  const modTbody = el("modTbody");

  // Players Online widget (Query via mcsrvstat.us)
  const playersOnlineCount = el("playersOnlineCount");
  const playersMaxCount = el("playersMaxCount");
  const playersOnlineList = el("playersOnlineList");
  const playersOnlineNote = el("playersOnlineNote");

  // Minecraft pills
  const mcDayEl = el("mcDay");
  const mcTimeEl = el("mcTime");
  const mcSeasonEl = el("mcSeason");

  // Map embed elements
  const bluemapFrame = el("bluemapFrame");
  const mapFallback = el("mapFallback");

  // -----------------------------
  // Helpers
  // -----------------------------
  function safeSetText(node, text) {
    if (!node) return;
    node.textContent = text;
  }
  function safeSetHtml(node, html) {
    if (!node) return;
    node.innerHTML = html;
  }
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function originFromUrl(url) {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }

  function ticksToIRLClock(ticks) {
    // Minecraft: 0 ticks = 6:00 AM
    const total = (Number(ticks) + 6000) % 24000;
    const hours24 = Math.floor(total / 1000);
    const minutes = Math.floor(((total % 1000) / 1000) * 60);

    const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const ampm = hours24 < 12 ? "AM" : "PM";
    return `${h12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  }

  async function tryFetchJson(urls) {
    let lastErr;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
        const data = await res.json();
        return { url, data };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("All endpoints failed");
  }

  // -----------------------------
  // Load config
  // -----------------------------
  let cfg;
  try {
    cfg = await fetch("data/server.json", { cache: "no-store" }).then((r) => r.json());
  } catch (e) {
    console.error("Could not load data/server.json", e);
    safeSetText(statusText, "Config missing");
    return;
  }

  const address = (cfg.address || "").trim();
  const refreshSeconds = Math.max(10, Number(cfg.refreshSeconds || 30));

  safeSetText(serverAddress, address || "—");

  if (joinLink) joinLink.href = cfg.howToJoinUrl || "#";
  if (discordLink) discordLink.href = cfg.discordUrl || "#";

  if (modpackCurseforge) modpackCurseforge.href = cfg.modpack?.curseforgeUrl || "#";
  if (modpackDirect) modpackDirect.href = cfg.modpack?.directZipUrl || "#";
  safeSetText(modpackNote, cfg.modpack?.note || "");

  if (sparkLink) sparkLink.href = cfg.links?.sparkUrl || "#";
  if (rulesLink) rulesLink.href = cfg.links?.rulesUrl || "#";
  if (changelogLink) changelogLink.href = cfg.links?.changelogUrl || "#";

  // -----------------------------
  // Map embed + open button fallback
  // -----------------------------
  const mapUrl = (window.MAYFLOWER_BLUEMAP_URL || cfg.mapEmbedUrl || "").trim();
  const mapButtonUrl = (cfg.mapDirectHttpUrl || mapUrl || "").trim();

  function wireMapButtons(url) {
    if (openMapBtn) openMapBtn.href = url || "#";
    if (openMapBtn2) openMapBtn2.href = url || "#";
  }

  if (mapUrl) {
    wireMapButtons(mapButtonUrl);

    if (bluemapFrame) bluemapFrame.src = mapUrl;
    if (mapFallback) mapFallback.style.display = "none";

    if (mapHint) {
      mapHint.textContent =
        "If the embed is blank, click “Open Map” (some browsers block iframes).";
    }
  } else {
    wireMapButtons("#");

    if (mapFallback) mapFallback.style.display = "block";

    if (mapHint) {
      mapHint.textContent =
        "Set mapEmbedUrl in data/server.json (or window.MAYFLOWER_BLUEMAP_URL) to enable the map.";
    }
  }

  // -----------------------------
  // Copy IP
  // -----------------------------
  if (copyIpBtn) {
    copyIpBtn.addEventListener("click", async () => {
      if (!address) {
        alert("Server address isn't set yet (data/server.json).");
        return;
      }
      try {
        await navigator.clipboard.writeText(address);
        copyIpBtn.textContent = "✅ Copied!";
        setTimeout(() => (copyIpBtn.textContent = "📋 Copy Server IP"), 1200);
      } catch {
        alert("Couldn’t copy automatically — manually copy:\n" + address);
      }
    });
  }

  // If address isn't set, stop here (prevents bad API calls)
  if (!address) {
    safeSetText(statusText, "Set server address");
    safeSetText(playersLine, "—");
    safeSetText(versionLine, "—");
    safeSetText(pingLine, "—");
    safeSetText(refreshIn, "—");

    safeSetText(mcDayEl, "—");
    safeSetText(mcTimeEl, "—");
    safeSetText(mcSeasonEl, "—");
    return;
  }

  // -----------------------------
  // Server Status (mcstatus.io)
  // -----------------------------
  const statusUrl = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}`;

  function setOnline(online) {
    if (!statusDot || !statusText) return;
    statusDot.classList.remove("online", "offline");
    statusDot.classList.add(online ? "online" : "offline");
    statusText.textContent = online ? "Online" : "Offline";
  }

  function renderPlayers(list) {
    if (!playerTags) return;
    playerTags.innerHTML = "";
    if (!list || !Array.isArray(list) || list.length === 0) return;

    const shown = list.slice(0, 20);
    for (const p of shown) {
      const name = p?.name_clean || p?.name_raw || p?.name || "Player";
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = name;
      playerTags.appendChild(span);
    }

    if (list.length > shown.length) {
      const more = document.createElement("span");
      more.className = "tag";
      more.textContent = `+${list.length - shown.length} more`;
      playerTags.appendChild(more);
    }
  }

  async function fetchStatus() {
    const t0 = performance.now();

    try {
      const res = await fetch(statusUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
      const data = await res.json();

      setOnline(!!data.online);

      const online = data?.players?.online ?? 0;
      const max = data?.players?.max ?? 0;
      safeSetText(playersLine, `${online} / ${max}`);

      const version =
        data?.version?.name_clean ||
        data?.version?.name_raw ||
        data?.version?.name ||
        data?.version?.protocol ||
        "—";
      safeSetText(versionLine, String(version || "—"));

      const latency = data?.latency ?? Math.round(performance.now() - t0);
      safeSetText(pingLine, `${latency} ms`);

      renderPlayers(data?.players?.list);
      safeSetText(lastUpdate, new Date().toLocaleTimeString());
    } catch (err) {
      setOnline(false);
      safeSetText(playersLine, "—");
      safeSetText(versionLine, "—");
      safeSetText(pingLine, "—");
      safeSetHtml(playerTags, "");
      safeSetText(lastUpdate, new Date().toLocaleTimeString());
      console.warn("Status fetch failed:", err);
    }
  }

  // -----------------------------
  // Players Online (Query via mcsrvstat.us)
  // -----------------------------
  async function fetchPlayersViaQuery(addr) {
    const url = `https://api.mcsrvstat.us/2/${encodeURIComponent(addr)}`;

    if (!playersOnlineCount || !playersMaxCount || !playersOnlineList || !playersOnlineNote) return;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.online) {
        playersOnlineCount.textContent = "0";
        playersMaxCount.textContent = "—";
        playersOnlineList.innerHTML = "";
        playersOnlineNote.textContent = "Server appears offline (or blocked from status/query).";
        return;
      }

      const online = data?.players?.online ?? 0;
      const max = data?.players?.max ?? "—";
      const list = data?.players?.list ?? [];

      playersOnlineCount.textContent = String(online);
      playersMaxCount.textContent = String(max);

      playersOnlineList.innerHTML = "";

      if (Array.isArray(list) && list.length) {
        for (const name of list.slice(0, 30)) {
          const span = document.createElement("span");
          span.className = "tag";
          span.textContent = name;
          playersOnlineList.appendChild(span);
        }
        if (list.length > 30) {
          const more = document.createElement("span");
          more.className = "tag";
          more.textContent = `+${list.length - 30} more`;
          playersOnlineList.appendChild(more);
        }
        playersOnlineNote.textContent = "Names provided by Minecraft Query.";
      } else {
        playersOnlineNote.textContent =
          online > 0
            ? "Players are online, but names aren’t available. Enable Query in server.properties and forward UDP."
            : "Nobody online right now.";
      }
    } catch (e) {
      playersOnlineCount.textContent = "—";
      playersMaxCount.textContent = "—";
      playersOnlineList.innerHTML = "";
      playersOnlineNote.textContent = "Couldn’t fetch player list (API/network issue).";
      console.warn("Query player fetch failed:", e);
    }
  }

  // -----------------------------
  // World HUD: Day / Time / Season
  //
  // NOW:
  //  - Time comes from old BlueMap: /maps/<mapId>/live/world.json
  //  - Day + Season are placeholders
  //
  // LATER (after you make the mod):
  //  - We’ll fetch a JSON endpoint that includes true day + Serene Seasons
  // -----------------------------

  // Config knobs you can add later:
  // "bluemapMapId": "world"
  // "worldStateUrl": "https://yourdomain/worldstate.json"
  // worldstate.json format (suggested):
  // { day: 128, ticks: 13542, season: "Autumn", subSeason: "Early", seasonDay: 6 }
  const bluemapMapId = (cfg.bluemapMapId || "").trim();
  const worldStateUrl = (cfg.worldStateUrl || "").trim();

  // Build BlueMap OLD endpoints (auto-try base + id)
  async function fetchTimeFromBlueMap() {
    if (!mcTimeEl) return;

    if (!mapUrl) {
      safeSetText(mcTimeEl, "Set map URL");
      return;
    }

    const origin = originFromUrl(mapUrl);
    if (!origin) {
      safeSetText(mcTimeEl, "Set map URL");
      return;
    }

    const bases = [`${origin}/bluemap`, `${origin}`];
    const ids = [
      ...(bluemapMapId ? [bluemapMapId] : []),
      "world",
      "overworld",
      "survival",
      "minecraft_overworld",
    ];

    const candidates = [];
    for (const base of bases) {
      for (const id of ids) {
        candidates.push(`${base}/maps/${encodeURIComponent(id)}/live/world.json`);
      }
    }

    const { data } = await tryFetchJson(candidates);

    const ticks =
      data?.dayTime ??
      data?.time ??
      data?.worldTime ??
      data?.data?.time;

    if (!Number.isFinite(Number(ticks))) {
      throw new Error("BlueMap JSON missing time/dayTime");
    }

    safeSetText(mcTimeEl, ticksToIRLClock(Number(ticks)));
    return Number(ticks);
  }

  // Future mod endpoint: true day + seasons, plus ticks (optional)
  async function fetchWorldStateFromMod() {
    if (!worldStateUrl) return null;

    const res = await fetch(worldStateUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`worldStateUrl HTTP ${res.status}`);
    return await res.json();
  }

  async function updateWorldHud() {
    // Defaults / placeholders
    if (mcDayEl) safeSetText(mcDayEl, "—");
    if (mcSeasonEl) safeSetText(mcSeasonEl, "—");
    if (mcTimeEl) safeSetText(mcTimeEl, "Loading…");

    // 1) Try mod endpoint first (later you turn it on, instantly works)
    if (worldStateUrl) {
      try {
        const ws = await fetchWorldStateFromMod();
        if (ws) {
          // Day
          if (mcDayEl && Number.isFinite(Number(ws.day))) {
            safeSetText(mcDayEl, `Day ${Number(ws.day)}`);
          } else if (mcDayEl) {
            safeSetText(mcDayEl, "Day ?");
          }

          // Time (prefer ticks from mod if provided; otherwise fallback)
          if (mcTimeEl && Number.isFinite(Number(ws.ticks))) {
            safeSetText(mcTimeEl, ticksToIRLClock(Number(ws.ticks)));
          } else {
            await fetchTimeFromBlueMap();
          }

          // Season (Serene Seasons)
          if (mcSeasonEl) {
            const season = ws.season || ws.seasonName;
            const sub = ws.subSeason || ws.subseason || ws.subSeasonName;
            const sDay = ws.seasonDay;

            if (season && sub && Number.isFinite(Number(sDay))) {
              safeSetText(mcSeasonEl, `${sub} ${season} (Day ${Number(sDay)})`);
            } else if (season && sub) {
              safeSetText(mcSeasonEl, `${sub} ${season}`);
            } else if (season) {
              safeSetText(mcSeasonEl, String(season));
            } else {
              safeSetText(mcSeasonEl, "—");
            }
          }

          return; // done
        }
      } catch (e) {
        console.warn("World state (mod) fetch failed; falling back to BlueMap time:", e);
      }
    }

    // 2) Fallback: BlueMap time only (works now)
    try {
      await fetchTimeFromBlueMap();
      if (mcDayEl) safeSetText(mcDayEl, "—");      // true day not available yet
      if (mcSeasonEl) safeSetText(mcSeasonEl, "—"); // seasons need the mod
    } catch (e) {
      if (mcTimeEl) safeSetText(mcTimeEl, "Unavailable");
      if (mcDayEl) safeSetText(mcDayEl, "—");
      if (mcSeasonEl) safeSetText(mcSeasonEl, "—");
      console.warn("World HUD update failed:", e);
    }
  }

  // -----------------------------
  // Refresh countdown + polling
  // -----------------------------
  let remaining = refreshSeconds;

  async function tick() {
    remaining -= 1;

    if (remaining <= 0) {
      remaining = refreshSeconds;
      await fetchStatus();
      await fetchPlayersViaQuery(address);
      await updateWorldHud();
    }

    safeSetText(refreshIn, `${remaining}s`);
  }

  // Initial fetches
  await fetchStatus();
  await fetchPlayersViaQuery(address);
  await updateWorldHud();

  safeSetText(refreshIn, `${remaining}s`);
  setInterval(tick, 1000);

  // -----------------------------
  // Modlist
  // -----------------------------
  let mods = [];
  try {
    const modData = await fetch("data/modlist.json", { cache: "no-store" }).then((r) => r.json());
    mods = Array.isArray(modData?.mods) ? modData.mods : [];
  } catch (e) {
    console.warn("Could not load data/modlist.json", e);
  }

  const categories = ["All", ...Array.from(new Set(mods.map((m) => m.category).filter(Boolean)))].sort((a, b) =>
    a.localeCompare(b)
  );

  let activeCategory = "All";

  function renderCategoryButtons() {
    if (!categoryRow) return;
    categoryRow.innerHTML = "";

    for (const cat of categories) {
      const btn = document.createElement("button");
      btn.className = "btn";
      if (cat === activeCategory) btn.classList.add("primary");
      btn.textContent = cat;

      btn.addEventListener("click", () => {
        activeCategory = cat;
        renderCategoryButtons();
        renderMods();
      });

      categoryRow.appendChild(btn);
    }
  }

  function matches(mod, q) {
    if (!q) return true;
    const blob = `${mod.name || ""} ${mod.category || ""} ${mod.side || ""} ${mod.notes || ""}`.toLowerCase();
    return blob.includes(q);
  }

  function renderMods() {
    if (!modTbody) return;
    const q = (modSearch?.value || "").trim().toLowerCase();

    const filtered = mods.filter((m) => {
      if (activeCategory !== "All" && (m.category || "") !== activeCategory) return false;
      return matches(m, q);
    });

    modTbody.innerHTML = "";

    for (const m of filtered) {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.innerHTML = `<strong>${escapeHtml(m.name || "Unnamed")}</strong>`;
      tr.appendChild(tdName);

      const tdCat = document.createElement("td");
      tdCat.textContent = m.category || "—";
      tr.appendChild(tdCat);

      const tdSide = document.createElement("td");
      tdSide.textContent = m.side || "—";
      tr.appendChild(tdSide);

      const tdNotes = document.createElement("td");
      tdNotes.textContent = m.notes || "";
      tr.appendChild(tdNotes);

      modTbody.appendChild(tr);
    }

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.innerHTML = `<span class="muted2">No mods matched that search.</span>`;
      tr.appendChild(td);
      modTbody.appendChild(tr);
    }
  }

  if (modSearch) modSearch.addEventListener("input", renderMods);
  renderCategoryButtons();
  renderMods();
})();
