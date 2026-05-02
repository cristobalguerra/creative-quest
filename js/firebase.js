import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, off } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBaTBrxfnbYz5edT-SxsG1qGraZhlwTyxQ",
  authDomain: "creative-quest-udem.firebaseapp.com",
  databaseURL: "https://creative-quest-udem-default-rtdb.firebaseio.com",
  projectId: "creative-quest-udem",
  storageBucket: "creative-quest-udem.firebasestorage.app",
  messagingSenderId: "8624766338",
  appId: "1:8624766338:web:3e0e733ce75be13949639b"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

window._fb = { db, ref, set, onValue, remove, off };
window._fbReady = true;
document.dispatchEvent(new Event('fb-ready'));
