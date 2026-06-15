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
      const auth = authMod.getAuth(app);
      const db = dbMod.getDatabase(app);
      try { await authMod.setPersistence(auth, authMod.browserLocalPersistence); } catch (_) {}

      mods = { appMod, authMod, dbMod, app, auth, db };
      MFAuth.db = db; // expose shared db so chat.js etc. reuse one connection

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

      // ---- auth state ----
      authMod.onAuthStateChanged(auth, async (user) => {
        MFAuth.user = user || null;
        if (user) {
          MFAuth.profile = await ensureProfile(user);
          // keep a presence-ish lastSeen fresh, and watch our own profile live
          dbMod.onValue(dbMod.ref(db, `users/${user.uid}`), (snap) => {
            MFAuth.profile = snap.exists() ? snap.val() : MFAuth.profile;
            MFAuth._emit();
          });
        } else {
          MFAuth.profile = null;
        }
        ready = true;
        MFAuth._emit();
      });

    } catch (err) {
      console.error("MFAuth init failed:", err);
      ready = true;
      MFAuth._emit();
    }
  })();

  window.MFAuth = MFAuth;
})();
