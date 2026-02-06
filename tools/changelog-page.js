(function () {
  const el = (id) => document.getElementById(id);

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function listBlock(label, items) {
    const arr = Array.isArray(items) ? items.filter(Boolean) : [];
    if (arr.length === 0) return "";
    const lines = arr.map(x => `• ${esc(x)}`).join("<br>\n");
    return `<strong>${esc(label)}:</strong> ${lines}<br>\n`;
  }

  function entryHTML(v) {
    const version = esc(v?.version || "");
    const badge = v?.badge ? ` <span class="badge">${esc(v.badge)}</span>` : "";
    const date = v?.date ? `<span class="muted" style="margin-left:.5rem;">(${esc(v.date)})</span>` : "";

    const blocks =
      listBlock("Added", v?.added) +
      listBlock("Changed", v?.changed) +
      listBlock("Fixed", v?.fixed) +
      listBlock("Stability", v?.stability) +
      listBlock("Known Issues", v?.knownIssues);

    const body = blocks.trim().length ? blocks : `<span class="muted">No notes provided.</span>`;

    return `
<h3>v${version}${badge} ${date}</h3>
<p class="muted">
  ${body}
</p>`.trim();
  }

  function setError(msg) {
    el("entries").innerHTML = `<p class="muted">${esc(msg)}</p>`;
  }

  const qs = new URLSearchParams(location.search);
  const modId = (qs.get("mod") || "").trim().toLowerCase();

  if (!modId) {
    el("pageTitle").textContent = "🧾 Changelog";
    el("subtitle").textContent = "Missing ?mod=";
    el("backBtn").href = "/projects.html";
    el("backBtn").textContent = "← Back to Projects";
    el("downloadBtn").style.display = "none";
    setError("Missing mod id. Use a link like /mods/changelog.html?mod=steelhold");
    return;
  }

  async function run() {
    try {
      const res = await fetch("/data/changelogs.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load /data/changelogs.json");
      const data = await res.json();

      const mods = Array.isArray(data?.mods) ? data.mods : [];
      const mod = mods.find(m => String(m?.id || "").toLowerCase() === modId);

      if (!mod) {
        el("pageTitle").textContent = "🧾 Changelog";
        el("subtitle").textContent = modId;
        el("downloadBtn").style.display = "none";
        el("backBtn").href = "/projects.html";
        el("backBtn").textContent = "← Back to Projects";
        setError(`No changelog found for "${modId}".`);
        return;
      }

      el("kicker").textContent = mod.kicker || "Minecraft Mod";
      el("pageTitle").textContent = `${mod.emoji || "🧾"} ${mod.name || modId} Changelog`;
      el("subtitle").textContent = "Newest first";

      const backHref = mod.backHref || `/mods/${modId}.html`;
      el("backBtn").href = backHref;
      el("backBtn").textContent = `← Back to ${mod.name || modId}`;

      const dl = mod.downloadHref || "#";
      if (!dl || dl === "#") {
        el("downloadBtn").style.display = "none";
      } else {
        el("downloadBtn").href = dl;
      }

      const versions = Array.isArray(mod.versions) ? [...mod.versions] : [];

      versions.sort((a, b) => {
        const ad = a?.date ? Date.parse(a.date) : NaN;
        const bd = b?.date ? Date.parse(b.date) : NaN;
        if (!Number.isNaN(ad) && !Number.isNaN(bd)) return bd - ad;
        return String(b?.version || "").localeCompare(String(a?.version || ""), undefined, { numeric: true });
      });

      const entries = versions.map(entryHTML).join("\n<hr class=\"sep\">\n");

      el("entries").innerHTML = entries || `<p class="muted">No releases yet.</p>`;
      document.title = `${mod.name || modId} Changelog • Mayflower Studios`;
    } catch (err) {
      console.error(err);
      setError("Couldn’t load changelog data. Check the console for details.");
    }
  }

  run();
})();