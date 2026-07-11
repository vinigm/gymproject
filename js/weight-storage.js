// Storage de peso (Kg Vivi): cada doc = 1 pesagem.
// Usa Firestore se configurado, senão localStorage.
// Altura fica em localStorage (raramente muda; default 1,63 m).

import {
  db, isConfigured,
  doc, collection, query, where, getDocs,
  addDoc, deleteDoc, serverTimestamp
} from "./firebase-config.js";

const COL = "weight_logs";
const LS_KEY = "habitos-weight-logs-v1";
const LS_HEIGHT_PREFIX = "habitos-weight-height-";
const LS_SEEDED_PREFIX = "habitos-weight-seeded-";

export const DEFAULT_HEIGHT_M = 1.63;

// ─── localStorage helpers ────────────────────────────────────────────
function readLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function writeLS(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

// ─── Pesagens ─────────────────────────────────────────────────────────
// entry: { userId, weight (kg), fasting (bool), date "YYYY-MM-DD", time "HH:MM", at (epoch ms) }
export async function addWeightEntry(entry) {
  const payload = {
    userId: entry.userId,
    weight: Number(entry.weight),
    fasting: !!entry.fasting,
    date: entry.date,
    time: entry.time || "",
    at: Number(entry.at) || Date.now(),
  };
  if (isConfigured) {
    const ref = await addDoc(collection(db, COL), { ...payload, created_at: serverTimestamp() });
    return { id: ref.id, ...payload };
  }
  const all = readLS();
  const rec = { id: `local-${Date.now()}-${Math.round(performance.now())}`, ...payload };
  all.push(rec);
  writeLS(all);
  return rec;
}

export async function getWeightEntries(userId) {
  if (isConfigured) {
    try {
      const q = query(collection(db, COL), where("userId", "==", userId));
      const snap = await getDocs(q);
      const out = [];
      snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
      out.sort((a, b) => (a.at || 0) - (b.at || 0));
      return out;
    } catch (err) {
      console.warn("getWeightEntries falhou (regras do Firestore?):", err);
      return [];
    }
  }
  return readLS().filter((e) => e.userId === userId).sort((a, b) => (a.at || 0) - (b.at || 0));
}

export async function deleteWeightEntry(userId, id) {
  if (isConfigured) {
    await deleteDoc(doc(db, COL, id));
    return;
  }
  writeLS(readLS().filter((e) => e.id !== id));
}

// ─── Altura (localStorage) ────────────────────────────────────────────
export function loadHeight(userId) {
  try {
    const raw = localStorage.getItem(LS_HEIGHT_PREFIX + userId);
    const h = raw ? Number(raw) : NaN;
    return h > 0 ? h : DEFAULT_HEIGHT_M;
  } catch { return DEFAULT_HEIGHT_M; }
}
export function saveHeight(userId, meters) {
  try { localStorage.setItem(LS_HEIGHT_PREFIX + userId, String(meters)); } catch {}
}

// ─── Seed inicial (uma vez) ───────────────────────────────────────────
export function wasSeeded(userId) {
  try { return localStorage.getItem(LS_SEEDED_PREFIX + userId) === "1"; }
  catch { return false; }
}
export function markSeeded(userId) {
  try { localStorage.setItem(LS_SEEDED_PREFIX + userId, "1"); } catch {}
}
