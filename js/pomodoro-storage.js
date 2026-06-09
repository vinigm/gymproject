// Storage do Pomodoro: sessões + configuração por usuário.
// Usa Firestore se configurado, senão localStorage.

import {
  db, isConfigured,
  doc, getDoc, setDoc, collection, query, where, getDocs,
  addDoc, serverTimestamp
} from "./firebase-config.js";

const SES_COL = "pomodoro_sessions";   // cada doc = 1 sessão de foco completa
const CFG_COL = "pomodoro_config";     // 1 doc por usuário (id = userId)

const LS_SES_KEY = "habitos-pomodoro-sessions-v1";
const LS_CFG_PREFIX = "habitos-pomodoro-cfg-";

export const DEFAULT_POMODORO_CONFIG = {
  focus_min: 25,
  short_min: 5,
  long_min: 10,
  cycles_per_long: 3,
  categories: ["Trabalho", "Estudo"],
};

// ─── localStorage helpers ────────────────────────────────────────────
function readSesLS() {
  try { return JSON.parse(localStorage.getItem(LS_SES_KEY)) || []; }
  catch { return []; }
}
function writeSesLS(arr) {
  localStorage.setItem(LS_SES_KEY, JSON.stringify(arr));
}

// ─── Sessões ─────────────────────────────────────────────────────────
// payload: { userId, category, duration_min, completedAt? (ISO) }
export async function savePomodoroSession({ userId, category, duration_min, completedAt }) {
  const iso = completedAt || new Date().toISOString();
  const payload = {
    userId,
    category,
    duration_min: Number(duration_min),
    completedAt: iso,
    date: iso.slice(0, 10),
  };
  if (isConfigured) {
    await addDoc(collection(db, SES_COL), { ...payload, created_at: serverTimestamp() });
    return;
  }
  const all = readSesLS();
  all.push({ ...payload, id: `local-${Date.now()}` });
  writeSesLS(all);
}

export async function getPomodoroSessions(userId) {
  if (isConfigured) {
    try {
      const q = query(collection(db, SES_COL), where("userId", "==", userId));
      const snap = await getDocs(q);
      const out = [];
      snap.forEach(d => out.push({ id: d.id, ...d.data() }));
      out.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
      return out;
    } catch (err) {
      console.warn("getPomodoroSessions falhou (regras do Firestore?):", err);
      return [];
    }
  }
  return readSesLS()
    .filter(s => s.userId === userId)
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
}

// ─── Config por usuário ──────────────────────────────────────────────
export async function loadPomodoroConfig(userId) {
  if (isConfigured) {
    try {
      const snap = await getDoc(doc(db, CFG_COL, userId));
      const data = snap.exists() ? snap.data() : {};
      return { ...DEFAULT_POMODORO_CONFIG, ...data };
    } catch (e) {
      console.warn("loadPomodoroConfig falhou:", e);
      return { ...DEFAULT_POMODORO_CONFIG };
    }
  }
  try {
    const raw = localStorage.getItem(LS_CFG_PREFIX + userId);
    return { ...DEFAULT_POMODORO_CONFIG, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_POMODORO_CONFIG };
  }
}

export async function savePomodoroConfig(userId, cfg) {
  // só persiste as chaves conhecidas pra não vazar lixo
  const clean = {
    focus_min: Number(cfg.focus_min) || DEFAULT_POMODORO_CONFIG.focus_min,
    short_min: Number(cfg.short_min) || DEFAULT_POMODORO_CONFIG.short_min,
    long_min:  Number(cfg.long_min)  || DEFAULT_POMODORO_CONFIG.long_min,
    cycles_per_long: Number(cfg.cycles_per_long) || DEFAULT_POMODORO_CONFIG.cycles_per_long,
    categories: Array.isArray(cfg.categories) ? cfg.categories.filter(Boolean) : [],
    userId,
  };
  if (isConfigured) {
    await setDoc(doc(db, CFG_COL, userId), clean);
    return;
  }
  localStorage.setItem(LS_CFG_PREFIX + userId, JSON.stringify(clean));
}
