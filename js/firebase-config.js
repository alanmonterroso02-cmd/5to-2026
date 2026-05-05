import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvVZDfwi93SH3UNFaUZx9VWIDQGa5af8Y",
  authDomain: "promocion-2026-a6c13.firebaseapp.com",
  projectId: "promocion-2026-a6c13",
  storageBucket: "promocion-2026-a6c13.firebasestorage.app",
  messagingSenderId: "1090245305436",
  appId: "1:1090245305436:web:66f1fac982ba80dc643299",
  measurementId: "G-K8GJ0F7SFR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };