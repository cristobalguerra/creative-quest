import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, update, onValue, remove, off } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBEAH4I5Qp2yRFrZVh1t7716ParEAUoJUo",
  authDomain: "creative-quest-udem-381d9.firebaseapp.com",
  databaseURL: "https://creative-quest-udem-381d9-default-rtdb.firebaseio.com",
  projectId: "creative-quest-udem-381d9",
  storageBucket: "creative-quest-udem-381d9.firebasestorage.app",
  messagingSenderId: "1016652016470",
  appId: "1:1016652016470:web:ceaa2aab592bba253c84f7"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

window._fb = { db, ref, set, update, onValue, remove, off };
window._fbReady = true;
document.dispatchEvent(new Event('fb-ready'));
