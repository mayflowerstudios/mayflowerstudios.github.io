/* Mayflower Studios — universal notification center */
(function () {
  const FB_VERSION = "10.12.2";
  const MAX_LIVE = 150;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const cleanUrl = value => {
    const v = String(value || "").trim();
    if (!v) return "";
    if (v.startsWith("/") && !v.startsWith("//")) return v;
    return "";
  };

  let db = null, mods = null, uid = null, rows = [], unsub = null;

  // ---- notification preferences ----
  // The six switches on the settings page used to do nothing at all: nothing
  // consulted them when a notification was created, and the sender could not
  // have done so anyway — notificationPrefs/$uid is readable only by its owner.
  // So they are applied here instead, on the recipient's own device, where the
  // preference actually lives. A muted type is neither listed nor counted.
  //
  // Moderation notices and awarded badges are deliberately absent from this
  // map: they always show. Being able to switch off a warning from a moderator
  // would make the warning pointless.
  const PREF_FOR_TYPE = {
    friend_request: "friends", friend_accepted: "friends",
    gift: "gifts",
    guestbook: "guestbook",
    relationship_request: "relationship", relationship_accepted: "relationship",
    room_invite: "rooms",
    mention: "messages", direct_message: "messages",
  };
  let prefs = null;   // null until loaded; nothing is filtered before then

  function wanted(n) {
    if (!prefs) return true;
    const key = PREF_FOR_TYPE[String(n && n.type || "")];
    return !key || prefs[key] !== false;
  }
  function visibleRows() { return rows.filter(wanted); }

  async function loadPrefs() {
    if (!window.MFAuth || !MFAuth.getNotificationPrefs) return;
    try { prefs = await MFAuth.getNotificationPrefs(); }
    catch (_) { prefs = null; }
    draw();
  }
  // Changing a switch on the settings page should take effect on any tab that
  // is already open, not only after a reload.
  window.addEventListener("mf-notification-prefs-changed", e => {
    if (e && e.detail) { prefs = e.detail; draw(); }
    else loadPrefs();
  });
  let panelOpen = false, pageFilter = "all";
  const $ = id => document.getElementById(id);

  function relativeTime(t) {
    const ms = Date.now() - (Number(t) || 0);
    if (!Number.isFinite(ms) || ms < 0) return "just now";
    const min = Math.floor(ms / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(Number(t)).toLocaleDateString();
  }

  function injectStyles() {
    if ($("mfNotificationStyles")) return;
    const st = document.createElement("style"); st.id = "mfNotificationStyles";
    st.textContent = `
      .mf-notify-button{position:relative;display:inline-grid;place-items:center;width:38px;height:36px;padding:0;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--text-2);font:inherit;font-size:16px;cursor:pointer;transition:.18s ease}
      .mf-notify-button:hover,.mf-notify-button[aria-expanded="true"]{color:var(--text);background:rgba(255,255,255,.05);border-color:var(--border-2)}
      .mf-notify-button[hidden],.mf-notify-badge[hidden]{display:none!important}.mf-notify-badge{position:absolute;top:-4px;right:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;display:grid;place-items:center;background:var(--rose-deep,#fb7185);color:#fff;border:2px solid rgba(14,13,28,.95);font:700 9px/1 system-ui}
      .mf-notify-panel{position:fixed;z-index:10020;top:70px;right:max(16px,calc((100vw - 1120px)/2));width:min(390px,calc(100vw - 24px));max-height:min(660px,calc(100vh - 90px));display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--border-2);border-radius:18px;background:rgba(17,16,35,.98);box-shadow:0 22px 70px rgba(0,0,0,.52);backdrop-filter:blur(20px)}
      .mf-notify-panel[hidden]{display:none}.mf-notify-head{display:flex;align-items:center;gap:8px;padding:14px 15px 11px;border-bottom:1px solid var(--border)}
      .mf-notify-head b{font-size:14px}.mf-notify-head span{font-size:11px;color:var(--text-3)}.mf-notify-head button{margin-left:auto;border:0;background:transparent;color:var(--rose);font:inherit;font-size:11.5px;cursor:pointer}
      .mf-notify-list{overflow:auto;padding:7px}.mf-notify-empty{padding:34px 18px;text-align:center;color:var(--text-3);font-size:12.5px;line-height:1.6}
      .mf-notify-item{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:start;padding:11px 10px;border:1px solid transparent;border-radius:12px;text-decoration:none;color:var(--text);cursor:pointer}
      .mf-notify-item:hover{background:rgba(255,255,255,.045);border-color:var(--border)}.mf-notify-item.unread{background:rgba(249,168,212,.075)}
      .mf-notify-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:rgba(255,255,255,.055);font-size:18px}.mf-notify-copy{min-width:0}.mf-notify-title{display:block;font-size:12.8px;line-height:1.35}.mf-notify-body{display:block;margin-top:3px;color:var(--text-2);font-size:11.8px;line-height:1.45;word-break:break-word}.mf-notify-time{display:block;margin-top:5px;color:var(--text-3);font-size:10.5px}.mf-notify-dot{width:7px;height:7px;margin-top:7px;border-radius:50%;background:var(--rose)}
      .mf-notify-foot{display:flex;gap:8px;align-items:center;padding:10px 13px;border-top:1px solid var(--border)}.mf-notify-foot a,.mf-notify-foot button{font:inherit;font-size:11.5px;color:var(--text-2);text-decoration:none;background:transparent;border:0;padding:4px;cursor:pointer}.mf-notify-foot a{color:var(--rose)}.mf-notify-foot button:last-child{margin-left:auto}
      .mf-notification-page{display:grid;gap:10px}.mf-notification-page .mf-notify-item{grid-template-columns:44px minmax(0,1fr) auto;padding:14px;border:1px solid var(--border);background:rgba(255,255,255,.025)}.mf-notification-page .mf-notify-item.unread{border-color:rgba(249,168,212,.28);background:rgba(249,168,212,.075)}
      .mf-notification-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}.mf-notification-toolbar button{font:inherit;font-size:12px;color:var(--text-2);background:rgba(0,0,0,.25);border:1px solid var(--border-2);border-radius:999px;padding:7px 12px;cursor:pointer}.mf-notification-toolbar button.active{color:var(--text);border-color:var(--rose);background:rgba(249,168,212,.08)}.mf-notification-toolbar .push{margin-left:auto}
      @media(max-width:760px){.mf-notify-button{width:100%;display:flex;justify-content:flex-start;gap:8px;padding:8px 12px;height:auto}.mf-notify-badge{position:static;display:inline-grid!important;border:0}.mf-notify-panel{top:62px;right:8px;left:8px;width:auto;max-height:calc(100vh - 76px)}}`;
    document.head.appendChild(st);
  }

  function injectPanel() {
    if ($("mfNotifyPanel")) return;
    const panel = document.createElement("section");
    panel.id = "mfNotifyPanel"; panel.className = "mf-notify-panel"; panel.hidden = true;
    panel.setAttribute("aria-label", "Notifications"); panel.setAttribute("data-no-translate", "");
    panel.innerHTML = `<div class="mf-notify-head"><b>Notifications</b><span id="mfNotifySummary"></span><button type="button" id="mfNotifyMarkAll">Mark all read</button></div><div class="mf-notify-list" id="mfNotifyList"></div><div class="mf-notify-foot"><a href="/notifications.html">View all notifications</a><a href="/settings.html#notifications">Preferences</a><button type="button" id="mfNotifyClearRead">Clear read</button></div>`;
    document.body.appendChild(panel);
    $("mfNotifyMarkAll").addEventListener("click", markAllRead);
    $("mfNotifyClearRead").addEventListener("click", clearRead);
  }

  function unreadRows() { return visibleRows().filter(n => !Number(n.readAt)); }
  function updateBadge() {
    const button = $("mfNotifyButton"), badge = $("mfNotifyBadge");
    if (!button || !badge) return;
    const count = unreadRows().length;
    button.hidden = !uid;
    badge.hidden = count < 1;
    badge.textContent = count > 99 ? "99+" : String(count);
    button.setAttribute("aria-label", count ? `Notifications, ${count} unread` : "Notifications");
  }

  function itemHtml(n, page) {
    const unread = !Number(n.readAt), link = cleanUrl(n.link) || "/notifications.html";
    const fixed = {
      friend_request:["New friend request","🌸"], friend_accepted:["Friend request accepted","💞"],
      guestbook:["New guestbook message","💌"], relationship_request:["Relationship request","♡"],
      relationship_accepted:["Relationship request accepted","💗"], room_invite:["Room invitation",n.icon||"✨"],
      direct_message:[n.title||"New direct message","💌"], mention:[n.title||"You were mentioned","💬"],
      moderation_warning:["Moderator warning","⚠️"], moderation_timeout:["You were timed out","⚠️"],
      moderation_unmute:["Your timeout was removed","✅"], moderation_block:["You were blocked from public chat","🚫"],
      moderation_unblock:["Your public-chat block was removed","✅"], role_promote:["You are now a site admin","👑"],
      role_demote:["Your admin role was removed","👑"], badge_awarded:["New profile badge","🏷️"]
    }[n.type];
    const title = fixed ? fixed[0] : (n.title || "Notification"), body = n.body || "", icon = fixed ? fixed[1] : (n.icon || "🔔");
    return `<a class="mf-notify-item${unread ? " unread" : ""}" href="${esc(link)}" data-notification-id="${esc(n.id)}"><span class="mf-notify-icon">${esc(icon)}</span><span class="mf-notify-copy"><b class="mf-notify-title">${esc(title)}</b>${body ? `<span class="mf-notify-body">${esc(body)}</span>` : ""}<span class="mf-notify-time" title="${esc(new Date(Number(n.createdAt)||0).toLocaleString())}">${esc(relativeTime(n.createdAt))}</span></span>${unread ? '<span class="mf-notify-dot" aria-label="Unread"></span>' : (page ? '<span></span>' : '')}</a>`;
  }

  function wireItems(scope) {
    scope.querySelectorAll("[data-notification-id]").forEach(node => node.addEventListener("click", async e => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { markRead(node.dataset.notificationId); return; }
      e.preventDefault();
      const href = node.getAttribute("href") || "/notifications.html";
      await markRead(node.dataset.notificationId);
      location.href = href;
    }));
  }

  function drawPanel() {
    const list = $("mfNotifyList"), summary = $("mfNotifySummary");
    if (!list) return;
    const recent = visibleRows().slice(0, 14), unread = unreadRows().length;
    if (summary) summary.textContent = unread ? `${unread} unread` : "You're caught up";
    list.innerHTML = recent.length ? recent.map(n => itemHtml(n, false)).join("") : '<div class="mf-notify-empty">No notifications yet.<br>Friend requests, gifts, room invites, messages, and moderation notices will appear here.</div>';
    wireItems(list);
  }

  function drawPage() {
    const list = $("mfNotificationPageList"), count = $("mfNotificationPageCount");
    if (!list) return;
    const shown = visibleRows();
    const visible = pageFilter === "unread" ? unreadRows() : shown;
    if (count) count.textContent = shown.length ? `${visible.length} shown · ${unreadRows().length} unread` : "";
    list.innerHTML = visible.length ? visible.map(n => itemHtml(n, true)).join("") : `<div class="mf-notify-empty">${pageFilter === "unread" ? "Nothing unread — nicely done 🌼" : "No notifications yet."}</div>`;
    wireItems(list);
  }

  function draw() { updateBadge(); drawPanel(); drawPage(); }

  async function markRead(id) {
    if (!uid || !id || !mods) return;
    const row = rows.find(n => n.id === id); if (!row || Number(row.readAt)) return;
    row.readAt = Date.now(); draw();
    try { await mods.set(mods.ref(db, `notifications/${uid}/${id}/readAt`), row.readAt); } catch (_) { row.readAt = 0; draw(); }
  }
  async function markAllRead() {
    if (!uid || !mods) return;
    const unread = unreadRows(); if (!unread.length) return;
    const now = Date.now(), updates = {};
    unread.forEach(n => { n.readAt = now; updates[`notifications/${uid}/${n.id}/readAt`] = now; }); draw();
    try { await mods.update(mods.ref(db), updates); } catch (_) { subscribe(); }
  }
  async function clearRead() {
    if (!uid || !mods) return;
    const read = rows.filter(n => Number(n.readAt)); if (!read.length) return;
    if (!confirm(`Remove ${read.length} read notification${read.length === 1 ? "" : "s"}?`)) return;
    const updates = {}; read.forEach(n => updates[`notifications/${uid}/${n.id}`] = null);
    try { await mods.update(mods.ref(db), updates); } catch (_) {}
  }

  function togglePanel(force) {
    const panel = $("mfNotifyPanel"), btn = $("mfNotifyButton"); if (!panel || !btn) return;
    panelOpen = typeof force === "boolean" ? force : !panelOpen;
    if (!uid) panelOpen = false;
    panel.hidden = !panelOpen; btn.setAttribute("aria-expanded", panelOpen ? "true" : "false");
    if (panelOpen && unreadRows().length) {
      // Opening is intentionally not the same as reading; individual items keep their unread state.
      drawPanel();
    }
  }

  function subscribe() {
    if (unsub) { try { unsub(); } catch (_) {} unsub = null; }
    rows = []; draw();
    if (!uid || !mods) return;
    const q = mods.query(mods.ref(db, `notifications/${uid}`), mods.orderByChild("createdAt"), mods.limitToLast(MAX_LIVE));
    const cb = snap => {
      rows = []; snap.forEach(ch => rows.push({ id: ch.key, ...(ch.val() || {}) }));
      rows.sort((a,b) => (Number(b.createdAt)||0) - (Number(a.createdAt)||0)); draw();
    };
    mods.onValue(q, cb, () => { rows = []; draw(); });
    unsub = () => mods.off(q, "value", cb);
  }

  function wirePage() {
    document.querySelectorAll("[data-notification-filter]").forEach(btn => btn.addEventListener("click", () => {
      pageFilter = btn.dataset.notificationFilter || "all";
      document.querySelectorAll("[data-notification-filter]").forEach(x => x.classList.toggle("active", x === btn)); drawPage();
    }));
    const mark = $("mfNotificationPageMarkAll"), clear = $("mfNotificationPageClearRead");
    if (mark) mark.addEventListener("click", markAllRead);
    if (clear) clear.addEventListener("click", clearRead);
  }

  async function readyAuth(user) {
    uid = user ? user.uid : null;
    if (!uid) { prefs = null; togglePanel(false); subscribe(); return; }
    db = MFAuth.db;
    if (!db) { setTimeout(() => readyAuth(MFAuth.user), 100); return; }
    if (!mods) mods = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-database.js`);
    subscribe();
    loadPrefs();   // which types this account wants to be told about
  }

  function boot() {
    injectStyles(); injectPanel(); wirePage();
    const button = $("mfNotifyButton"); if (button) button.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); togglePanel(); });
    document.addEventListener("click", e => { if (panelOpen && !e.target.closest("#mfNotifyPanel") && !e.target.closest("#mfNotifyButton")) togglePanel(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") togglePanel(false); });
    const wait = () => {
      if (window.MFAuth && MFAuth.onChange) MFAuth.onChange(readyAuth);
      else setTimeout(wait, 100);
    }; wait();
  }

  window.MFNotifications = { markAllRead, clearRead, open: () => togglePanel(true), refresh: subscribe };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
