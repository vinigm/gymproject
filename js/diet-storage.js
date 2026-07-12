// Storage da dieta: 1 doc por usuário por dia (id = `${userId}_${date}`).
// Guarda um mapa `foods`: { "<refeição>.<alimento>": quantidade }.
// Ex.: { "cafe.ovo": 2, "almoco.arroz": 100 }. Ausência = não comeu.

import {
  db, isConfigured,
  doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp
} from "./firebase-config.js";

const COL = "diet_logs";
const LS_KEY = "habitos-diet-logs-v1";

function keyOf(userId, date) { return `${userId}_${date}`; }
function readLS() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
function writeLS(o) { localStorage.setItem(LS_KEY, JSON.stringify(o)); }
function cleanFoods(foods) {
  const out = {};
  Object.keys(foods || {}).forEach((k) => {
    const v = Number(foods[k]);
    if (v > 0) out[k] = v;
  });
  return out;
}

// Alimentos marcados num dia (mapa foods).
export async function getDietDay(userId, date) {
  if (isConfigured) {
    try {
      const s = await getDoc(doc(db, COL, keyOf(userId, date)));
      return s.exists() ? cleanFoods(s.data().foods) : {};
    } catch (e) {
      console.warn("getDietDay falhou (regras do Firestore?):", e);
      return {};
    }
  }
  const all = readLS();
  return cleanFoods((all[keyOf(userId, date)] || {}).foods);
}

// Grava o mapa de alimentos do dia.
export async function setDietDay(userId, date, foods) {
  const clean = cleanFoods(foods);
  if (isConfigured) {
    await setDoc(doc(db, COL, keyOf(userId, date)), { userId, date, foods: clean, updatedAt: serverTimestamp() });
    return;
  }
  const all = readLS();
  all[keyOf(userId, date)] = { userId, date, foods: clean };
  writeLS(all);
}

// Mapa date -> foods de todos os dias (pro histórico).
export async function getDietMap(userId) {
  const map = {};
  if (isConfigured) {
    try {
      const q = query(collection(db, COL), where("userId", "==", userId));
      const snap = await getDocs(q);
      snap.forEach((d) => { const v = d.data(); map[v.date] = cleanFoods(v.foods); });
    } catch (e) {
      console.warn("getDietMap falhou (regras do Firestore?):", e);
    }
    return map;
  }
  Object.values(readLS())
    .filter((v) => v.userId === userId)
    .forEach((v) => { map[v.date] = cleanFoods(v.foods); });
  return map;
}
