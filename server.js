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

  // Chat (feed)
  const chatList = el("chatList");
  const chatNote = el("chatNote");

  // Chat (composer)
  const chatName = el("chatName");
  const chatMsg = el("chatMsg");
  const chatSendBtn = el("chatSendBtn");
  const chatSendStatus = el("chatSendStatus");

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
    return String(str ?? "")
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

  function setOnlineState(state) {
    // state: "online" | "offline" | "stale" | "loading"
    if (!statusDot || !statusText) return;
    statusDot.classList.remove("online", "offline");
    if (state === "online") {
      statusDot.classList.add("online");
      statusText.textContent = "Online";
    } else if (state === "stale") {
      statusDot.classList.add("offline"); // visually red; feel free to add a CSS class "stale" later
      statusText.textContent = "Stale";
    } else if (state === "loading") {
      statusText.textContent = "Loading…";
    } else {
      statusDot.classList.add("offline");
      statusText.textContent = "Offline";
    }
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

  function nowLabel() {
    return new Date().toLocaleTimeString();
  }

  function msAgeLabel(ms) {
    if (!Number.isFinite(ms)) return "";
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }

  function setChatStatus(text, kind = "neutral") {
    if (!chatSendStatus) return;
    chatSendStatus.textContent = text;

    chatSendStatus.classList.remove("good", "bad");
    if (kind === "good") chatSendStatus.classList.add("good");
    if (kind === "bad") chatSendStatus.classList.add("bad");
  }

  // Fetch with timeout + abort
  async function fetchJson(url, timeoutMs = 5500) {
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

  async function fetchJsonPost(url, bodyObj, headers = {}, timeoutMs = 6500) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...headers
        },
        body: JSON.stringify(bodyObj)
      });
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
      if (!res.ok) {
        const code = json?.error || `HTTP_${res.status}`;
        const err = new Error(code);
        err.status = res.status;
        err.payload = json;
        err.raw = text;
        throw err;
      }
      return json;
    } finally {
      clearTimeout(t);
    }
  }

  async function copyText(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch { return false; }
  }

  function clampChat(str, max) {
    const s = String(str ?? "");
    if (!s) return "";
    // remove control chars except basic whitespace
    const cleaned = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
  }

  // -----------------------------
  // Players (smarter rendering)
  // -----------------------------
  let lastPlayersKey = "";

  function playersKey(list) {
    if (!Array.isArray(list)) return "";
    return list.map(p => `${p?.name ?? ""}|${p?.dimension ?? ""}|${p?.activity ?? ""}`).join(";");
  }

  function renderPlayers(publicPlayers, noteText = "") {
    if (!playersGrid) return;

    const list = Array.isArray(publicPlayers) ? publicPlayers : [];
    const key = playersKey(list);

    if (key === lastPlayersKey) {
      if (playersOnlineNote) playersOnlineNote.textContent = noteText;
      return;
    }
    lastPlayersKey = key;

    playersGrid.innerHTML = "";

    if (!list.length) {
      if (playersOnlineNote) playersOnlineNote.textContent = noteText || "Nobody online right now.";
      return;
    }

    const frag = document.createDocumentFragment();

    for (const p of list.slice(0, 24)) {
      const name = p?.name || "Player";
      const activity = p?.activity ? String(p.activity) : "Exploring…";
      const dim = p?.dimension ? String(p.dimension).replace("minecraft:", "").replaceAll("_", " ") : "";
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
      frag.appendChild(card);
    }

    if (list.length > 24) {
      const more = document.createElement("div");
      more.className = "pCard";
      more.innerHTML = `<div class="pMeta"><div class="pName">+${list.length - 24} more</div><div class="pSub">Online</div></div>`;
      frag.appendChild(more);
    }

    playersGrid.appendChild(frag);
    if (playersOnlineNote) playersOnlineNote.textContent = noteText;
  }

  // -----------------------------
  // Chat feed (keep scroll position if user is reading)
  // -----------------------------
  let lastChatKey = "";

  function chatKey(lines) {
    if (!Array.isArray(lines)) return "";
    const tail = lines.slice(-20);
    // include player/type/t so "Server" fallback doesn't collapse keys
    return tail.map(l => `${l?.t ?? l?.ts ?? l?.time ?? ""}|${l?.type ?? ""}|${l?.player ?? l?.name ?? l?.user ?? ""}|${l?.msg ?? l?.message ?? ""}`).join(";");
  }

  function isNearBottom(node) {
    if (!node) return true;
    const threshold = 40;
    return node.scrollHeight - node.scrollTop - node.clientHeight < threshold;
  }

  function typeBadge(type) {
    const t = String(type || "chat").toLowerCase();
    if (t === "chat") return "";
    if (t === "advancement") return "🏆 ";
    if (t === "join") return "🟢 ";
    if (t === "leave") return "🔴 ";
    if (t === "death") return "💀 ";
    if (t === "server") return "🛰️ ";
    if (t === "info") return "ℹ️ ";
    return "• ";
  }

  function defaultNameForType(type, player) {
    const t = String(type || "chat").toLowerCase();
    if (player) return player;
    if (t === "server") return "Server";
    return "Unknown";
  }

  function renderChat(lines) {
    if (!chatList) return;

    const arr = Array.isArray(lines) ? lines : [];
    const key = chatKey(arr);

    if (key === lastChatKey) return;
    lastChatKey = key;

    const stickToBottom = isNearBottom(chatList);

    chatList.innerHTML = "";

    if (!arr.length) {
      const empty = document.createElement("div");
      empty.className = "chatLine";
      empty.innerHTML = `<div class="chatTop"><span>No messages yet</span><span>—</span></div>
                         <div class="chatMsg">It’s quiet… the kind of quiet before someone falls into a ravine.</div>`;
      chatList.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    for (const l of arr.slice(-60)) {
      const type = l?.type ?? "chat";
      const name =
        l?.player ??
        l?.name ??
        l?.user ??
        defaultNameForType(type, null);

      const msg = l?.msg ?? l?.message ?? "";
      const ts = (l?.t != null) ? Number(l.t)
        : ((l?.ts != null) ? Number(l.ts)
          : (l?.time ?? l?.timestamp ?? null));

      const ms = Number.isFinite(ts) ? (ts < 2e10 ? ts * 1000 : ts) : null;
      const timeLabel = ms ? new Date(ms).toLocaleTimeString() : "";
      const badge = typeBadge(type);

      const div = document.createElement("div");
      div.className = "chatLine";
      div.innerHTML = `
        <div class="chatTop">
          <span>${escapeHtml(badge + name)}</span>
          <span>${escapeHtml(timeLabel)}</span>
        </div>
        <div class="chatMsg">${escapeHtml(msg)}</div>
      `;
      frag.appendChild(div);
    }

    chatList.appendChild(frag);
    if (stickToBottom) chatList.scrollTop = chatList.scrollHeight;
  }

  // -----------------------------
  // Waystones (same behavior, just faster + stable)
  // -----------------------------
  let waystones = [];
  let lastWayKey = "";

  function fmtXYZ(w) {
    const x = w?.x, y = w?.y, z = w?.z;
    if ([x, y, z].every(v => Number.isFinite(Number(v)))) return `${Number(x)}, ${Number(y)}, ${Number(z)}`;
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

  function wayKey(list) {
    if (!Array.isArray(list)) return "";
    return list.slice(0, 120).map(w => `${getWayName(w)}|${w?.dimension ?? ""}|${w?.x ?? ""},${w?.y ?? ""},${w?.z ?? ""}|${w?.isGlobal ? 1 : 0}`).join(";");
  }

  function renderWaystones(force = false) {
    if (!waystoneList) return;

    const q = (waystoneSearch?.value || "").trim().toLowerCase();
    const filtered = waystones.filter(w => matchesWaystone(w, q));

    const k = `${q}::${wayKey(filtered)}`;
    if (!force && k === lastWayKey) return;
    lastWayKey = k;

    waystoneList.innerHTML = "";
    if (waystoneMeta) {
      waystoneMeta.textContent = q ? `Showing ${filtered.length} of ${waystones.length}` : `${waystones.length} total`;
    }

    if (!filtered.length) {
      waystoneList.innerHTML =
        `<div class="wayItem"><div class="wayName">No waystones found.</div><div class="waySub">Try a different search.</div></div>`;
      return;
    }

    const frag = document.createDocumentFragment();

    for (const w of filtered.slice(0, 80)) {
      const name = getWayName(w);
      const dim = String(w?.dimension || "—").replace("minecraft:", "").replaceAll("_", " ");
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

      frag.appendChild(card);
    }

    if (filtered.length > 80) {
      const more = document.createElement("div");
      more.className = "wayItem";
      more.innerHTML = `<div class="wayName">+${filtered.length - 80} more</div><div class="waySub">Refine your search to narrow it down.</div>`;
      frag.appendChild(more);
    }

    waystoneList.appendChild(frag);
  }

  if (waystoneSearch) waystoneSearch.addEventListener("input", () => renderWaystones(true));

  // -----------------------------
  // Config
  // -----------------------------
  let cfg;
  try {
    cfg = await fetchJson("data/server.json", 6000);
  } catch (e) {
    console.error("Could not load data/server.json", e);
    safeSetText(statusText, "Config missing");
    setOnlineState("offline");
    return;
  }

  const serverName = (cfg.serverName || "").trim();
  const address = (cfg.address || "").trim();
  const refreshSeconds = Math.max(10, Number(cfg.refreshSeconds || 30));

  // IMPORTANT: this should be a full URL like "https://api.mayflowerstudios.net/api/public"
  // In your existing setup it's likely the endpoint that returns your snapshot.
  const worldStateUrl = (cfg.worldStateUrl || "").trim();

  // NEW: token for POST /api/chat
  const worldStateToken = String(cfg.worldStateToken || "").trim();

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
      const ok = await copyText(address);
      if (ok) {
        copyIpBtn.textContent = "✅ Copied!";
        setTimeout(() => (copyIpBtn.textContent = "📋 Copy"), 1200);
      } else {
        alert("Couldn’t copy automatically — manually copy:\n" + address);
      }
    });
  }

  // -----------------------------
  // Chat sending (POST /api/chat)
  // -----------------------------
  // (still here in case you want it later, but you’re using cfg.worldApiBase now)
  function apiBaseFromWorldStateUrl(wsUrl) {
    try {
      const u = new URL(wsUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      return "";
    }
  }

  // ✅ Use explicit API base (recommended)
  // Put this in data/server.json:
  //   "worldApiBase": "https://api.mayflowerstudios.net"
  const worldApiBase = (cfg.worldApiBase || "").trim();
  const chatPostUrl = worldApiBase ? `${worldApiBase.replace(/\/$/, "")}/api/chat` : "";

  function chatCanSend() {
    return Boolean(chatPostUrl) && Boolean(worldStateToken);
  }

  function initChatComposer() {
    if (!chatSendBtn || !chatMsg || !chatName) return;

    // Prefill a name from localStorage
    const savedName = localStorage.getItem("mf_webchat_name");
    if (savedName && !chatName.value) chatName.value = savedName;

    if (!chatCanSend()) {
      setChatStatus(worldStateToken ? "Chat endpoint missing" : "Token missing", "bad");
      chatSendBtn.disabled = true;
      chatSendBtn.style.opacity = ".6";
      chatSendBtn.style.cursor = "not-allowed";
      return;
    }

    setChatStatus("Ready to send", "good");

    function setSending(on) {
      if (!chatSendBtn) return;
      chatSendBtn.disabled = on;
      chatSendBtn.textContent = on ? "Sending…" : "📨 Send";
    }

    async function doSend() {
      if (!chatCanSend()) return;

      const name = clampChat(chatName.value, 24) || "Web";
      const msg = clampChat(chatMsg.value, 200);

      localStorage.setItem("mf_webchat_name", name);

      if (!msg) {
        setChatStatus("Type a message first", "bad");
        chatMsg.focus();
        return;
      }

      setSending(true);
      setChatStatus("Sending…", "neutral");

      try {
        await fetchJsonPost(
          chatPostUrl,
          { name, msg },
          { "X-Worldstate-Token": worldStateToken },
          7000
        );

        chatMsg.value = "";
        setChatStatus("Sent ✔", "good");

        // Pull latest state quickly so your message shows up in the feed
        remaining = 1;
      } catch (e) {
        const code = String(e?.message || "send_failed");
        if (code === "rate_limited" || e?.status === 429) {
          setChatStatus("Rate limited (wait a sec)", "bad");
        } else if (code === "forbidden" || e?.status === 403) {
          setChatStatus("Forbidden (bad token)", "bad");
        } else if (code === "web_chat_disabled") {
          setChatStatus("Web chat disabled server-side", "bad");
        } else {
          setChatStatus(`Failed: ${code}`, "bad");
        }
      } finally {
        setSending(false);
      }
    }

    chatSendBtn.addEventListener("click", doSend);
    chatMsg.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        doSend();
      }
    });
  }

  // -----------------------------
  // WorldState + Fallback
  // -----------------------------
  let lastGoodMs = 0;
  let backoff = 0; // grows on failures
  let lastApplyAt = 0;

  async function fetchWorldState() {
    if (!worldStateUrl) return null;
    return await fetchJson(worldStateUrl, 5500);
  }

  function applyWorldState(ws) {
    lastGoodMs = Date.now();
    setOnlineState("online");

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
    renderWaystones(true);

    const chat = Array.isArray(ws?.chat) ? ws.chat : [];
    renderChat(chat);
    if (chatNote) chatNote.textContent = chat.length ? "Live feed from WorldState." : "No recent chat messages.";

    safeSetText(lastUpdate, nowLabel());
    lastApplyAt = Date.now();

    // Improve composer status once we know server is reachable
    if (chatCanSend()) setChatStatus("Ready to send", "good");
    else setChatStatus(worldStateToken ? "Token set (endpoint?)" : "Token missing", chatCanSend() ? "good" : "bad");
  }

  async function fetchStatusFallback() {
    if (!address) return;
    const statusUrl = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}`;
    try {
      const data = await fetchJson(statusUrl, 6500);
      setOnlineState(data.online ? "online" : "offline");

      const motd = data?.motd?.clean?.join(" ") || data?.motd?.raw?.join(" ") || "";
      if (motd) safeSetText(serverMotd, motd);

      const online = data?.players?.online ?? null;
      const max = data?.players?.max ?? null;
      if (online != null || max != null) setCountsEverywhere(online, max);

      safeSetText(lastUpdate, nowLabel());
      lastApplyAt = Date.now();
    } catch (e) {
      setOnlineState("offline");
      console.warn("Fallback status failed:", e);
    }
  }

  // -----------------------------
  // Polling (pause when hidden + backoff)
  // -----------------------------
  let remaining = refreshSeconds;

  function clearLivePanels(reason) {
    safeSetText(serverMotd, reason || "WorldState not available.");
    safeSetText(mcDayEl, "—");
    safeSetText(mcTimeEl, "—");
    safeSetText(mcSeasonEl, "—");
    safeSetText(mcWeatherEl, "—");
    safeSetText(tpsLine, "—");
    safeSetText(msptLine, "—");
    safeSetText(memLine, "—");
    renderPlayers([], reason || "WorldState is not configured.");
    waystones = [];
    renderWaystones(true);
    renderChat([]);
    if (chatNote) chatNote.textContent = "Chat feed unavailable.";
    if (waystoneNote) waystoneNote.textContent = "Waystones unavailable.";

    // Composer status
    if (!chatCanSend()) setChatStatus(worldStateToken ? "Token set (server offline?)" : "Token missing", "bad");
    else setChatStatus("Server offline/stale", "bad");
  }

  async function refreshAll() {
    if (!worldStateUrl) {
      setOnlineState("offline");
      clearLivePanels("Set worldStateUrl in data/server.json.");
      return;
    }

    try {
      const ws = await fetchWorldState();
      applyWorldState(ws);
      backoff = 0;
    } catch (e) {
      console.warn("WorldState failed:", e);

      backoff = Math.min(60, backoff ? backoff * 2 : 2);

      const age = Date.now() - (lastGoodMs || 0);
      if (lastGoodMs && age < 120000) {
        setOnlineState("stale");
        if (chatNote) chatNote.textContent = `Showing last known data (${msAgeLabel(age)}).`;
        if (waystoneNote) waystoneNote.textContent = `Showing last known data (${msAgeLabel(age)}).`;
        if (chatCanSend()) setChatStatus(`Stale (${msAgeLabel(age)})`, "bad");
      } else {
        await fetchStatusFallback();
        clearLivePanels("WorldState endpoint/CORS/offline.");
      }
    }
  }

  function updateLastUpdateAge() {
    if (!lastApplyAt) return;
    const age = Date.now() - lastApplyAt;
    if (age > 120000) setOnlineState("stale");
  }

  function effectiveRefreshSeconds() {
    return refreshSeconds + backoff;
  }

  async function tick() {
    if (document.hidden) {
      safeSetText(refreshIn, "paused");
      updateLastUpdateAge();
      return;
    }

    remaining -= 1;
    if (remaining <= 0) {
      remaining = effectiveRefreshSeconds();
      await refreshAll();
    }

    safeSetText(refreshIn, `${remaining}s`);
    updateLastUpdateAge();
  }

  // Start
  setCountsEverywhere("—", "—");
  setOnlineState("loading");
  remaining = effectiveRefreshSeconds();
  safeSetText(refreshIn, `${remaining}s`);

  initChatComposer();
  await refreshAll();
  setInterval(tick, 1000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) remaining = 1;
  });

  // -----------------------------
  // Modlist (unchanged behavior, tiny optimizations)
  // -----------------------------
  let mods = [];
  try {
    const modData = await fetchJson("data/modlist.json", 6000);
    mods = Array.isArray(modData?.mods) ? modData.mods : [];
  } catch (e) {
    console.warn("Could not load data/modlist.json", e);
  }

  const catSet = new Set(mods.map(m => (m.category || "").trim()).filter(Boolean));
  const categories = ["All", ...Array.from(catSet).sort((a, b) => a.localeCompare(b))];
  let activeCategory = "All";

  function renderCategoryButtons() {
    if (!categoryRow) return;
    categoryRow.innerHTML = "";
    const frag = document.createDocumentFragment();
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
      frag.appendChild(btn);
    }
    categoryRow.appendChild(frag);
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

    const frag = document.createDocumentFragment();

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

      frag.appendChild(tr);
    }

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.innerHTML = `<span style="opacity:.78;">No mods matched that search.</span>`;
      tr.appendChild(td);
      frag.appendChild(tr);
    }

    modTbody.appendChild(frag);
  }

  if (modSearch) modSearch.addEventListener("input", renderMods);
  renderCategoryButtons();
  renderMods();
})();