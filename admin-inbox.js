/* Mayflower Studios — what came in through the contact form, on the profile page.
   Who counts as an admin is a username ticked by hand under /admins in the
   Firebase console. Nothing on the site can write there, so nobody can make
   themselves one, and the section stays hidden for everyone else. */
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

  let token = null, all = [], wired = false;

  async function usernameOf(user) {
    const known = window.MFAuth && MFAuth.profile && MFAuth.profile.username;
    if (known) return String(known).toLowerCase();
    try {
      const r = await fetch(`${DB}/users/${user.uid}/username.json?auth=${token}`);
      const v = r.ok ? await r.json() : null;
      return v ? String(v).toLowerCase() : "";
    } catch (_) { return ""; }
  }

  async function start(user) {
    const wrap = el("adminInbox");
    if (!wrap) return;
    wrap.hidden = true;
    if (!user) return;

    try { token = await user.getIdToken(); } catch (_) { return; }

    const handle = await usernameOf(user);
    if (!handle) return;

    const yes = await fetch(`${DB}/admins/${encodeURIComponent(handle)}.json?auth=${token}`)
      .then(r => r.ok ? r.json() : null).catch(() => null);
    if (yes !== true) return;

    wrap.hidden = false;
    el("aiWho").textContent = handle;
    if (!wired) {
      wired = true;
      el("aiFilter").addEventListener("change", draw);
      el("aiHideDone").addEventListener("change", draw);
      el("aiRefresh").addEventListener("click", load);
      el("aiList").addEventListener("click", act);
    }
    load();
  }

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

  function wire() {
    if (window.MFAuth && MFAuth.onChange) MFAuth.onChange(user => start(user));
    else setTimeout(wire, 200);
  }
  wire();
})();
