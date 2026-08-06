/* Mayflower Studios — the contact form.
   Sending needs no account. What comes in is read from the admin section on the
   profile page, not from here. */
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
    "Minecraft mods", "BloomBot", "The website", "Something else"
  ];

  const el = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

  fillDefaults();
  el("cForm").addEventListener("submit", send);
})();
