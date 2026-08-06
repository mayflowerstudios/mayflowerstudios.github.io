/* rooms.js — Mayflower Studios unified room system
   One registry for every "together" room, regardless of type.

   A room is a single shared space. Its TYPE decides which experience page
   it opens (watch party / games / date), and its VISIBILITY decides who can
   see and enter it. All room types share one registry so the hub can list,
   create, invite, and route them uniformly — built around your account and
   your friends list.

   Data model
   ----------
   rooms/{id} = {
     id, type:'watch'|'games'|'date'|'learn', vis:'public'|'friends'|'private',
     name,                       // friendly label, shown in lobby & room bar
     owner, ownerName,           // creator's uid + display name
     ownerUsername,              // @handle, for "by @x" + friend lookups
     t, lastActive,              // created / last-touched (ms)
     invites: { uid: { name, t } }   // private rooms: explicitly invited friends
     members: { uid: t }             // anyone who has entered (for activity)
   }
   roomInvites/{uid}/{roomId} = { id, type, name, fromName, fromUid, t }
     // a per-user inbox so invitees get a notification + quick "Join" without
     // having to scan every room. Mirror of rooms/{id}/invites for fast reads.

   The per-type experience data still lives under its own namespace keyed by the
   SAME id: watch/{id}, together/{id}, datenight/{id}. rooms.js never touches
   those; it only governs the lobby + access.

   Exposes window.MFRooms. Depends on window.MFAuth (auth.js) for identity,
   the shared db connection, friends, and the db module fns (MFAuth._dbmod).
*/
(function () {
  const TYPES = {
    watch: { label: "Watch Party", emoji: "📺", page: "watch-together.html", verb: "Watch in sync" },
    games: { label: "Games Room",  emoji: "🎲", page: "together-room.html",  verb: "Play together" },
    date:  { label: "Date Night",  emoji: "🌙", page: "date-night.html",     verb: "A cozy space for two" },
    learn: { label: "Language Class", emoji: "📚", page: "language-class.html", verb: "Learn each other’s language" },
  };
  const VIS = {
    public:  { label: "Public",       emoji: "🌐", desc: "Listed for everyone. Anyone can drop in." },
    friends: { label: "Friends only", emoji: "💞", desc: "Only your friends see it, and they can join freely." },
    private: { label: "Private",      emoji: "🔒", desc: "Hidden. Only people you invite can enter." },
  };

  const MFRooms = { TYPES, VIS };

  // ---- small helpers ----
  function A() { return window.MFAuth; }
  function dbmod() { const a = A(); return a && a._dbmod; }
  function db() { const a = A(); return a && a.db; }
  function ready() { return !!(A() && A().isConfigured && A().isConfigured() && dbmod() && db()); }

  // Wait until MFAuth has booted its db modules (they load async after import).
  MFRooms.whenReady = function (cb) {
    if (ready()) { cb(); return; }
    let tries = 0;
    const iv = setInterval(() => {
      if (ready()) { clearInterval(iv); cb(); }
      else if (++tries > 150) { clearInterval(iv); }
    }, 100);
  };

  function newId() {
    // short, url-safe, collision-unlikely. Not derived from the name, so two
    // rooms can share a friendly label without clobbering each other.
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  MFRooms.cleanName = function (s) {
    return (s || "").replace(/[#$\[\]]/g, "").trim().slice(0, 48);
  };
  MFRooms.typeInfo = function (t) { return TYPES[t] || TYPES.watch; };
  MFRooms.visInfo = function (v) { return VIS[v] || VIS.public; };
  MFRooms.pageFor = function (type) { return (TYPES[type] || TYPES.watch).page; };
  MFRooms.urlFor = function (room) {
    const page = MFRooms.pageFor(room.type);
    return location.origin + "/" + page + "?room=" + encodeURIComponent(room.id);
  };

  // ---- create ----
  // opts: { type, vis, name, invites:[uid,...] }
  MFRooms.create = async function (opts) {
    const a = A();
    if (!ready()) throw new Error("Not connected yet");
    if (!a.uid) throw new Error("Sign in to create a room");
    const m = dbmod(), d = db();

    const type = TYPES[opts.type] ? opts.type : "watch";
    const vis = VIS[opts.vis] ? opts.vis : "public";
    const name = MFRooms.cleanName(opts.name) || TYPES[type].label;
    const id = newId();
    const now = Date.now();

    const room = {
      id, type, vis, name,
      owner: a.uid,
      ownerName: a.name() || "someone",
      ownerUsername: (a.profile && a.profile.username) || "",
      t: now, lastActive: now,
      members: { [a.uid]: now },
    };

    // Private rooms: seed invites (inside the room object) + per-user inboxes
    // so friends get notified. We must NOT also list rooms/$id/invites/$uid as a
    // separate update path — Firebase rejects an update whose paths overlap the
    // rooms/$id path we're already writing. The invites live in `room` instead.
    const invitees = Array.isArray(opts.invites) ? opts.invites.filter(Boolean) : [];
    const updates = { [`rooms/${id}`]: room };
    if (vis === "private" && invitees.length) {
      room.invites = {};
      for (const uid of invitees) {
        room.invites[uid] = { t: now };
        updates[`roomInvites/${uid}/${id}`] = {
          id, type, name, fromName: room.ownerName, fromUid: a.uid, t: now,
        };
      }
    }
    await m.update(m.ref(d), updates);
    if (vis === "private" && invitees.length && a.createNotification) {
      for (const uid of invitees) {
        try { await a.createNotification(uid, { id:`room_invite_${id}`, type:"room_invite", icon:TYPES[type].emoji, title:"Room invitation", body:`${room.ownerName} invited you to ${name}.`, link:`/${MFRooms.pageFor(type)}?room=${encodeURIComponent(id)}`, sourceId:id }); } catch (_) {}
      }
    }
    return room;
  };

  // ---- fetch a single room ----
  MFRooms.get = async function (id) {
    if (!ready()) return null;
    const m = dbmod(), d = db();
    try {
      const snap = await m.get(m.ref(d, `rooms/${id}`));
      return snap.exists() ? snap.val() : null;
    } catch (_) { return null; }
  };

  // ---- access check ----
  // Returns { ok, reason }. Used by room pages to gate entry. Friendship is
  // checked against the OWNER (a friends-only room is visible to the owner's
  // friends; private rooms require an explicit invite).
  MFRooms.canEnter = async function (room) {
    const a = A();
    if (!room) return { ok: false, reason: "missing" };
    const uid = a && a.uid;
    if (room.owner && uid && room.owner === uid) return { ok: true, reason: "owner" };
    if (room.vis === "public") return { ok: true, reason: "public" };
    if (!uid) return { ok: false, reason: "signin" };
    if (room.vis === "private") {
      if (room.invites && room.invites[uid]) return { ok: true, reason: "invited" };
      return { ok: false, reason: "notinvited" };
    }
    if (room.vis === "friends") {
      // visible/joinable to the owner's friends. We check from our own side:
      // are we friends with the owner?
      try {
        const ok = await a.areFriends(room.owner);
        return ok ? { ok: true, reason: "friend" } : { ok: false, reason: "notfriend" };
      } catch (_) { return { ok: false, reason: "notfriend" }; }
    }
    return { ok: false, reason: "denied" };
  };

  // Mark membership + bump activity on entry (best-effort; ignore failures so a
  // rules hiccup never blocks the actual room experience).
  MFRooms.touch = async function (id) {
    const a = A();
    if (!ready() || !a.uid) return;
    const m = dbmod(), d = db(), now = Date.now();
    try {
      await m.update(m.ref(d), {
        [`rooms/${id}/lastActive`]: now,
        [`rooms/${id}/members/${a.uid}`]: now,
      });
    } catch (_) {}
  };

  // ---- invites (after creation, or for friends-only/public rooms too) ----
  MFRooms.invite = async function (roomId, friendUid, friendName) {
    const a = A();
    if (!ready() || !a.uid) throw new Error("Sign in first");
    const room = await MFRooms.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.owner !== a.uid) throw new Error("Only the room's owner can invite");
    const m = dbmod(), d = db(), now = Date.now();
    await m.update(m.ref(d), {
      [`rooms/${roomId}/invites/${friendUid}`]: { t: now },
      [`roomInvites/${friendUid}/${roomId}`]: {
        id: roomId, type: room.type, name: room.name,
        fromName: a.name() || "someone", fromUid: a.uid, t: now,
      },
    });
    if (a.createNotification) { try { await a.createNotification(friendUid, { id:`room_invite_${roomId}`, type:"room_invite", icon:(TYPES[room.type]||TYPES.watch).emoji, title:"Room invitation", body:`${a.name() || "Someone"} invited you to ${room.name}.`, link:`/${MFRooms.pageFor(room.type)}?room=${encodeURIComponent(roomId)}`, sourceId:roomId }); } catch (_) {} }
    return true;
  };

  MFRooms.cancelInvite = async function (roomId, friendUid) {
    const a = A();
    if (!ready() || !a.uid) throw new Error("Sign in first");
    const m = dbmod(), d = db();
    await m.update(m.ref(d), {
      [`rooms/${roomId}/invites/${friendUid}`]: null,
      [`roomInvites/${friendUid}/${roomId}`]: null,
    });
    return true;
  };

  // Clear an invite from MY inbox (e.g. after I join or dismiss it).
  MFRooms.clearMyInvite = async function (roomId) {
    const a = A();
    if (!ready() || !a.uid) return;
    const m = dbmod(), d = db();
    try { await m.remove(m.ref(d, `roomInvites/${a.uid}/${roomId}`)); } catch (_) {}
  };

  MFRooms.watchMyInvites = function (cb) {
    const a = A();
    if (!ready() || !a.uid) { cb({}); return () => {}; }
    const m = dbmod(), d = db();
    const r = m.ref(d, `roomInvites/${a.uid}`);
    const h = m.onValue(r, (snap) => cb(snap.exists() ? snap.val() : {}));
    return () => m.off(r, "value", h);
  };

  // ---- delete (owner only) ----
  MFRooms.remove = async function (roomId) {
    const a = A();
    if (!ready() || !a.uid) throw new Error("Sign in first");
    const room = await MFRooms.get(roomId);
    if (!room) return true;
    if (room.owner !== a.uid) throw new Error("Only the owner can close this room");
    const m = dbmod(), d = db();
    const updates = { [`rooms/${roomId}`]: null };
    if (room.invites) {
      for (const uid of Object.keys(room.invites)) {
        updates[`roomInvites/${uid}/${roomId}`] = null;
      }
    }
    await m.update(m.ref(d), updates);
    return true;
  };

  // ---- edit visibility / name / type (owner only) ----
  MFRooms.update = async function (roomId, fields) {
    const a = A();
    if (!ready() || !a.uid) throw new Error("Sign in first");
    const room = await MFRooms.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.owner !== a.uid) throw new Error("Only the owner can edit this room");
    const m = dbmod(), d = db();
    const patch = {};
    if (fields.name != null) patch.name = MFRooms.cleanName(fields.name) || room.name;
    if (fields.vis && VIS[fields.vis]) patch.vis = fields.vis;
    patch.lastActive = Date.now();
    await m.update(m.ref(d, `rooms/${roomId}`), patch);
    return { ...room, ...patch };
  };

  // ---- listing ----
  // Watches the whole registry once, then filters client-side into what the
  // current user is allowed to SEE:
  //   - all public rooms
  //   - friends-only rooms owned by one of my friends
  //   - private rooms I own or am invited to
  // cb receives an array sorted by recent activity. Needs my friends set, so we
  // resolve that first (and re-resolve when it changes).
  MFRooms.watchVisible = function (cb) {
    const a = A();
    if (!ready()) { cb([]); return () => {}; }
    const m = dbmod(), d = db();

    let friends = {};         // uid -> true (resolved from MFAuth)
    let raw = {};             // id -> room
    let stopFriends = () => {};

    function emit() {
      const uid = a.uid;
      const out = [];
      for (const id in raw) {
        const r = raw[id];
        if (!r || typeof r !== "object") continue;
        r.id = r.id || id;
        const mine = uid && r.owner === uid;
        let visible = false;
        if (r.vis === "public") visible = true;
        else if (r.vis === "friends") visible = mine || (r.owner && friends[r.owner]);
        else if (r.vis === "private") visible = mine || (uid && r.invites && r.invites[uid]);
        if (visible) out.push(r);
      }
      out.sort((x, y) => (y.lastActive || y.t || 0) - (x.lastActive || x.t || 0));
      cb(out);
    }

    // friends (may be empty when signed out)
    if (a.uid && a.watchFriends) {
      stopFriends = a.watchFriends((f) => { friends = f || {}; emit(); });
    }

    const r = m.ref(d, "rooms");
    const h = m.onValue(r, (snap) => { raw = snap.exists() ? snap.val() : {}; emit(); });
    return () => { try { stopFriends(); } catch (_) {} m.off(r, "value", h); };
  };

  // Live member/presence count for a room, read from the per-type namespace so
  // the lobby can show "2 here" without the room page being open. Each type
  // stores presence under {ns}/{id}/presence.
  const NS = { watch: "watch", games: "together", date: "datenight", learn: "together" };
  MFRooms.watchCount = function (room, cb) {
    if (!ready()) { cb(0); return () => {}; }
    const m = dbmod(), d = db();
    const ns = NS[room.type] || "watch";
    const r = m.ref(d, `${ns}/${room.id}/presence`);
    const h = m.onValue(r, (snap) => {
      if (!snap.exists()) { cb(0); return; }
      const v = snap.val() || {};
      // Count one per person: collapse entries that share an identity key (the
      // account uid when signed in, else the per-device id). Fresh entries only.
      const now = Date.now();
      const ids = new Set();
      for (const k of Object.keys(v)) {
        const e = v[k] || {};
        const t = e.t || 0;
        if (t && (now - t) > 70000) continue;   // stale
        ids.add(e.idk || k);
      }
      cb(ids.size);
    });
    return () => m.off(r, "value", h);
  };

  // Count rooms the given user owns (one-shot read; for profile stats). Returns
  // { total, watch, games, date, learn }.
  MFRooms.countOwned = async function (uid) {
    const empty = { total: 0, watch: 0, games: 0, date: 0, learn: 0 };
    if (!ready() || !uid) return empty;
    const m = dbmod(), d = db();
    try {
      const snap = await m.get(m.ref(d, "rooms"));
      if (!snap.exists()) return empty;
      const all = snap.val() || {};
      const out = { ...empty };
      for (const id in all) {
        const r = all[id];
        if (r && r.owner === uid) {
          out.total++;
          if (out[r.type] !== undefined) out[r.type]++;
        }
      }
      return out;
    } catch (_) { return empty; }
  };

  window.MFRooms = MFRooms;
})();
