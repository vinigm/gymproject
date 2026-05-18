// Helpers compartilhados entre páginas (pontos, recordes, placares, vic).
// Tudo aqui é puro — não toca DOM, não inicia nada.

import { POINTS } from "./points-config.js";
import { pointsForDay } from "./points-engine.js";
import { todayISO, USERS, APP_START_DATE } from "./app.js";

// --- formatadores genéricos -----------------------------------------
export const pad = (n) => String(n).padStart(2, "0");
export const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function fmtPts(n) {
  return `${n >= 0 ? "+" : ""}${n}`;
}
export function fmtDayFull(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const wkRaw = date.toLocaleDateString("pt-BR", { weekday: "long" });
  const wk = wkRaw.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return `${pad(d)}/${pad(m)}/${y} - ${wk}`;
}
export function fmtDayShort(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${pad(d)}/${pad(m)}/${y}`;
}
export function fmtWeekRange(startISO) {
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const dm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return `${dm(start)} – ${dm(end)}/${end.getFullYear()}`;
}
export function fmtMonth(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${MONTHS_PT[m - 1]} ${y}`;
}

// --- períodos -------------------------------------------------------
export function mondayOfWeek(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const offset = dow === 0 ? -6 : (1 - dow);
  date.setDate(date.getDate() + offset);
  return toISO(date);
}
export function weekStartISO() {
  return mondayOfWeek(todayISO());
}
export function monthStartISO() {
  const t = new Date();
  const first = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-01`;
  return first < APP_START_DATE ? APP_START_DATE : first;
}
function clampStart(iso) {
  return iso < APP_START_DATE ? APP_START_DATE : iso;
}
export function periodRange(period) {
  const end = todayISO();
  let start;
  if (period === "weekly")       start = weekStartISO();
  else if (period === "monthly") start = monthStartISO();
  else                           start = APP_START_DATE;
  return [clampStart(start), end];
}

export const PERIOD_LABELS = {
  weekly:  "esta semana",
  monthly: "este mês",
  all:     "total",
};

// --- breakdown (linha por categoria a partir de dias) ---------------
const EX_LABELS = {
  academia: "Academia", corrida: "Corrida", yoga: "Yoga",
  jiujitsu: "Jiu Jitsu", bicicleta: "Bicicleta",
};
const EXTRA_LABELS = {
  marmita: "Marmita", vegetais: "Vegetais", fruta: "Fruta",
  cafe: "Café manhã", mercado: "Mercado", escada: "Escada",
  leitura: "Leitura", conversa: "Conversa", skincare: "Skincare",
  suplemento: "Suplemento",
};

export function breakdownForDays(days) {
  const exerciseCounts = {};
  let waterDays = 0, waterPts = 0;
  let lunchClean = 0, lunchDirty = 0;
  let dinnerClean = 0, dinnerDirty = 0;
  let cigTotal = 0;
  let dessertNao = 0, dessertSim = 0;
  let sodaNao = 0, sodaSim = 0;
  const extrasCounts = {};

  for (const d of days) {
    for (const ex of (d.exercises || [])) {
      exerciseCounts[ex] = (exerciseCounts[ex] || 0) + 1;
    }
    for (const e of (d.extras || [])) {
      extrasCounts[e] = (extrasCounts[e] || 0) + 1;
    }
    if (d.water && POINTS.water?.[d.water] != null) {
      waterDays++;
      waterPts += POINTS.water[d.water];
    }
    if (d.lunch === "limpo") lunchClean++;
    else if (d.lunch === "sujo") lunchDirty++;
    if (d.dinner === "limpo") dinnerClean++;
    else if (d.dinner === "sujo") dinnerDirty++;
    if (d.cigarettes != null && d.cigarettes !== "") {
      cigTotal += Number(d.cigarettes);
    }
    if (d.dessert === "nao") dessertNao++;
    else if (d.dessert === "sim") dessertSim++;
    if (d.soda === "nao") sodaNao++;
    else if (d.soda === "sim") sodaSim++;
  }

  const lines = [];
  for (const [ex, count] of Object.entries(exerciseCounts)) {
    const ptsPer = POINTS.exercises?.[ex] || 0;
    if (count > 0 && ptsPer !== 0) {
      lines.push({ label: EX_LABELS[ex] || ex, count, pts: ptsPer * count, kind: ptsPer > 0 ? "good" : "bad" });
    }
  }
  if (waterDays > 0 && waterPts !== 0) {
    lines.push({ label: "Água", count: waterDays, pts: waterPts, kind: waterPts > 0 ? "good" : "bad" });
  }
  const mealRow = (label, c, pPer) => {
    if (c > 0 && pPer !== 0) lines.push({ label, count: c, pts: pPer * c, kind: pPer > 0 ? "good" : "bad" });
  };
  mealRow("Almoço limpo", lunchClean,  POINTS.meals?.lunch?.limpo  || 0);
  mealRow("Almoço sujo",  lunchDirty,  POINTS.meals?.lunch?.sujo   || 0);
  mealRow("Janta limpa",  dinnerClean, POINTS.meals?.dinner?.limpo || 0);
  mealRow("Janta suja",   dinnerDirty, POINTS.meals?.dinner?.sujo  || 0);
  if (cigTotal > 0 && (POINTS.cigarettes || 0) !== 0) {
    const pPer = POINTS.cigarettes;
    lines.push({ label: "Cigarros", count: cigTotal, pts: pPer * cigTotal, kind: pPer > 0 ? "good" : "bad" });
  }
  const yesNoRow = (label, c, pPer) => {
    if (c > 0 && pPer !== 0) lines.push({ label, count: c, pts: pPer * c, kind: pPer > 0 ? "good" : "bad" });
  };
  yesNoRow("Sem sobremesa",     dessertNao, POINTS.dessert?.nao || 0);
  yesNoRow("Sobremesa (sim)",   dessertSim, POINTS.dessert?.sim || 0);
  yesNoRow("Sem refrigerante",  sodaNao,    POINTS.soda?.nao || 0);
  yesNoRow("Refrigerante (sim)", sodaSim,   POINTS.soda?.sim || 0);
  for (const [key, count] of Object.entries(extrasCounts)) {
    const ptsPer = POINTS.extras?.[key] || 0;
    if (count > 0 && ptsPer !== 0) {
      lines.push({ label: EXTRA_LABELS[key] || key, count, pts: ptsPer * count, kind: ptsPer > 0 ? "good" : "bad" });
    }
  }
  lines.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "good" ? -1 : 1;
    return Math.abs(b.pts) - Math.abs(a.pts);
  });
  const total = lines.reduce((s, l) => s + l.pts, 0);
  return { lines, total };
}

export function breakdownByDay(days) {
  return [...days]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(d => {
      const { lines, total } = breakdownForDays([d]);
      return { date: d.date, lines, total };
    })
    .filter(b => b.lines.length > 0);
}

// --- agregações + recordes ------------------------------------------
export function aggregateByWeek(days) {
  const map = new Map();
  for (const d of days) {
    const wk = mondayOfWeek(d.date);
    map.set(wk, (map.get(wk) || 0) + pointsForDay(d));
  }
  return map;
}
export function aggregateByMonth(days) {
  const map = new Map();
  for (const d of days) {
    const month = d.date.slice(0, 7);
    map.set(month, (map.get(month) || 0) + pointsForDay(d));
  }
  return map;
}
export function getBestDay(userDays) {
  let best = null;
  for (const d of userDays) {
    const { lines, total } = breakdownForDays([d]);
    if (lines.length === 0) continue;
    if (!best || total > best.total) best = { date: d.date, total, lines };
  }
  return best;
}
export function getBestWeek(userDays) {
  const weeks = new Map();
  for (const d of userDays) {
    const wk = mondayOfWeek(d.date);
    if (!weeks.has(wk)) weeks.set(wk, []);
    weeks.get(wk).push(d);
  }
  let best = null;
  for (const [wkStart, days] of weeks) {
    const { lines, total } = breakdownForDays(days);
    if (lines.length === 0) continue;
    if (!best || total > best.total) best = { weekStart: wkStart, total, lines };
  }
  return best;
}
export function getBestMonth(userDays) {
  const months = new Map();
  for (const d of userDays) {
    const key = d.date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(d);
  }
  let best = null;
  for (const [key, days] of months) {
    const { lines, total } = breakdownForDays(days);
    if (lines.length === 0) continue;
    if (!best || total > best.total) best = { monthKey: key, total, lines };
  }
  return best;
}

// --- carga de dados de todos os usuários ----------------------------
import { getRange } from "./storage.js";

export async function loadAllData() {
  const end = todayISO();
  const start = APP_START_DATE;
  const results = await Promise.all(
    USERS.map(u => getRange(u, start, end).catch(() => []))
  );
  return Object.fromEntries(USERS.map((u, i) => [u, results[i]]));
}

// --- soma por período de UMA pessoa ---------------------------------
export function pointsInPeriod(userDays, period) {
  const [start, end] = periodRange(period);
  let total = 0;
  for (const d of userDays) {
    if (d.date >= start && d.date <= end) total += pointsForDay(d);
  }
  return total;
}

// --- ganho total da pessoa desde o início ---------------------------
export function totalEarnedByUser(userDays) {
  return userDays.reduce((s, d) => s + pointsForDay(d), 0);
}
