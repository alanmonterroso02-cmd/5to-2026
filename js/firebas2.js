import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBy9aCg_mGyqnXJrq8xIsfZ2F99UhQv1Ew",
  authDomain: "docentes-f21b5.firebaseapp.com",
  projectId: "docentes-f21b5",
  storageBucket: "docentes-f21b5.firebasestorage.app",
  messagingSenderId: "1079465879902",
  appId: "1:1079465879902:web:14e5229ae400f67f4607cf",
  measurementId: "G-PMLYR4ZJC9"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };