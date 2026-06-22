// Storage de Presença (status do escritório): 1 doc por usuário (id = userId).
// Usa Firestore com sincronização em TEMPO REAL (onSnapshot) quando configurado,
// senão cai pra localStorage (sincroniza só entre abas do mesmo navegador).

import {
  db, isConfigured,
  doc, setDoc, onSnapshot, serverTimestamp
} from "./firebase-config.js";

const COL = "presence";                 // cada doc = status atual de 1 pessoa
const LS_PREFIX = "habitos-presence-";  // fallback local

// Estados possíveis. "livre" = neutro (sem sinal aceso).
export const STATUSES = ["livre", "ocupado", "pode_falar"];

function lsKey(userId) { return LS_PREFIX + userId; }

function readLS(userId) {
  try {
    const raw = localStorage.getItem(lsKey(userId));
    const data = raw ? JSON.parse(raw) : {};
    return STATUSES.includes(data.status) ? data.status : "livre";
  } catch {
    return "livre";
  }
}

// Grava o status atual da pessoa.
export async function setPresence(userId, status) {
  const clean = STATUSES.includes(status) ? status : "livre";
  if (isConfigured) {
    await setDoc(doc(db, COL, userId), {
      userId,
      status: clean,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  localStorage.setItem(lsKey(userId), JSON.stringify({
    userId, status: clean, updatedAt: new Date().toISOString(),
  }));
  // storage event não dispara na própria aba — avisa manualmente
  window.dispatchEvent(new CustomEvent("presence-local", { detail: { userId, status: clean } }));
}

// Assina mudanças do status de uma pessoa. Chama cb(status) na hora e a cada update.
// Retorna uma função pra cancelar a assinatura.
export function subscribePresence(userId, cb) {
  if (isConfigured) {
    return onSnapshot(
      doc(db, COL, userId),
      (snap) => {
        const status = snap.exists() ? snap.data().status : "livre";
        cb(STATUSES.includes(status) ? status : "livre");
      },
      (err) => {
        console.warn("subscribePresence falhou (regras do Firestore?):", err);
        cb("livre");
      }
    );
  }
  // Fallback localStorage: estado inicial + escuta outras abas (storage) e a própria (custom)
  cb(readLS(userId));
  const onStorage = (e) => { if (e.key === lsKey(userId)) cb(readLS(userId)); };
  const onLocal = (e) => { if (e.detail && e.detail.userId === userId) cb(e.detail.status); };
  window.addEventListener("storage", onStorage);
  window.addEventListener("presence-local", onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("presence-local", onLocal);
  };
}
