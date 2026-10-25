import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
  getFirestore,
  collection, getDocs, getDoc, doc, setDoc,
  query, where, addDoc, deleteDoc, orderBy, updateDoc, serverTimestamp,
  onSnapshot, limit, runTransaction, arrayUnion
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
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

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
  // Initialize Firebase — core only (App + Firestore + Auth)
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

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
