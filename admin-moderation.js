/* Mayflower Studios — public-chat moderation center.
   Requires MFAuth and the Firebase Realtime Database rules included with this update. */
(function () {
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const RETENTION = 30 * 24 * 60 * 60 * 1000;
  const ACTION_LABELS = {
    delete:"Deleted message", bulk_delete:"Bulk cleanup", timeout:"Timeout", unmute:"Timeout removed",
    block:"Chat blocked", unblock:"Chat unblocked", warning:"Warning", note:"Admin note",
    promote:"Made admin", demote:"Admin removed", lock:"Chat locked", unlock:"Chat unlocked",
    slow_mode:"Slow mode", unlock_policy:"Unlock policy", restore:"Message restored"
  };

  let db = null, mods = null, me = null, myName = "", myHandle = "", role = "user";
  let ownerHandle = "", settings = { locked:false, slowSeconds:0, adminsCanUnlock:false };
  let logs = [], activeUser = null, settingsUnsub = null, controlsWired = false;

  function cleanHandle(v) { return String(v || "").trim().toLowerCase().replace(/^@/, ""); }
  function isMod() { return role === "admin" || role === "owner"; }
  function say(text, kind) {
    const node = el("amStatus"); if (!node) return;
    node.textContent = text || ""; node.className = "amStatus" + (kind ? " " + kind : "");
  }
  function when(t) { const d = new Date(Number(t)||0); return isNaN(d.getTime()) ? "" : d.toLocaleString(); }
  function excerpt(text) {
    text = String(text || "").replace(/^\u0001mfmedia:.+$/, "[image or GIF]").replace(/\s+/g, " ").trim();
    return text.length > 120 ? text.slice(0,117) + "…" : text;
  }

  async function roleForUid(uid) {
    if (!uid) return "user";
    const userSnap = await mods.get(mods.ref(db, `users/${uid}/username`));
    const handle = cleanHandle(userSnap.val());
    if (handle && handle === ownerHandle) return "owner";
    if (handle) {
      const adminSnap = await mods.get(mods.ref(db, `admins/${handle}`));
      if (adminSnap.val() === true) return "admin";
    }
    return "user";
  }
  async function canAct(uid) {
    if (role === "owner") return uid !== me;
    return role === "admin" && uid !== me && (await roleForUid(uid)) === "user";
  }

  async function addLog(action, target, extra) {
    const now = Date.now();
    const key = mods.push(mods.ref(db, "moderationLog")).key;
    const value = {
      action, actorUid:me, actorName:myName || myHandle || "moderator", actorRole:role,
      targetUid:(target && target.uid) || "", targetName:(target && target.name) || "",
      at:now, expiresAt:now + RETENTION, ...(extra || {})
    };
    await mods.set(mods.ref(db, `moderationLog/${key}`), value);
    return key;
  }

  function wireSettings() {
    if (settingsUnsub) { try { settingsUnsub(); } catch (_) {} }
    const ref = mods.ref(db, "chatSettings/global");
    const cb = snap => {
      settings = { locked:false, slowSeconds:0, adminsCanUnlock:false, ...(snap.val() || {}) };
      el("amLock").checked = !!settings.locked;
      el("amSlow").value = String(Number(settings.slowSeconds)||0);
      el("amAdminsUnlock").checked = !!settings.adminsCanUnlock;
      el("amAdminsUnlockWrap").hidden = role !== "owner";
      el("amPurge").hidden = role !== "owner";
      el("amLock").disabled = role === "admin" && settings.locked && !settings.adminsCanUnlock;
      say(settings.locked ? "Public chat is locked." : (settings.slowSeconds ? `Public chat is open with ${settings.slowSeconds}-second slow mode.` : "Public chat is open."), "ok");
    };
    mods.onValue(ref, cb);
    settingsUnsub = () => mods.off(ref, "value", cb);
  }

  async function changeSetting(path, value, action, extra) {
    try {
      await mods.set(mods.ref(db, `chatSettings/global/${path}`), value);
      await addLog(action, {uid:"",name:"Public chat"}, extra || {});
      say("Chat setting saved.", "ok");
    } catch (err) {
      console.warn("chat setting", err); say("That setting change was refused. Make sure the new database rules are published.", "bad");
      wireSettings();
    }
  }

  async function loadLogs() {
    const list = el("amLogList"); list.innerHTML = '<div class="acctEmpty">Loading moderation history…</div>';
    try {
      const q = mods.query(mods.ref(db, "moderationLog"), mods.orderByChild("at"), mods.limitToLast(300));
      const snap = await mods.get(q); logs = [];
      snap.forEach(ch => logs.push({id:ch.key, ...(ch.val() || {})}));
      logs.sort((a,b)=>(b.at||0)-(a.at||0)); drawLogs();
    } catch (err) {
      console.warn("moderation logs", err); list.innerHTML = '<div class="acctEmpty">Could not load moderation history. Publish the included Firebase rules first.</div>';
    }
  }

  function filterMatches(log, selected) {
    if (!selected) return true;
    if (selected === "promote") return log.action === "promote" || log.action === "demote";
    if (selected === "lock") return ["lock","unlock","slow_mode","unlock_policy"].includes(log.action);
    return log.action === selected;
  }
  function drawLogs() {
    const list = el("amLogList");
    const selected = el("amLogFilter").value;
    const search = el("amLogSearch").value.trim().toLowerCase();
    const hideRestored = el("amHideRestored").checked;
    const rows = logs.filter(log => filterMatches(log, selected) && (!hideRestored || !log.restoredAt) && (!search || [log.actorName,log.targetName,log.reason,log.messageText,log.action].join(" ").toLowerCase().includes(search)));
    el("amLogCount").textContent = logs.length ? `${rows.length} of ${logs.length}` : "";
    if (!rows.length) { list.innerHTML = `<div class="acctEmpty">${logs.length ? "Nothing matching those filters." : "No moderation activity yet."}</div>`; return; }
    list.innerHTML = rows.map(log => {
      const canRestore = role === "owner" && ["delete","bulk_delete"].includes(log.action) && log.messageText !== undefined && !log.restoredAt && Number(log.expiresAt) > Date.now();
      const body = log.messageText !== undefined
        ? `<div>Message from <b>${esc(log.targetName || "user")}</b>: “${esc(excerpt(log.messageText))}”</div>`
        : `<div><b>${esc(log.actorName || "moderator")}</b> → ${esc(log.targetName || "Public chat")}</div>`;
      return `<article class="amLog${log.restoredAt ? " restored" : ""}" data-log-id="${esc(log.id)}">
        <div class="amLogHead"><span class="amActionTag">${esc(ACTION_LABELS[log.action] || log.action)}</span><b>${esc(log.actorName || "moderator")}</b><span class="amLogTime">${esc(when(log.at))}</span></div>
        <div class="amLogBody">${body}${log.reason ? `<div class="amLogReason">Reason: ${esc(log.reason)}</div>` : ""}${log.restoredAt ? `<div>Restored ${esc(when(log.restoredAt))} by ${esc(log.restoredBy || "owner")}</div>` : ""}</div>
        ${canRestore ? `<div class="amLogActs"><button type="button" data-restore="${esc(log.id)}">Restore message</button></div>` : ""}
      </article>`;
    }).join("");
    list.querySelectorAll("[data-restore]").forEach(btn => btn.addEventListener("click", () => restoreMessage(btn.dataset.restore, btn)));
  }

  async function restoreMessage(id, button) {
    if (role !== "owner") return;
    const log = logs.find(x => x.id === id); if (!log || log.restoredAt) return;
    if (!confirm(`Restore the deleted message from ${log.targetName || "this user"}?`)) return;
    button.disabled = true;
    try {
      const now = Date.now(); const msgKey = mods.push(mods.ref(db, "chat/global")).key;
      const updates = {};
      updates[`chat/global/${msgKey}`] = { uid:log.targetUid, name:log.targetName || "someone", text:String(log.messageText || ""), t:now, restored:true, restoredFrom:id, restoredAt:now };
      updates[`moderationLog/${id}/restoredAt`] = now;
      updates[`moderationLog/${id}/restoredBy`] = myName || myHandle || "owner";
      await mods.update(mods.ref(db), updates);
      log.restoredAt = now; log.restoredBy = myName || myHandle || "owner"; drawLogs(); say("Message restored to public chat.", "ok");
    } catch (err) { console.warn("restore", err); button.disabled = false; say("The message could not be restored.", "bad"); }
  }

  async function purgeExpired() {
    if (role !== "owner") return;
    const expired = logs.filter(log => Number(log.expiresAt) > 0 && Number(log.expiresAt) <= Date.now());
    if (!expired.length) return say("There are no expired moderation records.", "ok");
    if (!confirm(`Permanently remove ${expired.length} expired moderation record${expired.length===1?"":"s"}?`)) return;
    const updates = {}; expired.forEach(log => updates[`moderationLog/${log.id}`] = null);
    try { await mods.update(mods.ref(db), updates); logs = logs.filter(log => !expired.includes(log)); drawLogs(); say("Expired records removed.", "ok"); }
    catch (err) { console.warn("purge", err); say("Expired records could not be removed.", "bad"); }
  }

  async function setRestriction(user, patch, action, reason) {
    if (!(await canAct(user.uid))) throw new Error("protected");
    const ref = mods.ref(db, `chatRestrictions/${user.uid}`); const snap = await mods.get(ref); const old = snap.val() || {};
    const next = { ...old, ...patch, byUid:me, byName:myName || myHandle || "moderator", at:Date.now(), reason:String(reason || "").slice(0,200) };
    if (!next.blocked && !(Number(next.mutedUntil) > Date.now())) await mods.remove(ref); else await mods.set(ref, next);
    await addLog(action, user, { reason:String(reason || "").slice(0,200), mutedUntil:Number(next.mutedUntil)||0, blocked:!!next.blocked });
  }
  async function warnUser(user) {
    if (!(await canAct(user.uid))) throw new Error("protected");
    const text = prompt(`Private warning for ${user.name}:`, ""); if (!text || !text.trim()) return false;
    const key = mods.push(mods.ref(db, `chatWarnings/${user.uid}`)).key;
    await mods.set(mods.ref(db, `chatWarnings/${user.uid}/${key}`), { text:text.trim().slice(0,500), byUid:me, byName:myName || myHandle || "moderator", at:Date.now() });
    await addLog("warning", user, {reason:text.trim().slice(0,200)}); return true;
  }
  async function noteUser(user) {
    if (!(await canAct(user.uid))) throw new Error("protected");
    const text = prompt(`Private admin note for ${user.name}:`, ""); if (!text || !text.trim()) return false;
    const key = mods.push(mods.ref(db, `moderationNotes/${user.uid}`)).key;
    await mods.set(mods.ref(db, `moderationNotes/${user.uid}/${key}`), { text:text.trim().slice(0,1000), byUid:me, byName:myName || myHandle || "moderator", at:Date.now() });
    await addLog("note", user, {reason:text.trim().slice(0,200)}); return true;
  }
  async function bulkDelete(user, amount) {
    if (!(await canAct(user.uid))) throw new Error("protected");
    const snap = await mods.get(mods.query(mods.ref(db, "chat/global"), mods.limitToLast(250))); const rows=[];
    snap.forEach(ch => { const msg=ch.val(); if(msg && msg.uid===user.uid && !msg.deleted) rows.push({key:ch.key,msg}); });
    rows.sort((a,b)=>(b.msg.t||0)-(a.msg.t||0)); const chosen = amount === "all" ? rows : rows.slice(0,Number(amount)||0);
    if (!chosen.length) return say("No recent messages found for that account.", "bad");
    if (prompt(`This removes ${chosen.length} message${chosen.length===1?"":"s"} from ${user.name}. Type DELETE to continue:`, "") !== "DELETE") return;
    const reason = prompt("Reason for bulk removal (optional):", "") || "";
    for (let offset=0; offset<chosen.length; offset+=40) {
      const updates={}; const now=Date.now(); const batchId=`${now.toString(36)}-${Math.random().toString(36).slice(2,7)}`;
      chosen.slice(offset,offset+40).forEach(row => {
        const key=mods.push(mods.ref(db,"moderationLog")).key;
        updates[`moderationLog/${key}`]={ action:"bulk_delete", actorUid:me, actorName:myName||myHandle||"moderator", actorRole:role, targetUid:user.uid, targetName:user.name, messageId:row.key, messageText:String(row.msg.text||"").slice(0,500), messageTime:Number(row.msg.t)||now, reason:String(reason).slice(0,200), batchId, at:now, expiresAt:now+RETENTION };
        updates[`chat/global/${row.key}`]=null;
      });
      await mods.update(mods.ref(db),updates);
    }
    say(`${chosen.length} message${chosen.length===1?"":"s"} removed.`,"ok"); await loadLogs();
  }

  async function loadUser() {
    const handle = cleanHandle(el("amUser").value); const card=el("amUserCard");
    if (!handle) return; card.hidden=false; card.innerHTML='<div class="acctEmpty">Loading user…</div>';
    try {
      const uidSnap = await mods.get(mods.ref(db, `usernames/${handle}`)); const uid=uidSnap.val();
      if (!uid) { card.innerHTML='<div class="acctEmpty">No account uses that username.</div>'; return; }
      const [profileSnap,restrictionSnap,warningsSnap,notesSnap] = await Promise.all([
        mods.get(mods.ref(db,`users/${uid}`)), mods.get(mods.ref(db,`chatRestrictions/${uid}`)),
        mods.get(mods.query(mods.ref(db,`chatWarnings/${uid}`),mods.limitToLast(12))),
        mods.get(mods.query(mods.ref(db,`moderationNotes/${uid}`),mods.limitToLast(12)))
      ]);
      const profile=profileSnap.val()||{}; const targetRole=await roleForUid(uid); const allowed=await canAct(uid); const restriction=restrictionSnap.val()||{};
      const warnings=[]; warningsSnap.forEach(ch=>warnings.push(ch.val()||{})); const notes=[]; notesSnap.forEach(ch=>notes.push(ch.val()||{}));
      activeUser={uid,name:profile.displayName||handle,handle,role:targetRole,restriction};
      card.innerHTML=`<div class="amUserHead"><b>${esc(activeUser.name)}</b><span class="amHandle">@${esc(handle)}</span><span class="amRole ${esc(targetRole)}">${esc(targetRole)}</span></div>
        ${allowed?"":`<div class="amProtected">🛡️ ${targetRole === "owner" ? "The owner" : targetRole === "admin" ? "Another admin" : "Your own account"} is protected from these actions.</div>`}
        <div class="amActions">
          <button data-am-act="profile">👤 View profile</button>
          ${allowed?`<button data-am-act="warn">⚠️ Warn privately</button><button data-am-act="note">📝 Add private note</button>
          <button data-am-act="mute10">🔇 Mute 10 minutes</button><button data-am-act="mute60">🔇 Mute 1 hour</button><button data-am-act="mute1440">🔇 Mute 24 hours</button><button data-am-act="muteForever">🔇 Mute indefinitely</button>
          <button data-am-act="unmute">🔊 Remove timeout</button><button data-am-act="${restriction.blocked?"unblock":"block"}">${restriction.blocked?"✅ Unblock public chat":"🚫 Block public chat"}</button>
          <button data-am-act="del5">🧹 Delete last 5</button><button data-am-act="del10">🧹 Delete last 10</button><button data-am-act="delall" class="danger">🧹 Delete all recent</button>`:""}
          ${role==="owner" && targetRole!=="owner"?`<button data-am-act="${targetRole==="admin"?"demote":"promote"}" class="owner">👑 ${targetRole==="admin"?"Remove admin":"Make admin"}</button>`:""}
        </div>
        <div class="amHistory"><div class="amHistoryItem"><b>Current restriction:</b> ${restriction.blocked?"Blocked":Number(restriction.mutedUntil)>Date.now()?`Muted until ${esc(when(restriction.mutedUntil))}`:"None"}${restriction.reason?`<br><small>${esc(restriction.reason)}</small>`:""}</div>
          <div class="amHistoryItem"><b>Warning history (${warnings.length})</b>${warnings.length?warnings.reverse().map(w=>`<br><small>${esc(when(w.at))} · ${esc(w.byName||"moderator")}: ${esc(w.text||"")}</small>`).join(""):"<br><small>No warnings.</small>"}</div>
          <div class="amHistoryItem"><b>Private admin notes (${notes.length})</b>${notes.length?notes.reverse().map(n=>`<br><small>${esc(when(n.at))} · ${esc(n.byName||"moderator")}: ${esc(n.text||"")}</small>`).join(""):"<br><small>No notes.</small>"}</div>
        </div>`;
      card.querySelectorAll("[data-am-act]").forEach(btn=>btn.addEventListener("click",()=>userAction(btn)));
    } catch(err) { console.warn("load user",err); card.innerHTML='<div class="acctEmpty">Could not load that account.</div>'; }
  }

  async function userAction(button) {
    if (!activeUser) return; const action=button.dataset.amAct; button.disabled=true;
    try {
      if(action==="profile") { if(window.MFProfile) MFProfile.show(activeUser.uid); button.disabled=false; return; }
      if(action==="warn") { if(!(await warnUser(activeUser))) {button.disabled=false;return;} }
      else if(action==="note") { if(!(await noteUser(activeUser))) {button.disabled=false;return;} }
      else if(action.startsWith("mute")) { const mins={mute10:10,mute60:60,mute1440:1440}[action]; const until=mins?Date.now()+mins*60000:32503680000000; const reason=prompt("Reason for timeout (optional):","")||""; await setRestriction(activeUser,{mutedUntil:until},"timeout",reason); }
      else if(action==="unmute") await setRestriction(activeUser,{mutedUntil:0},"unmute","");
      else if(action==="block") { const reason=prompt("Reason for blocking public chat (optional):","")||""; await setRestriction(activeUser,{blocked:true},"block",reason); }
      else if(action==="unblock") await setRestriction(activeUser,{blocked:false},"unblock","");
      else if(action==="del5") { await bulkDelete(activeUser,5); button.disabled=false; return; }
      else if(action==="del10") { await bulkDelete(activeUser,10); button.disabled=false; return; }
      else if(action==="delall") { await bulkDelete(activeUser,"all"); button.disabled=false; return; }
      else if(action==="promote" || action==="demote") {
        if(role!=="owner") throw new Error("owner only");
        if(!confirm(`${action==="promote"?"Make":"Remove"} @${activeUser.handle} ${action==="promote"?"an admin":"from the admin team"}?`)){button.disabled=false;return;}
        const ref=mods.ref(db,`admins/${activeUser.handle}`); if(action==="promote") await mods.set(ref,true); else await mods.remove(ref);
        await addLog(action,activeUser,{reason:`@${activeUser.handle}`});
      }
      say("Moderation action saved.","ok"); await loadUser(); await loadLogs();
    } catch(err) { console.warn("user action",err); say(err && err.message==="protected"?"That account is protected.":"That moderation action was refused.","bad"); button.disabled=false; }
  }

  function wireControls() {
    if (controlsWired) return;
    controlsWired = true;
    el("amLock").addEventListener("change", e => changeSetting("locked",e.target.checked,e.target.checked?"lock":"unlock",{}));
    el("amSlow").addEventListener("change", e => { const value=Number(e.target.value)||0; changeSetting("slowSeconds",value,"slow_mode",{slowSeconds:value}); });
    el("amAdminsUnlock").addEventListener("change", e => changeSetting("adminsCanUnlock",e.target.checked,"unlock_policy",{adminsCanUnlock:e.target.checked}));
    el("amLoadUser").addEventListener("click",loadUser); el("amUser").addEventListener("keydown",e=>{if(e.key==="Enter")loadUser();});
    el("amLogFilter").addEventListener("change",drawLogs); el("amLogSearch").addEventListener("input",drawLogs); el("amHideRestored").addEventListener("change",drawLogs);
    el("amRefresh").addEventListener("click",loadLogs); el("amPurge").addEventListener("click",purgeExpired);
  }

  async function start(user) {
    if (!el("amLogList")) return;
    if (!user) return;
    me=user.uid; myName=MFAuth.name()||""; db=MFAuth.db;
    if (!db) return setTimeout(()=>start(user),150);
    if (!mods) mods=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
    myHandle=cleanHandle(MFAuth.profile && MFAuth.profile.username);
    if(!myHandle){const snap=await mods.get(mods.ref(db,`users/${me}/username`));myHandle=cleanHandle(snap.val());}
    const [ownerSnap,adminSnap]=await Promise.all([mods.get(mods.ref(db,"owner")),mods.get(mods.ref(db,`admins/${myHandle}`))]);
    ownerHandle=cleanHandle(ownerSnap.val()); role=myHandle&&myHandle===ownerHandle?"owner":adminSnap.val()===true?"admin":"user";
    if(!isMod()){ el("amLogList").innerHTML='<div class="acctEmpty">This section is for admins.</div>'; return; }
    wireControls(); wireSettings(); loadLogs();
  }

  function boot(){ if(window.MFAuth&&MFAuth.onChange) MFAuth.onChange(user=>start(user)); else setTimeout(boot,150); }
  boot();
})();
