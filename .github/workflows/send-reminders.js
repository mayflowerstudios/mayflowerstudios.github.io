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
 * Required GitHub Secrets:
 *   MG_ENCRYPTION_PASSPHRASE – (required if your data is encrypted)
 *   TZ_OFFSET                – hour offset from UTC (e.g., -5 for EST, -4 for EDT)
 *   SITE_URL                 – (optional) base URL of your mind garden site for confirm links
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

// ── Config from environment (only non-SMS stuff now) ──
const {
  MG_ENCRYPTION_PASSPHRASE,
  SITE_URL,
  TZ_OFFSET,
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

// ── AES-256-GCM decryption (matches mind-garden.html) ──
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
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
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
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

  // Handle encryption
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

  // Find which meds are taken today
  const takenToday = new Set(
    medLogs.filter(l => l.date === todayStr).map(l => l.medId)
  );

  // Collect due (untaken) meds from enabled reminders whose time has passed
  // Only fire if we're within 5 minutes of the reminder time (the cron window)
  const dueMedIds = new Set();

  for (const rem of reminders) {
    if (!rem.enabled) continue;
    const [rh, rm] = rem.time.split(":").map(Number);
    const remMins = rh * 60 + rm;

    // Fire if current time is 0–4 minutes past the reminder time
    const diff = nowTotalMins - remMins;
    if (diff < 0 || diff > 4) continue;

    for (const medId of rem.medIds) {
      if (!takenToday.has(medId)) {
        dueMedIds.add(medId);
      }
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
}

main();
