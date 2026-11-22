// firebase-config.js
// Paste YOUR values from: Firebase Console > Project settings > General > Your apps > Web app > SDK setup (Config)
var firebaseConfig = {
  apiKey: "AIzaSyBQKuICiakdVzWUSaDnN97cYnVZ4CeQIjU",
  authDomain: "mr-ms-cics.firebaseapp.com",
  projectId: "mr-ms-cics",
  storageBucket: "mr-ms-cics.firebasestorage.app",
  messagingSenderId: "1039349613246",
  appId: "1:1039349613246:web:bc1830d9a97b0649f314ef",
  measurementId: "G-LTMB1RKXTL"
};

if (firebaseConfig.apiKey.indexOf("PASTE") === 0) {
  console.error("[firebase-config.js] Replace the placeholder values with your real Firebase config.");
}

firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();
