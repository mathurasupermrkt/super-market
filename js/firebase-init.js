import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
  getFirestore,
  collection, getDocs, getDoc, doc, setDoc,
  query, where, addDoc, deleteDoc, orderBy, updateDoc, serverTimestamp,
  onSnapshot, limit, runTransaction, arrayUnion, writeBatch,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyCy-euC1CaVTejDj_cCQNgzyJ6uIZHJ0jM",
  authDomain: "mathura-quickmart-v2.firebaseapp.com",
  projectId: "mathura-quickmart-v2",
  storageBucket: "mathura-quickmart-v2.firebasestorage.app",
  messagingSenderId: "365937178136",
  appId: "1:365937178136:web:c3096783b0e1a47d0cb56d",
  measurementId: "G-B616KNRK78"
};

try {
  // Initialize Firebase — core only (App + Firestore + Auth + Functions)
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const functions = getFunctions(app);

  // ── ENVIRONMENT SEPARATION: REAL FIREBASE (DEFAULT) vs ISOLATED EMULATORS ──
  // By default, the application connects to Real Firebase Authentication and Real Cloud Firestore
  // on both local development (localhost / 127.0.0.1) and production (mathura-supermrkt.vercel.app).
  // This enables genuine Google OAuth sign-in (accounts.google.com) and authentic cloud token verification.
  //
  // To protect against split-brain states (mixing real Auth with local emulator Firestore),
  // emulators are never silently or partially connected.
  //
  // For isolated offline testing, local emulators can be explicitly enabled:
  // 1. window.__USE_FIREBASE_EMULATORS__ === true
  // 2. localStorage.getItem('mathura_use_emulators') === 'true'
  // 3. URL parameter: ?emulator=true
  const isLocalEnv = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const isExplicitEmulatorRequested = isLocalEnv && (
    (typeof window !== 'undefined' && window.__USE_FIREBASE_EMULATORS__ === true) ||
    (typeof window !== 'undefined' && window.location && new URLSearchParams(window.location.search).get('emulator') === 'true') ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('mathura_use_emulators') === 'true')
  );

  if (isExplicitEmulatorRequested) {
    if (!window._firebaseEmulatorsConnected) {
      try {
        const host = window.location.hostname;
        
        // 1. Connect Functions emulator (port 5001)
        connectFunctionsEmulator(functions, host, 5001);

        // 2. Connect Firestore emulator (port 8080)
        connectFirestoreEmulator(db, host, 8080);

        // 3. Connect Auth emulator (port 9099)
        connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });

        window._firebaseEmulatorsConnected = true;
        console.log(`🔒 [Isolated Emulator Mode] Connected to Firebase Emulators on ${host} (Functions:5001, Firestore:8080, Auth:9099)`);
      } catch (emuErr) {
        // FAIL CLOSED: Prevent any operations from leaking to production
        window.firebaseIsReady = false;
        console.error("🚨 [CRITICAL SAFETY ERROR] Failed to establish local emulator isolation:", emuErr);
        const errBanner = document.createElement('div');
        errBanner.id = 'emulator-isolation-error';
        errBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:#ffffff;padding:14px 20px;font-family:sans-serif;font-size:14px;font-weight:bold;z-index:999999;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        errBanner.innerHTML = '⚠️ LOCAL DEV ERROR: Firebase Emulator isolation failed. Operations halted to prevent accidental writes to production database. Ensure Firebase Emulators are running on ports 8080, 5001, and 9099.';
        if (document.body) {
          document.body.prepend(errBanner);
        } else {
          document.addEventListener('DOMContentLoaded', () => document.body.prepend(errBanner));
        }
        throw new Error(`EMULATOR_ISOLATION_FAILED: ${emuErr.message}`);
      }
    }
  } else {
    console.log(`🌐 [Live Firebase Mode] Connected directly to Real Firebase Project (${firebaseConfig.projectId}) — Real Google Sign-In & Cloud Firestore`);
  }

  // Expose Functions to window
  window.FirebaseFunctions = functions;
  window.FirebaseFunctionsFns = {
    httpsCallable,
    connectFunctionsEmulator
  };

  // Expose Firestore to window so existing vanilla JS can access it
  window.FirebaseApp = app;
  window.FirebaseDB = db;
  window.Firestore = {
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    query,
    where,
    addDoc,
    deleteDoc,
    orderBy,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    limit,
    runTransaction,
    arrayUnion,
    writeBatch,
    connectFirestoreEmulator
  };

  // Expose Auth instance and helper functions to window
  window.FirebaseAuth = auth;
  window.FirebaseAuthFns = {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    connectAuthEmulator
  };

  // Expose Storage instance and helper functions to window
  try {
    const storage = getStorage(app);
    window.FirebaseStorage = storage;
    window.FirebaseStorageFns = {
      ref,
      uploadBytes,
      uploadBytesResumable,
      getDownloadURL,
      deleteObject,
    };
    console.log("📦 Firebase Storage Initialized Successfully!");
  } catch (storageErr) {
    console.warn("Storage initialization notice:", storageErr);
  }

  // ✅ Fire 'firebase-ready' immediately — Auth, Firestore & Storage are available NOW
  console.log("🔥 Firebase, Firestore, Auth & Storage Initialized Successfully!");
  window.firebaseIsReady = true;
  window.dispatchEvent(new CustomEvent('firebase-ready'));

  // ── LAZY LOAD: Analytics & FCM (non-critical, loaded AFTER page is interactive) ──
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => _initDeferredModules(app));
  } else {
    setTimeout(() => _initDeferredModules(app), 2000);
  }

} catch (error) {
  console.error("🔥 Firebase Initialization Error:", error);
  window.firebaseIsReady = false;
}

/**
 * Load Analytics and FCM/Service Worker lazily.
 * These are heavy modules that are NOT needed for initial page render.
 */
async function _initDeferredModules(app) {
  // 1. Analytics — lazy import
  try {
    const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js");
    getAnalytics(app);
  } catch (e) {
    console.warn("Analytics load skipped:", e.message);
  }

  // 2. FCM & Service Worker Integration (uses unified PWA service worker)
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const { getMessaging, getToken } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging.js");
      const messaging = getMessaging(app);
      window.FirebaseMessaging = messaging;

      // User-action-based notification permission helper
      window.requestNotificationPermission = async () => {
        try {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            const token = await getToken(messaging, {
              vapidKey: "BGRe9OaQHPYN7yNIA7Fw_wtCX8BOCGfsEm2HPZfQ--gApStykz0JUDvoF8JWKIN9nzIP0j02-nSy0iF8DMqeEQk",
              serviceWorkerRegistration: registration
            });
            console.log("🔥 FCM Token obtained:", token);
            window.FCMToken = token;
            return token;
          }
        } catch (err) {
          console.warn("FCM Token request notice:", err.message);
        }
        return null;
      };

      // If notification permission was already granted in a previous session, fetch token
      if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
        window.requestNotificationPermission().catch(() => {});
      }
    } catch (fcmError) {
      console.warn("FCM setup skipped:", fcmError.message);
    }
  }
}
