// ============================================================
//  Firebase configuration
// ------------------------------------------------------------
//  1. Acesse https://console.firebase.google.com e crie um projeto
//     (pode chamar de "habitos-vini-vic" ou qualquer outro nome).
//  2. No projeto, clique no ícone </> (Web app) para registrar
//     um app web. Copie o objeto firebaseConfig que aparecer.
//  3. Cole as chaves abaixo, substituindo os placeholders.
//  4. No menu lateral do Firebase: Build > Firestore Database
//     > Create database > Start in test mode (ou production).
//     Em produção, ajuste as Rules (veja README.md).
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, setDoc, collection, query, where, getDocs,
  addDoc, deleteDoc, orderBy, onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-D0nMCeDIVvByW8oxaNapUJl2kkHmYHg",
  authDomain: "gymproject-12fff.firebaseapp.com",
  projectId: "gymproject-12fff",
  storageBucket: "gymproject-12fff.firebasestorage.app",
  messagingSenderId: "839126688806",
  appId: "1:839126688806:web:7cb3a46fad0ea85046f2e7"
};

export const isConfigured = !firebaseConfig.apiKey.includes("COLE_AQUI");

let _app = null;
let _db = null;
let _auth = null;

if (isConfigured) {
  _app = initializeApp(firebaseConfig);
  _db = getFirestore(_app);
  _auth = getAuth(_app);
  // Mantém sessão entre recarregamentos (default já é local, garantindo)
  setPersistence(_auth, browserLocalPersistence).catch(err => {
    console.error("persistence error:", err);
  });
}

export const db = _db;
export const auth = _auth;
export { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, deleteDoc, orderBy, onSnapshot, serverTimestamp, GoogleAuthProvider };
