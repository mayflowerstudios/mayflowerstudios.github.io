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
  let currentUser = null;
  let currentProfile = null;

  function setStatus(message, kind) {
    status.textContent = message || "";
    status.className = "wm-status" + (kind ? " " + kind : "");
  }

  function validFile() {
    const file = fileInput.files && fileInput.files[0];
    return !!file && file.name.toLowerCase().endsWith(".world") && file.size <= MAX_BYTES;
  }

  function refreshButton() {
    submit.disabled = !currentUser || !currentProfile || !currentProfile.username || !validFile();
  }

  function renderAccount(user, profile) {
    currentUser = user || null;
    currentProfile = profile || null;
    if (!user) {
      accountBox.innerHTML = 'Sign in to your Mayflower Studios account before creating a WorldMark. <a href="/account.html">Sign in or create an account →</a>';
    } else if (!profile || !profile.username) {
      accountBox.innerHTML = 'Your account needs a unique <strong>@username</strong> before it can mark a world. <a href="/account.html">Choose one in Account →</a>';
    } else {
      const safeName = String(profile.displayName || user.displayName || "Mayflower creator").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
      const safeHandle = String(profile.username).replace(/[^a-z0-9_]/gi, "");
      accountBox.innerHTML = `WorldMark will identify this world as <strong>${safeName} (@${safeHandle})</strong>.`;
    }
    refreshButton();
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

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file && !file.name.toLowerCase().endsWith(".world")) setStatus("Choose a 3DXChat .world file.", "bad");
    else if (file && file.size > MAX_BYTES) setStatus("That world is over the current 24 MB web limit.", "bad");
    else setStatus("");
    refreshButton();
  });

  byId("worldmarkForm").addEventListener("submit", async event => {
    event.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    if (!currentUser || !currentProfile || !currentProfile.username || !validFile()) return refreshButton();
    submit.disabled = true;
    submit.textContent = "Creating your WorldMark…";
    setStatus("Securely marking your world. Larger worlds may take a moment.");
    try {
      const token = await currentUser.getIdToken(true);
      const form = new FormData();
      form.append("world", file, file.name);
      form.append("note", noteInput.value.slice(0, 500));
      form.append("username", currentProfile.username);
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) {
        let message = "WorldMark could not mark this world.";
        try { const body = await response.json(); if (body && body.error) message = body.error; } catch (_) {}
        throw new Error(message);
      }
      const blob = await response.blob();
      const fallback = file.name.replace(/\.world$/i, " WorldMark Package.zip");
      const filename = filenameFrom(response, fallback);
      download(blob, filename);
      setStatus(`WorldMark created successfully. Downloaded ${filename}`, "ok");
      fileInput.value = "";
      noteInput.value = "";
    } catch (error) {
      setStatus(error && error.message ? error.message : "WorldMark could not mark this world.", "bad");
    } finally {
      submit.textContent = "Create my WorldMark";
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
