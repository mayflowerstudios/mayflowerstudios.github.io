(function () {
  "use strict";

  const ENDPOINT = "https://us-east1-mayflowerworldmark.cloudfunctions.net/world_mark_api";
  const MAX_BYTES = 24 * 1024 * 1024;
  const byId = id => document.getElementById(id);
  const fileInput = byId("worldmarkFile");
  const noteInput = byId("worldmarkNote");
  const accountBox = byId("worldmarkAccount");
  const submit = byId("worldmarkSubmit");
  const status = byId("worldmarkStatus");
  const report = byId("worldmarkReport");
  let currentUser = null;
  let currentProfile = null;
  let mode = "sign";

  function setStatus(message, kind) {
    status.textContent = message || "";
    status.className = "wm-status" + (kind ? " " + kind : "");
  }

  function validFile() {
    const file = fileInput.files && fileInput.files[0];
    return !!file && file.name.toLowerCase().endsWith(".world") && file.size <= MAX_BYTES;
  }

  function canUseCurrentMode() {
    if (!currentUser || !validFile()) return false;
    return mode === "verify" || !!(currentProfile && currentProfile.username);
  }

  function refreshButton() {
    submit.disabled = !canUseCurrentMode();
  }

  function safeAccountName(user, profile) {
    return String((profile && profile.displayName) || user.displayName || "Mayflower creator")
      .replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }

  function renderAccount(user, profile) {
    currentUser = user || null;
    currentProfile = profile || null;
    if (!user) {
      accountBox.innerHTML = `Sign in to your Mayflower Studios account before ${mode === "sign" ? "creating" : "checking"} a WorldMark. <a href="/account.html">Sign in or create an account →</a>`;
    } else if (mode === "sign" && (!profile || !profile.username)) {
      accountBox.innerHTML = 'Your account needs a unique <strong>@username</strong> before it can mark a world. <a href="/account.html">Choose one in Account →</a>';
    } else if (mode === "sign") {
      const safeName = safeAccountName(user, profile);
      const safeHandle = String(profile.username).replace(/[^a-z0-9_]/gi, "");
      accountBox.innerHTML = `WorldMark will identify this world as <strong>${safeName} (@${safeHandle})</strong>.`;
    } else {
      accountBox.innerHTML = `Signed in as <strong>${safeAccountName(user, profile)}</strong>. Choose a world to check its embedded WorldMark.`;
    }
    refreshButton();
  }

  function setMode(nextMode) {
    mode = nextMode;
    const signing = mode === "sign";
    byId("worldmarkModeSign").classList.toggle("active", signing);
    byId("worldmarkModeSign").setAttribute("aria-selected", String(signing));
    byId("worldmarkModeVerify").classList.toggle("active", !signing);
    byId("worldmarkModeVerify").setAttribute("aria-selected", String(!signing));
    byId("worldmarkNoteField").hidden = !signing;
    byId("worldmarkSignHelp").hidden = !signing;
    byId("worldmarkVerifyHelp").hidden = signing;
    byId("worldmarkFileLabel").textContent = signing ? "Unsigned world file" : "World file to verify";
    submit.textContent = signing ? "Create my WorldMark" : "Verify this WorldMark";
    report.hidden = true;
    setStatus("");
    renderAccount(currentUser, currentProfile);
  }

  function filenameFrom(response, fallback) {
    const header = response.headers.get("Content-Disposition") || "";
    const match = /filename="?([^";]+)"?/i.exec(header);
    return String(match ? match[1] : fallback).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function addDetail(label, value) {
    if (value === null || value === undefined || value === "") return;
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = String(value);
    byId("worldmarkDetails").append(term, description);
  }

  function renderVerification(value) {
    if (!value) return;
    const verdict = byId("worldmarkVerdict");
    const labels = {
      valid_unchanged: ["Authentic · unchanged", "good", `Signed by ${value.signerName || "Unknown signer"}`],
      valid_edited: ["Authentic · edited", "warn", `Signed by ${value.signerName || "Unknown signer"}`],
      invalid: ["Invalid or damaged", "bad", "WorldMark proof could not be validated"],
      unsigned: ["No WorldMark", "warn", "This world is not signed"],
    };
    const selected = labels[value.status] || labels.invalid;
    verdict.textContent = selected[0];
    verdict.className = "wm-verdict " + selected[1];
    byId("worldmarkReportTitle").textContent = selected[2];
    byId("worldmarkReportMessage").textContent = value.message || "Verification finished.";
    byId("worldmarkDetails").replaceChildren();
    if (value.hasSignature) {
      addDetail("Signer", value.signerName || "Unknown");
      addDetail("Signed", value.signedLocal || value.signedUtc);
      addDetail("Cryptographic proof", value.cryptographicallyValid ? "Valid" : "Invalid or damaged");
      addDetail("World content", value.contentMatches ? "Unchanged since signing" : "Changed after signing");
      addDetail("Embedded backups", `${value.validCopies || 0} of 3 valid copies`);
      addDetail("Movement-resistant match", `${Math.round(Number(value.movementMatch || 0) * 100)}%`);
      addDetail("Original filename", value.originalWorldName);
      addDetail("Objects when signed", value.objectCount);
      addDetail("Signature ID", value.signatureId);
      addDetail("Key fingerprint", value.keyFingerprint);
      addDetail("Ownership note", value.note);
    }
    report.hidden = false;
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    report.hidden = true;
    if (file && !file.name.toLowerCase().endsWith(".world")) setStatus("Choose a 3DXChat .world file.", "bad");
    else if (file && file.size > MAX_BYTES) setStatus("That world is over the current 24 MB web limit.", "bad");
    else setStatus("");
    refreshButton();
  });

  byId("worldmarkModeSign").addEventListener("click", () => setMode("sign"));
  byId("worldmarkModeVerify").addEventListener("click", () => setMode("verify"));

  byId("worldmarkForm").addEventListener("submit", async event => {
    event.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    if (!canUseCurrentMode()) return refreshButton();
    const action = mode;
    submit.disabled = true;
    submit.textContent = action === "sign" ? "Creating your WorldMark…" : "Verifying WorldMark…";
    report.hidden = true;
    setStatus(action === "sign" ? "Securely marking your world. Larger worlds may take a moment." : "Checking the embedded ownership proof…");
    try {
      const token = await currentUser.getIdToken(true);
      const form = new FormData();
      form.append("action", action);
      form.append("world", file, file.name);
      if (action === "sign") {
        form.append("note", noteInput.value.slice(0, 500));
        form.append("username", currentProfile.username);
      }
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) {
        let message = action === "sign" ? "WorldMark could not mark this world." : "WorldMark could not verify this world.";
        try {
          const body = await response.json();
          if (body && body.verification) renderVerification(body.verification);
          if (body && body.error) message = body.error;
        } catch (_) {}
        throw new Error(message);
      }
      if (action === "verify") {
        const body = await response.json();
        renderVerification(body.verification);
        setStatus("Verification complete.", "ok");
      } else {
        const blob = await response.blob();
        const fallback = file.name.replace(/\.world$/i, " WorldMark Package.zip");
        const filename = filenameFrom(response, fallback);
        download(blob, filename);
        setStatus(`WorldMark created successfully. Downloaded ${filename}`, "ok");
        fileInput.value = "";
        noteInput.value = "";
      }
    } catch (error) {
      setStatus(error && error.message ? error.message : "WorldMark could not process this world.", "bad");
    } finally {
      submit.textContent = mode === "sign" ? "Create my WorldMark" : "Verify this WorldMark";
      refreshButton();
    }
  });

  function connectAuth() {
    if (window.MFAuth && typeof MFAuth.onChange === "function") {
      MFAuth.onChange(renderAccount);
      return true;
    }
    return false;
  }
  if (!connectAuth()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (connectAuth() || attempts > 100) clearInterval(timer);
    }, 100);
  }
})();
