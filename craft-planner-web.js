/* Mayflower Craft Planner — the planner, in the browser.
   Reads the same two lists the app writes and works out the raw materials.
   Read only: nothing here ever writes to the database. */
(function () {
  const DB = "https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const RECIPES = DB + "/craftRecipes.json";
  const SOURCES = DB + "/craftSources.json";

  const VERBS = { kill: "Kill", chop: "Chop", mine: "Mine",
                  fish: "Fish", pick: "Pick", buy: "Buy from" };

  const el = id => document.getElementById(id);
  const statusEl = el("planStatus"), listEl = el("planList"),
        searchEl = el("planSearch"), wantEl = el("planWanted"), outEl = el("planResult");

  const key = s => String(s || "").trim().toLowerCase();
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const num = n => Number(n || 0).toLocaleString();

  let recipes = [];            // {output, makes, needs:[{item,qty}], where, cost, id}
  let byOutput = new Map();    // lower name => [recipe, ...] in the order written
  let sources = new Map();     // lower name => [{kind, from, where, cost}]
  let makeable = [];           // distinct outputs, sorted
  const wanted = [];           // [{item, qty}]
  const picked = new Map();    // lower name => recipe id, when there is more than one way

  /* ---------------------------------------------------------------- loading */

  function parseNeeds(text) {
    // "4 Iron Ore, 1 Coal" — the same shape the app writes
    return String(text || "").split(/[,+]/).map(chunk => {
      const m = chunk.trim().match(/^(\d+)\s+(.+)$/);
      if (m) return { qty: Math.max(1, parseInt(m[1], 10)), item: m[2].trim() };
      const t = chunk.trim();
      return t ? { qty: 1, item: t } : null;
    }).filter(Boolean);
  }

  async function load() {
    const [rRes, sRes] = await Promise.all([
      fetch(RECIPES, { cache: "no-store" }),
      fetch(SOURCES, { cache: "no-store" }).catch(() => null)
    ]);
    if (!rRes.ok) throw new Error("HTTP " + rRes.status);

    const rData = (await rRes.json()) || {};
    recipes = Object.entries(rData).map(([id, v]) => ({
      id,
      output: String(v.output || "").trim(),
      makes: Number(v.makes) > 1 ? Number(v.makes) : 1,
      cost: Number(v.cost) > 0 ? Number(v.cost) : 0,
      where: String(v.where || "").trim(),
      needs: parseNeeds(v.needs)
    })).filter(r => r.output && r.needs.length);

    byOutput = new Map();
    recipes.forEach(r => {
      const k = key(r.output);
      if (!byOutput.has(k)) byOutput.set(k, []);
      byOutput.get(k).push(r);
    });

    sources = new Map();
    if (sRes && sRes.ok) {
      const sData = (await sRes.json()) || {};
      Object.values(sData).forEach(v => {
        const item = String(v.item || "").trim(), from = String(v.from || "").trim();
        if (!item || !from) return;
        const k = key(item);
        if (!sources.has(k)) sources.set(k, []);
        sources.get(k).push({
          kind: VERBS[v.kind] ? v.kind : "kill",
          from, where: String(v.where || "").trim(),
          cost: Number(v.cost) > 0 ? Number(v.cost) : 0
        });
      });
    }

    const seen = new Set();
    makeable = recipes.map(r => r.output).filter(o => {
      const k = key(o);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).sort((a, b) => a.localeCompare(b));

    statusEl.textContent = `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} · ` +
                           `${makeable.length} thing${makeable.length === 1 ? "" : "s"} you can make`;
  }

  /* ---------------------------------------------------------------- the maths */

  function recipeFor(item) {
    const all = byOutput.get(key(item));
    if (!all || !all.length) return null;
    const want = picked.get(key(item));
    return (want && all.find(r => r.id === want)) || all[0];
  }

  // Demand is added up across the whole tree before it is turned into whole
  // crafts. Rounding each branch on its own asks for more than you need.
  function plan(list) {
    const out = { wanted: list, materials: [], steps: [], leftovers: [],
                  unknown: [], loops: [], eons: 0 };
    if (!list.length) return out;

    const order = [], state = new Map(), loops = new Set();
    (function build(items) {
      items.forEach(function visit(item) {
        const k = key(item);
        const st = state.get(k);
        if (st) { if (st === 1) loops.add(item); return; }
        state.set(k, 1);
        const r = recipeFor(item);
        if (r) r.needs.forEach(p => visit(p.item));
        state.set(k, 2);
        order.push(item);
      });
    })(list.map(w => w.item));
    order.reverse();

    out.loops = [...loops];
    out.unknown = list.filter(w => !recipeFor(w.item)).map(w => w.item);

    const need = new Map(), shown = new Map(), left = new Map();
    list.forEach(w => {
      const k = key(w.item);
      need.set(k, (need.get(k) || 0) + w.qty);
      if (!shown.has(k)) shown.set(k, w.item);
    });

    order.forEach(item => {
      const k = key(item);
      const want = need.get(k) || 0;
      if (want <= 0) return;
      const r = loops.has(item) ? null : recipeFor(item);
      if (!r) { out.materials.push({ item: shown.get(k) || item, qty: want }); return; }

      const crafts = Math.ceil(want / r.makes);
      const made = crafts * r.makes;
      if (made > want) left.set(k, made - want);
      const eons = crafts * r.cost;
      out.eons += eons;
      out.steps.push({
        item: r.output, crafts, eons, where: r.where,
        ways: (byOutput.get(k) || []), using: r.id
      });
      r.needs.forEach(p => {
        const pk = key(p.item);
        if (!shown.has(pk)) shown.set(pk, p.item);
        need.set(pk, (need.get(pk) || 0) + crafts * p.qty);
      });
    });

    out.steps.reverse();
    const merged = new Map();
    out.materials.forEach(m => {
      const k = key(m.item);
      merged.set(k, { item: m.item, qty: (merged.get(k)?.qty || 0) + m.qty });
    });
    out.materials = [...merged.values()].sort((a, b) => b.qty - a.qty || a.item.localeCompare(b.item));
    out.leftovers = [...left.entries()].map(([k, q]) => ({ item: shown.get(k) || k, qty: q }));
    return out;
  }

  /* ---------------------------------------------------------------- drawing */

  function sourceLine(s) {
    let t = (VERBS[s.kind] || "Kill") + " " + s.from;
    if (s.where) t += " in " + s.where;
    if (s.cost) t += " for " + num(s.cost) + " eons";
    return t;
  }

  function drawList() {
    const q = key(searchEl && searchEl.value);
    const hits = q ? makeable.filter(n => n.toLowerCase().includes(q)) : makeable;
    if (!hits.length) {
      listEl.innerHTML = `<p class="muted small">${q ? "Nothing matches." : "No recipes shared yet."}</p>`;
      return;
    }
    listEl.innerHTML = hits.map(n =>
      `<button class="pItem" data-add="${esc(n)}">${esc(n)}</button>`).join("");
  }

  function drawWanted() {
    if (!wanted.length) { wantEl.innerHTML = ""; return; }
    wantEl.innerHTML = `<div class="pWanted">` + wanted.map(w =>
      `<span class="pChip">
         <button data-less="${esc(w.item)}" aria-label="one fewer">−</button>
         <b>${w.qty}</b>
         <button data-more="${esc(w.item)}" aria-label="one more">+</button>
         <span class="pChipName">${esc(w.item)}</span>
         <button data-drop="${esc(w.item)}" aria-label="remove">×</button>
       </span>`).join("") +
      `<button class="pClear" data-clear="1">Clear</button></div>`;
  }

  function drawResult() {
    if (!wanted.length) {
      outEl.innerHTML = `<p class="muted">Pick something on the left to plan it.</p>`;
      return;
    }
    const p = plan(wanted);
    let html = "";

    if (p.unknown.length)
      html += `<p class="pWarn">No recipe shared for ${esc(p.unknown.join(", "))} yet.</p>`;
    if (p.loops.length)
      html += `<p class="pWarn">These recipes feed each other, so they were left alone: ${esc(p.loops.join(", "))}</p>`;

    if (p.materials.length) {
      html += `<h3 class="pHead">You need</h3><ul class="pNeed">` + p.materials.map(m => {
        const from = sources.get(key(m.item)) || [];
        const note = from.length
          ? `<span class="pFrom">${from.map(s => esc(sourceLine(s))).join(" · ")}</span>` : "";
        return `<li><b>${m.qty}</b> <span class="pName">${esc(m.item)}</span>${note}</li>`;
      }).join("") + `</ul>`;
    }

    if (p.steps.length) {
      html += `<h3 class="pHead">Then craft${p.eons ? `<span class="pEons">${num(p.eons)} eons</span>` : ""}</h3>`;
      html += `<ul class="pSteps">` + p.steps.map(s => {
        const many = s.ways.length > 1
          ? `<select class="pWay" data-way="${esc(s.item)}">` + s.ways.map(w =>
              `<option value="${esc(w.id)}"${w.id === s.using ? " selected" : ""}>` +
              esc(w.needs.map(n => n.qty + " " + n.item).join(" + ")) + `</option>`).join("") + `</select>`
          : "";
        const aside = !many && s.where ? `<span class="pAside">${esc(s.where)}</span>` : "";
        const cost = s.eons ? `<span class="pAside">${num(s.eons)} eons</span>` : "";
        return `<li><span>Craft <b>${s.crafts}</b> × ${esc(s.item)}</span>${many}${aside}${cost}</li>`;
      }).join("") + `</ul>`;
    }

    if (p.leftovers.length)
      html += `<p class="muted small pLeft">Left over: ` +
              p.leftovers.map(l => `${l.qty} ${esc(l.item)}`).join(", ") + `</p>`;

    outEl.innerHTML = html;
  }

  function draw() { drawWanted(); drawResult(); }

  /* ---------------------------------------------------------------- clicking */

  function add(item, by) {
    const found = wanted.find(w => key(w.item) === key(item));
    if (found) { found.qty += by; if (found.qty < 1) wanted.splice(wanted.indexOf(found), 1); }
    else if (by > 0) wanted.push({ item, qty: by });
    draw();
  }

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-add],[data-more],[data-less],[data-drop],[data-clear]");
    if (!t) return;
    if (t.dataset.add) add(t.dataset.add, 1);
    else if (t.dataset.more) add(t.dataset.more, 1);
    else if (t.dataset.less) add(t.dataset.less, -1);
    else if (t.dataset.drop) {
      const i = wanted.findIndex(w => key(w.item) === key(t.dataset.drop));
      if (i >= 0) wanted.splice(i, 1);
      draw();
    } else if (t.dataset.clear) { wanted.length = 0; draw(); }
  });

  document.addEventListener("change", e => {
    if (!e.target.matches(".pWay")) return;
    picked.set(key(e.target.dataset.way), e.target.value);
    drawResult();
  });

  if (searchEl) searchEl.addEventListener("input", drawList);

  load().then(() => { drawList(); draw(); }).catch(err => {
    statusEl.textContent = "The recipe list could not be loaded.";
    listEl.innerHTML = `<p class="muted small">Unavailable right now.</p>`;
    outEl.innerHTML = "";
    console.warn("Craft Planner web:", err);
  });
})();
