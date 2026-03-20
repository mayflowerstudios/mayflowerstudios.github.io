/**
 * send-reminders.js
 *
 * Runs in GitHub Actions on a 5-minute cron schedule.
 * Reads data/mindgarden.json from the repo, checks which meds are due
 * and not yet taken, then sends SMS via the EmailJS REST API.
 *
 * SMS config (phone number, carrier, EmailJS keys) is read from the
 * smsConfig object inside mindgarden.json — set it up via the admin
 * page's "Text Setup" panel instead of GitHub Secrets.
 *
 * Dedup: writes to a SEPARATE file (data/sms-sent.json) so we never
 * touch mindgarden.json and can't race with the admin page.
 *
 * Required GitHub Secrets:
 *   MG_ENCRYPTION_PASSPHRASE – (required if your data is encrypted)
 *   TZ_OFFSET                – hour offset from UTC (e.g., -5 for EST, -4 for EDT)
 *   SITE_URL                 – (optional) base URL of your mind garden site
 */

const fs = require("fs");
const nodeCrypto = require("crypto");

// Node's require("crypto") has .subtle but NOT .getRandomValues.
// For getRandomValues we need globalThis.crypto (Web Crypto API).
const webcrypto = globalThis.crypto || nodeCrypto.webcrypto;

// ── Carrier gateways (must match mind-garden.html) ──
const CARRIERS = {
  "Verizon":           "vtext.com",
  "T-Mobile":          "mailmymobile.net",
  "Metro by T-Mobile": "mymetropcs.com",
  "Boost Mobile":      "sms.myboostmobile.com",
  "Google Fi":         "msg.fi.google.com",
  "U.S. Cellular":     "email.uscc.net",
  "Visible":           "vtext.com",
  "Xfinity Mobile":    "vtext.com",
  "Simple Mobile":     "smtext.com",
  "Ting":              "message.ting.com",
  "Ultra Mobile":      "mailmymobile.net",
  "Consumer Cellular": "mailmymobile.net",
  "AT&T":              "txt.att.net",
  "Cricket":           "sms.cricketwireless.net",
};

// ── Config from environment ──
const {
  MG_ENCRYPTION_PASSPHRASE,
  SITE_URL,
  TZ_OFFSET,
  GITHUB_REPOSITORY, // auto-set by GitHub Actions: "owner/repo"
} = process.env;

// Prefer GH_PAT if set, else GITHUB_TOKEN (auto-injected by Actions)
const GH_TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN;

function getGatewayEmail(smsConfig) {
  const carrier = smsConfig.carrier || "";
  const number = smsConfig.number || "";
  const domain = CARRIERS[carrier];
  if (!domain) {
    console.error(`[SMS] Unknown carrier: "${carrier}". Known: ${Object.keys(CARRIERS).join(", ")}`);
    return null;
  }
  const digits = number.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) {
    console.error(`[SMS] Invalid phone number: "${number}"`);
    return null;
  }
  return `${digits}@${domain}`;
}

// ── AES-256-GCM decryption (matches mind-garden.html @ 310k iterations) ──
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decryptData(b64, passphrase) {
  const buf = Buffer.from(b64, "base64");
  const salt = buf.slice(0, 16);
  const iv = buf.slice(16, 28);
  const ct = buf.slice(28);
  const key = await deriveKey(passphrase, salt);
  const dec = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(dec);
}

// ── EmailJS REST API ──
async function sendViaEmailJS(smsConfig, templateParams) {
  const body = JSON.stringify({
    service_id: smsConfig.emailjsServiceId,
    template_id: smsConfig.emailjsTemplateId,
    user_id: smsConfig.emailjsPublicKey,
    template_params: templateParams,
  });
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EmailJS ${res.status}: ${text}`);
  }
  return true;
}

// ── GitHub API helpers (for the dedup file only) ──
const GH_API = "https://api.github.com";
const DEDUP_PATH = "data/sms-sent.json";

function ghHeaders() {
  return {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

async function readDedupFile() {
  // Try local checkout first (faster, no API call)
  try {
    const raw = fs.readFileSync(DEDUP_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    // File doesn't exist yet — that's fine, first run
    return { sentToday: [], date: "" };
  }
}

async function writeDedupFile(dedupData) {
  if (!GH_TOKEN || !GITHUB_REPOSITORY) {
    console.warn("[SMS] ⚠ No token/repo — can't write dedup file. May get duplicate texts.");
    return;
  }

  const content = JSON.stringify(dedupData, null, 2);
  const b64 = Buffer.from(content, "utf8").toString("base64");

  // Get current SHA (if file exists)
  let sha = null;
  try {
    const res = await fetch(
      `${GH_API}/repos/${GITHUB_REPOSITORY}/contents/${DEDUP_PATH}`,
      { headers: ghHeaders() }
    );
    if (res.ok) {
      const json = await res.json();
      sha = json.sha;
    }
  } catch {}

  const body = {
    message: "[bot] update sms dedup log",
    content: b64,
    branch: "main",
  };
  if (sha) body.sha = sha;

  try {
    const res = await fetch(
      `${GH_API}/repos/${GITHUB_REPOSITORY}/contents/${DEDUP_PATH}`,
      { method: "PUT", headers: ghHeaders(), body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[SMS] ⚠ Dedup write failed: ${res.status} ${text}`);
    } else {
      console.log("[SMS] ✅ Dedup log updated.");
    }
  } catch (err) {
    console.warn("[SMS] ⚠ Dedup write error:", err.message);
  }
}

