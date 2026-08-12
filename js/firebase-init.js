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

  // ✅ Fire 'firebase-ready' immediately — Auth & Firestore are available NOW
  console.log("🔥 Firebase, Firestore & Auth Initialized Successfully!");
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

  // 2. FCM & Service Worker — lazy import
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      console.log("✅ Service Worker Registered");

      const { getMessaging, getToken } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging.js");
      const messaging = getMessaging(app);
      window.FirebaseMessaging = messaging;

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const token = await getToken(messaging, {
          vapidKey: "BGRe9OaQHPYN7yNIA7Fw_wtCX8BOCGfsEm2HPZfQ--gApStykz0JUDvoF8JWKIN9nzIP0j02-nSy0iF8DMqeEQk",
          serviceWorkerRegistration: registration
        });
        console.log("🔥 FCM Token:", token);
        window.FCMToken = token;
      } else {
        console.log("❌ Notification permission denied.");
      }
    } catch (fcmError) {
      console.warn("FCM/SW setup skipped:", fcmError.message);
    }
  }
}
