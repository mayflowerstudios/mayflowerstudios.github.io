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

  const mapWrap = el("mapWrap");
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

  // Minecraft time pills (you add these in HTML)
  const mcDayEl = el("mcDay");
  const mcTimeEl = el("mcTime");

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

  function formatClockFromTicks(ticks) {
    // Minecraft: 0 ticks = 6:00 AM (IRL-equivalent clock)
    const total = (Number(ticks) + 6000) % 24000;
    const hours24 = Math.floor(total / 1000);
    const minutes = Math.floor(((total % 1000) / 1000) * 60);

    const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const ampm = hours24 < 12 ? "AM" : "PM";
    return `${h12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  }

  function buildBlueMapWorldJsonUrl(mapUrl, worldId) {
    // mapUrl example: https://example.com:8100/ or https://example.com:8100/bluemap/
    // We want:        https://example.com:8100/bluemap/data/worlds/<worldId>.json
    try {
      if (!mapUrl) return null;

      const u = new URL(mapUrl);
      const origin = u.origin; // keeps https/http and port consistent
      const path = u.pathname || "/";

      // If the embed url already points inside /bluemap/ keep it.
      // Otherwise assume BlueMap is served at /bluemap/
      const basePath = path.includes("/bluemap") ? "/bluemap" : "/bluemap";

      return `${origin}${basePath}/maps/${encodeURIComponent(worldId)}.json`;
    } catch {
      return null;
    }
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

  // Copy IP
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

  // -----------------------------
  // Map embed + open button fallback
  // -----------------------------
  const mapUrl = (window.MAYFLOWER_BLUEMAP_URL || cfg.mapEmbedUrl || "").trim();
  const mapRawUrl = (window.MAYFLOWER_BLUEMAP_URL || cfg.mapDirectHttpUrl || "").trim();
  const bluemapFrame = el("bluemapFrame");
  const mapFallback = el("mapFallback");

  function wireMapButtons(url) {
    if (openMapBtn) openMapBtn.href = url || "#";
    if (openMapBtn2) openMapBtn2.href = url || "#";
  }

  if (mapUrl) {
    wireMapButtons(mapUrl);

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

  // If address isn't set, stop here (prevents bad API calls)
  if (!address) {
    safeSetText(statusText, "Set server address");
    safeSetText(playersLine, "—");
    safeSetText(versionLine, "—");
    safeSetText(pingLine, "—");
    safeSetText(refreshIn, "—");
    // Minecraft time also can't load without mapUrl; show placeholders
    safeSetText(mcDayEl, "—");
    safeSetText(mcTimeEl, "—");
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

    // Widget might not be on the page; keep it silent
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
  // Minecraft World Day/Time (via BlueMap JSON)
  // -----------------------------
  // You can override this in data/server.json later if you want:
  //   "bluemapWorldId": "world"
  const bluemapWorldId = (cfg.bluemapWorldId || "world").trim();

  // Build URL from your embed map URL so protocol/port match
  const bluemapWorldJsonUrl = buildBlueMapWorldJsonUrl(mapRawUrl, bluemapWorldId);

  async function fetchMinecraftWorldTime() {
    if (!mcDayEl || !mcTimeEl) return;          // pills not on page
    if (!bluemapWorldJsonUrl) {                // no map url configured
      safeSetText(mcDayEl, "—");
      safeSetText(mcTimeEl, "Set map URL");
      return;
    }

    try {
      const res = await fetch(bluemapWorldJsonUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`BlueMap HTTP ${res.status}`);

      const data = await res.json();
      const ticks = Number(data?.time);

      if (!Number.isFinite(ticks)) throw new Error("BlueMap JSON missing time");

      const day = Math.floor(ticks / 24000);
      const clock = formatClockFromTicks(ticks);

      safeSetText(mcDayEl, `Day ${day}`);
      safeSetText(mcTimeEl, clock);
    } catch (e) {
      safeSetText(mcDayEl, "—");
      safeSetText(mcTimeEl, "Unavailable");
      console.warn("World time fetch failed:", e);
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
      await fetchMinecraftWorldTime(); // tie to refresh cadence
    }

    safeSetText(refreshIn, `${remaining}s`);
  }

  // Initial fetches
  await fetchStatus();
  await fetchPlayersViaQuery(address);
  await fetchMinecraftWorldTime();

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
