/* auth.js — Mayflower Studios universal account system
   Exposes window.MFAuth. Loaded on every page by shared.js.

   Responsibilities:
   - Initialize Firebase App + Auth + Realtime DB (shared singleton).
   - Email/password + Google sign-in & sign-up.
   - Profile (display name) stored at users/$uid.
   - onChange(cb) so nav, chat, and rooms react to sign-in state.

   Other code should treat this as the single source of truth for identity:
     MFAuth.isConfigured() -> bool
     MFAuth.user           -> firebase user | null
     MFAuth.profile        -> { displayName, photoURL, ... } | null
     MFAuth.uid            -> string | null
     MFAuth.name()         -> best display name string
     MFAuth.onChange(cb)   -> cb(user, profile); also called immediately if ready
     MFAuth.signInEmail / signUpEmail / signInGoogle / signOut / setDisplayName
*/
(function () {
  const FB_VERSION = "10.12.2";
  const cfg = {
    apiKey: "AIzaSyDVJ0Tiq0gimaB-epcD9HQlVBrOWHq-IXI",
    authDomain: "watchtogether-95d7d.firebaseapp.com",
    databaseURL: "https://watchtogether-95d7d-default-rtdb.firebaseio.com",
    projectId: "watchtogether-95d7d",
    storageBucket: "watchtogether-95d7d.firebasestorage.app",
  };
  const CONFIGURED = !cfg.apiKey.startsWith("REPLACE");

  const listeners = [];
  let ready = false;
  let mods = null; // loaded firebase modules

  const MFAuth = {
    _ver: "privacy-notifications-achievements-2",   // bump marker: confirms the new typing path is loaded
    user: null,
    profile: null,
    get uid() { return MFAuth.user ? MFAuth.user.uid : null; },
    isConfigured() { return CONFIGURED; },
    isReady() { return ready; },
    name() {
      if (MFAuth.profile && MFAuth.profile.displayName) return MFAuth.profile.displayName;
      if (MFAuth.user && MFAuth.user.displayName) return MFAuth.user.displayName;
      if (MFAuth.user && MFAuth.user.email) return MFAuth.user.email.split("@")[0];
      return null;
    },
    // Make a user-supplied image link safe to drop into a CSS url() or an
    // <img src>. Returns "" for anything that isn't a plain http(s) URL.
    //
    // The percent-encoding matters as much as the scheme check. A banner URL
    // ending in  x.png');position:fixed;inset:0;z-index:99999;--a:url('
    // used to pass the old "starts with http" test, and HTML-escaping it did
    // not help: the parser turns &#39; back into a quote before the CSS engine
    // sees it, so the url() token closed early and the rest became real CSS —
    // enough to cover the screen of anyone opening that profile.
    //
    // encodeURIComponent is not used here because it leaves ' ( ) untouched.
    safeImageURL(value) {
      const raw = String(value == null ? "" : value).trim();
      if (!raw) return "";
      let u;
      try { u = new URL(raw); } catch (_) { return ""; }
      if (u.protocol !== "https:" && u.protocol !== "http:") return "";
      return u.href.replace(/["'()\\\s;<>]/g,
        ch => "%" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
    },
    // Returns { kind:'photo'|'emoji'|'letter', value } for any profile object.
    avatarFor(profile, name) {
      const p = profile || {};
      if (p.avatarType === "photo" && p.photoURL) return { kind: "photo", value: p.photoURL };
      if (p.photoURL && !p.avatarType) return { kind: "photo", value: p.photoURL }; // google photo
      if (p.avatarEmoji) return { kind: "emoji", value: p.avatarEmoji };
      const n = p.displayName || name || "?";
      return { kind: "letter", value: (n[0] || "?").toUpperCase() };
    },
    onChange(cb) {
      if (typeof cb !== "function") return;
      listeners.push(cb);
      if (ready) { try { cb(MFAuth.user, MFAuth.profile); } catch (_) {} }
    },
    _emit() {
      listeners.forEach(cb => { try { cb(MFAuth.user, MFAuth.profile); } catch (_) {} });
    },
  };

  // A failed database read here returns an empty value, which is
  // indistinguishable from "there is nothing to show" — so a rules mistake
  // looks exactly like an empty profile. Naming the read in the console is
  // the difference between a five-minute fix and an afternoon.
  function dbRead(what, err) {
    console.warn("[MFAuth] read failed: " + what, err && (err.code || err.message) || err);
  }

  function notReady() { return Promise.reject(new Error("Auth not ready yet")); }
  // Placeholder methods until modules load
  MFAuth.signInEmail = MFAuth.signUpEmail = MFAuth.signInGoogle =
    MFAuth.signOut = MFAuth.setDisplayName = notReady;

  if (!CONFIGURED) {
    window.MFAuth = MFAuth;
    ready = true; // "ready" but signed-out forever
    return;
  }

  (async () => {
    try {
      const appMod  = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`);
      const authMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`);
      const dbMod   = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-database.js`);

      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);

      // Initialize Auth with persistence declared UP FRONT so the signed-in
      // session is restored from storage on every page load (no re-login on
      // reload). We prefer IndexedDB, then localStorage, then in-memory.
      // initializeAuth must run before any getAuth() for this app; if another
      // module already created it, fall back to getAuth + setPersistence.
      let auth;
      try {
        auth = authMod.initializeAuth(app, {
          persistence: [
            authMod.indexedDBLocalPersistence,
            authMod.browserLocalPersistence,
          ],
          popupRedirectResolver: authMod.browserPopupRedirectResolver,
        });
      } catch (_) {
        // already initialized somewhere — reuse it and set persistence anyway
        auth = authMod.getAuth(app);
        try { await authMod.setPersistence(auth, authMod.browserLocalPersistence); } catch (_) {}
      }
      const db = dbMod.getDatabase(app);

      mods = { appMod, authMod, dbMod, app, auth, db };
      MFAuth.db = db; // expose shared db so chat.js etc. reuse one connection
      MFAuth._app = app; // expose app so chat.js can init Storage on the same instance
      MFAuth._dbmod = dbMod; // expose RTDB module fns (ref/get/set/update/onValue/...) for rooms.js etc.

      // ---- universal notifications ----
      function notificationText(v, max) { return String(v || "").trim().slice(0, max); }
      MFAuth.createNotification = async (toUid, data) => {
        if (!MFAuth.user || !toUid || toUid === MFAuth.user.uid) return null;
        data = data || {};
        const id = notificationText(data.id, 120) || dbMod.push(dbMod.ref(db, `notifications/${toUid}`)).key;
        const record = {
          type: notificationText(data.type, 32) || "general",
          title: notificationText(data.title, 80) || "Notification",
          body: notificationText(data.body, 240),
          icon: notificationText(data.icon, 8) || "🔔",
          link: notificationText(data.link, 300),
          actorUid: MFAuth.user.uid,
          actorName: notificationText(MFAuth.name() || "someone", 32),
          actorUsername: notificationText((MFAuth.profile && MFAuth.profile.username) || "", 20),
          sourceId: notificationText(data.sourceId || "", 120),
          createdAt: Date.now(),
          readAt: 0,
        };
        try {
          await dbMod.set(dbMod.ref(db, `notifications/${toUid}/${id}`), record);
          return id;
        } catch (err) {
          console.warn("Notification could not be created", err);
          return null;
        }
      };


      // ---- profile privacy, notification preferences, persistent achievements ----
      // Privacy defaults preserve what the site already exposed before this feature.
      // Friends are the exception: public friend lists are new, so they default to friends-only.
      const PROFILE_PRIVACY_DEFAULTS = Object.freeze({
        relationship:"everyone", gifts:"everyone", guestbook:"everyone", friends:"friends",
        onlineStatus:"everyone", lastSeen:"everyone", achievements:"everyone", badges:"everyone"
      });
      const NOTIFICATION_PREF_DEFAULTS = Object.freeze({
        friends:true, gifts:true, guestbook:true, relationship:true, rooms:true, messages:true
      });
      const ACHIEVEMENT_CATALOG = Object.freeze([
        { id:"joined", icon:"🌸", name:"Welcome", desc:"Made an account" },
        { id:"named", icon:"🪪", name:"Identity", desc:"Set a username" },
        { id:"decorated", icon:"🖼️", name:"Decorated", desc:"Added a banner" },
        { id:"open", icon:"📖", name:"Open Book", desc:"Wrote a bio" },
        { id:"friend1", icon:"🤝", name:"Made a Friend", desc:"Added 1 friend" },
        { id:"social", icon:"💞", name:"Social", desc:"Had 5 friends" },
        { id:"gifted", icon:"🎁", name:"Gifted", desc:"Received a gift" },
        { id:"guestbook", icon:"💌", name:"Signed", desc:"Got a guestbook note" },
        { id:"birthday", icon:"🎂", name:"Birthday", desc:"Set your birthday" },
        { id:"host", icon:"🚪", name:"Host", desc:"Opened a room" },
        { id:"regular", icon:"🏡", name:"Regular", desc:"Opened 5 rooms" },
        { id:"caretaker", icon:"🌱", name:"Caretaker", desc:"Raised a companion" },
        { id:"grower", icon:"🌟", name:"Grower", desc:"A companion reached lvl 5" },
        { id:"devoted", icon:"🦄", name:"Devoted", desc:"A companion reached lvl 18" },
        { id:"veteran", icon:"🗓️", name:"Settled In", desc:"30 days as a member" },
      ]);
      MFAuth.profilePrivacyDefaults = PROFILE_PRIVACY_DEFAULTS;
      MFAuth.notificationPrefDefaults = NOTIFICATION_PREF_DEFAULTS;
      MFAuth.achievementCatalog = ACHIEVEMENT_CATALOG;

      function allowedVisibility(v, fallback) {
        return /^(everyone|friends|nobody)$/.test(String(v || "")) ? String(v) : fallback;
      }
      MFAuth.getProfilePrivacy = async (uid) => {
        uid = uid || MFAuth.uid;
        if (!uid) return { ...PROFILE_PRIVACY_DEFAULTS };
        try {
          const snap = await dbMod.get(dbMod.ref(db, `profilePrivacy/${uid}`));
          const raw = snap.exists() ? (snap.val() || {}) : {};
          const out = { ...PROFILE_PRIVACY_DEFAULTS };
          Object.keys(out).forEach(k => out[k] = allowedVisibility(raw[k], out[k]));
          return out;
        } catch (_) { return { ...PROFILE_PRIVACY_DEFAULTS }; }
      };
      MFAuth.saveProfilePrivacy = async (values) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const patch = {};
        Object.keys(PROFILE_PRIVACY_DEFAULTS).forEach(k => {
          if (Object.prototype.hasOwnProperty.call(values || {}, k)) patch[k] = allowedVisibility(values[k], PROFILE_PRIVACY_DEFAULTS[k]);
        });
        if (Object.keys(patch).length) await dbMod.update(dbMod.ref(db, `profilePrivacy/${MFAuth.uid}`), patch);
        return MFAuth.getProfilePrivacy(MFAuth.uid);
      };
      MFAuth.canViewProfileSection = async (uid, section, privacy) => {
        if (!MFAuth.user || !uid) return false;
        if (uid === MFAuth.uid) return true;
        const p = privacy || await MFAuth.getProfilePrivacy(uid);
        const mode = allowedVisibility(p && p[section], PROFILE_PRIVACY_DEFAULTS[section] || "everyone");
        if (mode === "everyone") return true;
        if (mode === "nobody") return false;
        try { return (await dbMod.get(dbMod.ref(db, `friends/${MFAuth.uid}/${uid}`))).exists(); }
        catch (e) { dbRead("canSee/friends", e); return false; }
      };

      MFAuth.getNotificationPrefs = async () => {
        if (!MFAuth.user) return { ...NOTIFICATION_PREF_DEFAULTS };
        try {
          const snap = await dbMod.get(dbMod.ref(db, `notificationPrefs/${MFAuth.uid}`));
          const raw = snap.exists() ? (snap.val() || {}) : {};
          const out = { ...NOTIFICATION_PREF_DEFAULTS };
          Object.keys(out).forEach(k => { if (typeof raw[k] === "boolean") out[k] = raw[k]; });
          return out;
        } catch (_) { return { ...NOTIFICATION_PREF_DEFAULTS }; }
      };
      MFAuth.saveNotificationPrefs = async (values) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const patch = {};
        Object.keys(NOTIFICATION_PREF_DEFAULTS).forEach(k => {
          if (typeof (values || {})[k] === "boolean") patch[k] = values[k];
        });
        if (Object.keys(patch).length) await dbMod.update(dbMod.ref(db, `notificationPrefs/${MFAuth.uid}`), patch);
        return MFAuth.getNotificationPrefs();
      };

      MFAuth.getAchievements = async (uid) => {
        uid = uid || MFAuth.uid;
        if (!uid) return {};
        try { const snap = await dbMod.get(dbMod.ref(db, `achievements/${uid}`)); return snap.exists() ? (snap.val() || {}) : {}; }
        catch (e) { dbRead("getAchievements", e); return {}; }
      };
      MFAuth.watchAchievements = (uid, cb) => {
        uid = uid || MFAuth.uid;
        if (!uid || typeof cb !== "function") return () => {};
        const r = dbMod.ref(db, `achievements/${uid}`);
        const h = dbMod.onValue(r, snap => cb(snap.exists() ? (snap.val() || {}) : {}), () => cb({}));
        return () => dbMod.off(r, "value", h);
      };
      MFAuth.unlockAchievements = async (ids) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const valid = new Set(ACHIEVEMENT_CATALOG.map(a => a.id));
        ids = [...new Set((Array.isArray(ids) ? ids : [ids]).map(x => String(x || "")).filter(x => valid.has(x)))];
        if (!ids.length) return {};
        const existing = await MFAuth.getAchievements(MFAuth.uid);
        const patch = {}, now = Date.now();
        ids.forEach(id => { if (!existing[id]) patch[`achievements/${MFAuth.uid}/${id}`] = { unlockedAt: now }; });
        if (Object.keys(patch).length) await dbMod.update(dbMod.ref(db), patch);
        return { ...existing, ...Object.fromEntries(ids.map(id => [id, existing[id] || { unlockedAt: now }])) };
      };
      // Compatibility entry point used by pages that still know about the old
      // calculated achievement state. Writes are append-only in Firebase.
      MFAuth.migrateLegacyAchievements = async (ids) => MFAuth.unlockAchievements(ids);
      MFAuth.refreshBasicAchievements = async () => {
        if (!MFAuth.user) return {};
        const p = MFAuth.profile || {}, uid = MFAuth.uid;
        const ids = ["joined"];
        if (p.username) ids.push("named");
        if (p.bannerURL) ids.push("decorated");
        if (p.bio && String(p.bio).trim()) ids.push("open");
        if (p.birthday) ids.push("birthday");
        if (p.createdAt && Date.now() - Number(p.createdAt) >= 30 * 86400000) ids.push("veteran");

        // Migrate any achievements the account already qualifies for into the
        // permanent store whenever they sign in. This means old accounts gain
        // durable unlocks without needing to visit the profile editor first.
        try {
          const [friendsSnap, giftsSnap, guestSnap, roomsSnap] = await Promise.all([
            dbMod.get(dbMod.ref(db, `friends/${uid}`)).catch(() => null),
            dbMod.get(dbMod.ref(db, `gifts/${uid}`)).catch(() => null),
            dbMod.get(dbMod.ref(db, `guestbooks/${uid}`)).catch(() => null),
            dbMod.get(dbMod.ref(db, "rooms")).catch(() => null),
          ]);
          let friendCount = 0;
          if (friendsSnap && friendsSnap.exists()) friendsSnap.forEach(() => { friendCount++; });
          if (friendCount >= 1) ids.push("friend1");
          if (friendCount >= 5) ids.push("social");
          if (giftsSnap && giftsSnap.exists()) ids.push("gifted");
          if (guestSnap && guestSnap.exists()) ids.push("guestbook");
          if (roomsSnap && roomsSnap.exists()) {
            let owned = 0;
            roomsSnap.forEach(ch => { const room = ch.val() || {}; if (room.owner === uid) owned++; });
            if (owned >= 1) ids.push("host");
            if (owned >= 5) ids.push("regular");
          }
          if (typeof MFAuth.listMyPets === "function") {
            const pets = await MFAuth.listMyPets().catch(() => []);
            if (pets.length) ids.push("caretaker");
            const top = pets.reduce((m, pet) => Math.max(m, Number(pet.level) || 0), 0);
            if (top >= 5) ids.push("grower");
            if (top >= 18) ids.push("devoted");
          }
        } catch (_) {}
        try { return await MFAuth.unlockAchievements(ids); } catch (_) { return {}; }
      };

      MFAuth.getUserBadges = async (uid) => {
        if (!uid) return {};
        try { const snap = await dbMod.get(dbMod.ref(db, `userBadges/${uid}`)); return snap.exists() ? (snap.val() || {}) : {}; }
        catch (e) { dbRead("getUserBadges", e); return {}; }
      };
      MFAuth.watchUserBadges = (uid, cb) => {
        if (!uid || typeof cb !== "function") return () => {};
        const r = dbMod.ref(db, `userBadges/${uid}`);
        const h = dbMod.onValue(r, snap => cb(snap.exists() ? (snap.val() || {}) : {}), () => cb({}));
        return () => dbMod.off(r, "value", h);
      };
      MFAuth.getFriendsForProfile = async (uid) => {
        if (!uid) return {};
        try { const snap = await dbMod.get(dbMod.ref(db, `friends/${uid}`)); return snap.exists() ? (snap.val() || {}) : {}; }
        catch (e) { dbRead("getFriendsForProfile", e); return {}; }
      };

      // ---- profile helpers ----
      async function loadProfile(uid) {
        try {
          const snap = await dbMod.get(dbMod.ref(db, `users/${uid}`));
          return snap.exists() ? snap.val() : null;
        } catch (e) { dbRead("loadProfile", e); return null; }
      }
      async function ensureProfile(user) {
        // Seed a profile on first sign-in; keep light + non-destructive.
        const uref = dbMod.ref(db, `users/${user.uid}`);
        const snap = await dbMod.get(uref);
        const existing = snap.exists() ? snap.val() : {};
        const patch = {};
        if (!existing.displayName) {
          patch.displayName = user.displayName || (user.email ? user.email.split("@")[0] : "someone");
        }
        if (user.photoURL && !existing.photoURL) patch.photoURL = user.photoURL;
        if (!existing.createdAt) patch.createdAt = dbMod.serverTimestamp();
        patch.lastSeen = dbMod.serverTimestamp();
        if (Object.keys(patch).length) { try { await dbMod.update(uref, patch); } catch (_) {} }
        return { ...existing, ...patch };
      }

      // ---- public methods ----
      MFAuth.signUpEmail = async (email, password, displayName) => {
        const cred = await authMod.createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          try { await authMod.updateProfile(cred.user, { displayName }); } catch (_) {}
          try { await dbMod.update(dbMod.ref(db, `users/${cred.user.uid}`), { displayName }); } catch (_) {}
        }
        return cred.user;
      };
      MFAuth.signInEmail = async (email, password) =>
        (await authMod.signInWithEmailAndPassword(auth, email, password)).user;
      MFAuth.signInGoogle = async () => {
        const provider = new authMod.GoogleAuthProvider();
        return (await authMod.signInWithPopup(auth, provider)).user;
      };
      MFAuth.resetPassword = async (email) => authMod.sendPasswordResetEmail(auth, email);
      MFAuth.signOut = async () => authMod.signOut(auth);
      MFAuth.setDisplayName = async (name) => {
        name = String(name || "").trim().slice(0, 32);
        if (!name) throw new Error("Name can't be empty");
        if (!MFAuth.user) throw new Error("Not signed in");
        try { await authMod.updateProfile(MFAuth.user, { displayName: name }); } catch (_) {}
        await dbMod.update(dbMod.ref(db, `users/${MFAuth.user.uid}`), { displayName: name });
        MFAuth.profile = { ...(MFAuth.profile || {}), displayName: name };
        MFAuth._emit();
        return name;
      };
      MFAuth.getProfile = loadProfile;

      // Whitelisted, validated profile fields. Keeps writes tidy and matches DB rules.
      const HEX = /^#[0-9a-fA-F]{6}$/;
      MFAuth.updateProfile = async (fields) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const patch = {};
        if (typeof fields.displayName === "string") {
          const v = fields.displayName.trim().slice(0, 32);
          if (!v) throw new Error("Name can't be empty");
          patch.displayName = v;
          try { await authMod.updateProfile(MFAuth.user, { displayName: v }); } catch (_) {}
        }
        if (typeof fields.bio === "string")      patch.bio    = fields.bio.trim().slice(0, 300);
        if (typeof fields.status === "string")   patch.status = fields.status.trim().slice(0, 120);
        if (typeof fields.pronouns === "string") patch.pronouns = fields.pronouns.trim().slice(0, 32);
        if (typeof fields.accent === "string") {
          const a = fields.accent.trim();
          // only write a valid hex; skip empties so we never hit the validator
          if (a && !HEX.test(a)) throw new Error("Accent must be a hex color like #f9a8d4");
          if (a) patch.accent = a;
        }
        if (typeof fields.birthday === "string") {
          const b = fields.birthday.trim();
          if (b && !/^\d{2}-\d{2}$/.test(b)) throw new Error("Birthday must be saved as MM-DD");
          patch.birthday = b;
        }
        if (typeof fields.avatarEmoji === "string" && fields.avatarEmoji) {
          patch.avatarEmoji = fields.avatarEmoji.slice(0, 8);
          patch.avatarType = "emoji";
        }
        if (typeof fields.photoURL === "string" && fields.photoURL) {
          const safe = MFAuth.safeImageURL(fields.photoURL);
          if (!safe) throw new Error("That photo link isn't a valid http(s) address");
          patch.photoURL = safe.slice(0, 500);
          patch.avatarType = "photo";
        }
        // bannerURL: a string sets it; an empty string clears it (both valid)
        if (typeof fields.bannerURL === "string") {
          if (!fields.bannerURL) patch.bannerURL = "";
          else {
            const safe = MFAuth.safeImageURL(fields.bannerURL);
            if (!safe) throw new Error("That banner link isn't a valid http(s) address");
            patch.bannerURL = safe.slice(0, 500);
          }
        }
        if (!Object.keys(patch).length) return MFAuth.profile;
        try {
          await dbMod.update(dbMod.ref(db, `users/${MFAuth.user.uid}`), patch);
          const unlock = [];
          if (patch.bannerURL) unlock.push("decorated");
          if (typeof patch.bio === "string" && patch.bio.trim()) unlock.push("open");
          if (patch.birthday) unlock.push("birthday");
          if (unlock.length) { try { await MFAuth.unlockAchievements(unlock); } catch (_) {} }
        } catch (err) {
          // Surface a useful message instead of Firebase's generic wording.
          const code = (err && err.code) || "";
          const raw = (err && err.message) || "";
          if (/permission/i.test(code) || /PERMISSION_DENIED/.test(raw)) {
            throw new Error("Couldn't save — the Realtime Database rules are rejecting this. Re-publish the rules (the users rule must include the fields being saved). [" + (code || raw).slice(0,80) + "]");
          }
          throw err;
        }
        MFAuth.profile = { ...(MFAuth.profile || {}), ...patch };
        MFAuth._emit();
        return MFAuth.profile;
      };

      // ---- usernames (unique @handle) ----
      // Index lives at usernames/{handle} = uid. We claim the new one, then
      // release the old, so a handle is never double-owned.
      function normHandle(h) {
        return String(h || "").trim().toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9_]/g, "").slice(0, 20);
      }
      MFAuth.normHandle = normHandle;
      MFAuth.setUsername = async (handle) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const h = normHandle(handle);
        if (h.length < 3) throw new Error("Username needs at least 3 letters/numbers");
        const current = MFAuth.profile && MFAuth.profile.username;
        if (current === h) return h;
        const uref = dbMod.ref(db, `usernames/${h}`);
        const snap = await dbMod.get(uref);
        if (snap.exists() && snap.val() !== MFAuth.user.uid) throw new Error("That username is taken — try another");
        // claim new
        await dbMod.set(uref, MFAuth.user.uid);
        await dbMod.update(dbMod.ref(db, `users/${MFAuth.user.uid}`), { username: h });
        // release old
        if (current && current !== h) { try { await dbMod.remove(dbMod.ref(db, `usernames/${current}`)); } catch (_) {} }
        MFAuth.profile = { ...(MFAuth.profile || {}), username: h };
        MFAuth._emit();
        try { await MFAuth.unlockAchievements("named"); } catch (_) {}
        return h;
      };
      MFAuth.lookupUsername = async (handle) => {
        const h = normHandle(handle);
        if (!h) return null;
        try {
          const snap = await dbMod.get(dbMod.ref(db, `usernames/${h}`));
          return snap.exists() ? snap.val() : null; // returns uid or null
        } catch (e) { dbRead("uidForUsername", e); return null; }
      };

      // ---- friends & requests ----
      // Data model:
      //   friendRequests/{toUid}/{fromUid} = { name, username, t }   (incoming)
      //   friends/{uid}/{otherUid} = { t }                            (mutual once accepted)
      MFAuth.sendFriendRequest = async (handle) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const targetUid = await MFAuth.lookupUsername(handle);
        if (!targetUid) throw new Error("No one found with that username");
        if (targetUid === MFAuth.user.uid) throw new Error("That's you! 🌸");
        // already friends?
        const fr = await dbMod.get(dbMod.ref(db, `friends/${MFAuth.user.uid}/${targetUid}`));
        if (fr.exists()) throw new Error("You're already friends");
        await dbMod.set(dbMod.ref(db, `friendRequests/${targetUid}/${MFAuth.user.uid}`), {
          name: MFAuth.name() || "someone",
          username: (MFAuth.profile && MFAuth.profile.username) || "",
          t: Date.now(),
        });
        await MFAuth.createNotification(targetUid, { id:`friend_request_${MFAuth.user.uid}`, type:"friend_request", icon:"🌸", title:"New friend request", body:`${MFAuth.name() || "Someone"} sent you a friend request.`, link:"/account.html#friends", sourceId:MFAuth.user.uid });
        return true;
      };
      MFAuth.acceptFriendRequest = async (fromUid) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const me = MFAuth.user.uid;
        const t = Date.now();
        // create the mutual friendship (both directions), then clear the request
        await dbMod.update(dbMod.ref(db), {
          [`friends/${me}/${fromUid}`]: { t },
          [`friends/${fromUid}/${me}`]: { t },
          [`friendRequests/${me}/${fromUid}`]: null,
        });
        try { await dbMod.remove(dbMod.ref(db, `notifications/${me}/friend_request_${fromUid}`)); } catch (_) {}
        try {
          const fs = await dbMod.get(dbMod.ref(db, `friends/${me}`)); let n = 0; fs.forEach(() => { n++; });
          const unlock = n >= 5 ? ["friend1","social"] : ["friend1"];
          await MFAuth.unlockAchievements(unlock);
        } catch (_) {}
        await MFAuth.createNotification(fromUid, { id:`friend_accepted_${me}`, type:"friend_accepted", icon:"💞", title:"Friend request accepted", body:`${MFAuth.name() || "Someone"} accepted your friend request.`, link:"/account.html#friends", sourceId:me });
        return true;
      };
      MFAuth.declineFriendRequest = async (fromUid) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        await dbMod.remove(dbMod.ref(db, `friendRequests/${MFAuth.user.uid}/${fromUid}`));
        try { await dbMod.remove(dbMod.ref(db, `notifications/${MFAuth.user.uid}/friend_request_${fromUid}`)); } catch (_) {}
        return true;
      };
      MFAuth.removeFriend = async (otherUid) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const me = MFAuth.user.uid;
        await dbMod.update(dbMod.ref(db), {
          [`friends/${me}/${otherUid}`]: null,
          [`friends/${otherUid}/${me}`]: null,
        });
        return true;
      };
      MFAuth.watchFriends = (cb) => {
        if (!MFAuth.user) return () => {};
        const r = dbMod.ref(db, `friends/${MFAuth.user.uid}`);
        const h = dbMod.onValue(r, (snap) => cb(snap.exists() ? snap.val() : {}));
        return () => dbMod.off(r, "value", h);
      };
      MFAuth.watchFriendRequests = (cb) => {
        if (!MFAuth.user) return () => {};
        const r = dbMod.ref(db, `friendRequests/${MFAuth.user.uid}`);
        const h = dbMod.onValue(r, (snap) => cb(snap.exists() ? snap.val() : {}));
        return () => dbMod.off(r, "value", h);
      };
      MFAuth.areFriends = async (otherUid) => {
        if (!MFAuth.user) return false;
        try { return (await dbMod.get(dbMod.ref(db, `friends/${MFAuth.user.uid}/${otherUid}`))).exists(); }
        catch (e) { dbRead("areFriends", e); return false; }
      };

      // Avatar upload via Firebase Storage (loaded lazily so pages that never
      // upload don't pay for the module). Returns the download URL.
      let storageMod = null, storage = null;
      MFAuth.uploadAvatar = async (file) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        if (!file) throw new Error("No file");
        if (!/^image\//.test(file.type)) throw new Error("Please choose an image file");
        if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
        if (!storageMod) storageMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-storage.js`);
        if (!storage) storage = storageMod.getStorage(app);
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
        const path = `avatars/${MFAuth.user.uid}/avatar.${ext}`;
        const sref = storageMod.ref(storage, path);
        await storageMod.uploadBytes(sref, file, { contentType: file.type });
        const url = await storageMod.getDownloadURL(sref);
        await MFAuth.updateProfile({ photoURL: url });
        return url;
      };

      // Profile banner (Discord-style header image). Stored separately from the
      // avatar; saved to users/$uid/bannerURL. Allow a slightly larger file
      // since banners are wider. Pass null to clear it.
      MFAuth.uploadBanner = async (file) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        if (!file) throw new Error("No file");
        if (!/^image\//.test(file.type)) throw new Error("Please choose an image file");
        if (file.size > 8 * 1024 * 1024) throw new Error("Banner must be under 8 MB");
        if (!storageMod) storageMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-storage.js`);
        if (!storage) storage = storageMod.getStorage(app);
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
        const path = `banners/${MFAuth.user.uid}/banner.${ext}`;
        const sref = storageMod.ref(storage, path);
        await storageMod.uploadBytes(sref, file, { contentType: file.type });
        const url = await storageMod.getDownloadURL(sref);
        // Write the URL to the profile, then read it straight back to confirm it
        // actually persisted (RTDB applies writes optimistically and silently
        // rolls back if a rule rejects them — this catches that case loudly).
        await MFAuth.updateProfile({ bannerURL: url });
        try {
          const check = await dbMod.get(dbMod.ref(db, `users/${MFAuth.user.uid}/bannerURL`));
          if (!check.exists() || check.val() !== url) {
            throw new Error("The banner image uploaded, but saving it to your profile was blocked. Re-publish the Realtime Database rules (the users rule needs the bannerURL field).");
          }
        } catch (err) {
          if (err && /blocked/.test(err.message)) throw err;
          // a read failure here isn't fatal; the write above already succeeded or threw
        }
        return url;
      };
      MFAuth.clearBanner = async () => {
        if (!MFAuth.user) throw new Error("Not signed in");
        await MFAuth.updateProfile({ bannerURL: "" });
      };



      // ---- social extras: guestbook, gifts, relationship status ----
      const GIFT_CATALOG = {
        flower: { emoji: "🌸", name: "Flower" },
        heart: { emoji: "❤️", name: "Heart" },
        coffee: { emoji: "☕", name: "Coffee" },
        cookie: { emoji: "🍪", name: "Cookie" },
        ticket: { emoji: "🎬", name: "Movie Ticket" },
        controller: { emoji: "🎮", name: "Controller" },
        plushie: { emoji: "🐱", name: "Cat Plushie" },
        star: { emoji: "⭐", name: "Star" },
      };
      MFAuth.giftCatalog = GIFT_CATALOG;

      function safeText(v, max) { return String(v || "").trim().slice(0, max); }
      async function publicName(uid) {
        try {
          const snap = await dbMod.get(dbMod.ref(db, `users/${uid}`));
          const p = snap.exists() ? snap.val() : {};
          return { name: p.displayName || "someone", username: p.username || "" };
        } catch (_) { return { name: "someone", username: "" }; }
      }

      MFAuth.sendGift = async (toUid, giftId, note) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        if (!toUid || toUid === MFAuth.user.uid) throw new Error("Pick someone else to send a gift to");
        const gift = GIFT_CATALOG[giftId];
        if (!gift) throw new Error("That gift doesn't exist");
        const id = dbMod.push(dbMod.ref(db, `gifts/${toUid}`)).key;
        await dbMod.set(dbMod.ref(db, `gifts/${toUid}/${id}`), {
          fromUid: MFAuth.user.uid,
          fromName: MFAuth.name() || "someone",
          fromUsername: (MFAuth.profile && MFAuth.profile.username) || "",
          giftId,
          emoji: gift.emoji,
          name: gift.name,
          note: safeText(note, 160),
          t: Date.now(),
        });
        await MFAuth.createNotification(toUid, { id:`gift_${id}`, type:"gift", icon:gift.emoji, title:`${MFAuth.name() || "Someone"} sent you ${gift.name}`, body:safeText(note,160) || "A little something is waiting on your profile.", link:"/account.html#gifts", sourceId:id });
        return id;
      };

      MFAuth.watchGifts = (uid, cb, limit = 50) => {
        if (!uid) return () => {};
        const q = dbMod.query(dbMod.ref(db, `gifts/${uid}`), dbMod.orderByChild("t"), dbMod.limitToLast(limit));
        const h = dbMod.onValue(q, (snap) => cb(snap.exists() ? snap.val() : {}));
        return () => dbMod.off(q, "value", h);
      };

      MFAuth.postGuestbook = async (toUid, text) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        text = safeText(text, 500);
        if (!text) throw new Error("Write a little message first");
        const id = dbMod.push(dbMod.ref(db, `guestbooks/${toUid}`)).key;
        await dbMod.set(dbMod.ref(db, `guestbooks/${toUid}/${id}`), {
          fromUid: MFAuth.user.uid,
          fromName: MFAuth.name() || "someone",
          fromUsername: (MFAuth.profile && MFAuth.profile.username) || "",
          text,
          t: Date.now(),
        });
        await MFAuth.createNotification(toUid, { id:`guestbook_${id}`, type:"guestbook", icon:"💌", title:"New guestbook message", body:`${MFAuth.name() || "Someone"}: ${text.slice(0,120)}`, link:"/account.html#guestbook", sourceId:id });
        return id;
      };
      MFAuth.deleteGuestbookPost = async (profileUid, postId) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        await dbMod.remove(dbMod.ref(db, `guestbooks/${profileUid}/${postId}`));
      };
      MFAuth.watchGuestbook = (uid, cb, limit = 25) => {
        if (!uid) return () => {};
        const q = dbMod.query(dbMod.ref(db, `guestbooks/${uid}`), dbMod.orderByChild("t"), dbMod.limitToLast(limit));
        const h = dbMod.onValue(q, (snap) => cb(snap.exists() ? snap.val() : {}));
        return () => dbMod.off(q, "value", h);
      };

      MFAuth.sendRelationshipRequest = async (handle, startedAt) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const targetUid = await MFAuth.lookupUsername(handle);
        if (!targetUid) throw new Error("No one found with that username");
        if (targetUid === MFAuth.user.uid) throw new Error("That's you 🌸");
        const mine = await dbMod.get(dbMod.ref(db, `relationships/${MFAuth.user.uid}`));
        if (mine.exists()) throw new Error("Clear your current relationship status first");
        await dbMod.set(dbMod.ref(db, `relationshipRequests/${targetUid}/${MFAuth.user.uid}`), {
          fromName: MFAuth.name() || "someone",
          fromUsername: (MFAuth.profile && MFAuth.profile.username) || "",
          startedAt: Number(startedAt) || Date.now(),
          t: Date.now(),
        });
        await MFAuth.createNotification(targetUid, { id:`relationship_request_${MFAuth.user.uid}`, type:"relationship_request", icon:"♡", title:"Relationship request", body:`${MFAuth.name() || "Someone"} wants to show your relationship on their profile.`, link:"/account.html#relationship", sourceId:MFAuth.user.uid });
        return true;
      };
      MFAuth.acceptRelationshipRequest = async (fromUid) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const me = MFAuth.user.uid;
        const reqSnap = await dbMod.get(dbMod.ref(db, `relationshipRequests/${me}/${fromUid}`));
        if (!reqSnap.exists()) throw new Error("That request is gone");
        const req = reqSnap.val() || {};
        const them = await publicName(fromUid);
        const my = { name: MFAuth.name() || "someone", username: (MFAuth.profile && MFAuth.profile.username) || "" };
        const startedAt = Number(req.startedAt) || Date.now();
        await dbMod.update(dbMod.ref(db), {
          [`relationships/${me}`]: { partnerUid: fromUid, partnerName: them.name, partnerUsername: them.username, startedAt, t: Date.now() },
          [`relationships/${fromUid}`]: { partnerUid: me, partnerName: my.name, partnerUsername: my.username, startedAt, t: Date.now() },
          [`relationshipRequests/${me}/${fromUid}`]: null,
        });
        try { await dbMod.remove(dbMod.ref(db, `notifications/${me}/relationship_request_${fromUid}`)); } catch (_) {}
        await MFAuth.createNotification(fromUid, { id:`relationship_accepted_${me}`, type:"relationship_accepted", icon:"💗", title:"Relationship request accepted", body:`${my.name} accepted your relationship request.`, link:"/account.html#relationship", sourceId:me });
        return true;
      };
      MFAuth.declineRelationshipRequest = async (fromUid) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        await dbMod.remove(dbMod.ref(db, `relationshipRequests/${MFAuth.user.uid}/${fromUid}`));
        try { await dbMod.remove(dbMod.ref(db, `notifications/${MFAuth.user.uid}/relationship_request_${fromUid}`)); } catch (_) {}
      };
      MFAuth.clearRelationship = async () => {
        if (!MFAuth.user) throw new Error("Not signed in");
        const me = MFAuth.user.uid;
        const snap = await dbMod.get(dbMod.ref(db, `relationships/${me}`));
        const rel = snap.exists() ? snap.val() : null;
        const patch = { [`relationships/${me}`]: null };
        if (rel && rel.partnerUid) patch[`relationships/${rel.partnerUid}`] = null;
        await dbMod.update(dbMod.ref(db), patch);
      };
      MFAuth.watchMyRelationship = (cb) => {
        if (!MFAuth.user) return () => {};
        const r = dbMod.ref(db, `relationships/${MFAuth.user.uid}`);
        const h = dbMod.onValue(r, (snap) => cb(snap.exists() ? snap.val() : null));
        return () => dbMod.off(r, "value", h);
      };
      MFAuth.watchRelationshipRequests = (cb) => {
        if (!MFAuth.user) return () => {};
        const r = dbMod.ref(db, `relationshipRequests/${MFAuth.user.uid}`);
        const h = dbMod.onValue(r, (snap) => cb(snap.exists() ? snap.val() : {}));
        return () => dbMod.off(r, "value", h);
      };
      MFAuth.getRelationship = async (uid) => {
        try {
          const snap = await dbMod.get(dbMod.ref(db, `relationships/${uid}`));
          return snap.exists() ? snap.val() : null;
        } catch (e) { dbRead("getRelationship", e); return null; }
      };

      // ---- pet summaries (for the profile page) ----
      // Reads the user's bond index (userPets/$uid), then each pet record.
      // Returns [{ bondId, name, level, emoji, shared, withName }]. Safe to call
      // when signed out (returns []). Errors degrade to an empty list.
      const PET_STAGES = [
        { minLevel: 1, emoji: "🥚" }, { minLevel: 2, emoji: "🐣" },
        { minLevel: 5, emoji: "🦊" }, { minLevel: 10, emoji: "🌟" },
        { minLevel: 18, emoji: "🦄" },
      ];
      function petEmoji(p) {
        let e = "🥚";
        for (const st of PET_STAGES) if ((p.level || 1) >= st.minLevel) e = st.emoji;
        return e;
      }
      MFAuth.listMyPets = async () => {
        if (!MFAuth.user) return [];
        const uid = MFAuth.user.uid;
        try {
          const idxSnap = await dbMod.get(dbMod.ref(db, `userPets/${uid}`));
          if (!idxSnap.exists()) return [];
          const idx = idxSnap.val() || {};
          const out = [];
          for (const bondId of Object.keys(idx)) {
            try {
              const ps = await dbMod.get(dbMod.ref(db, `pets/${bondId}`));
              if (!ps.exists()) continue;
              const p = ps.val();
              const entry = idx[bondId] || {};
              let withName = "";
              if (entry.with) {
                try {
                  const wp = await dbMod.get(dbMod.ref(db, `users/${entry.with}`));
                  if (wp.exists()) withName = (wp.val().displayName) || "";
                } catch (_) {}
              }
              out.push({
                bondId,
                name: p.name || "Pip",
                level: p.level || 1,
                emoji: petEmoji(p),
                shared: entry.role === "shared",
                withName,
              });
            } catch (_) {}
          }
          // newest/strongest first
          out.sort((a, b) => b.level - a.level);
          return out;
        } catch (e) { dbRead("listMyPets", e); return []; }
      };

      // ---- presence (online + lastSeen) with optional "appear offline" ----
      // Appear-offline is a per-device privacy choice stored locally. When on,
      // we publish "offline" even while connected, so friends don't see us as
      // online and our typing indicators are suppressed. We can still see them.
      let _presenceUid = null;
      function readAppearOffline() {
        try { return localStorage.getItem("mf_appear_offline") === "1"; } catch (_) { return false; }
      }
      function publishPresence() {
        if (!_presenceUid) return;
        const stRef = dbMod.ref(db, `status/${_presenceUid}`);
        const invisible = readAppearOffline();
        // Always set onDisconnect to offline; while connected, online unless invisible.
        dbMod.onDisconnect(stRef).set({ state: "offline", last: dbMod.serverTimestamp() });
        dbMod.set(stRef, { state: invisible ? "offline" : "online", last: dbMod.serverTimestamp() });
      }
      function startPresence(uid) {
        _presenceUid = uid;
        const connRef = dbMod.ref(db, ".info/connected");
        dbMod.onValue(connRef, (snap) => { if (snap.val() === true) publishPresence(); });
      }

      MFAuth.getAppearOffline = readAppearOffline;
      MFAuth.setAppearOffline = (on) => {
        try { localStorage.setItem("mf_appear_offline", on ? "1" : "0"); } catch (_) {}
        publishPresence();           // re-publish immediately so the change is live
        return readAppearOffline();
      };

      // expose a status watcher for other modules (chat, profile view)
      MFAuth.watchStatus = (uid, cb) => {
        const stRef = dbMod.ref(db, `status/${uid}`);
        return dbMod.onValue(stRef, (snap) => cb(snap.exists() ? snap.val() : null));
      };

      // ---- typing indicators for DMs ----
      // Stored at dmTyping/{pairKey}/{uid} = timestamp — a SEPARATE node from
      // the messages (dm/{pairKey}/$msg), so the message subscription never
      // sees typing events. Set (throttled) while typing, cleared on stop/send.
      // Suppressed when appearing offline.
      MFAuth.setTyping = (pairKey, isTyping) => {
        if (!MFAuth.user || !pairKey) return;
        const tRef = dbMod.ref(db, `dmTyping/${pairKey}/${MFAuth.user.uid}`);
        try {
          if (isTyping && !readAppearOffline()) {
            const p = dbMod.set(tRef, dbMod.serverTimestamp());
            if (p && p.catch) p.catch(e => console.warn("[typing] write denied — is the dmTyping rule published?", e && e.message));
            try { dbMod.onDisconnect(tRef).remove(); } catch (_) {}  // best-effort cleanup
          } else {
            dbMod.remove(tRef);
          }
        } catch (err) { console.warn("setTyping failed", err); }
      };
      // Watch the OTHER person's typing flag. Calls cb(true/false). Treats a
      // stale timestamp (>6s old) as not-typing in case a clear was missed.
      MFAuth.watchTyping = (pairKey, otherUid, cb) => {
        const tRef = dbMod.ref(db, `dmTyping/${pairKey}/${otherUid}`);
        let timer = null;
        const unsub = dbMod.onValue(tRef, (snap) => {
          if (timer) { clearTimeout(timer); timer = null; }
          const t = snap.exists() ? snap.val() : 0;
          const fresh = t && (Date.now() - t < 6000);
          cb(!!fresh);
          if (fresh) timer = setTimeout(() => cb(false), 6000);  // auto-expire
        });
        return () => { if (timer) clearTimeout(timer); unsub(); };
      };

      // ---- auth state ----
      authMod.onAuthStateChanged(auth, async (user) => {
        MFAuth.user = user || null;
        if (user) {
          // Mark ready and emit right away using whatever we know, so pages
          // recognise the restored session instantly on load (no re-login
          // flash). The profile + presence load in the background and emit
          // again when they arrive.
          ready = true;
          MFAuth._emit();
          try { MFAuth.profile = await ensureProfile(user); } catch (_) {}
          try { await MFAuth.refreshBasicAchievements(); } catch (_) {}
          startPresence(user.uid);
          dbMod.onValue(dbMod.ref(db, `users/${user.uid}`), (snap) => {
            MFAuth.profile = snap.exists() ? snap.val() : MFAuth.profile;
            MFAuth._emit();
          });
          MFAuth._emit();
        } else {
          MFAuth.profile = null;
          ready = true;
          MFAuth._emit();
        }
      });

    } catch (err) {
      console.error("MFAuth init failed:", err);
      ready = true;
      MFAuth._emit();
    }
  })();

  window.MFAuth = MFAuth;
})();