// Storage da dieta: 1 doc por usuário por dia (id = `${userId}_${date}`).
// Guarda um mapa `foods`: { "<refeição>.<alimento>": quantidade }.
// Ex.: { "cafe.ovo": 2, "almoco.arroz": 100 }. Ausência = não comeu.

import {
  db, isConfigured,
  doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp
} from "./firebase-config.js";
import { normalizeViniDietDay } from "./vini-diet-plan.js";

const COL = "diet_logs";
const LS_KEY = "habitos-diet-logs-v1";
const VINI_DIET_PLAN_START_DATE = "2026-07-15";

function keyOf(userId, date) { return `${userId}_${date}`; }
function readLS() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
function writeLS(o) { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch {} }
function writeLocalPlanDay(userId, date, plan, { pendingSync = false } = {}) {
  const all = readLS();
  all[keyOf(userId, date)] = {
    ...(all[keyOf(userId, date)] || {}),
    userId,
    date,
    plan,
    planVersion: plan.version,
    planPendingSync: pendingSync,
  };
  writeLS(all);
}
function localPlanEntry(userId, date) {
  return readLS()[keyOf(userId, date)] || {};
}
function markLocalPlanSynced(userId, date, plan) {
  const cached = localPlanEntry(userId, date);
  if (!cached.plan) return;
  const cachedPlan = normalizeViniDietDay(cached.plan);
  if (JSON.stringify(cachedPlan) !== JSON.stringify(plan)) return;
  writeLocalPlanDay(userId, date, cachedPlan);
}
function localPlanMap(userId) {
  const map = {};
  Object.values(readLS())
    .filter((value) => value.userId === userId && value.date && value.plan)
    .forEach((value) => { map[value.date] = normalizeViniDietDay(value.plan); });
  return map;
}
function isoDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (current <= end) {
    dates.push([
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, "0"),
      String(current.getDate()).padStart(2, "0"),
    ].join("-"));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
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
    await setDoc(
      doc(db, COL, keyOf(userId, date)),
      { userId, date, foods: clean, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return;
  }
  const all = readLS();
  all[keyOf(userId, date)] = { ...(all[keyOf(userId, date)] || {}), userId, date, foods: clean };
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

// ─── Plano alimentar estruturado do Vini ────────────────────────────
// O campo `plan` vive no mesmo documento diário que o mapa legado
// `foods`. As gravações usam merge para preservar os dois formatos.

export async function getViniDietPlanDay(userId, date) {
  const cached = localPlanEntry(userId, date);
  const local = normalizeViniDietDay(cached.plan);
  if (isConfigured) {
    try {
      const s = await getDoc(doc(db, COL, keyOf(userId, date)));
      if (!s.exists() || !s.data().plan) return local;
      if (cached.plan && cached.planPendingSync) return local;
      const remote = normalizeViniDietDay(s.data().plan);
      writeLocalPlanDay(userId, date, remote);
      return remote;
    } catch (e) {
      console.warn("getViniDietPlanDay falhou (regras do Firestore?):", e);
      return local;
    }
  }
  return local;
}

export function cacheViniDietPlanDay(userId, date, plan) {
  writeLocalPlanDay(userId, date, normalizeViniDietDay(plan), { pendingSync: isConfigured });
}

export async function setViniDietPlanDay(userId, date, plan) {
  const clean = normalizeViniDietDay(plan);
  // Salva no browser antes da sincronização remota para não perder marcações
  // quando a conexão cai ou as regras do Firestore recusam a gravação.
  cacheViniDietPlanDay(userId, date, clean);
  if (isConfigured) {
    await setDoc(
      doc(db, COL, keyOf(userId, date)),
      { userId, date, plan: clean, planVersion: clean.version, updatedAt: serverTimestamp() },
      { merge: true }
    );
    // Só confirma a versão que acabou de subir. Uma marcação mais nova pode
    // já estar no cache enquanto esta escrita aguardava a rede.
    markLocalPlanSynced(userId, date, clean);
    return;
  }
  writeLocalPlanDay(userId, date, clean);
}

export async function getViniDietPlanMap(userId) {
  // O cache local entra primeiro; dados remotos mais recentes prevalecem.
  const map = localPlanMap(userId);
  if (isConfigured) {
    try {
      const q = query(collection(db, COL), where("userId", "==", userId));
      const snap = await getDocs(q);
      snap.forEach((entry) => {
        const value = entry.data();
        if (!value.date || !value.plan) return;
        const cached = localPlanEntry(userId, value.date);
        if (cached.plan && cached.planPendingSync) return;
        const remote = normalizeViniDietDay(value.plan);
        map[value.date] = remote;
        writeLocalPlanDay(userId, value.date, remote);
      });
    } catch (e) {
      console.warn("getViniDietPlanMap falhou (regras do Firestore?); tentando leitura direta:", e);
      // Algumas regras aceitam o ID determinístico, mas não a consulta por
      // userId. Reconstrói o histórico em lotes, sem descartar o cache local.
      const dates = isoDateRange(VINI_DIET_PLAN_START_DATE, todayISO());
      for (let index = 0; index < dates.length; index += 20) {
        const batch = dates.slice(index, index + 20);
        const entries = await Promise.all(batch.map(async (date) => {
          try {
            const snapshot = await getDoc(doc(db, COL, keyOf(userId, date)));
            return snapshot.exists() && snapshot.data().plan
              ? [date, normalizeViniDietDay(snapshot.data().plan)]
              : null;
          } catch {
            return null;
          }
        }));
        entries.filter(Boolean).forEach(([date, plan]) => {
          const cached = localPlanEntry(userId, date);
          if (cached.plan && cached.planPendingSync) return;
          map[date] = plan;
          writeLocalPlanDay(userId, date, plan);
        });
      }
    }
    return map;
  }
  return map;
}
