/* Mayflower Studios — the contact form, and the admin view of what comes in.
   Writing a message needs no account. Reading them needs to be an admin, which
   is decided by /admins/<uid> in the database and can only be set in the
   Firebase console — there is no way to make yourself one from here. */
(function () {
  const DB = "https://watchtogether-95d7d-default-rtdb.firebaseio.com";

  const KINDS = [
    ["bug", "🐞 Something is broken"],
    ["idea", "💡 An idea or a request"],
    ["question", "❓ A question"],
    ["other", "🌸 Something else"]
  ];
  const ABOUT = [
    "Craft Planner", "Mayflower Radio", "Mayflower Idle RPG", "Farm Challenge",
    "Minecraft mods", "Discord bots", "The website", "Something else"
  ];

  const el = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------------------------------------------------------------- sending */

  function newKey() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  }

  function fill(sel, options) {
    sel.innerHTML = options.map(o =>
      Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>`
                       : `<option value="${esc(o)}">${esc(o)}</option>`).join("");
  }

  function say(node, text, kind) {
    node.textContent = text;
    node.className = "cMsg " + (kind || "");
  }

  async function send(e) {
    e.preventDefault();
    const msgEl = el("cFormMsg"), btn = el("cSend");
    // A field no person can see. Anything that fills it in is not a person.
    if (el("cWebsite").value) { say(msgEl, "Thanks!", "ok"); return; }

    const message = el("cMessage").value.trim();
    if (message.length < 4) { say(msgEl, "Tell me a little more first.", "bad"); return; }

    const body = {
      kind: el("cKind").value,
      about: el("cAbout").value,
      message: message.slice(0, 4000),
      at: Date.now()
    };
    const subject = el("cSubject").value.trim();
    const reply = el("cReply").value.trim();
    const name = el("cName").value.trim();
    if (subject) body.subject = subject.slice(0, 80);
    if (reply) body.reply = reply.slice(0, 120);
    if (name) body.name = name.slice(0, 40);
    if (window.MFAuth && MFAuth.user) body.uid = MFAuth.user.uid;

    btn.disabled = true;
    say(msgEl, "Sending…", "");
    try {
      const res = await fetch(`${DB}/feedback/${newKey()}.json`, {
        method: "PUT", body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      el("cForm").reset();
      fillDefaults();
      say(msgEl, "Sent — thank you. Every one of these gets read. 🌸", "ok");
    } catch (err) {
      say(msgEl, "That did not send. Try again in a moment, or use Ko-fi.", "bad");
      console.warn("contact send failed:", err);
    } finally {
      btn.disabled = false;
    }
  }

  function fillDefaults() {
    fill(el("cKind"), KINDS);
    fill(el("cAbout"), ABOUT);
    // If they came from a project page, guess what it is about.
    const from = document.referrer || "";
    const guess = from.includes("craft-planner") ? "Craft Planner"
                : from.includes("radio") ? "Mayflower Radio"
                : from.includes("idle-rpg") ? "Mayflower Idle RPG"
                : from.includes("farm-challenge") ? "Farm Challenge"
                : "";
    if (guess) el("cAbout").value = guess;
  }

  /* ---------------------------------------------------------------- reading */

  let token = null, mine = [];

  const KIND_WORD = Object.fromEntries(KINDS.map(k => [k[0], k[1]]));
  const when = t => {
    const d = new Date(Number(t) || 0);
    return isNaN(d) ? "" : d.toLocaleString();
  };

  async function loadAdmin(user) {
    const box = el("cAdmin");
    if (!user) { box.hidden = true; return; }
    try { token = await user.getIdToken(); } catch { box.hidden = true; return; }

    const isAdmin = await fetch(`${DB}/admins/${user.uid}.json?auth=${token}`)
      .then(r => r.ok ? r.json() : null).catch(() => null);
    if (isAdmin !== true) {
      // Not an admin: show the account id so it can be added in the console.
      el("cWhoami").hidden = false;
      el("cUid").textContent = user.uid;
      box.hidden = true;
      return;
    }
    el("cWhoami").hidden = true;
    box.hidden = false;
    await refresh();
  }

  async function refresh() {
    const list = el("cList");
    list.innerHTML = `<p class="muted small">Loading…</p>`;
    try {
      const data = await fetch(`${DB}/feedback.json?auth=${token}`, { cache: "no-store" })
        .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
      mine = Object.entries(data || {}).map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.at || 0) - (a.at || 0));
      draw();
    } catch (err) {
      list.innerHTML = `<p class="muted small">Could not load. ${esc(err.message)}</p>`;
    }
  }

  function draw() {
    const list = el("cList");
    const kind = el("cFilterKind").value, hide = el("cHideDone").checked;
    const rows = mine.filter(m => (!kind || m.kind === kind) && (!hide || !m.done));
    el("cCount").textContent = `${rows.length} of ${mine.length}`;
    if (!rows.length) { list.innerHTML = `<p class="muted small">Nothing here.</p>`; return; }

    list.innerHTML = rows.map(m => `
      <article class="cItem${m.done ? " done" : ""}">
        <header>
          <span class="cTag">${esc(KIND_WORD[m.kind] || m.kind || "?")}</span>
          <span class="cTag alt">${esc(m.about || "—")}</span>
          <span class="cWhen">${esc(when(m.at))}</span>
        </header>
        ${m.subject ? `<h4>${esc(m.subject)}</h4>` : ""}
        <p class="cBody">${esc(m.message || "")}</p>
        <footer>
          <span class="muted small">
            ${m.name ? esc(m.name) : "Anonymous"}${m.reply ? " · " + esc(m.reply) : ""}${m.uid ? " · signed in" : ""}
          </span>
          <span class="cActs">
            <button data-done="${esc(m.id)}">${m.done ? "Not done" : "Mark done"}</button>
            <button data-del="${esc(m.id)}" class="danger">Delete</button>
          </span>
        </footer>
      </article>`).join("");
  }

  async function act(e) {
    const t = e.target.closest("[data-done],[data-del]");
    if (!t) return;
    const id = t.dataset.done || t.dataset.del;
    const row = mine.find(m => m.id === id);
    if (!row) return;
    try {
      if (t.dataset.del) {
        if (!confirm("Delete this message for good?")) return;
        await fetch(`${DB}/feedback/${id}.json?auth=${token}`, { method: "DELETE" });
        mine = mine.filter(m => m.id !== id);
      } else {
        const now = !row.done;
        await fetch(`${DB}/feedback/${id}.json?auth=${token}`, {
          method: "PATCH", body: JSON.stringify({ done: now })
        });
        row.done = now;
      }
      draw();
    } catch (err) { console.warn("contact action failed:", err); }
  }

  /* ---------------------------------------------------------------- start */

  fillDefaults();
  el("cForm").addEventListener("submit", send);
  el("cList").addEventListener("click", act);
  el("cFilterKind").addEventListener("change", draw);
  el("cHideDone").addEventListener("change", draw);
  el("cRefresh").addEventListener("click", refresh);
  fill(el("cFilterKind"), [["", "Everything"], ...KINDS]);

  if (window.MFAuth && MFAuth.onChange) MFAuth.onChange(user => loadAdmin(user));
  else document.addEventListener("DOMContentLoaded", () => {
    if (window.MFAuth && MFAuth.onChange) MFAuth.onChange(user => loadAdmin(user));
  });
})();
