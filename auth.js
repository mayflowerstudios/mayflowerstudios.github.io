/* auth.js — Mayflower Studios
 *
 * Shared authentication + user-profile layer for the whole site.
 *
 * Uses Firebase Authentication (email/password + Google) and Cloud Firestore.
 * IMPORTANT — why this is the secure approach on a static host:
 *   - Passwords are never stored by us. Firebase Auth hashes + verifies them
 *     on Google's servers; we only ever see an opaque signed-in user object.
 *   - Firestore encrypts data at rest automatically.
 *   - Who can read/write what is enforced by Firestore Security Rules, which
 *     run on Google's servers — NOT by this client code. So even though this
 *     file is public, a signed-in user can only touch their own document.
 *
 * Do NOT add any "secret" or "encryption key" to this file expecting it to be
 * hidden. Everything here ships to the browser and is readable by anyone. The
 * security comes entirely from Firebase Auth + Security Rules.
 *
 * Exposes a small global: window.MFAuth
 */
(function () {
  // Same Firebase project as Watch Together. If you later split projects,
  // only this block changes.
  const firebaseConfig = {
    apiKey: "AIzaSyDVJ0Tiq0gimaB-epcD9HQlVBrOWHq-IXI",
    authDomain: "watchtogether-95d7d.firebaseapp.com",
    databaseURL: "https://watchtogether-95d7d-default-rtdb.firebaseio.com",
    projectId: "watchtogether-95d7d",
  };

  const READY = !firebaseConfig.apiKey.startsWith("REPLACE");

  // State + listeners
  let app = null, auth = null, db = null;
  let currentUser = null;       // raw Firebase user (or null)
  let currentProfile = null;    // Firestore profile doc (or null)
  let ready = false;            // first auth state has resolved
  const listeners = new Set();  // fn(user, profile) called on every change

  // Lazily-imported SDK functions, filled in init()
  let _fb = {};

  function notify() {
    listeners.forEach(fn => {
      try { fn(currentUser, currentProfile); } catch (e) { console.error(e); }
    });
  }

  async function init() {
    if (!READY) { ready = true; notify(); return; }
    try {
      const appMod  = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      const authMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      const fsMod   = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

      _fb = {
        createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
        signInWithEmailAndPassword:     authMod.signInWithEmailAndPassword,
        signInWithPopup:                authMod.signInWithPopup,
        GoogleAuthProvider:             authMod.GoogleAuthProvider,
        signOut:                        authMod.signOut,
        updateProfile:                  authMod.updateProfile,
        sendPasswordResetEmail:         authMod.sendPasswordResetEmail,
        onAuthStateChanged:             authMod.onAuthStateChanged,
        doc:    fsMod.doc,
        getDoc: fsMod.getDoc,
        setDoc: fsMod.setDoc,
        serverTimestamp: fsMod.serverTimestamp,
      };

      app  = appMod.initializeApp(firebaseConfig);
      auth = authMod.getAuth(app);
      db   = fsMod.getFirestore(app);

      _fb.onAuthStateChanged(auth, async (user) => {
        currentUser = user || null;
        currentProfile = user ? await loadOrCreateProfile(user) : null;
        ready = true;
        notify();
      });
    } catch (err) {
      console.error("Auth init failed:", err);
      ready = true;
      notify();
    }
  }

  // Fetch the user's profile doc; create a default one on first sign-in.
  async function loadOrCreateProfile(user) {
    try {
      const refDoc = _fb.doc(db, "users", user.uid);
      const snap = await _fb.getDoc(refDoc);
      if (snap.exists()) return snap.data();
      const profile = {
        uid: user.uid,
        displayName: user.displayName || (user.email ? user.email.split("@")[0] : "Member"),
        email: user.email || null,
        photoURL: user.photoURL || null,
        createdAt: _fb.serverTimestamp(),
      };
      await _fb.setDoc(refDoc, profile);
      return profile;
    } catch (err) {
      console.error("Profile load/create failed:", err);
      return null;
    }
  }

  function mapError(err) {
    const code = (err && err.code) || "";
    const m = {
      "auth/email-already-in-use": "That email already has an account — try signing in.",
      "auth/invalid-email": "That doesn't look like a valid email.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/invalid-credential": "Email or password didn't match.",
      "auth/wrong-password": "Email or password didn't match.",
      "auth/user-not-found": "No account with that email yet.",
      "auth/popup-closed-by-user": "Sign-in window closed before finishing.",
      "auth/popup-blocked": "Your browser blocked the sign-in popup.",
      "auth/too-many-requests": "Too many tries — wait a bit and retry.",
      "auth/network-request-failed": "Network problem — check your connection.",
    };
    return m[code] || (err && err.message) || "Something went wrong.";
  }

  // ---- public API ----
  const MFAuth = {
    isConfigured() { return READY; },
    isReady() { return ready; },
    user() { return currentUser; },
    profile() { return currentProfile; },

    // Subscribe to auth changes. Fires immediately if state already known.
    // Returns an unsubscribe function.
    onChange(fn) {
      listeners.add(fn);
      if (ready) { try { fn(currentUser, currentProfile); } catch (e) { console.error(e); } }
      return () => listeners.delete(fn);
    },

    async signUp(email, password, displayName) {
      if (!READY) throw new Error("Auth isn't configured yet.");
      try {
        const cred = await _fb.createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          try { await _fb.updateProfile(cred.user, { displayName }); } catch (_) {}
        }
        return cred.user;
      } catch (err) { throw new Error(mapError(err)); }
    },

    async signIn(email, password) {
      if (!READY) throw new Error("Auth isn't configured yet.");
      try {
        const cred = await _fb.signInWithEmailAndPassword(auth, email, password);
        return cred.user;
      } catch (err) { throw new Error(mapError(err)); }
    },

    async signInGoogle() {
      if (!READY) throw new Error("Auth isn't configured yet.");
      try {
        const provider = new _fb.GoogleAuthProvider();
        const cred = await _fb.signInWithPopup(auth, provider);
        return cred.user;
      } catch (err) { throw new Error(mapError(err)); }
    },

    async resetPassword(email) {
      if (!READY) throw new Error("Auth isn't configured yet.");
      try { await _fb.sendPasswordResetEmail(auth, email); }
      catch (err) { throw new Error(mapError(err)); }
    },

    async signOut() {
      if (!READY) return;
      try { await _fb.signOut(auth); } catch (err) { console.error(err); }
    },

    // Update the signed-in user's profile fields (e.g. { displayName }).
    async updateProfile(fields) {
      if (!READY || !currentUser) throw new Error("Not signed in.");
      try {
        const refDoc = _fb.doc(db, "users", currentUser.uid);
        await _fb.setDoc(refDoc, fields, { merge: true });
        if (fields.displayName) {
          try { await _fb.updateProfile(currentUser, { displayName: fields.displayName }); } catch (_) {}
        }
        currentProfile = Object.assign({}, currentProfile, fields);
        notify();
        return currentProfile;
      } catch (err) { throw new Error(mapError(err)); }
    },
  };

  window.MFAuth = MFAuth;
  init();
})();
