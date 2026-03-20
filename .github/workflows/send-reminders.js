/**
 * send-reminders.js
 *
 * Runs in GitHub Actions on a 5-minute cron schedule.
 * Reads data/mindgarden.json from the repo, checks which meds are due
 * and not yet taken, then sends SMS via the EmailJS REST API.
 *
 * SMS config (phone number, carrier, EmailJS keys) is read from the
 * smsConfig object inside mindgarden.json — set it up via the admin
 * page's "Text Setup" panel so you don't need separate GitHub Secrets.
 *
 * To avoid duplicate texts, the script writes a `smsSentLog` array back
 * into the data file after each successful send. Each entry records the
 * reminder ID + date, so the same reminder only fires once per day even
 * if GitHub Actions runs the cron late or multiple times.
 *
 * Required GitHub Secrets:
 *   MG_ENCRYPTION_PASSPHRASE – (required if your data is encrypted)
 *   TZ_OFFSET                – hour offset from UTC (e.g., -5 for EST, -4 for EDT)
 *   SITE_URL                 – (optional) base URL of your mind garden site for confirm links
 *   GH_PAT                   – a GitHub personal access token with repo write access
 *                               (needed to push the dedup log back to the repo)
 */

const fs = require("fs");
const crypto = require("crypto");

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
  GH_PAT,
  GITHUB_REPOSITORY, // automatically set by GitHub Actions: "owner/repo"
} = process.env;

function getGatewayEmail(smsConfig) {
  const carrier = smsConfig.carrier || "";
  const number = smsConfig.number || "";

  const domain = CARRIERS[carrier];
  if (!domain) {
    console.error(`[SMS] Unknown carrier: "${carrier}". Known carriers: ${Object.keys(CARRIERS).join(", ")}`);
    return null;
  }
  const digits = number.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) {
    console.error(`[SMS] Invalid phone number: "${number}"`);
    return null;
  }
  return `${digits}@${domain}`;
}

// ── AES-256-GCM encryption/decryption (matches mind-garden.html) ──
async function deriveKey(passphrase, salt, usages) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}

async function decryptData(b64, passphrase) {
  const buf = Buffer.from(b64, "base64");
  const salt = buf.slice(0, 16);
  const iv = buf.slice(16, 28);
  const ct = buf.slice(28);
  const key = await deriveKey(passphrase, salt, ["decrypt"]);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(dec);
}

async function encryptData(plaintext, passphrase) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  const buf = new Uint8Array(salt.length + iv.length + ct.byteLength);
  buf.set(salt, 0);
  buf.set(iv, salt.length);
  buf.set(new Uint8Array(ct), salt.length + iv.length);
  return Buffer.from(buf).toString("base64");
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

// ── GitHub API: write file back to repo (for dedup log) ──
async function getFileSha(repo, path, token) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.sha;
}

async function writeFileToRepo(repo, path, content, message, token) {
  const sha = await getFileSha(repo, path, token);
  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: "main",
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    console.warn(`[SMS] Failed to write dedup log back to repo: ${res.status} ${text}`);
    return false;
  }
  return true;
}

