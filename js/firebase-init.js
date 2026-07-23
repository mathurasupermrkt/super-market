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

  console.log("🔥 Firebase, Firestore & Auth Initialized Successfully!");
  window.dispatchEvent(new CustomEvent('firebase-ready'));
} catch (error) {
  console.error("🔥 Firebase Initialization Error:", error);
}
