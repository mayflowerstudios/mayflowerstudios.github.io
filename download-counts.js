import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVJ0Tiq0gimaB-epcD9HQlVBrOWHq-IXI",
  authDomain: "watchtogether-95d7d.firebaseapp.com",
  databaseURL: "https://watchtogether-95d7d-default-rtdb.firebaseio.com",
  projectId: "watchtogether-95d7d",
  storageBucket: "watchtogether-95d7d.firebasestorage.app"
};

const ALLOWED_IDS = new Set([
  "craft-planner",
  "farm-challenge",
  "idle-rpg",
  "mayflower-radio"
]);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const links = [...document.querySelectorAll("a[data-download-id]")]
  .filter(link => ALLOWED_IDS.has(link.dataset.downloadId));

if (links.length) {
  installStyles();
  const counters = new Map();
  const incrementQueues = new Map();

  for (const link of links) {
    const id = link.dataset.downloadId;
    let badge = link.nextElementSibling;
    if (!badge || !badge.matches(`.mf-download-count[data-download-count-id="${id}"]`)) {
      badge = document.createElement("span");
      badge.className = "mf-download-count";
      badge.dataset.downloadCountId = id;
      badge.setAttribute("aria-live", "polite");
      badge.textContent = "Loading downloads…";
      link.insertAdjacentElement("afterend", badge);
    }
    if (!counters.has(id)) counters.set(id, []);
    counters.get(id).push(badge);

    link.addEventListener("click", () => queueIncrement(id), { capture: true });
  }

  loadCounts();

  async function loadCounts() {
    try {
      const snapshot = await get(ref(db, "downloadCounts"));
      const values = snapshot.val() || {};
      for (const id of counters.keys()) updateBadges(id, normalizeCount(values[id]));
    } catch (error) {
      console.warn("Download counts could not be loaded.", error);
      for (const id of counters.keys()) setUnavailable(id);
    }
  }

  function queueIncrement(id) {
    const previous = incrementQueues.get(id) || Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(() => increment(id))
      .finally(() => {
        if (incrementQueues.get(id) === next) incrementQueues.delete(id);
      });
    incrementQueues.set(id, next);
  }

  async function increment(id) {
    try {
      const result = await runTransaction(
        ref(db, `downloadCounts/${id}`),
        current => normalizeCount(current) + 1,
        { applyLocally: false }
      );
      if (result.committed) updateBadges(id, normalizeCount(result.snapshot.val()));
    } catch (error) {
      // Never block or cancel the actual file download if Firebase is unavailable.
      console.warn(`Download count could not be updated for ${id}.`, error);
    }
  }

  function updateBadges(id, count) {
    const label = `${formatNumber(count)} ${count === 1 ? "download" : "downloads"}`;
    for (const badge of counters.get(id) || []) {
      badge.textContent = label;
      badge.title = `${label} for this file`;
    }
  }

  function setUnavailable(id) {
    for (const badge of counters.get(id) || []) {
      badge.textContent = "Download count unavailable";
      badge.title = "The file still downloads normally";
    }
  }
}

function normalizeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function installStyles() {
  if (document.getElementById("mf-download-count-styles")) return;
  const style = document.createElement("style");
  style.id = "mf-download-count-styles";
  style.textContent = `
    .mf-download-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 26px;
      margin: 6px 0 6px 8px;
      padding: 4px 9px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.07);
      color: inherit;
      font-size: 0.78rem;
      font-weight: 700;
      line-height: 1.2;
      opacity: 0.82;
      white-space: nowrap;
      vertical-align: middle;
    }
    @media (max-width: 540px) {
      .mf-download-count {
        margin-left: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
