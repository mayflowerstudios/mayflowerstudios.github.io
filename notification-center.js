/* Mayflower Studios — universal notification center */
(function () {
  const FB_VERSION = "10.12.2";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const cleanUrl = value => {
    const v = String(value || "").trim();
    if (!v) return "";
    if (v.startsWith("/") && !v.startsWith("//")) return v;
    return "";
  };

  const PANEL_SIZE = 30, PAGE_SIZE = 50;
  let db = null, mods = null, uid = null, rows = [], unsub = null;
  const records = new Map();
  let dirty = true, drawTimer = null, pageIndex = 0, authEpoch = 0, authTimer = null, modulePromise = null;

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
  // Keep read timestamps saved so cleared items stay gone across devices.
  function visibleRows() {
    if (dirty) {
      rows = [...records.values()].filter(n => wanted(n) && !Number(n.readAt))
        .sort((a,b) => (Number(b.createdAt)||0) - (Number(a.createdAt)||0) || a.id.localeCompare(b.id));
      dirty = false;
    }
    return rows;
  }

  async function loadPrefs() {
    if (!window.MFAuth || !MFAuth.getNotificationPrefs) return;
    const epoch = authEpoch;
    let next = null;
    try { next = await MFAuth.getNotificationPrefs(); } catch (_) {}
    if (epoch !== authEpoch) return;
    prefs = next; dirty = true;
    draw();
  }
  // Changing a switch on the settings page should take effect on any tab that
  // is already open, not only after a reload.
  window.addEventListener("mf-notification-prefs-changed", e => {
    if (e && e.detail) { prefs = e.detail; dirty = true; draw(); }
    else loadPrefs();
  });
  let panelOpen = false;
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
      .mf-notify-panel{position:fixed;z-index:10020;top:70px;right:max(16px,calc((100vw - 1120px)/2));width:min(390px,calc(100vw - 24px));max-height:min(520px,calc(100dvh - 90px));margin:0;padding:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--border-2);border-radius:18px;background:rgba(17,16,35,.98);box-shadow:0 22px 70px rgba(0,0,0,.52);backdrop-filter:blur(20px)}
      .mf-notify-panel[hidden]{display:none}.mf-notify-head{display:flex;align-items:center;gap:8px;padding:14px 15px 11px;border-bottom:1px solid var(--border)}
      .mf-notify-head b{font-size:14px}.mf-notify-head span{font-size:11px;color:var(--text-3)}.mf-notify-head button{margin-left:auto;border:0;background:transparent;color:var(--rose);font:inherit;font-size:11.5px;cursor:pointer}
      .mf-notify-head,.mf-notify-foot{flex:0 0 auto}
      .mf-notify-list{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;max-height:400px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:var(--rose) transparent;padding:7px}
      .mf-notify-list:focus-visible{outline:2px solid var(--rose);outline-offset:-2px}
      .mf-notify-list .mf-notify-item{flex:0 0 auto;min-height:96px}
      .mf-notify-list .mf-notify-title,.mf-notify-list .mf-notify-body{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
      .mf-notify-empty{padding:34px 18px;text-align:center;color:var(--text-3);font-size:12.5px;line-height:1.6}
      .mf-notify-item{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:start;padding:11px 10px;border:1px solid transparent;border-radius:12px;text-decoration:none;color:var(--text);cursor:pointer}
      .mf-notify-item:hover{background:rgba(255,255,255,.045);border-color:var(--border)}.mf-notify-item.unread{background:rgba(249,168,212,.075)}
      .mf-notify-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:rgba(255,255,255,.055);font-size:18px}.mf-notify-copy{min-width:0}.mf-notify-title{display:block;font-size:12.8px;line-height:1.35}.mf-notify-body{display:block;margin-top:3px;color:var(--text-2);font-size:11.8px;line-height:1.45;word-break:break-word}.mf-notify-time{display:block;margin-top:5px;color:var(--text-3);font-size:10.5px}.mf-notify-dot{width:7px;height:7px;margin-top:7px;border-radius:50%;background:var(--rose)}
      .mf-notify-foot{display:flex;gap:8px;align-items:center;padding:10px 13px;border-top:1px solid var(--border)}.mf-notify-foot a,.mf-notify-foot button{font:inherit;font-size:11.5px;color:var(--text-2);text-decoration:none;background:transparent;border:0;padding:4px;cursor:pointer}.mf-notify-foot a{color:var(--rose)}.mf-notify-foot button:last-child{margin-left:auto}
      .mf-notification-page{display:grid;gap:10px}.mf-notification-page .mf-notify-item{grid-template-columns:44px minmax(0,1fr) auto;padding:14px;border:1px solid var(--border);background:rgba(255,255,255,.025)}.mf-notification-page .mf-notify-item.unread{border-color:rgba(249,168,212,.28);background:rgba(249,168,212,.075)}
      .mf-notification-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}.mf-notification-toolbar button{font:inherit;font-size:12px;color:var(--text-2);background:rgba(0,0,0,.25);border:1px solid var(--border-2);border-radius:999px;padding:7px 12px;cursor:pointer}.mf-notification-toolbar button.active{color:var(--text);border-color:var(--rose);background:rgba(249,168,212,.08)}.mf-notification-toolbar .push{margin-left:auto}
      .mf-notification-toolbar[hidden]{display:none}
      @media(max-width:760px){.mf-notify-button{width:100%;display:flex;justify-content:flex-start;gap:8px;padding:8px 12px;height:auto}.mf-notify-badge{position:static;display:inline-grid!important;border:0}.mf-notify-panel{top:62px;right:8px;left:8px;width:auto;max-height:min(520px,calc(100dvh - 76px))}}`;
    document.head.appendChild(st);
  }

  function injectPanel() {
    if ($("mfNotifyPanel")) return;
    const panel = document.createElement("section");
    panel.id = "mfNotifyPanel"; panel.className = "mf-notify-panel"; panel.hidden = true;
    panel.setAttribute("aria-label", "Notifications"); panel.setAttribute("data-no-translate", "");
    panel.innerHTML = `<div class="mf-notify-head"><b>Notifications</b><span id="mfNotifySummary"></span><button type="button" id="mfNotifyMarkAll">Mark all read</button></div><div class="mf-notify-list" id="mfNotifyList" tabindex="0" role="region" aria-label="Unread notifications"></div><div class="mf-notify-foot"><a href="/notifications.html">View all notifications</a><a href="/settings.html#notifications">Preferences</a></div>`;
    document.body.appendChild(panel);
    $("mfNotifyMarkAll").addEventListener("click", markAllRead);
  }

  function unreadRows() { return visibleRows(); }
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
    if (!list || !panelOpen) return;
    const all = visibleRows(), recent = all.slice(0, PANEL_SIZE), unread = all.length, scrollTop = list.scrollTop;
    if (summary) summary.textContent = unread ? `${unread} unread${unread > PANEL_SIZE ? ` · latest ${PANEL_SIZE}` : ''}` : "You're caught up";
    list.innerHTML = recent.length ? recent.map(n => itemHtml(n, false)).join("") : '<div class="mf-notify-empty">You’re all caught up.<br>New notifications will appear here.</div>';
    list.scrollTop = scrollTop;
    if ($("mfNotifyMarkAll")) $("mfNotifyMarkAll").disabled = !uid || !unread;
    wireItems(list);
  }

  function drawPage() {
    const list = $("mfNotificationPageList"), count = $("mfNotificationPageCount");
    if (!list) return;
    const visible = visibleRows();
    pageIndex = Math.min(pageIndex, Math.max(0, Math.ceil(visible.length / PAGE_SIZE) - 1));
    const start = pageIndex * PAGE_SIZE, page = visible.slice(start, start + PAGE_SIZE);
    if (count) count.textContent = uid ? `${visible.length} unread${visible.length > PAGE_SIZE ? ` · ${start + 1}–${start + page.length} shown` : ''}` : "";
    list.innerHTML = page.length ? page.map(n => itemHtml(n, true)).join("") : `<div class="mf-notify-empty">${uid ? "You’re all caught up. New notifications will appear here." : "Sign in to see your notifications."}</div>`;
    if ($("mfNotificationPager")) $("mfNotificationPager").hidden = visible.length <= PAGE_SIZE;
    if ($("mfNotificationPrev")) $("mfNotificationPrev").disabled = pageIndex === 0;
    if ($("mfNotificationNext")) $("mfNotificationNext").disabled = start + PAGE_SIZE >= visible.length;
    if ($("mfNotificationPageMarkAll")) $("mfNotificationPageMarkAll").disabled = !uid || !visible.length;
    wireItems(list);
  }

  function draw() {
    if (document.hidden) return;
    updateBadge(); drawPanel(); drawPage();
  }
  // Firebase delivers the initial children (and bulk reads) in bursts. Paint
  // once for the burst, and defer hidden-tab rendering until it is visible.
  function scheduleDraw() {
    if (drawTimer !== null || document.hidden) return;
    drawTimer = setTimeout(() => { drawTimer = null; draw(); }, 50);
  }

  async function markRead(id) {
    if (!uid || !id || !mods) return;
    const row = records.get(id); if (!row || Number(row.readAt)) return;
    const epoch = authEpoch;
    row.readAt = Date.now(); dirty = true; draw();
    try { await mods.set(mods.ref(db, `notifications/${uid}/${id}/readAt`), row.readAt); }
    catch (_) { if (epoch === authEpoch) { row.readAt = 0; records.set(id, row); dirty = true; draw(); } }
  }
  async function markAllRead() {
    if (!uid || !mods) return;
    const unread = unreadRows(); if (!unread.length) return;
    const now = Date.now(), updates = {}, epoch = authEpoch;
    unread.forEach(n => { n.readAt = now; updates[`notifications/${uid}/${n.id}/readAt`] = now; }); dirty = true; draw();
    try { await mods.update(mods.ref(db), updates); }
    catch (_) { if (epoch === authEpoch) { unread.forEach(n => { n.readAt = 0; records.set(n.id, n); }); dirty = true; draw(); } }
  }
  async function clearRead() {
    if (!uid || !mods) return;
    // Legacy explicit cleanup only: read history is not retained in the UI.
    const epoch = authEpoch, read = [];
    let snapshot;
    try { snapshot = await mods.get(mods.ref(db, `notifications/${uid}`)); } catch (_) { return; }
    if (epoch !== authEpoch) return;
    snapshot.forEach(ch => { const row = ch.val(); if (row && Number(row.readAt)) read.push({ ...row, id: ch.key }); });
    if (!read.length) return;
    if (!confirm(`Remove ${read.length} read notification${read.length === 1 ? "" : "s"}?`)) return;
    const updates = {}; read.forEach(n => updates[`notifications/${uid}/${n.id}`] = null);
    try { await mods.update(mods.ref(db), updates); } catch (_) {}
  }

  function togglePanel(force) {
    const panel = $("mfNotifyPanel"), btn = $("mfNotifyButton"); if (!panel || !btn) return;
    panelOpen = typeof force === "boolean" ? force : !panelOpen;
    if (!uid) panelOpen = false;
    panel.hidden = !panelOpen; btn.setAttribute("aria-expanded", panelOpen ? "true" : "false");
    if (panelOpen) {
      // Opening is intentionally not the same as reading; individual items keep their unread state.
      drawPanel();
    } else if ($("mfNotifyList")) {
      $("mfNotifyList").innerHTML = "";
    }
  }

  function subscribe() {
    if (unsub) { try { unsub(); } catch (_) {} unsub = null; }
    records.clear(); rows = []; dirty = true; pageIndex = 0; draw();
    if (!uid || !mods) return;
    // Reading recent history alone can hide older unread items behind read ones.
    const q = mods.query(mods.ref(db, `notifications/${uid}`), mods.orderByChild("createdAt"));
    const epoch = authEpoch;
    const changed = snap => {
      if (epoch !== authEpoch) return;
      const row = snap.val();
      if (row && typeof row === 'object' && !Number(row.readAt)) records.set(snap.key, { ...row, id: snap.key });
      else records.delete(snap.key);
      dirty = true; scheduleDraw();
    };
    const removed = snap => { if (epoch === authEpoch) { records.delete(snap.key); dirty = true; scheduleDraw(); } };
    const failed = () => { if (epoch === authEpoch) { records.clear(); dirty = true; scheduleDraw(); } };
    // Child events avoid copying and sorting the entire history for each read
    // or new item. Keep all unread items, including older legacy records.
    const stops = [mods.onChildAdded(q, changed, failed), mods.onChildChanged(q, changed, failed), mods.onChildRemoved(q, removed, failed)];
    unsub = () => stops.forEach(stop => stop());
  }

  function wirePage() {
    const mark = $("mfNotificationPageMarkAll");
    if (mark) mark.addEventListener("click", markAllRead);
    const list = $("mfNotificationPageList");
    if (list && !$("mfNotificationPager")) {
      const pager = document.createElement('div');
      pager.id = 'mfNotificationPager'; pager.className = 'mf-notification-toolbar'; pager.hidden = true;
      pager.innerHTML = '<button type="button" id="mfNotificationPrev">Newer notifications</button><button type="button" id="mfNotificationNext">Older notifications</button>';
      list.after(pager);
      $("mfNotificationPrev").addEventListener('click', () => { pageIndex = Math.max(0, pageIndex - 1); drawPage(); });
      $("mfNotificationNext").addEventListener('click', () => { pageIndex++; drawPage(); });
    }
  }

  async function readyAuth(user) {
    const nextUid = user ? user.uid : null;
    if (nextUid === uid && (unsub || (!mods && modulePromise) || authTimer)) return;
    const epoch = ++authEpoch;
    uid = nextUid; prefs = null; dirty = true;
    if (unsub) { unsub(); unsub = null; }
    if (authTimer) { clearTimeout(authTimer); authTimer = null; }
    records.clear(); rows = []; pageIndex = 0; draw();
    if (!uid) { prefs = null; togglePanel(false); subscribe(); return; }
    db = MFAuth.db;
    if (!db) { authTimer = setTimeout(() => { authTimer = null; readyAuth(MFAuth.user); }, 100); return; }
    try {
      if (!mods) {
        if (!modulePromise) modulePromise = import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-database.js`);
        mods = await modulePromise;
      }
    } catch (_) { modulePromise = null; return; }
    if (epoch !== authEpoch) return;
    subscribe();
    loadPrefs();   // which types this account wants to be told about
  }

  function boot() {
    injectStyles(); injectPanel(); wirePage();
    const button = $("mfNotifyButton"); if (button) button.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); togglePanel(); });
    document.addEventListener("click", e => { if (panelOpen && !e.target.closest("#mfNotifyPanel") && !e.target.closest("#mfNotifyButton")) togglePanel(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") togglePanel(false); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) draw(); });
    const wait = () => {
      if (window.MFAuth && MFAuth.onChange) MFAuth.onChange(readyAuth);
      else setTimeout(wait, 100);
    }; wait();
  }

  window.MFNotifications = { markAllRead, clearRead, open: () => togglePanel(true), refresh: subscribe };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
