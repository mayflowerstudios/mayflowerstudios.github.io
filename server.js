(async function () {
  const el = (id) => document.getElementById(id);
  const safeSetText = (node, text) => { if (node) node.textContent = text; };

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

  // Mood UI
  const worldMoodFooter = el("worldMoodFooter");
  const worldMoodClock = el("worldMoodClock");
  const worldMoodWeather = el("worldMoodWeather");
  const worldMoodSeason = el("worldMoodSeason");
  const worldMoodMoon = el("worldMoodMoon");

  // Performance UI
  const tpsLine = el("tpsLine");
  const msptLine = el("msptLine");
  const memLine = el("memLine");

  // AE2 UI
  const ae2Pill = el("ae2Pill");
  const ae2Online = el("ae2Online");
  const ae2Offline = el("ae2Offline");
  const ae2Conflicted = el("ae2Conflicted");
  const ae2DimNote = el("ae2DimNote");

  const bluemapFrame = el("bluemapFrame");
  const mapFallback = el("mapFallback");

  const playersOnlineCount = el("playersOnlineCount");
  const playersMaxCount = el("playersMaxCount");
  const playersOnlineCountMini = el("playersOnlineCountMini");
  const playersMaxCountMini = el("playersMaxCountMini");
  const playersGrid = el("playersGrid");
  const playersOnlineNote = el("playersOnlineNote");

  const chatList = el("chatList");
  const chatNote = el("chatNote");

  const chatName = el("chatName");
  const chatMsg = el("chatMsg");
  const chatSendBtn = el("chatSendBtn");
  const chatSendStatus = el("chatSendStatus");

  const waystoneSearch = el("waystoneSearch");
  const waystoneList = el("waystoneList");
  const waystoneMeta = el("waystoneMeta");
  const waystoneNote = el("waystoneNote");

  // Starter kits UI
  const kitCount = el("kitCount");
  const kitSearch = el("kitSearch");
  const kitFilterRow = el("kitFilterRow");
  const kitList = el("kitList");
  const kitNote = el("kitNote");

  const modSearch = el("modSearch");
  const categoryRow = el("categoryRow");
  const modTbody = el("modTbody");
  const modCountEl = el("modCount");

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
    if (!statusDot || !statusText) return;
    statusDot.classList.remove("online", "offline");
    if (state === "online") {
      statusDot.classList.add("online");
      statusText.textContent = "Online";
    } else if (state === "stale") {
      statusDot.classList.add("offline");
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

  function extractClockFromHeadline(headline) {
    if (!headline) return "";
    const m = String(headline).match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/i);
    return m ? m[1] : "";
  }

  function prettyFirstSeasonToken(seasonRaw) {
    const s = String(seasonRaw || "").trim();
    if (!s) return "";
    const first = s.split(/\s+/).filter(Boolean)[0] || "";
    return prettyToken(first);
  }

  function moonEmoji(phase) {
    const p = Number(phase);
    if (!Number.isFinite(p)) return "🌙";
    const e = ["🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔"];
    return e[p & 7];
  }

  function moonLabel(phase) {
    const p = Number(phase);
    if (!Number.isFinite(p)) return "Moon";
    const n = [
      "Full Moon",
      "Waning Gibbous",
      "Last Quarter",
      "Waning Crescent",
      "New Moon",
      "Waxing Crescent",
      "First Quarter",
      "Waxing Gibbous"
    ];
    return n[p & 7];
  }

  function fmtWeather(w) {
    if (!w) return "—";
    if (w.isThundering) return "⛈️ Thunder";
    if (w.isRaining) return "🌧️ Rain";
    return "☁️ Clear";
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
    chatSendStatus.classList.remove("good", "bad", "warn");
    if (kind === "good") chatSendStatus.classList.add("good");
    if (kind === "bad") chatSendStatus.classList.add("bad");
    if (kind === "warn") chatSendStatus.classList.add("warn");
  }

  function setPill(node, text, kind) {
    if (!node) return;
    node.textContent = text;
    node.classList.remove("good", "bad", "warn");
    if (kind) node.classList.add(kind);
  }

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
      try { json = text ? JSON.parse(text) : null; } catch { }
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
    const cleaned = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
  }

  // ---------- Players ----------
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

  // ---------- Chat ----------
  let lastChatKey = "";

  function chatKey(lines) {
    if (!Array.isArray(lines)) return "";
    const tail = lines.slice(-20);
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
    if (t === "boss") return "👑 ";
    return "• ";
  }

  function defaultNameForType(type) {
    const t = String(type || "chat").toLowerCase();
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
        defaultNameForType(type);

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

  // ---------- Waystones ----------
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

  // ---------- AE2 ----------
  function dimPretty(id){
    return String(id || "")
      .replace("minecraft:", "")
      .replaceAll("_", " ")
      .replace(/\bthe\s+nether\b/i, "Nether")
      .replace(/\bthe\s+end\b/i, "The End")
      .replace(/\boverworld\b/i, "Overworld");
  }

  function renderAE2(ws){
    const ae2 = ws?.ae2 || null;

    if (!ae2?.ae2Loaded) {
      safeSetText(ae2Online, "—");
      safeSetText(ae2Offline, "—");
      safeSetText(ae2Conflicted, "—");
      setPill(ae2Pill, "🧠 AE2: Not available", "bad");
      safeSetText(ae2DimNote, "—");
      return;
    }

    const total = ae2.total || {};
    safeSetText(ae2Online, Number(total.online ?? 0));
    safeSetText(ae2Offline, Number(total.offline ?? 0));
    safeSetText(ae2Conflicted, Number(total.conflicted ?? 0));

    const has = Boolean(ae2.hasConflicts);
    setPill(
      ae2Pill,
      has ? "⚠️ AE2: Conflicts detected" : "✅ AE2: Healthy",
      has ? "warn" : "good"
    );

    const rows = Array.isArray(ae2.byDimension) ? ae2.byDimension : [];
    if (!rows.length) {
      safeSetText(ae2DimNote, "No controllers tracked yet (load chunks with controllers).");
      return;
    }

    const parts = rows.map(r => {
      const d = dimPretty(r?.dimension);
      const c = r?.controllers || {};
      const conflict = Boolean(r?.hasConflicts) || (Number(c.conflicted || 0) > 0);
      const online = Number(c.online || 0);
      const off = Number(c.offline || 0);
      const conf = Number(c.conflicted || 0);
      return `${conflict ? "⚠️" : "•"} ${d}: ${online} on, ${off} off, ${conf} conflict`;
    });

    safeSetText(ae2DimNote, parts.join("  |  "));
  }

  // ---------- Starter Kits ----------
  let starterKits = [];
  let kitCategory = "All";
  const KIT_CATS = ["All", "Active", "Inactive"];

  function kitNamePretty(n){
    const s = String(n || "").trim();
    if (!s) return "Kit";
    return s.replaceAll("_"," ").replace(/\s+/g," ").trim();
  }

  function kitMatches(k, q){
    if (!q) return true;
    const blob = `${k?.name||""} ${k?.description||""}`.toLowerCase();
    return blob.includes(q);
  }

  function renderKitFilters(){
    if (!kitFilterRow) return;
    kitFilterRow.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (const cat of KIT_CATS){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "catChip" + (cat === kitCategory ? " active" : "");
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        kitCategory = cat;
        renderKitFilters();
        renderKits(true);
      });
      frag.appendChild(btn);
    }

    kitFilterRow.appendChild(frag);
  }

  function renderKits(force=false){
    if (!kitList) return;

    const q = (kitSearch?.value || "").trim().toLowerCase();
    let filtered = starterKits.slice();

    if (kitCategory === "Active") filtered = filtered.filter(k => k?.active);
    if (kitCategory === "Inactive") filtered = filtered.filter(k => !k?.active);

    filtered = filtered.filter(k => kitMatches(k, q));

    kitList.innerHTML = "";

    if (kitCount) {
      kitCount.textContent = q || kitCategory !== "All"
        ? `${filtered.length} of ${starterKits.length}`
        : `${starterKits.length} kits`;
    }

    if (!filtered.length){
      kitList.innerHTML = `<div class="kitItem"><div class="kitName">No kits found.</div><div class="kitDesc">Try a different search or filter.</div></div>`;
      if (kitNote) kitNote.textContent = "";
      return;
    }

    const frag = document.createDocumentFragment();

    for (const k of filtered.slice(0, 60)){
      const name = kitNamePretty(k?.name);
      const desc = String(k?.description || "").trim();
      const active = Boolean(k?.active);

      const card = document.createElement("div");
      card.className = "kitItem";
      card.innerHTML = `
        <div class="kitTop">
          <div>
            <div class="kitName">${escapeHtml(name)}</div>
            ${desc ? `<div class="kitDesc">${escapeHtml(desc)}</div>` : `<div class="kitDesc">No description yet.</div>`}
          </div>
          <div class="kitBadges">
            <span class="kitBadge ${active ? "" : "off"}">${active ? "✅ Active" : "⛔ Inactive"}</span>
          </div>
        </div>
        <div class="kitBtns">
          <button class="btnMini kitCopyName" type="button">📌 Copy kit name</button>
          ${k?.raw ? `<button class="btnMini kitCopyRaw" type="button">📋 Copy raw</button>` : ``}
        </div>
      `;

      card.querySelector(".kitCopyName")?.addEventListener("click", async () => {
        const ok = await copyText(k?.name || name);
        const btn = card.querySelector(".kitCopyName");
        if (!btn) return;
        btn.textContent = ok ? "✅ Copied!" : "Copy failed";
        setTimeout(() => (btn.textContent = "📌 Copy kit name"), 900);
      });

      card.querySelector(".kitCopyRaw")?.addEventListener("click", async () => {
        const ok = await copyText(String(k?.raw || ""));
        const btn = card.querySelector(".kitCopyRaw");
        if (!btn) return;
        btn.textContent = ok ? "✅ Copied!" : "Copy failed";
        setTimeout(() => (btn.textContent = "📋 Copy raw"), 900);
      });

      frag.appendChild(card);
    }

    if (filtered.length > 60){
      const more = document.createElement("div");
      more.className = "kitItem";
      more.innerHTML = `<div class="kitName">+${filtered.length - 60} more</div><div class="kitDesc">Refine your search to narrow it down.</div>`;
      frag.appendChild(more);
    }

    kitList.appendChild(frag);

    if (kitNote) kitNote.textContent =
      "Kits are loaded from the server via WorldState (StarterKit config).";
  }

  if (kitSearch) kitSearch.addEventListener("input", () => renderKits(true));
  renderKitFilters();

  // ---------- Load config ----------
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

  const worldStateUrl = (cfg.worldStateUrl || "").trim();
  const worldApiBase = (cfg.worldApiBase || "").trim().replace(/\/$/, "");
  const worldStateToken = String(cfg.worldStateToken || "").trim();

  const chatFastSeconds = Math.max(1, Number(cfg.chatFastSeconds || 2));

  if (serverTitle) serverTitle.textContent = serverName ? `🛰️ ${serverName}` : "🛰️ Server Dashboard";
  safeSetText(serverAddress, address || "—");

  if (joinLink) joinLink.href = cfg.howToJoinUrl || "#";
  if (discordLink) discordLink.href = cfg.discordUrl || "#";
  if (rulesLink) rulesLink.href = cfg.links?.rulesUrl || "#";
  if (sparkLink) sparkLink.href = cfg.links?.sparkUrl || "#";
  if (modpackCurseforge) modpackCurseforge.href = cfg.modpack?.curseforgeUrl || "#";

  const mapUrl = (window.MAYFLOWER_BLUEMAP_URL || cfg.mapEmbedUrl || "").trim();
  const fixedMap = withProtocol(mapUrl);
  if (openMapBtn) openMapBtn.href = fixedMap || "#";
  if (fixedMap) {
    if (bluemapFrame) bluemapFrame.src = fixedMap;
    if (mapFallback) mapFallback.style.display = "none";
  } else {
    if (mapFallback) mapFallback.style.display = "block";
  }

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

  const chatPostUrl = worldApiBase ? `${worldApiBase}/api/chat` : "";

  function chatCanSend() {
    return Boolean(chatPostUrl) && Boolean(worldStateToken);
  }

  function initChatComposer() {
    if (!chatSendBtn || !chatMsg || !chatName) return;

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

        remaining = 1;
        chatRemaining = 1;
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

  let lastGoodMs = 0;
  let backoff = 0;
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

    // Mood card
    const mood = ws?.mood || {};
    const clock = extractClockFromHeadline(mood.headline) || (ws?.time?.clock ? String(ws.time.clock) : "—");
    const weather = mood.weather ? String(mood.weather) : (ws?.weather ? fmtWeather(ws.weather).replace(/^.\s*/, "") : "—");
    const season = mood.season ? prettyFirstSeasonToken(mood.season) : "—";

    const mEmoji = moonEmoji(mood.moonPhase);
    const mName = moonLabel(mood.moonPhase);
    const flavor = mood.flavor ? String(mood.flavor) : "—";

    safeSetText(worldMoodClock, clock);
    safeSetText(worldMoodWeather, weather);
    safeSetText(worldMoodSeason, season);
    safeSetText(worldMoodMoon, `${mEmoji} ${mName}`);
    safeSetText(worldMoodFooter, flavor);

    // Perf
    const perf = ws?.perf || {};
    safeSetText(tpsLine, Number.isFinite(Number(perf.estTps)) ? Number(perf.estTps).toFixed(1) : "—");
    safeSetText(msptLine, Number.isFinite(Number(perf.avgMspt)) ? `${Number(perf.avgMspt).toFixed(1)}` : "—");
    if (Number.isFinite(Number(perf.usedMemMb)) && Number.isFinite(Number(perf.maxMemMb))) {
      safeSetText(memLine, `${Number(perf.usedMemMb)} / ${Number(perf.maxMemMb)} MB`);
    } else {
      safeSetText(memLine, "—");
    }

    // Players
    renderPlayers(pubPlayers, pubPlayers.length ? "Live list from WorldState." : "Nobody online right now.");

    // Waystones
    waystones = Array.isArray(ws?.waystones) ? ws.waystones : [];
    if (waystoneNote) {
      waystoneNote.textContent = waystones.length ? "Waystones loaded from WorldState." : "No waystones found (or none are public).";
    }
    renderWaystones(true);

    // Chat
    const chat = Array.isArray(ws?.chat) ? ws.chat : [];
    renderChat(chat);
    if (chatNote) chatNote.textContent = chat.length ? "Live feed from WorldState." : "No recent chat messages.";

    // AE2
    renderAE2(ws);

    // Starter Kits
    starterKits = Array.isArray(ws?.starterKits) ? ws.starterKits : [];
    renderKitFilters();
    renderKits(true);

    safeSetText(lastUpdate, nowLabel());
    lastApplyAt = Date.now();

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

  let remaining = refreshSeconds;
  let chatRemaining = chatFastSeconds;

  function clearLivePanels(reason) {
    safeSetText(serverMotd, reason || "WorldState not available.");

    safeSetText(worldMoodClock, "—");
    safeSetText(worldMoodWeather, "—");
    safeSetText(worldMoodSeason, "—");
    safeSetText(worldMoodMoon, "—");
    safeSetText(worldMoodFooter, "—");

    safeSetText(tpsLine, "—");
    safeSetText(msptLine, "—");
    safeSetText(memLine, "—");

    renderPlayers([], reason || "WorldState is not configured.");
    waystones = [];
    renderWaystones(true);
    renderChat([]);

    if (chatNote) chatNote.textContent = "Chat feed unavailable.";
    if (waystoneNote) waystoneNote.textContent = "Waystones unavailable.";

    renderAE2({ ae2: { ae2Loaded: false } });

    starterKits = [];
    if (kitList) kitList.innerHTML = "";
    if (kitCount) kitCount.textContent = "—";
    if (kitNote) kitNote.textContent = "Starter kits unavailable.";

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
        if (chatCanSend()) setChatStatus(`Stale (${msAgeLabel(age)})`, "warn");
      } else {
        await fetchStatusFallback();
        clearLivePanels("WorldState endpoint/CORS/offline.");
      }
    }
  }

  function applyChatOnly(ws) {
    const chat = Array.isArray(ws?.chat) ? ws.chat : [];
    renderChat(chat);
    if (chatNote) chatNote.textContent = chat.length ? "Live feed from WorldState." : "No recent chat messages.";
  }

  async function refreshChatOnly() {
    if (!worldStateUrl) return;
    try {
      const ws = await fetchWorldState();
      applyChatOnly(ws);
    } catch { }
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

  async function chatTick() {
    if (document.hidden) return;

    chatRemaining -= 1;
    if (chatRemaining <= 0) {
      chatRemaining = chatFastSeconds;
      await refreshChatOnly();
    }
  }

  setCountsEverywhere("—", "—");
  setOnlineState("loading");
  remaining = effectiveRefreshSeconds();
  safeSetText(refreshIn, `${remaining}s`);

  initChatComposer();
  await refreshAll();

  setInterval(tick, 1000);

  chatRemaining = 1;
  setInterval(chatTick, 1000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      remaining = 1;
      chatRemaining = 1;
    }
  });

  // ---------- Modlist ----------
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