// ── Main ──
async function main() {
  // 1. Read mindgarden.json
  let rawFile;
  try {
    rawFile = fs.readFileSync("data/mindgarden.json", "utf8");
  } catch (e) {
    console.error("[SMS] Can't read data/mindgarden.json:", e.message);
    return;
  }

  let fileData;
  try {
    fileData = JSON.parse(rawFile);
  } catch (e) {
    console.error("[SMS] Failed to parse mindgarden.json:", e.message);
    return;
  }

  // 2. Decrypt if needed
  let data;
  if (fileData.encrypted) {
    if (!MG_ENCRYPTION_PASSPHRASE) {
      console.log("[SMS] Data is encrypted but MG_ENCRYPTION_PASSPHRASE not set — skipping.");
      return;
    }
    try {
      const decrypted = await decryptData(fileData.data, MG_ENCRYPTION_PASSPHRASE);
      data = JSON.parse(decrypted);
    } catch (e) {
      console.error("[SMS] Decryption failed:", e.message);
      return;
    }
  } else {
    data = fileData;
  }

  const { meds = [], medLogs = [], reminders = [], smsConfig = {} } = data;

  // 3. Validate SMS config
  if (!smsConfig.enabled) {
    console.log("[SMS] SMS is disabled in Mind Garden settings — skipping.");
    return;
  }
  if (!smsConfig.emailjsPublicKey || !smsConfig.emailjsServiceId || !smsConfig.emailjsTemplateId) {
    console.log("[SMS] Missing EmailJS config in smsConfig — configure in admin Text Setup.");
    return;
  }
  const gateway = getGatewayEmail(smsConfig);
  if (!gateway) return;

  // 4. Compute local time
  const offset = parseFloat(TZ_OFFSET || "-5");
  const now = new Date(Date.now() + offset * 3600000);
  const nowHours = now.getUTCHours();
  const nowMins = now.getUTCMinutes();
  const nowTotalMins = nowHours * 60 + nowMins;
  const todayStr = now.toISOString().split("T")[0];

  console.log(`[SMS] ${String(nowHours).padStart(2,"0")}:${String(nowMins).padStart(2,"0")} (UTC${offset >= 0 ? "+" : ""}${offset}) — ${todayStr}`);

  // 5. Load dedup log (separate file, never touches mindgarden.json)
  let dedup = await readDedupFile();
  // Reset if it's a new day
  if (dedup.date !== todayStr) {
    dedup = { sentToday: [], date: todayStr };
  }
  const alreadySent = new Set(dedup.sentToday);

  // 6. Find meds taken today
  const takenToday = new Set(
    medLogs.filter(l => l.date === todayStr).map(l => l.medId)
  );

  // 7. Collect due reminders
  const dueMedIds = new Set();
  const firedRemIds = [];

  for (const rem of reminders) {
    if (!rem.enabled) continue;
    if (alreadySent.has(rem.id)) continue;

    const [rh, rm] = rem.time.split(":").map(Number);
    const remMins = rh * 60 + rm;

    // Fire if reminder time has passed (2-min grace for clock skew)
    if (nowTotalMins < remMins - 2) continue;

    let hasUntaken = false;
    for (const medId of rem.medIds) {
      if (!takenToday.has(medId)) {
        dueMedIds.add(medId);
        hasUntaken = true;
      }
    }
    if (hasUntaken) firedRemIds.push(rem.id);
  }

  const dueMeds = [...dueMedIds]
    .map(id => meds.find(m => m.id === id))
    .filter(Boolean);

  if (dueMeds.length === 0) {
    console.log("[SMS] No meds due right now.");
    return;
  }

  console.log(`[SMS] ${dueMeds.length} med(s) due: ${dueMeds.map(m => m.name).join(", ")}`);

  // 8. Build message
  const baseUrl = SITE_URL || "";
  let message;
  if (dueMeds.length === 1) {
    const med = dueMeds[0];
    const link = baseUrl && med.id ? `${baseUrl}#take=${med.id}` : "";
    message = `Time to take ${med.name} (${med.dosage || "no dosage"})${link ? "\nTap to confirm: " + link : ""}`;
  } else {
    const lines = dueMeds.map(m => {
      const link = baseUrl && m.id ? `${baseUrl}#take=${m.id}` : "";
      return `• ${m.name} (${m.dosage || "no dosage"})${link ? "\n  Confirm: " + link : ""}`;
    });
    message = `💊 Time to take your meds:\n${lines.join("\n")}`;
  }

  // 9. Send
  try {
    await sendViaEmailJS(smsConfig, {
      to_email: gateway,
      med_name: dueMeds.map(m => m.name).join(", "),
      med_dosage: dueMeds.map(m => m.dosage || "").join(", "),
      message,
    });
    console.log(`[SMS] ✅ Sent to ${gateway}`);
  } catch (err) {
    console.error(`[SMS] ❌ Failed:`, err.message);
    process.exit(1);
  }

  // 10. Update dedup log (separate file — no risk to mindgarden.json)
  for (const remId of firedRemIds) {
    dedup.sentToday.push(remId);
  }
  await writeDedupFile(dedup);
}

main();
