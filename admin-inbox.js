/* Mayflower Studios — what came in through the contact form, on the profile page.

   Two ranks. The owner is one username at /owner, set by hand in the Firebase
   console and writable by nothing, ever. Admins are usernames under /admins,
   which only the owner can change — from the panel at the bottom of this
   section. Admins read what comes in; they cannot make more admins. */
(function () {
  const DB = "https://watchtogether-95d7d-default-rtdb.firebaseio.com";

  const KIND_WORD = {
    bug: "🐞 Broken", idea: "💡 Idea", question: "❓ Question", other: "🌸 Other"
  };

  const el = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const when = t => {
    const d = new Date(Number(t) || 0);
    return isNaN(d.getTime()) ? "" : d.toLocaleString();
  };
  const get = path => fetch(`${DB}/${path}.json?auth=${token}`, { cache: "no-store" })
    .then(r => r.ok ? r.json() : null).catch(() => null);

  let token = null, me = "", owner = false, all = [], admins = [], wired = false;

  async function usernameOf(user) {
    const known = window.MFAuth && MFAuth.profile && MFAuth.profile.username;
    if (known) return String(known).toLowerCase();
    const v = await get(`users/${user.uid}/username`);
    return v ? String(v).toLowerCase() : "";
  }

  async function start(user) {
    const wrap = el("adminInbox");
    if (!wrap) return;
    wrap.hidden = true;
    if (!user) return;

    try { token = await user.getIdToken(); } catch (_) { return; }

    me = await usernameOf(user);
    if (!me) return;

    const [whoOwns, amAdmin] = await Promise.all([
      get("owner"),
      get(`admins/${encodeURIComponent(me)}`)
    ]);
    owner = String(whoOwns || "").toLowerCase() === me;
    if (!owner && amAdmin !== true) return;

    wrap.hidden = false;
    el("aiWho").textContent = me;
    const tag = el("aiRankTag");
    tag.textContent = owner ? "Owner" : "Admin";
    tag.className = "aiRank" + (owner ? "" : " admin");

    if (!wired) {
      wired = true;
      el("aiFilter").addEventListener("change", draw);
      el("aiHideDone").addEventListener("change", draw);
      el("aiRefresh").addEventListener("click", load);
      el("aiList").addEventListener("click", act);
      el("aiAddBtn").addEventListener("click", addAdmin);
      el("aiAddName").addEventListener("keydown", e => { if (e.key === "Enter") addAdmin(); });
      el("aiAdminList").addEventListener("click", dropAdmin);
    }

    el("aiRanks").hidden = !owner;
    load();
    if (owner) loadAdmins();
  }

  /* ------------------------------------------------------------- messages */

  async function load() {
    const list = el("aiList");
    list.innerHTML = `<div class="acctEmpty">Loading…</div>`;
    try {
      const data = await fetch(`${DB}/feedback.json?auth=${token}`, { cache: "no-store" })
        .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
      all = Object.entries(data || {}).map(([id, v]) => Object.assign({ id: id }, v))
        .sort((a, b) => (b.at || 0) - (a.at || 0));
      draw();
    } catch (err) {
      list.innerHTML = `<div class="acctEmpty">Could not load these. ${esc(err.message)}</div>`;
    }
  }

  function draw() {
    const list = el("aiList");
    const kind = el("aiFilter").value, hide = el("aiHideDone").checked;
    const rows = all.filter(m => (!kind || m.kind === kind) && (!hide || !m.done));
    el("aiCount").textContent = all.length ? `${rows.length} of ${all.length}` : "";
    if (!rows.length) {
      list.innerHTML = `<div class="acctEmpty">${all.length ? "Nothing matching that." : "Nothing has come in yet."}</div>`;
      return;
    }

    list.innerHTML = rows.map(m => `
      <article class="aiItem${m.done ? " isDone" : ""}">
        <header>
          <span class="aiTag">${esc(KIND_WORD[m.kind] || m.kind || "?")}</span>
          <span class="aiTag alt">${esc(m.about || "—")}</span>
          <span class="aiWhen">${esc(when(m.at))}</span>
        </header>
        ${m.subject ? `<h4>${esc(m.subject)}</h4>` : ""}
        <p class="aiBody">${esc(m.message || "")}</p>
        <footer>
          <span class="aiFrom">${m.name ? esc(m.name) : "Anonymous"}${m.reply ? " · " + esc(m.reply) : ""}${m.uid ? " · signed in" : ""}</span>
          <span class="aiActs">
            <button type="button" data-done="${esc(m.id)}">${m.done ? "Not done" : "Mark done"}</button>
            <button type="button" data-del="${esc(m.id)}" class="danger">Delete</button>
          </span>
        </footer>
      </article>`).join("");
  }

  async function act(e) {
    const t = e.target.closest("[data-done],[data-del]");
    if (!t) return;
    const id = t.dataset.done || t.dataset.del;
    const row = all.find(m => m.id === id);
    if (!row) return;
    try {
      if (t.dataset.del) {
        if (!confirm("Delete this message for good?")) return;
        const r = await fetch(`${DB}/feedback/${id}.json?auth=${token}`, { method: "DELETE" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        all = all.filter(m => m.id !== id);
      } else {
        const now = !row.done;
        const r = await fetch(`${DB}/feedback/${id}.json?auth=${token}`, {
          method: "PATCH", body: JSON.stringify({ done: now })
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        row.done = now;
      }
      draw();
    } catch (err) { console.warn("admin inbox:", err); }
  }

  /* ---------------------------------------------------------------- ranks */

  function rankSay(text, kind) {
    const n = el("aiRankMsg");
    n.textContent = text || "";
    n.className = kind || "";
  }

  async function loadAdmins() {
    const data = await get("admins");
    admins = Object.entries(data || {}).filter(([, v]) => v === true)
      .map(([h]) => h).sort();
    drawAdmins();
  }

  function drawAdmins() {
    const box = el("aiAdminList");
    const you = `<span class="aiChip">${esc(me)} <span class="aiRank">Owner</span></span>`;
    box.innerHTML = you + admins.map(h => `
      <span class="aiChip">${esc(h)}
        <button type="button" data-drop="${esc(h)}" title="Take it away">✕</button>
      </span>`).join("");
  }

  async function addAdmin() {
    const box = el("aiAddName");
    const handle = box.value.trim().toLowerCase().replace(/^@/, "");
    if (!handle) return;
    if (!/^[a-z0-9_]{1,20}$/.test(handle)) { rankSay("Usernames are letters, numbers and _ only.", "bad"); return; }
    if (handle === me) { rankSay("You are the owner already.", "bad"); return; }
    if (admins.includes(handle)) { rankSay(`@${handle} is already an admin.`, "bad"); return; }

    rankSay("Checking…", "");
    const uid = await get(`usernames/${encodeURIComponent(handle)}`);
    if (!uid) { rankSay(`No account called @${handle}.`, "bad"); return; }

    try {
      const r = await fetch(`${DB}/admins/${encodeURIComponent(handle)}.json?auth=${token}`, {
        method: "PUT", body: "true"
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      admins = admins.concat(handle).sort();
      box.value = "";
      drawAdmins();
      rankSay(`@${handle} can see these now.`, "ok");
    } catch (err) {
      rankSay("That did not save.", "bad");
      console.warn("make admin:", err);
    }
  }

  async function dropAdmin(e) {
    const t = e.target.closest("[data-drop]");
    if (!t) return;
    const handle = t.dataset.drop;
    if (!confirm(`Take admin away from @${handle}?`)) return;
    try {
      const r = await fetch(`${DB}/admins/${encodeURIComponent(handle)}.json?auth=${token}`, { method: "DELETE" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      admins = admins.filter(h => h !== handle);
      drawAdmins();
      rankSay(`@${handle} can no longer see these.`, "ok");
    } catch (err) {
      rankSay("That did not save.", "bad");
      console.warn("drop admin:", err);
    }
  }

  function wire() {
    if (window.MFAuth && MFAuth.onChange) MFAuth.onChange(user => start(user));
    else setTimeout(wire, 200);
  }
  wire();
})();
