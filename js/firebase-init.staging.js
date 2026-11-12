// Mathura Quick Mart — Firebase Initialization (Staging)
// This file mirrors firebase-init.js but points to the staging Firebase project.
// Replace the placeholder values with the actual staging web‑app configuration
// obtained from the Firebase console (Settings → General → Your apps).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
  getFirestore,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import {
  getAuth,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";
import {
  getFunctions,
  connectFunctionsEmulator
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-functions.js";

// ---------------------------------------------------------------------------
// STAGING CONFIGURATION – replace the placeholders with real values!
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCsz2puyiJ7GyR9We4sf11cI_XxeNZ1cas",
  authDomain: "mathura-quick-mart-staging.firebaseapp.com",
  projectId: "mathura-quick-mart-staging",
  storageBucket: "mathura-quick-mart-staging.firebasestorage.app",
  messagingSenderId: "902584090641",
  appId: "1:902584090641:web:feea008413aeec290d31b0",
  measurementId: "G-FKF9SRHYLS"
};

try {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const functions = getFunctions(app);
  const storage = getStorage(app);

  // -----------------------------------------------------------------------
  // Environment separation – keep real services by default. Enable explicit
  // emulator mode with the same flags used in firebase-init.js (URL ?emulator)
  // -----------------------------------------------------------------------
  const isLocalEnv = typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const isExplicitEmulatorRequested = isLocalEnv && (
    (typeof window !== "undefined" && window.__USE_FIREBASE_EMULATORS__ === true) ||
    (typeof window !== "undefined" && window.location && new URLSearchParams(window.location.search).get("emulator") === "true") ||
    (typeof localStorage !== "undefined" && localStorage.getItem("mathura_use_emulators") === "true")
  );

  if (isExplicitEmulatorRequested) {
    const host = window.location.hostname;
    // Functions emulator (port 5001)
    connectFunctionsEmulator(functions, host, 5001);
    // Firestore emulator (port 8080)
    connectFirestoreEmulator(db, host, 8080);
    // Auth emulator (port 9099)
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    console.log("🔒 [Staging] Connected to Firebase Emulators on", host);
  } else {
    console.log("🌐 [Staging] Connected to real Firebase project", firebaseConfig.projectId);
  }

  // Expose globals for the rest of the app (same names as production init)
  window.FirebaseApp = app;
  window.FirebaseDB = db;
  window.Firestore = {
    collection: getFirestore().collection,
    getDocs: getFirestore().getDocs,
    getDoc: getFirestore().getDoc,
    doc: getFirestore().doc,
    setDoc: getFirestore().setDoc,
    query: getFirestore().query,
    where: getFirestore().where,
    addDoc: getFirestore().addDoc,
    deleteDoc: getFirestore().deleteDoc,
    orderBy: getFirestore().orderBy,
    updateDoc: getFirestore().updateDoc,
    serverTimestamp: getFirestore().serverTimestamp,
    onSnapshot: getFirestore().onSnapshot,
    limit: getFirestore().limit,
    runTransaction: getFirestore().runTransaction,
    arrayUnion: getFirestore().arrayUnion,
    writeBatch: getFirestore().writeBatch,
    connectFirestoreEmulator
  };

  window.FirebaseAuth = auth;
  window.FirebaseAuthFns = {
    signOut: auth.signOut,
    onAuthStateChanged: auth.onAuthStateChanged,
    // ... other auth helpers can be added as needed
    // Re‑export the same helpers as in the production init for compatibility
    createUserWithEmailAndPassword: auth.createUserWithEmailAndPassword,
    signInWithEmailAndPassword: auth.signInWithEmailAndPassword,
    GoogleAuthProvider: auth.GoogleAuthProvider,
    signInWithPopup: auth.signInWithPopup,
    signInWithRedirect: auth.signInWithRedirect,
    getRedirectResult: auth.getRedirectResult,
    connectAuthEmulator
  };

  window.FirebaseFunctions = functions;
  window.FirebaseStorage = storage;

  // Signal readiness – the app will listen for this event.
  window.firebaseIsReady = true;
  window.dispatchEvent(new CustomEvent('firebase-ready'));
} catch (error) {
  console.error("🔥 [Staging] Firebase Initialization Error:", error);
  window.firebaseIsReady = false;
  window.dispatchEvent(new CustomEvent('firebase-ready'));
}

// Lazy‑load Analytics & FCM – identical to production init (unchanged).
// The code below is copied from the production file to keep behaviour consistent.
async function _initDeferredModules(app) {
  // 1. Analytics – lazy import
  try {
    const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js");
    getAnalytics(app);
  } catch (e) {
    console.warn("Analytics load skipped:", e.message);
  }

  // 2. FCM – Service Worker Integration (uses the unified PWA SW)
let _stagingSWRegistration = null;

window.registerStagingSW = async () => {
  if (_stagingSWRegistration) return _stagingSWRegistration;
  try {
    _stagingSWRegistration = await navigator.serviceWorker.register('/service-worker.staging.js');
    console.log('[Staging] Service worker registered');
    return _stagingSWRegistration;
  } catch (e) {
    console.error('[Staging] Service worker registration failed:', e);
    throw e;
  }
};

window.requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const registration = await window.registerStagingSW();
    const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: 'BGHt_QYAUz_8JCI6lBxSGTxZISzlNdqMpy1aiaiOL342xswSjY4Bi_c9P-gsixumXgAbG4N3UmSzfzFU6_P2caM',
      serviceWorkerRegistration: registration
    });
    if (token) {
      console.log('🔥 FCM Token obtained (staging):', token);
    }
    return token;
  } catch (err) {
    console.warn('FCM Token request notice:', err.message);
    return null;
  }
};
}

if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => _initDeferredModules(window.FirebaseApp));
} else {
  setTimeout(() => _initDeferredModules(window.FirebaseApp), 2000);
}

