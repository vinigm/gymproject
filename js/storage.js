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
  doc, getDoc, setDoc, collection, query, where, getDocs,
  addDoc, deleteDoc, orderBy, serverTimestamp
} from "./firebase-config.js";

const LS_KEY = "habitos-days-v1";
const LS_TX_KEY = "habitos-transactions-v1";
const COL = "days";
const TX_COL = "transactions";

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

// ===== Transações (carteira / resgate de prêmios) =====
// Cada doc representa um resgate de recompensa.
// scope:
//   "shared"            → desconta do saldo conjunto (futuro)
//   "personal-victoria" → desconta só do saldo pessoal da Vic
//   "personal-vinicius" → idem pro Vini (futuro)
//
// Estrutura:
//   { scope, item, price, note?, created_at }

function readTxLS() {
  try { return JSON.parse(localStorage.getItem(LS_TX_KEY)) || []; }
  catch { return []; }
}
function writeTxLS(arr) {
  localStorage.setItem(LS_TX_KEY, JSON.stringify(arr));
}

export async function addTransaction({ scope, item, price, note }) {
  const payload = {
    scope, item, price: Number(price),
    note: note || null,
  };
  if (isConfigured) {
    await addDoc(collection(db, TX_COL), {
      ...payload,
      created_at: serverTimestamp(),
    });
    return;
  }
  const all = readTxLS();
  all.push({ ...payload, id: `local-${Date.now()}`, created_at: new Date().toISOString() });
  writeTxLS(all);
}

export async function getTransactions({ scope } = {}) {
  if (isConfigured) {
    let q;
    if (scope) {
      q = query(collection(db, TX_COL), where("scope", "==", scope));
    } else {
      q = collection(db, TX_COL);
    }
    const snap = await getDocs(q);
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    // ordenar por created_at desc; serverTimestamp pode vir como Timestamp
    out.sort((a, b) => {
      const ta = a.created_at?.toMillis ? a.created_at.toMillis() : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const tb = b.created_at?.toMillis ? b.created_at.toMillis() : (b.created_at ? new Date(b.created_at).getTime() : 0);
      return tb - ta;
    });
    return out;
  }
  const all = readTxLS();
  return all
    .filter(t => !scope || t.scope === scope)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function deleteTransaction(id) {
  if (isConfigured) {
    await deleteDoc(doc(db, TX_COL, id));
    return;
  }
  const all = readTxLS().filter(t => t.id !== id);
  writeTxLS(all);
}
