// Storage do Alongamento: sessões com timestamp + duração.
// Diferente do stretch_min no day-record (que é a duração pontual do dia),
// isso aqui guarda o HISTÓRICO completo — cada timer concluído vira 1 doc.

import {
  db, isConfigured,
  collection, query, where, getDocs, addDoc, serverTimestamp
} from "./firebase-config.js";

const COL = "stretch_sessions";
const LS_KEY = "habitos-stretch-sessions-v1";

function readLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function writeLS(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }

// payload: { userId, duration_min, completedAt? (ISO) }
export async function saveStretchSession({ userId, duration_min, completedAt }) {
  const iso = completedAt || new Date().toISOString();
  const payload = {
    userId,
    duration_min: Number(duration_min),
    completedAt: iso,
    date: iso.slice(0, 10),
  };
  if (isConfigured) {
    await addDoc(collection(db, COL), { ...payload, created_at: serverTimestamp() });
    return;
  }
  const all = readLS();
  all.push({ ...payload, id: `local-${Date.now()}` });
  writeLS(all);
}

export async function getStretchSessions(userId) {
  if (isConfigured) {
    try {
      const q = query(collection(db, COL), where("userId", "==", userId));
      const snap = await getDocs(q);
      const out = [];
      snap.forEach(d => out.push({ id: d.id, ...d.data() }));
      out.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
      return out;
    } catch (err) {
      console.warn("getStretchSessions falhou (regras do Firestore?):", err);
      return [];
    }
  }
  return readLS()
    .filter(s => s.userId === userId)
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
}
