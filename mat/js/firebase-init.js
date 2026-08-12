import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
  getFirestore,
  collection, getDocs, getDoc, doc, setDoc,
  query, where, addDoc, deleteDoc, orderBy, updateDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
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
  getMessaging,
  getToken
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging.js";

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
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Expose Firestore to window so existing vanilla JS can access it
  window.FirebaseApp = app;
  window.FirebaseDB = db;
  window.Firestore = {
    collection, getDocs, getDoc, doc, setDoc,
    query, where, addDoc, deleteDoc, orderBy, updateDoc,
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

  // Initialize Firebase Cloud Messaging & Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/firebase-messaging-sw.js")
      .then(async (registration) => {
        console.log("✅ Service Worker Registered");

        try {
          const messaging = getMessaging(app);
          window.FirebaseMessaging = messaging;

          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            const token = await getToken(messaging, {
              vapidKey: "BGRe9OaQHPYN7yNIA7Fw_wtCX8BOCGfsEm2HPZfQ--gApStykz0JUDvoF8JWKIN9nzIP0j02-nSy0iF8DMqeEQk",
              serviceWorkerRegistration: registration
            });
            console.log("🔥 FCM Token:");
            console.log(token);
            window.FCMToken = token;
          } else {
            console.log("❌ Notification permission denied.");
          }
        } catch (fcmError) {
          console.error("FCM Token Error:", fcmError);
        }
      })
      .catch(err => {
        console.error("Service Worker Error:", err);
      });
  }

  console.log("🔥 Firebase, Firestore & Auth Initialized Successfully!");
  window.dispatchEvent(new CustomEvent('firebase-ready'));
} catch (error) {
  console.error("🔥 Firebase Initialization Error:", error);
}
