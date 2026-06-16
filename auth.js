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

      // ---- profile helpers ----
      async function loadProfile(uid) {
        try {
          const snap = await dbMod.get(dbMod.ref(db, `users/${uid}`));
          return snap.exists() ? snap.val() : null;
        } catch (_) { return null; }
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
        if (typeof fields.avatarEmoji === "string" && fields.avatarEmoji) {
          patch.avatarEmoji = fields.avatarEmoji.slice(0, 8);
          patch.avatarType = "emoji";
        }
        if (typeof fields.photoURL === "string" && fields.photoURL) {
          patch.photoURL = fields.photoURL.slice(0, 500);
          patch.avatarType = "photo";
        }
        if (!Object.keys(patch).length) return MFAuth.profile;
        try {
          await dbMod.update(dbMod.ref(db, `users/${MFAuth.user.uid}`), patch);
        } catch (err) {
          // Surface a useful message instead of Firebase's generic wording.
          const code = (err && err.code) || "";
          if (/permission/i.test(code) || /PERMISSION_DENIED/.test(err && err.message)) {
            throw new Error("Couldn't save — the database rules need updating (see database-rules.json).");
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
        return h;
      };
      MFAuth.lookupUsername = async (handle) => {
        const h = normHandle(handle);
        if (!h) return null;
        try {
          const snap = await dbMod.get(dbMod.ref(db, `usernames/${h}`));
          return snap.exists() ? snap.val() : null; // returns uid or null
        } catch (_) { return null; }
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
        return true;
      };
      MFAuth.declineFriendRequest = async (fromUid) => {
        if (!MFAuth.user) throw new Error("Not signed in");
        await dbMod.remove(dbMod.ref(db, `friendRequests/${MFAuth.user.uid}/${fromUid}`));
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
        catch (_) { return false; }
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

      // ---- presence (online + lastSeen) ----
      function startPresence(uid) {
        const stRef = dbMod.ref(db, `status/${uid}`);
        const connRef = dbMod.ref(db, ".info/connected");
        dbMod.onValue(connRef, (snap) => {
          if (snap.val() !== true) return;
          // On disconnect, mark offline with a timestamp; while connected, mark online.
          dbMod.onDisconnect(stRef).set({ state: "offline", last: dbMod.serverTimestamp() });
          dbMod.set(stRef, { state: "online", last: dbMod.serverTimestamp() });
        });
      }

      // expose a status watcher for other modules (chat, profile view)
      MFAuth.watchStatus = (uid, cb) => {
        const stRef = dbMod.ref(db, `status/${uid}`);
        return dbMod.onValue(stRef, (snap) => cb(snap.exists() ? snap.val() : null));
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
