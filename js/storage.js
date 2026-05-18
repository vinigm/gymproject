// Storage layer: usa Firestore se configurado, senão localStorage.
// Modelo do documento (chave: `${userId}_${YYYY-MM-DD}`):
// {
//   userId: 'vinicius' | 'victoria',
//   date: 'YYYY-MM-DD',
//   exercises: string[],
//   water:  '1L' | '1.5L' | '2L' | null,
//   lunch:  'limpo' | 'sujo' | null,
//   dinner: 'limpo' | 'sujo' | null,
//   updatedAt: timestamp
// }

import {
  db, isConfigured,
  doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp
} from "./firebase-config.js";

const LS_KEY = "habitos-days-v1";
const COL = "days";

function readLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function writeLS(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

function emptyDay(userId, date) {
  return {
    userId, date,
    exercises: [],
    water: null,
    lunch: null,
    dinner: null,
    updatedAt: null
  };
}

export function dayKey(userId, date) {
  return `${userId}_${date}`;
}

export async function getDay(userId, date) {
  const key = dayKey(userId, date);
  if (isConfigured) {
    const snap = await getDoc(doc(db, COL, key));
    return snap.exists() ? snap.data() : emptyDay(userId, date);
  }
  const all = readLS();
  return all[key] || emptyDay(userId, date);
}

export async function saveDay(userId, date, data) {
  const key = dayKey(userId, date);
  const payload = { ...data, userId, date };
  if (isConfigured) {
    await setDoc(doc(db, COL, key), { ...payload, updatedAt: serverTimestamp() });
    return;
  }
  const all = readLS();
  all[key] = { ...payload, updatedAt: new Date().toISOString() };
  writeLS(all);
}

export async function getRange(userId, startDate, endDate) {
  // startDate / endDate são strings YYYY-MM-DD inclusivas
  if (isConfigured) {
    const q = query(
      collection(db, COL),
      where("userId", "==", userId),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );
    const snap = await getDocs(q);
    const out = [];
    snap.forEach(d => out.push(d.data()));
    return out;
  }
  const all = readLS();
  return Object.values(all).filter(d =>
    d.userId === userId && d.date >= startDate && d.date <= endDate
  );
}

export const storageMode = isConfigured ? "firebase" : "local";
