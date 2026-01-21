(async function () {
  const el = (id) => document.getElementById(id);

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

  const modSearch = el("modSearch");
  const categoryRow = el("categoryRow");
  const modTbody = el("modTbody");

  // --- Players Online widget (Query via mcsrvstat.us) ---
  const playersOnlineCount = el("playersOnlineCount");
  const playersMaxCount = el("playersMaxCount");
  const playersOnlineList = el("playersOnlineList");
  const playersOnlineNote = el("playersOnlineNote");

  function safeSetText(node, text) {
    if (!node) return;
    node.textContent = text;
  }
  function safeSetHtml(node, html) {
    if (!node) return;
    node.innerHTML = html;
  }

  // -----------------------------
  // Load config
  // -----------------------------
  const cfg = await fetch("data/server.json", { cache: "no-store" }).then((r) => r.json());

  const address = cfg.address || "";
  safeSetText(serverAddress, address);

  if (joinLink) joinLink.href = cfg.howToJoinUrl || "#";
  if (discordLink) discordLink.href = cfg.discordUrl || "#";

  if (modpackCurseforge) modpackCurseforge.href = cfg.modpack?.curseforgeUrl || "#";
  if (modpackDirect) modpackDirect.href = cfg.modpack?.directZipUrl || "#";
  safeSetText(modpackNote, cfg.modpack?.note || "");

  if (sparkLink) sparkLink.href = cfg.links?.sparkUrl || "#";
  if (rulesLink) rulesLink.href = cfg.links?.rulesUrl || "#";
  if (changelogLink) changelogLink.href = cfg.links?.changelogUrl || "#";

  if (copyIpBtn) {
    copyIpBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(address);
        copyIpBtn.textContent = "✅ Copied!";
        setTimeout(() => (copyIpBtn.textContent = "📋 Copy Server IP"), 1200);
      } catch {
        alert("Couldn’t copy automatically — manually copy:\n" + address);
      }
    });
  }

  // Map embed
  const mapUrl = (cfg.mapEmbedUrl || "").trim();
  if (mapUrl && mapWrap) {
    mapWrap.innerHTML = `<iframe src="${mapUrl}" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  }

  const refreshSeconds = Math.max(10, Number(cfg.refreshSeconds || 30));

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

      const playersOnline = data?.players?.online ?? 0;
      const playersMax = data?.players?.max ?? 0;
      safeSetText(playersLine, `${playersOnline} / ${playersMax}`);

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
    // mcsrvstat.us endpoint: /2/<address>
    const url = `https://api.mcsrvstat.us/2/${encodeURIComponent(addr)}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!playersOnlineCount || !playersMaxCount || !playersOnlineList || !playersOnlineNote) {
        // Widget not present on this page; don't error.
        return;
      }

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
            ? "Players are online, but names aren’t available. Make sure enable-query=true and UDP is forwarded."
            : "Nobody online right now.";
      }
    } catch (e) {
      if (!playersOnlineCount || !playersMaxCount || !playersOnlineList || !playersOnlineNote) return;
      playersOnlineCount.textContent = "—";
      playersMaxCount.textContent = "—";
      playersOnlineList.innerHTML = "";
      playersOnlineNote.textContent = "Couldn’t fetch player list (API/network issue).";
      console.warn("Query player fetch failed:", e);
    }
  }

  // -----------------------------
  // Refresh countdown + polling
  // -----------------------------
  let remaining = refreshSeconds;

  async function refreshAll() {
    await fetchStatus();
    await fetchPlayersViaQuery(address);
  }

  async function tick() {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = refreshSeconds;
      await refreshAll();
    }
    safeSetText(refreshIn, `${remaining}s`);
  }

  await refreshAll();
  safeSetText(refreshIn, `${remaining}s`);
  setInterval(tick, 1000);

  // -----------------------------
  // Modlist
  // -----------------------------
  const modData = await fetch("data/modlist.json", { cache: "no-store" }).then((r) => r.json());
  const mods = Array.isArray(modData?.mods) ? modData.mods : [];

  const categories = ["All", ...Array.from(new Set(mods.map((m) => m.category).filter(Boolean)))].sort((a, b) =>
    a.localeCompare(b)
  );
  let activeCategory = "All";

  function renderCategoryButtons() {
    if (!categoryRow) return;
    categoryRow.innerHTML = "";
    for (const cat of categories) {
      const btn = document.createElement("button");
      btn.className = "btn2";
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

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  if (modSearch) modSearch.addEventListener("input", renderMods);
  renderCategoryButtons();
  renderMods();
})();
