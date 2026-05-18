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

function enumerateDates(startISO, endISO) {
  const out = [];
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  const endD = new Date(ey, em - 1, ed);
  while (cursor <= endD) {
    out.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export async function getRange(userId, startDate, endDate) {
  if (isConfigured) {
    // Busca cada dia por ID direto — combina perfeitamente com a regra de segurança
    // (que valida `docId.matches(...)`) e não exige índice composto.
    const dates = enumerateDates(startDate, endDate);
    const snaps = await Promise.all(
      dates.map(date => getDoc(doc(db, COL, `${userId}_${date}`)))
    );
    return snaps.filter(s => s.exists()).map(s => s.data());
  }
  const all = readLS();
  return Object.values(all).filter(d =>
    d.userId === userId && d.date >= startDate && d.date <= endDate
  );
}

export const storageMode = isConfigured ? "firebase" : "local";
