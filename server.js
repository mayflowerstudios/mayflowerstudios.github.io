(async function () {
  const el = (id) => document.getElementById(id);
  const safeSetText = (node, text) => { if (node) node.textContent = text; };

  // Header
  const statusDot = el("statusDot");
  const statusText = el("statusText");
  const refreshIn = el("refreshIn");
  const lastUpdate = el("lastUpdate");

  const serverTitle = el("serverTitle");
  const serverAddress = el("serverAddress");
  const serverMotd = el("serverMotd");

  const copyIpBtn = el("copyIpBtn");
  const joinLink = el("joinLink");
  const discordLink = el("discordLink");
  const rulesLink = el("rulesLink");
  const modpackCurseforge = el("modpackCurseforge");
  const sparkLink = el("sparkLink");
  const openMapBtn = el("openMapBtn");

  // HUD strip
  const mcDayEl = el("mcDay");
  const mcTimeEl = el("mcTime");
  const mcSeasonEl = el("mcSeason");
  const mcWeatherEl = el("mcWeather");
  const tpsLine = el("tpsLine");
  const msptLine = el("msptLine");
  const memLine = el("memLine");

  // Map
  const bluemapFrame = el("bluemapFrame");
  const mapFallback = el("mapFallback");

  // Players
  const playersOnlineCount = el("playersOnlineCount");
  const playersMaxCount = el("playersMaxCount");
  const playersOnlineCountMini = el("playersOnlineCountMini");
  const playersMaxCountMini = el("playersMaxCountMini");
  const playersGrid = el("playersGrid");
  const playersOnlineNote = el("playersOnlineNote");

  // Chat
  const chatList = el("chatList");
  const chatNote = el("chatNote");

  // Waystones
  const waystoneSearch = el("waystoneSearch");
  const waystoneList = el("waystoneList");
  const waystoneMeta = el("waystoneMeta");
  const waystoneNote = el("waystoneNote");

  // Modlist
  const modSearch = el("modSearch");
  const categoryRow = el("categoryRow");
  const modTbody = el("modTbody");
  const modCountEl = el("modCount");

  // -----------------------------
  // Helpers
  // -----------------------------
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function withProtocol(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    return "https://" + u;
  }

  function setOnline(online) {
    if (!statusDot || !statusText) return;
    statusDot.classList.remove("online", "offline");
    statusDot.classList.add(online ? "online" : "offline");
    statusText.textContent = online ? "Online" : "Offline";
  }

  function setCountsEverywhere(online, max) {
    const o = (online == null) ? "—" : String(online);
    const m = (max == null) ? "—" : String(max);
    if (playersOnlineCount) playersOnlineCount.textContent = o;
    if (playersMaxCount) playersMaxCount.textContent = m;
    if (playersOnlineCountMini) playersOnlineCountMini.textContent = o;
    if (playersMaxCountMini) playersMaxCountMini.textContent = m;
  }

  function avatarUrl(name) {
    return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
  }

  function prettyToken(v) {
    if (v == null) return "";
    const raw = String(v).trim();
    if (!raw) return "";
    if (/^[A-Z0-9_]+$/.test(raw)) {
      return raw.toLowerCase().split("_").filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    }
    return raw.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  function fmtWeather(w) {
    if (!w) return "—";
    if (w.isThundering) return "⛈️ Thunder";
    if (w.isRaining) return "🌧️ Rain";
    return "☁️ Clear";
  }

  function seasonLabel(season, subSeason, seasonDay) {
    const seasonEmoji = { Spring: "🌸", Summer: "☀️", Autumn: "🍂", Fall: "🍂", Winter: "❄️" };
    const pSeason = prettyToken(season);
    const pSub = prettyToken(subSeason);
    const label = [pSub, pSeason].filter(Boolean).join(" ").trim();
    const emoji = seasonEmoji[pSeason] ? `${seasonEmoji[pSeason]} ` : "";
    return Number.isFinite(Number(seasonDay))
      ? `${emoji}${label} (Day ${Number(seasonDay)})`
      : (label ? `${emoji}${label}` : "—");
  }

  function renderPlayers(publicPlayers, noteText="") {
    if (!playersGrid) return;
    playersGrid.innerHTML = "";

    const list = Array.isArray(publicPlayers) ? publicPlayers : [];

    if (!list.length) {
      if (playersOnlineNote) playersOnlineNote.textContent = noteText || "Nobody online right now.";
      return;
    }

    for (const p of list.slice(0, 24)) {
      const name = p?.name || "Player";
      const activity = p?.activity ? String(p.activity) : "Exploring…";
      const dim = p?.dimension ? String(p.dimension).replace("minecraft:", "").replaceAll("_"," ") : "";
      const sub = [activity, dim].filter(Boolean).join(" • ");

      const card = document.createElement("div");
      card.className = "pCard";

      const av = document.createElement("div");
      av.className = "avatar";
      const img = document.createElement("img");
      img.alt = name;
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = avatarUrl(name);
      av.appendChild(img);

      const meta = document.createElement("div");
      meta.className = "pMeta";
      meta.innerHTML = `<div class="pName">${escapeHtml(name)}</div><div class="pSub">${escapeHtml(sub)}</div>`;

      card.appendChild(av);
      card.appendChild(meta);
      playersGrid.appendChild(card);
    }

    if (list.length > 24) {
      const more = document.createElement("div");
      more.className = "pCard";
      more.innerHTML = `<div class="pMeta"><div class="pName">+${list.length - 24} more</div><div class="pSub">Online</div></div>`;
      playersGrid.appendChild(more);
    }

    if (playersOnlineNote) playersOnlineNote.textContent = noteText;
  }

  function renderChat(lines) {
    if (!chatList) return;
    chatList.innerHTML = "";

    const arr = Array.isArray(lines) ? lines : [];

    if (!arr.length) {
      const empty = document.createElement("div");
      empty.className = "chatLine";
      empty.innerHTML = `<div class="chatTop"><span>No messages yet</span><span>—</span></div>
                         <div class="chatMsg">It’s quiet… the kind of quiet before someone falls into a ravine.</div>`;
      chatList.appendChild(empty);
      return;
    }

    for (const l of arr.slice(-60)) {
      const name = l.name ?? l.user ?? "Server";
      const msg = l.msg ?? l.message ?? "";
      const ts = (l.ts != null) ? Number(l.ts) : (l.time ?? l.timestamp ?? null);
      const ms = Number.isFinite(ts) ? (ts < 2e10 ? ts * 1000 : ts) : null;
      const timeLabel = ms ? new Date(ms).toLocaleTimeString() : "";

      const div = document.createElement("div");
      div.className = "chatLine";
      div.innerHTML = `
        <div class="chatTop">
          <span>${escapeHtml(name)}</span>
          <span>${escapeHtml(timeLabel)}</span>
        </div>
        <div class="chatMsg">${escapeHtml(msg)}</div>
      `;
      chatList.appendChild(div);
    }

    chatList.scrollTop = chatList.scrollHeight;
  }

  // Waystones
  let waystones = [];

  function fmtXYZ(w) {
    const x = w?.x, y = w?.y, z = w?.z;
    if ([x,y,z].every(v => Number.isFinite(Number(v)))) return `${Number(x)}, ${Number(y)}, ${Number(z)}`;
    return "—";
  }

  function getWayName(w) {
    return (w?.name ?? w?.label ?? w?.title ?? "").trim() || "Unnamed Waystone";
  }

  function matchesWaystone(w, q) {
    if (!q) return true;
    const blob = `${getWayName(w)} ${w?.dimension ?? ""} ${fmtXYZ(w)} ${w?.isGlobal ? "global" : ""}`.toLowerCase();
    return blob.includes(q);
  }

  async function copyText(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch { return false; }
  }

  function renderWaystones() {
    if (!waystoneList) return;
    const q = (waystoneSearch?.value || "").trim().toLowerCase();
    const filtered = waystones.filter(w => matchesWaystone(w, q));

    waystoneList.innerHTML = "";
    if (waystoneMeta) {
      waystoneMeta.textContent = q ? `Showing ${filtered.length} of ${waystones.length}` : `${waystones.length} total`;
    }

    if (!filtered.length) {
      waystoneList.innerHTML =
        `<div class="wayItem"><div class="wayName">No waystones found.</div><div class="waySub">Try a different search.</div></div>`;
      return;
    }

    for (const w of filtered.slice(0, 80)) {
      const name = getWayName(w);
      const dim = String(w?.dimension || "—").replace("minecraft:", "").replaceAll("_"," ");
      const xyz = fmtXYZ(w);
      const global = w?.isGlobal ? " • Global" : "";

      const card = document.createElement("div");
      card.className = "wayItem";
      card.innerHTML = `
        <div>
          <div class="wayName">${escapeHtml(name)}</div>
          <div class="waySub">📍 ${escapeHtml(dim)} • ${escapeHtml(xyz)}${escapeHtml(global)}</div>
        </div>
        <div class="wayBtns">
          <button class="btnMini wayCopyName" type="button">📌 Copy name</button>
          <button class="btnMini wayCopyCoords" type="button">🧭 Copy coords</button>
        </div>
      `;

      const btnName = card.querySelector(".wayCopyName");
      const btnCoords = card.querySelector(".wayCopyCoords");

      btnName?.addEventListener("click", async () => {
        const ok = await copyText(name);
        btnName.textContent = ok ? "✅ Copied!" : "Copy failed";
        setTimeout(() => (btnName.textContent = "📌 Copy name"), 900);
      });

      btnCoords?.addEventListener("click", async () => {
        const ok = await copyText(xyz);
        btnCoords.textContent = ok ? "✅ Copied!" : "Copy failed";
        setTimeout(() => (btnCoords.textContent = "🧭 Copy coords"), 900);
      });

      waystoneList.appendChild(card);
    }

    if (filtered.length > 80) {
      const more = document.createElement("div");
      more.className = "wayItem";
      more.innerHTML = `<div class="wayName">+${filtered.length - 80} more</div><div class="waySub">Refine your search to narrow it down.</div>`;
      waystoneList.appendChild(more);
    }
  }

  if (waystoneSearch) waystoneSearch.addEventListener("input", renderWaystones);

  // -----------------------------
  // Config
  // -----------------------------
  let cfg;
  try {
    cfg = await fetch("data/server.json", { cache: "no-store" }).then(r => r.json());
  } catch (e) {
    console.error("Could not load data/server.json", e);
    safeSetText(statusText, "Config missing");
    return;
  }

  const serverName = (cfg.serverName || "").trim();
  const address = (cfg.address || "").trim();
  const refreshSeconds = Math.max(10, Number(cfg.refreshSeconds || 30));
  const worldStateUrl = (cfg.worldStateUrl || "").trim();

  if (serverTitle) serverTitle.textContent = serverName ? `🛰️ ${serverName}` : "🛰️ Server Dashboard";
  safeSetText(serverAddress, address || "—");

  if (joinLink) joinLink.href = cfg.howToJoinUrl || "#";
  if (discordLink) discordLink.href = cfg.discordUrl || "#";
  if (rulesLink) rulesLink.href = cfg.links?.rulesUrl || "#";
  if (sparkLink) sparkLink.href = cfg.links?.sparkUrl || "#";
  if (modpackCurseforge) modpackCurseforge.href = cfg.modpack?.curseforgeUrl || "#";

  // Map
  const mapUrl = (window.MAYFLOWER_BLUEMAP_URL || cfg.mapEmbedUrl || "").trim();
  const fixedMap = withProtocol(mapUrl);
  if (openMapBtn) openMapBtn.href = fixedMap || "#";
  if (fixedMap) {
    if (bluemapFrame) bluemapFrame.src = fixedMap;
    if (mapFallback) mapFallback.style.display = "none";
  } else {
    if (mapFallback) mapFallback.style.display = "block";
  }

  // Copy IP
  if (copyIpBtn) {
    copyIpBtn.addEventListener("click", async () => {
      if (!address) return alert("Server address isn't set yet (data/server.json).");
      try {
        await navigator.clipboard.writeText(address);
        copyIpBtn.textContent = "✅ Copied!";
        setTimeout(() => (copyIpBtn.textContent = "📋 Copy"), 1200);
      } catch {
        alert("Couldn’t copy automatically — manually copy:\n" + address);
      }
    });
  }

  // -----------------------------
  // WorldState (primary)
  // -----------------------------
  async function fetchWorldState() {
    if (!worldStateUrl) return null;
    const res = await fetch(worldStateUrl, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`worldStateUrl HTTP ${res.status}: ${text.slice(0, 120)}`);
    return JSON.parse(text);
  }

  function applyWorldState(ws) {
    setOnline(true);

    const meta = ws?.meta || {};
    if (meta.motd) safeSetText(serverMotd, meta.motd);

    const pubPlayers = Array.isArray(ws?.publicPlayers) ? ws.publicPlayers : [];
    const online = pubPlayers.length;
    const max = (meta.maxPlayers != null) ? meta.maxPlayers : null;
    setCountsEverywhere(online, max);

    const time = ws?.time || {};
    safeSetText(mcDayEl, Number.isFinite(Number(time.day)) ? `Day ${Number(time.day)}` : "Day ?");
    safeSetText(mcTimeEl, time.clock ? String(time.clock) : "Time ?");

    const s = ws?.season || {};
    safeSetText(mcSeasonEl, s.sereneSeasonsLoaded === false ? "—" : seasonLabel(s.season, s.subSeason, s.seasonDay));

    safeSetText(mcWeatherEl, fmtWeather(ws?.weather));

    const perf = ws?.perf || {};
    safeSetText(tpsLine, Number.isFinite(Number(perf.estTps)) ? Number(perf.estTps).toFixed(1) : "—");
    safeSetText(msptLine, Number.isFinite(Number(perf.avgMspt)) ? `${Number(perf.avgMspt).toFixed(1)}` : "—");
    if (Number.isFinite(Number(perf.usedMemMb)) && Number.isFinite(Number(perf.maxMemMb))) {
      safeSetText(memLine, `${Number(perf.usedMemMb)} / ${Number(perf.maxMemMb)} MB`);
    } else {
      safeSetText(memLine, "—");
    }

    renderPlayers(pubPlayers, pubPlayers.length ? "Live list from WorldState." : "Nobody online right now.");

    waystones = Array.isArray(ws?.waystones) ? ws.waystones : [];
    if (waystoneNote) {
      waystoneNote.textContent = waystones.length ? "Waystones loaded from WorldState." : "No waystones found (or none are public).";
    }
    renderWaystones();

    const chat = Array.isArray(ws?.chat) ? ws.chat : [];
    renderChat(chat);
    if (chatNote) chatNote.textContent = chat.length ? "Live feed from WorldState." : "No recent chat messages.";

    safeSetText(lastUpdate, new Date().toLocaleTimeString());
  }

  // Fallback: mcstatus.io
  async function fetchStatusFallback() {
    if (!address) return;
    const statusUrl = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}`;
    try {
      const res = await fetch(statusUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
      const data = await res.json();

      setOnline(!!data.online);

      const motd = data?.motd?.clean?.join(" ") || data?.motd?.raw?.join(" ") || "";
      if (motd) safeSetText(serverMotd, motd);

      const online = data?.players?.online ?? null;
      const max = data?.players?.max ?? null;
      if (online != null || max != null) setCountsEverywhere(online, max);

      safeSetText(lastUpdate, new Date().toLocaleTimeString());
    } catch (e) {
      setOnline(false);
      console.warn("Fallback status failed:", e);
    }
  }

  // -----------------------------
  // Polling
  // -----------------------------
  let remaining = refreshSeconds;

  async function refreshAll() {
    if (!worldStateUrl) {
      setOnline(false);
      safeSetText(serverMotd, "Set worldStateUrl in data/server.json.");
      safeSetText(mcDayEl, "—");
      safeSetText(mcTimeEl, "—");
      safeSetText(mcSeasonEl, "—");
      safeSetText(mcWeatherEl, "—");
      safeSetText(tpsLine, "—");
      safeSetText(msptLine, "—");
      safeSetText(memLine, "—");
      renderPlayers([], "WorldState is not configured.");
      waystones = [];
      renderWaystones();
      renderChat([]);
      return;
    }

    try {
      const ws = await fetchWorldState();
      applyWorldState(ws);
    } catch (e) {
      console.warn("WorldState failed:", e);
      await fetchStatusFallback();
      renderChat([]);
      waystones = [];
      renderWaystones();
      if (chatNote) chatNote.textContent = "Chat feed unavailable (endpoint/CORS/offline).";
      if (waystoneNote) waystoneNote.textContent = "Waystones unavailable (endpoint/CORS/offline).";
    }
  }

  async function tick() {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = refreshSeconds;
      await refreshAll();
    }
    safeSetText(refreshIn, `${remaining}s`);
  }

  setCountsEverywhere("—", "—");
  safeSetText(refreshIn, `${remaining}s`);
  await refreshAll();
  setInterval(tick, 1000);

  // -----------------------------
  // Modlist
  // -----------------------------
  let mods = [];
  try {
    const modData = await fetch("data/modlist.json", { cache: "no-store" }).then(r => r.json());
    mods = Array.isArray(modData?.mods) ? modData.mods : [];
  } catch (e) {
    console.warn("Could not load data/modlist.json", e);
  }

  const catSet = new Set(mods.map(m => (m.category || "").trim()).filter(Boolean));
  const categories = ["All", ...Array.from(catSet).sort((a,b)=>a.localeCompare(b))];
  let activeCategory = "All";

  function renderCategoryButtons() {
    if (!categoryRow) return;
    categoryRow.innerHTML = "";
    for (const cat of categories) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "catChip" + (cat === activeCategory ? " active" : "");
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
    const q = (modSearch?.value || "").trim().toLowerCase();
    const filtered = mods.filter(m => {
      if (activeCategory !== "All" && (m.category || "") !== activeCategory) return false;
      return matches(m, q);
    });

    if (modCountEl) {
      modCountEl.textContent =
        activeCategory === "All" && !q
          ? `${filtered.length} mods`
          : `${filtered.length} of ${mods.length}`;
    }

    if (!modTbody) return;
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
      td.innerHTML = `<span style="opacity:.78;">No mods matched that search.</span>`;
      tr.appendChild(td);
      modTbody.appendChild(tr);
    }
  }

  if (modSearch) modSearch.addEventListener("input", renderMods);
  renderCategoryButtons();
  renderMods();
})();