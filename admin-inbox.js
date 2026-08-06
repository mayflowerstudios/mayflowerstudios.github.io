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

  // Firebase id tokens run out after an hour, and the page is meant to be
  // left open. Asking for it again before each write costs nothing when it is
  // still good, and is the difference between a button working and a button
  // doing nothing at all.
  let signedInUser = null;
  async function fresh() {
    if (!signedInUser) return token;
    try { token = await signedInUser.getIdToken(); } catch (_) { }
    return token;
  }

  // Anything that goes wrong has to say so. A button that quietly fails is
  // worse than one that is not there.
  function trouble(err, what) {
    console.warn("admin:", what, err);
    const say = el("cbMsg");
    if (!say) return;
    const code = String(err && err.message || err);
    say.textContent = code.indexOf("401") >= 0 || code.indexOf("403") >= 0
      ? `${what} was refused. The database rules may not be updated yet — see the craft book rules.`
      : `${what} did not go through: ${code}`;
    say.className = "cbMsg bad";
  }

  function fine(what) {
    const say = el("cbMsg");
    if (!say) return;
    say.textContent = what;
    say.className = "cbMsg ok";
  }

  async function usernameOf(user) {
    const known = window.MFAuth && MFAuth.profile && MFAuth.profile.username;
    if (known) return String(known).toLowerCase();
    const v = await get(`users/${user.uid}/username`);
    return v ? String(v).toLowerCase() : "";
  }

  // Two pages use this. The profile only wants the button; the admin page
  // wants everything, and has to say something when you are not one.
  function shut(why) {
    const link = el("adminLink");
    if (link) link.hidden = true;
    const wrap = el("adminInbox");
    if (wrap) wrap.hidden = true;
    const gate = el("adminGate");
    if (gate) gate.innerHTML = `<p class="muted" style="margin:0;">${why}</p>`;
  }

  async function start(user) {
    const wrap = el("adminInbox");
    const link = el("adminLink");
    if (!wrap && !link) return;
    if (!user) { shut("Sign in on your profile first."); return; }

    signedInUser = user;
    try { token = await user.getIdToken(); }
    catch (_) { shut("Could not check who you are."); return; }

    me = await usernameOf(user);
    if (!me) { shut("Set a username on your profile first."); return; }

    const [whoOwns, amAdmin] = await Promise.all([
      get("owner"),
      get(`admins/${encodeURIComponent(me)}`)
    ]);
    owner = String(whoOwns || "").toLowerCase() === me;
    if (!owner && amAdmin !== true) { shut("This page is for admins."); return; }

    if (link) link.hidden = false;
    if (!wrap) return;                 // on the profile, the button is all there is
    const gate = el("adminGate");
    if (gate) gate.hidden = true;
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
      el("cbWhat").addEventListener("change", loadBook);
      el("cbFind").addEventListener("input", drawBook);
      el("cbOnlyNew").addEventListener("change", drawBook);
      el("cbRefresh").addEventListener("click", loadBook);
      el("cbList").addEventListener("click", dropEntry);
    }

    el("aiRanks").hidden = !owner;
    load();
    loadBook();
    if (owner) loadAdmins();
  }

  /* ------------------------------------------------- the shared craft book */

  let book = [];

  // Whichever of the two lists is being looked at.
  const bookNode = () => el("cbWhat").value === "craftSources" ? "craftSources" : "craftRecipes";

  async function loadBook() {
    const list = el("cbList");
    list.innerHTML = `<div class="acctEmpty">Loading…</div>`;
    const node = bookNode();
    try {
      const data = await fetch(`${DB}/${node}.json`, { cache: "no-store" })
        .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
      book = Object.entries(data || {}).map(([id, v]) => Object.assign({ id: id, node: node }, v))
        .sort((a, b) => (b.at || 0) - (a.at || 0));
      drawBook();
    } catch (err) {
      list.innerHTML = `<div class="acctEmpty">Could not load these. ${esc(err.message)}</div>`;
    }
  }

  function bookLine(m) {
    if (m.node === "craftSources") {
      const doing = { kill: "Kill", chop: "Chop", mine: "Mine", fish: "Fish",
                      pick: "Pick", buy: "Buy from", quest: "From the quest" };
      let s = m.kind === "use" && m.uses
        ? `Use ${m.uses} on ${m.from || "?"}`
        : `${doing[m.kind] || m.kind || "?"} ${m.from || "?"}`;
      if (m.where) s += ` in ${m.where}`;
      if (m.cost > 0) s += ` for ${Number(m.cost).toLocaleString()} eons`;
      return s;
    }
    let s = `${m.makes > 1 ? m.makes + " from " : ""}${m.needs || "?"}`;
    if (m.where) s += ` · at ${m.where}`;
    if (m.cost > 0) s += ` · ${Number(m.cost).toLocaleString()} eons`;
    return s;
  }

  const bookName = m => String(m.node === "craftSources" ? m.item : m.output || "");

  // What it said before somebody changed it, if anybody has.
  function wasLine(m) {
    if (!m.was) return "";
    const bits = [];
    if (m.node !== "craftSources" && (m.was.where || "") !== (m.where || ""))
      bits.push(`at ${m.was.where || "nowhere"}`);
    if ((m.was.cost || 0) !== (m.cost || 0))
      bits.push(`${Number(m.was.cost || 0).toLocaleString()} eons`);
    return bits.length ? "was " + bits.join(" · ") : "";
  }

  function drawBook() {
    const list = el("cbList");
    const q = el("cbFind").value.trim().toLowerCase();
    const onlyNew = el("cbOnlyNew").checked;
    let rows = book.filter(m => !q || bookName(m).toLowerCase().includes(q)
                                  || bookLine(m).toLowerCase().includes(q));
    if (onlyNew) rows = rows.filter(m => m.ok !== true);
    // Anything not looked at yet comes first, changes before brand new ones.
    rows.sort((a, b) => (a.ok === true) - (b.ok === true)
                     || (b.was ? 1 : 0) - (a.was ? 1 : 0)
                     || (b.at || 0) - (a.at || 0));

    const waiting = book.filter(m => m.ok !== true).length;
    el("cbCount").textContent = book.length
      ? `${rows.length} of ${book.length}${waiting ? ` · ${waiting} to look at` : ""}` : "";
    if (!rows.length) {
      list.innerHTML = `<div class="acctEmpty">${book.length
        ? (onlyNew ? "Everything has been looked at." : "Nothing matching that.")
        : "Nothing shared yet."}</div>`;
      return;
    }
    list.innerHTML = rows.map(m => {
      const before = wasLine(m);
      return `
      <div class="cbRow${m.ok === true ? " isOk" : ""}">
        <span class="cbText">
          <span class="cbName">${esc(bookName(m))}${m.ok === true
            ? ` <span class="cbTick" title="Checked">✓</span>`
            : ` <span class="cbNew">${m.was ? "changed" : "new"}</span>`}</span>
          <span class="cbSays">${esc(bookLine(m))}</span>
          ${before ? `<span class="cbWas">${esc(before)}</span>` : ""}
        </span>
        <span class="cbActs">
          ${m.ok === true ? "" : `<button type="button" data-ok="${esc(m.id)}">Approve</button>`}
          ${m.was ? `<button type="button" data-revert="${esc(m.id)}">Put back</button>` : ""}
          <button type="button" class="danger" data-drop-entry="${esc(m.id)}">Remove</button>
        </span>
      </div>`;
    }).join("");
  }

  async function send(row, patch) {
    const tok = await fresh();
    const r = await fetch(`${DB}/${row.node}/${row.id}.json?auth=${tok}`, {
      method: "PATCH", body: JSON.stringify(patch)
    });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text().catch(() => "")).slice(0, 160));
  }

  async function dropEntry(e) {
    const t = e.target.closest("[data-drop-entry],[data-ok],[data-revert]");
    if (!t) return;
    const id = t.dataset.dropEntry || t.dataset.ok || t.dataset.revert;
    const row = book.find(m => m.id === id);
    if (!row) return;
    const label = bookName(row);
    t.disabled = true;
    try {
      if (t.dataset.ok) {
        // Checked, and no longer showing what it replaced.
        await send(row, { ok: true, was: null });
        row.ok = true; delete row.was;
        fine(`“${label}” approved.`);
      } else if (t.dataset.revert) {
        if (!confirm(`Put "${label}" back to what it said before?`)) { t.disabled = false; return; }
        const back = { cost: row.was.cost || 0, ok: true, was: null };
        if (row.node !== "craftSources") back.where = row.was.where || "";
        await send(row, back);
        row.ok = true; row.cost = back.cost;
        if (back.where !== undefined) row.where = back.where;
        delete row.was;
        fine(`“${label}” put back to what it said before.`);
      } else {
        if (!confirm(`Take "${label}" off the shared list for everybody?`)) { t.disabled = false; return; }
        const tok = await fresh();
        const r = await fetch(`${DB}/${row.node}/${id}.json?auth=${tok}`, { method: "DELETE" });
        if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text().catch(() => "")).slice(0, 160));
        book = book.filter(m => m.id !== id);
        fine(`“${label}” taken off the list.`);
      }
      drawBook();
    } catch (err) {
      t.disabled = false;
      trouble(err, t.dataset.ok ? "Approving" : t.dataset.revert ? "Putting it back" : "Removing");
    }
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
      const tok = await fresh();
      const r = await fetch(`${DB}/admins/${encodeURIComponent(handle)}.json?auth=${tok}`, {
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
      const tok = await fresh();
      const r = await fetch(`${DB}/admins/${encodeURIComponent(handle)}.json?auth=${tok}`, { method: "DELETE" });
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
