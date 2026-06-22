// Storage de Presença (status do escritório): 1 doc por usuário (id = userId).
// Modelo simples: { ocupado: bool }. Ocupado = vermelho; senão = disponível (verde).
// Usa Firestore com sincronização em TEMPO REAL (onSnapshot) quando configurado,
// senão cai pra localStorage (sincroniza só entre abas do mesmo navegador).

import {
  db, isConfigured,
  doc, setDoc, onSnapshot, serverTimestamp
} from "./firebase-config.js";

const COL = "presence";                 // cada doc = status atual de 1 pessoa
const LS_PREFIX = "habitos-presence-";  // fallback local

function lsKey(userId) { return LS_PREFIX + userId; }

function readLS(userId) {
  try {
    const raw = localStorage.getItem(lsKey(userId));
    return !!(raw ? JSON.parse(raw).ocupado : false);
  } catch {
    return false;
  }
}

// Grava se a pessoa está ocupada (true) ou disponível (false).
export async function setPresence(userId, ocupado) {
  const val = !!ocupado;
  if (isConfigured) {
    await setDoc(doc(db, COL, userId), {
      userId,
      ocupado: val,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  localStorage.setItem(lsKey(userId), JSON.stringify({
    userId, ocupado: val, updatedAt: new Date().toISOString(),
  }));
  // storage event não dispara na própria aba — avisa manualmente
  window.dispatchEvent(new CustomEvent("presence-local", { detail: { userId, ocupado: val } }));
}

// Assina mudanças do status de uma pessoa. Chama cb(ocupado) na hora e a cada update.
// Retorna uma função pra cancelar a assinatura.
export function subscribePresence(userId, cb) {
  if (isConfigured) {
    return onSnapshot(
      doc(db, COL, userId),
      (snap) => cb(snap.exists() ? !!snap.data().ocupado : false),
      (err) => {
        console.warn("subscribePresence falhou (regras do Firestore?):", err);
        cb(false);
      }
    );
  }
  // Fallback localStorage: estado inicial + escuta outras abas (storage) e a própria (custom)
  cb(readLS(userId));
  const onStorage = (e) => { if (e.key === lsKey(userId)) cb(readLS(userId)); };
  const onLocal = (e) => { if (e.detail && e.detail.userId === userId) cb(!!e.detail.ocupado); };
  window.addEventListener("storage", onStorage);
  window.addEventListener("presence-local", onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("presence-local", onLocal);
  };
}
