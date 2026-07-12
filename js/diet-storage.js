// Storage da dieta (checklist de refeições): 1 doc por usuário por dia.
// id = `${userId}_${date}`. Usa Firestore se configurado, senão localStorage.

import {
  db, isConfigured,
  doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp
} from "./firebase-config.js";

const COL = "diet_logs";
const LS_KEY = "habitos-diet-logs-v1";

const EMPTY = { breakfast: false, lunch: false, dinner: false };

function keyOf(userId, date) { return `${userId}_${date}`; }
function readLS() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
function writeLS(o) { localStorage.setItem(LS_KEY, JSON.stringify(o)); }
function pickMeals(d) { return { breakfast: !!d.breakfast, lunch: !!d.lunch, dinner: !!d.dinner }; }

// Refeições de um dia específico.
export async function getDietDay(userId, date) {
  if (isConfigured) {
    try {
      const s = await getDoc(doc(db, COL, keyOf(userId, date)));
      return s.exists() ? pickMeals(s.data()) : { ...EMPTY };
    } catch (e) {
      console.warn("getDietDay falhou (regras do Firestore?):", e);
      return { ...EMPTY };
    }
  }
  const all = readLS();
  return { ...EMPTY, ...pickMeals(all[keyOf(userId, date)] || {}) };
}

// Grava as refeições de um dia.
export async function setDietDay(userId, date, meals) {
  const clean = { userId, date, ...pickMeals(meals) };
  if (isConfigured) {
    await setDoc(doc(db, COL, keyOf(userId, date)), { ...clean, updatedAt: serverTimestamp() });
    return;
  }
  const all = readLS();
  all[keyOf(userId, date)] = clean;
  writeLS(all);
}

// Mapa date -> {breakfast,lunch,dinner} de todos os dias (pro histórico).
export async function getDietMap(userId) {
  const map = {};
  if (isConfigured) {
    try {
      const q = query(collection(db, COL), where("userId", "==", userId));
      const snap = await getDocs(q);
      snap.forEach((d) => { const v = d.data(); map[v.date] = pickMeals(v); });
    } catch (e) {
      console.warn("getDietMap falhou (regras do Firestore?):", e);
    }
    return map;
  }
  Object.values(readLS())
    .filter((v) => v.userId === userId)
    .forEach((v) => { map[v.date] = pickMeals(v); });
  return map;
}
