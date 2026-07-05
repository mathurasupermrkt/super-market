import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, query, where, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCC-ukj-BTSbyDRg925wsJRT87yXe8Vp90",
  authDomain: "mathura-quickmart.firebaseapp.com",
  projectId: "mathura-quickmart",
  storageBucket: "mathura-quickmart.firebasestorage.app",
  messagingSenderId: "425559621596",
  appId: "1:425559621596:web:24c23825b929030c055919",
  measurementId: "G-GK8KQQKL9H"
};

try {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  const db = getFirestore(app);

  // Expose to window so our existing vanilla JS can access the db instance
  window.FirebaseDB = db;
  window.Firestore = { collection, getDocs, getDoc, doc, setDoc, query, where, addDoc, deleteDoc };

  console.log("🔥 Firebase & Firestore Initialized Successfully!");
  window.dispatchEvent(new CustomEvent('firebase-ready'));
} catch (error) {
  console.error("🔥 Firebase Initialization Error:", error);
}