// ── Main ──
async function main() {
  // Read the data file from the repo
  const rawFile = fs.readFileSync("data/mindgarden.json", "utf8");
  let fileData;
  try {
    fileData = JSON.parse(rawFile);
  } catch (e) {
    console.error("[SMS] Failed to parse mindgarden.json:", e.message);
    return;
  }

  const isEncrypted = !!fileData.encrypted;

  // Handle encryption
  let data;
  if (isEncrypted) {
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
  // smsSentLog tracks which reminders have already fired today: [{ remId, date }]
  let smsSentLog = data.smsSentLog || [];

  // Check if SMS is enabled in the app config
  if (!smsConfig.enabled) {
    console.log("[SMS] SMS is disabled in Mind Garden settings — skipping.");
    return;
  }

  // Validate SMS config from the data file
  if (!smsConfig.emailjsPublicKey || !smsConfig.emailjsServiceId || !smsConfig.emailjsTemplateId) {
    console.log("[SMS] Missing EmailJS config in smsConfig — set it up in the admin Text Setup panel.");
    return;
  }

  const gateway = getGatewayEmail(smsConfig);
  if (!gateway) return;

  // Get current time in the user's timezone
  const offset = parseFloat(TZ_OFFSET || "-5"); // default EST
  const now = new Date(Date.now() + offset * 3600000);
  const nowHours = now.getUTCHours();
  const nowMins = now.getUTCMinutes();
  const nowTotalMins = nowHours * 60 + nowMins;
  const todayStr = now.toISOString().split("T")[0];

  console.log(`[SMS] Checking reminders at ${String(nowHours).padStart(2,"0")}:${String(nowMins).padStart(2,"0")} (UTC${offset >= 0 ? "+" : ""}${offset}) — ${todayStr}`);

  // Purge old sent-log entries (keep only today's)
  smsSentLog = smsSentLog.filter(e => e.date === todayStr);

  // Find which meds are taken today
  const takenToday = new Set(
    medLogs.filter(l => l.date === todayStr).map(l => l.medId)
  );

  // Build set of already-sent reminder IDs today
  const alreadySent = new Set(smsSentLog.map(e => e.remId));

  // Collect due (untaken) meds from enabled reminders whose time has passed today.
  // No tight window — if it's past the reminder time and the med isn't taken
  // and we haven't already texted for this reminder today, fire it.
  const dueMedIds = new Set();
  const firedRemIds = [];

  for (const rem of reminders) {
    if (!rem.enabled) continue;
    if (alreadySent.has(rem.id)) continue; // already texted for this one today

    const [rh, rm] = rem.time.split(":").map(Number);
    const remMins = rh * 60 + rm;

    // Only fire if the reminder time has passed (with 2 min grace for clock skew)
    if (nowTotalMins < remMins - 2) continue;

    let hasUntaken = false;
    for (const medId of rem.medIds) {
      if (!takenToday.has(medId)) {
        dueMedIds.add(medId);
        hasUntaken = true;
      }
    }
    if (hasUntaken) {
      firedRemIds.push(rem.id);
    }
  }

  const dueMeds = [...dueMedIds]
    .map(id => meds.find(m => m.id === id))
    .filter(Boolean);

  if (dueMeds.length === 0) {
    console.log("[SMS] No meds due right now.");
    return;
  }

  console.log(`[SMS] ${dueMeds.length} med(s) due: ${dueMeds.map(m => m.name).join(", ")}`);

  // Build message
  const baseUrl = SITE_URL || "";
  let message;

  if (dueMeds.length === 1) {
    const med = dueMeds[0];
    const takeLink = baseUrl && med.id ? `${baseUrl}#take=${med.id}` : "";
    message = `Time to take ${med.name} (${med.dosage || "no dosage"})${takeLink ? "\nTap to confirm: " + takeLink : ""}`;
  } else {
    const lines = dueMeds.map(m => {
      const takeLink = baseUrl && m.id ? `${baseUrl}#take=${m.id}` : "";
      return `• ${m.name} (${m.dosage || "no dosage"})${takeLink ? "\n  Confirm: " + takeLink : ""}`;
    });
    message = `💊 Time to take your meds:\n${lines.join("\n")}`;
  }

  // Send
  try {
    await sendViaEmailJS(smsConfig, {
      to_email: gateway,
      med_name: dueMeds.map(m => m.name).join(", "),
      med_dosage: dueMeds.map(m => m.dosage || "").join(", "),
      message,
    });
    console.log(`[SMS] ✅ Reminder sent to ${gateway}`);
  } catch (err) {
    console.error(`[SMS] ❌ Failed:`, err.message);
    process.exit(1);
  }

  // Record which reminders we just sent, so we don't text again today
  for (const remId of firedRemIds) {
    smsSentLog.push({ remId, date: todayStr });
  }

  // Write the updated sent log back to the repo
  data.smsSentLog = smsSentLog;

  const token = GH_PAT || process.env.GITHUB_TOKEN;
  const repo = GITHUB_REPOSITORY;
  if (token && repo) {
    let contentText;
    if (isEncrypted) {
      const raw = JSON.stringify(data, null, 2);
      const encrypted = await encryptData(raw, MG_ENCRYPTION_PASSPHRASE);
      contentText = JSON.stringify({ encrypted: true, v: 1, data: encrypted });
    } else {
      contentText = JSON.stringify(data, null, 2);
    }
    await writeFileToRepo(repo, "data/mindgarden.json", contentText, `SMS sent ${todayStr}`, token);
    console.log("[SMS] ✅ Dedup log written back to repo.");
  } else {
    console.warn("[SMS] ⚠ No GH_PAT or GITHUB_TOKEN — can't write dedup log. You may get duplicate texts.");
  }
}

main();
