// Página de estatísticas — Vini e Vivi numa página só, com toggle no topo.

import { todayISO, APP_START_DATE, USERS } from "./app.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { getRange } from "./storage.js";
import { pointsForDay } from "./points-engine.js";
import { POINTS, EXTRAS_META, CATEGORY_START_DATES } from "./points-config.js";
import {
  loadAndApplyConfig, pointsInPeriod, totalEarnedByUser,
  fmtPts, fmtDayFull, fmtWeekRange, fmtMonth,
  getBestDay, getBestWeek, getBestMonth,
  mondayOfWeek,
} from "./points-utils.js";
import { mountNavMenu } from "./nav-menu.js";

const NAMES = { vinicius: "Vini", victoria: "Vivi" };
const ACCENTS = { vinicius: "var(--vini)", victoria: "var(--vic)" };
const EX_LABELS = {
  academia: "Academia", corrida: "Corrida", yoga: "Yoga",
  jiujitsu: "Jiu Jitsu", bicicleta: "Bicicleta",
};

let _daysByUser = { vinicius: [], victoria: [] };
let _currentUser = "vinicius";
let _currentRange = "30";

const pad = (n) => String(n).padStart(2, "0");
function shiftISO(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function daysBetweenInclusive(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000) + 1;
}
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
function waterLitres(v) {
  if (v === "0.5L") return 0.5;
  if (v === "1L") return 1;
  if (v === "1.5L") return 1.5;
  if (v === "2L") return 2;
  return 0;
}
function fmtLitres(n) {
  return n.toFixed(1).replace(".", ",") + "L";
}
function hasData(d) {
  return (d.exercises && d.exercises.length) || (d.extras && d.extras.length) ||
    d.water || d.lunch || d.dinner || d.dessert || d.soda ||
    (d.cigarettes != null && d.cigarettes !== "");
}

// === status semântico p/ streaks ===
function exStatus(d)        { if (!d) return "skip"; return (d.exercises && d.exercises.length) ? "satisfied" : "skip"; }
function smokeFreeStatus(d) { if (!d) return "skip"; const c = d.cigarettes; if (c == null || c === "") return "skip"; return (c === "0" || c === 0) ? "satisfied" : "broken"; }
function sodaFreeStatus(d)  { if (!d) return "skip"; if (!d.soda) return "skip"; return d.soda === "nao" ? "satisfied" : "broken"; }
function dessertFreeStatus(d){ if (!d) return "skip"; if (!d.dessert) return "skip"; return d.dessert === "nao" ? "satisfied" : "broken"; }

function currentStreak(byDate, statusFn) {
  let streak = 0;
  let cursor = todayISO();
  const todayStatus = statusFn(byDate.get(cursor));
  if (todayStatus === "broken") return 0;
  if (todayStatus === "skip") cursor = shiftISO(cursor, -1);
  while (cursor >= APP_START_DATE) {
    const s = statusFn(byDate.get(cursor));
    if (s === "satisfied") { streak++; cursor = shiftISO(cursor, -1); }
    else break;
  }
  return streak;
}
function bestStreak(byDate, statusFn) {
  let best = 0, run = 0;
  let cursor = APP_START_DATE;
  const today = todayISO();
  while (cursor <= today) {
    const s = statusFn(byDate.get(cursor));
    if (s === "satisfied") { run++; best = Math.max(best, run); }
    else { run = 0; } // broken OU skip quebram a sequência histórica
    cursor = shiftISO(cursor, 1);
  }
  return best;
}

// === gauge semi-circular (igual ao da página principal) ===
function semiDonut(clean, dirty) {
  const total = clean + dirty;
  const pClean = total > 0 ? (clean / total) * 100 : 0;
  const pDirty = total > 0 ? 100 - pClean : 0;
  return `
    <div class="donut">
      <svg viewBox="0 0 200 130" class="donut-svg" aria-hidden="true">
        <path d="M 20 100 A 80 80 0 0 1 180 100" class="donut-bg" pathLength="100"/>
        <path d="M 20 100 A 80 80 0 0 1 180 100" class="donut-fg" pathLength="100" stroke-dasharray="${pClean} 100"/>
        <text x="100" y="86" class="donut-total">${total}</text>
        <text x="100" y="110" class="donut-sub">refeições</text>
      </svg>
      <div class="donut-legend">
        <div class="leg leg--good">
          <span class="leg-pct">${Math.round(pClean)}%</span>
          <span class="leg-lbl">limpas · ${clean}</span>
        </div>
        <div class="leg leg--bad">
          <span class="leg-pct">${Math.round(pDirty)}%</span>
          <span class="leg-lbl">sujas · ${dirty}</span>
        </div>
      </div>
    </div>
  `;
}

const bar = (p) => `<div class="bar"><i style="width:${p}%"></i></div>`;

// === Datas de início por categoria ===
const MONTHS_PT_LOWER = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
function fmtStartDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS_PT_LOWER[m - 1]}`;
}
function daysSinceStart(startISO) {
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - start) / 86400000) + 1;
}
function startInfoLine(startISO, activeWeeks, activeMonths) {
  const days = daysSinceStart(startISO);
  const dateLabel = fmtStartDate(startISO);
  if (days >= 1) {
    const aw = `${activeWeeks} ${activeWeeks === 1 ? "semana ativa" : "semanas ativas"}`;
    const am = `${activeMonths} ${activeMonths === 1 ? "mês ativo" : "meses ativos"}`;
    return `${days} ${days === 1 ? "dia" : "dias"} desde ${dateLabel} · ${aw} · ${am}`;
  }
  const future = 1 - days;
  return `começa em ${future} ${future === 1 ? "dia" : "dias"} (${dateLabel})`;
}

// === conta semanas/meses ATIVOS (com pelo menos 1 dia em `days`) ===
function activeWeeksMonths(filteredDays) {
  const weeks = new Set();
  const months = new Set();
  for (const d of filteredDays) {
    weeks.add(mondayOfWeek(d.date));
    months.add(d.date.slice(0, 7));
  }
  return { weeks: weeks.size, months: months.size };
}

// === Academia helpers (grupos musculares) ===
const GYM_GROUPS = [
  { key: "costa",      label: "Costa",     abbr: "Co", color: "#60a5fa" },
  { key: "triceps",    label: "Tríceps",   abbr: "Tr", color: "#a78bfa" },
  { key: "peito",      label: "Peito",     abbr: "Pe", color: "#f472b6" },
  { key: "biceps",     label: "Bíceps",    abbr: "Bi", color: "#f87171" },
  { key: "perna",      label: "Perna",     abbr: "Pn", color: "#fb923c" },
  { key: "ombro",      label: "Ombro",     abbr: "Om", color: "#fbbf24" },
  { key: "lombar",     label: "Lombar",    abbr: "Lb", color: "#34d399" },
  { key: "abdominal",  label: "Abdominal", abbr: "Ab", color: "#22d3ee" },
];
const GYM_LOOKUP = Object.fromEntries(GYM_GROUPS.map(g => [g.key, g]));

// Bar chart horizontal: cada DOW é uma linha, barra empilhada por grupo muscular.
function gymDowBars(gymDays) {
  const counts = Array.from({ length: 7 }, () => ({}));
  for (const d of gymDays) {
    const [y, m, day] = d.date.split("-").map(Number);
    const dow = new Date(y, m - 1, day).getDay();
    for (const g of (d.gym_groups || [])) {
      counts[dow][g] = (counts[dow][g] || 0) + 1;
    }
  }
  const totals = counts.map(g => Object.values(g).reduce((s, n) => s + n, 0));
  const max = Math.max(1, ...totals);
  return `
    <div class="gym-dow-bars">
      ${DOW_PT_SHORT.map((label, i) => {
        const groupCounts = counts[i];
        const total = totals[i];
        const widthPct = (total / max) * 100;
        const segments = GYM_GROUPS
          .filter(g => groupCounts[g.key])
          .map(g => {
            const c = groupCounts[g.key];
            const pct = (c / total) * 100;
            return `<div class="gym-dow-seg" style="width:${pct}%; background:${g.color}" data-tooltip="${g.label}: ${c}"></div>`;
          }).join("");
        return `
          <div class="gym-dow-row">
            <span class="gym-dow-label">${label}</span>
            <div class="gym-dow-track">
              <div class="gym-dow-bar" style="width:${widthPct}%">${segments}</div>
            </div>
            <span class="gym-dow-total">${total}</span>
          </div>
        `;
      }).join("")}
      <div class="gym-dow-legend">
        ${GYM_GROUPS.map(g => `
          <span class="gym-leg-item">
            <i style="background:${g.color}"></i>${g.label}
          </span>
        `).join("")}
      </div>
    </div>
  `;
}

// Mini-calendário: cada dia mostra badges com os grupos treinados.
function gymCalendar(gymDays, jiuDateSet = new Set()) {
  const byDate = new Map(gymDays.map(d => [d.date, d]));
  const t = new Date();
  const year = t.getFullYear();
  const month = t.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${year}-${pad(month + 1)}-${pad(t.getDate())}`;

  let cells = DOW_PT_SHORT.map(d => `<div class="gym-cal-head">${d}</div>`).join("");
  for (let i = 0; i < firstDow; i++) cells += `<div class="gym-cal-cell is-empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    const dayData = byDate.get(dateStr);
    const groups = (dayData?.gym_groups || []);
    const hasJiu = jiuDateSet.has(dateStr);
    const isToday = dateStr === todayStr;
    const groupBadges = groups.map(g => {
      const meta = GYM_LOOKUP[g];
      if (!meta) return "";
      return `<span class="gym-cal-grp" style="background:${meta.color}">${meta.label}</span>`;
    }).join("");
    const jiuBadge = hasJiu
      ? `<span class="gym-cal-jiu">🥋 Jiu Jitsu</span>`
      : "";
    const badges = groupBadges + jiuBadge;
    const hasActivity = groups.length > 0 || hasJiu;
    const klass = `gym-cal-cell${hasActivity ? " has-training" : ""}${isToday ? " is-today" : ""}`;
    cells += `
      <div class="${klass}">
        <span class="gym-cal-day">${day}</span>
        ${badges ? `<div class="gym-cal-grps">${badges}</div>` : ""}
      </div>
    `;
  }

  return `
    <div class="gym-cal-grid">${cells}</div>
  `;
}

function computeGymStats(days) {
  const gymDays = days.filter(d => (d.exercises || []).includes("academia"));
  const total = gymDays.length;
  const groupCounts = {};
  for (const d of gymDays) {
    for (const g of (d.gym_groups || [])) {
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    }
  }
  const daysWithoutGroups = gymDays.filter(d => !(d.gym_groups || []).length).length;
  const { weeks: activeWeeks, months: activeMonths } = activeWeeksMonths(gymDays);
  const aw = Math.max(1, activeWeeks);
  const am = Math.max(1, activeMonths);
  return {
    gymDays,
    total,
    groupCounts,
    daysWithoutGroups,
    activeWeeks, activeMonths,
    avgPerActiveWeek: total / aw,
    avgPerActiveMonth: total / am,
  };
}

function gymSectionHtml(stats, ACCENT, jiuDateSet = new Set()) {
  const {
    total, groupCounts, daysWithoutGroups, gymDays,
    activeWeeks, activeMonths,
    avgPerActiveWeek, avgPerActiveMonth,
  } = stats;
  const sorted = [...GYM_GROUPS]
    .map(g => ({ ...g, count: groupCounts[g.key] || 0 }))
    .sort((a, b) => b.count - a.count);
  const rows = sorted.map(g => {
    const c = g.count;
    const p = total > 0 ? Math.round((c / total) * 100) : 0;
    return `
      <div class="stat-row">
        <div style="flex:1;min-width:0">
          <div class="stat-label">${g.label}</div>
          ${bar(p)}
        </div>
        <div class="stat-value">${c}<span class="muted" style="font-weight:500;font-size:12px">/${total}</span></div>
      </div>
    `;
  }).join("");

  return `
    <section class="block">
      <div class="block-head"><h2>🏋️ Academia</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr)">
          <div class="kpi">
            <div class="kpi-value">${total}</div>
            <div class="kpi-label">treinos totais</div>
          </div>
          <div class="kpi">
            <div class="kpi-value">${fmtN(avgPerActiveWeek)}</div>
            <div class="kpi-label">treinos / semana ativa</div>
          </div>
          <div class="kpi">
            <div class="kpi-value">${fmtN(avgPerActiveMonth)}</div>
            <div class="kpi-label">treinos / mês ativo</div>
          </div>
        </div>
        <p class="muted stats-meta">${startInfoLine(CATEGORY_START_DATES.academia, activeWeeks, activeMonths)}</p>

        ${total === 0 ? '<p class="muted" style="font-size:12px;margin:8px 0 0">sem treinos de academia ainda</p>' : `
          <h3 class="stats-subhead">Por grupo muscular</h3>
          ${rows}
          ${daysWithoutGroups > 0
            ? `<p class="muted" style="font-size:11px;margin-top:6px">${daysWithoutGroups} treino${daysWithoutGroups === 1 ? "" : "s"} sem grupo marcado</p>`
            : ""}

          <h3 class="stats-subhead">Treinos por dia da semana</h3>
          ${dowChart(gymDays)}

          <h3 class="stats-subhead">Grupos por dia da semana</h3>
          ${gymDowBars(gymDays)}

          <h3 class="stats-subhead">Calendário do mês</h3>
          ${gymCalendar(gymDays, jiuDateSet)}
        `}
      </div>
    </section>
  `;
}

// === Jiu Jitsu helpers ===
const JIU_DURATION = {
  "6h30": 60, "12h": 60, "16h30": 60,
  "19h30": 90, "Sab11": 90,
};
const DOW_PT_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function jiuMinutes(session) {
  return JIU_DURATION[session] || 60;
}
function fmtHours(min) {
  if (!min || min === 0) return "0h";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
function fmtN(n, digits = 1) {
  return Number(n).toFixed(digits).replace(".", ",");
}

function computeJiuStats(days) {
  const jiuDays = days.filter(d => (d.exercises || []).includes("jiujitsu"));
  let totalMinutes = 0;
  let totalSparMin = 0;
  for (const d of jiuDays) {
    totalMinutes += jiuMinutes(d.jiu_session);
    if (d.jiu_spar_min != null && d.jiu_spar_min !== "") {
      totalSparMin += Number(d.jiu_spar_min) || 0;
    }
  }
  const total = jiuDays.length;
  const { weeks: activeWeeks, months: activeMonths } = activeWeeksMonths(jiuDays);
  const aw = Math.max(1, activeWeeks);
  const am = Math.max(1, activeMonths);
  return {
    jiuDays,
    totalTrainings: total,
    totalMinutes,
    totalSparMin,
    activeWeeks, activeMonths,
    avgSparPerTraining: total > 0 ? totalSparMin / total : 0,
    avgTrainingsPerActiveWeek: total / aw,
    avgMinutesPerActiveWeek: totalMinutes / aw,
    avgSparPerActiveWeek: totalSparMin / aw,
    avgTrainingsPerActiveMonth: total / am,
    avgMinutesPerActiveMonth: totalMinutes / am,
    avgSparPerActiveMonth: totalSparMin / am,
  };
}

function dowChart(jiuDays) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of jiuDays) {
    const [y, m, day] = d.date.split("-").map(Number);
    counts[new Date(y, m - 1, day).getDay()]++;
  }
  const max = Math.max(1, ...counts);
  return `
    <div class="dow-chart">
      ${counts.map((c, i) => `
        <div class="dow-col">
          <div class="dow-bar-wrap">
            <div class="dow-bar${c === 0 ? " is-zero" : ""}" style="height:${(c / max) * 100}%"></div>
          </div>
          <div class="dow-count">${c}</div>
          <div class="dow-label">${DOW_PT_SHORT[i]}</div>
        </div>
      `).join("")}
    </div>
  `;
}

// Barras normalizadas (100% altura): proporção limpa/suja dentro de cada dia.
// Embaixo do label, mostra "X% · N" pra cada categoria.
function mealDowChart(days) {
  const clean = [0, 0, 0, 0, 0, 0, 0];
  const dirty = [0, 0, 0, 0, 0, 0, 0];
  for (const d of days) {
    const [y, m, day] = d.date.split("-").map(Number);
    const dow = new Date(y, m - 1, day).getDay();
    for (const slot of ["lunch", "dinner"]) {
      if (d[slot] === "limpo") clean[dow]++;
      else if (d[slot] === "sujo") dirty[dow]++;
    }
  }
  return `
    <div class="dow-chart meal-dow-chart">
      ${DOW_PT_SHORT.map((label, i) => {
        const c = clean[i], s = dirty[i];
        const total = c + s;
        if (total === 0) {
          return `
            <div class="dow-col">
              <div class="dow-bar-wrap"><div class="meal-empty"></div></div>
              <div class="dow-label">${label}</div>
              <div class="dow-meal-empty">—</div>
            </div>
          `;
        }
        const cPct = Math.round((c / total) * 100);
        const sPct = 100 - cPct;
        return `
          <div class="dow-col">
            <div class="dow-bar-wrap">
              <div class="meal-stack">
                ${s > 0 ? `<div class="meal-bar meal-bar--dirty" style="height:${sPct}%"></div>` : ""}
                ${c > 0 ? `<div class="meal-bar meal-bar--clean" style="height:${cPct}%"></div>` : ""}
              </div>
            </div>
            <div class="dow-label">${label}</div>
            <div class="dow-meal-pct meal-clean">${cPct}% · ${c}</div>
            <div class="dow-meal-pct meal-dirty">${sPct}% · ${s}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function jiuSectionHtml(stats, ACCENT) {
  const {
    totalTrainings, totalMinutes, totalSparMin, jiuDays,
    activeWeeks, activeMonths,
    avgSparPerTraining,
    avgTrainingsPerActiveWeek, avgMinutesPerActiveWeek, avgSparPerActiveWeek,
    avgTrainingsPerActiveMonth, avgMinutesPerActiveMonth, avgSparPerActiveMonth,
  } = stats;
  return `
    <section class="block">
      <div class="block-head"><h2>🥋 Jiu Jitsu</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-value">${totalTrainings}</div><div class="kpi-label">treinos totais</div></div>
          <div class="kpi"><div class="kpi-value">${fmtHours(totalMinutes)}</div><div class="kpi-label">tempo total</div></div>
          <div class="kpi"><div class="kpi-value">${fmtHours(totalSparMin)}</div><div class="kpi-label">luta total</div></div>
          <div class="kpi"><div class="kpi-value">${Math.round(avgSparPerTraining)}<span class="muted" style="font-size:12px;font-weight:500">min</span></div><div class="kpi-label">luta / treino (média)</div></div>
        </div>
        <p class="muted stats-meta">${startInfoLine(CATEGORY_START_DATES.jiujitsu, activeWeeks, activeMonths)}</p>

        <h3 class="stats-subhead">Médias por semana ativa</h3>
        <div class="stat-row"><span class="stat-label">📅 Treinos</span><span class="stat-value">${fmtN(avgTrainingsPerActiveWeek)}</span></div>
        <div class="stat-row"><span class="stat-label">⏱️ Tempo total</span><span class="stat-value">${fmtHours(Math.round(avgMinutesPerActiveWeek))}</span></div>
        <div class="stat-row"><span class="stat-label">🥊 Tempo de luta</span><span class="stat-value">${fmtHours(Math.round(avgSparPerActiveWeek))}</span></div>

        <h3 class="stats-subhead">Médias por mês ativo</h3>
        <div class="stat-row"><span class="stat-label">📅 Treinos</span><span class="stat-value">${fmtN(avgTrainingsPerActiveMonth)}</span></div>
        <div class="stat-row"><span class="stat-label">⏱️ Tempo total</span><span class="stat-value">${fmtHours(Math.round(avgMinutesPerActiveMonth))}</span></div>
        <div class="stat-row"><span class="stat-label">🥊 Tempo de luta</span><span class="stat-value">${fmtHours(Math.round(avgSparPerActiveMonth))}</span></div>

        <h3 class="stats-subhead">Treinos por dia da semana</h3>
        ${dowChart(jiuDays)}
      </div>
    </section>
  `;
}

function kpiRow(value, label, suffix = "") {
  return `
    <div class="kpi-row">
      <div class="kpi-value">${value}${suffix ? `<span class="kpi-suffix">${suffix}</span>` : ""}</div>
      <div class="kpi-label">${label}</div>
    </div>
  `;
}

function render() {
  const USER = _currentUser;
  const ACCENT = ACCENTS[USER];
  const _days = _daysByUser[USER];
  const el = document.getElementById("vstat-content");
  const days = Number(_currentRange);
  const end = todayISO();
  let rangeStart = shiftISO(end, -(days - 1));
  if (rangeStart < APP_START_DATE) rangeStart = APP_START_DATE;
  const totalDays = daysBetweenInclusive(rangeStart, end);

  const byDate = new Map(_days.map(d => [d.date, d]));
  const rangeData = _days.filter(d => d.date >= rangeStart && d.date <= end);

  // ----- período (range) -----
  let exDays = 0, activeDays = 0, totalCigRange = 0;
  let cleanRange = 0, dirtyRange = 0;
  const exCount = {};
  const extraCount = {};
  for (const d of rangeData) {
    if (hasData(d)) activeDays++;
    const arr = d.exercises || [];
    if (arr.length) exDays++;
    for (const e of arr) exCount[e] = (exCount[e] || 0) + 1;
    for (const x of (d.extras || [])) extraCount[x] = (extraCount[x] || 0) + 1;
    for (const slot of ["lunch", "dinner"]) {
      if (d[slot] === "limpo") cleanRange++;
      else if (d[slot] === "sujo") dirtyRange++;
    }
    if (d.cigarettes != null && d.cigarettes !== "") totalCigRange += Number(d.cigarettes);
  }
  const waterRange = rangeData.reduce((s, d) => s + waterLitres(d.water), 0);
  const avgWaterRange = totalDays > 0 ? waterRange / totalDays : 0;

  // ----- desde o início (all-time) -----
  const totalCigAll = _days.reduce((s, d) => s + ((d.cigarettes != null && d.cigarettes !== "") ? Number(d.cigarettes) : 0), 0);
  const waterAll = _days.reduce((s, d) => s + waterLitres(d.water), 0);
  const activeDaysAll = _days.filter(hasData).length;
  const marmitas = _days.filter(d => (d.extras || []).includes("marmita")).length;

  // denominadores = dias em que aquele hábito foi registrado
  const cigReg = _days.filter(d => d.cigarettes != null && d.cigarettes !== "").length;
  const sodaReg = _days.filter(d => d.soda === "sim" || d.soda === "nao").length;
  const dessertReg = _days.filter(d => d.dessert === "sim" || d.dessert === "nao").length;

  const diasSemRefri = _days.filter(d => d.soda === "nao").length;
  const diasComRefri = _days.filter(d => d.soda === "sim").length;
  const diasSemSobremesa = _days.filter(d => d.dessert === "nao").length;
  const diasComSobremesa = _days.filter(d => d.dessert === "sim").length;
  const diasSemFumarTotal = _days.filter(d => d.cigarettes === "0" || d.cigarettes === 0).length;
  const totalPts = totalEarnedByUser(_days);
  const ptsWeek = pointsInPeriod(_days, "weekly");
  const ptsMonth = pointsInPeriod(_days, "monthly");
  const daysSinceStart = Math.max(1, daysBetweenInclusive(APP_START_DATE, end));
  const avgPtsDay = Math.round(totalPts / daysSinceStart);

  // ----- streaks (atual + recorde) -----
  const exCur = currentStreak(byDate, exStatus);
  const exBest = bestStreak(byDate, exStatus);
  const smokeCur = currentStreak(byDate, smokeFreeStatus);
  const smokeBest = bestStreak(byDate, smokeFreeStatus);
  const sodaCur = currentStreak(byDate, sodaFreeStatus);
  const sodaBest = bestStreak(byDate, sodaFreeStatus);
  const dessertCur = currentStreak(byDate, dessertFreeStatus);
  const dessertBest = bestStreak(byDate, dessertFreeStatus);

  // ----- modalidades (range) -----
  const modalidades = Object.keys(EX_LABELS)
    .map(key => ({ key, count: exCount[key] || 0 }))
    .filter(m => m.count > 0)
    .sort((a, b) => b.count - a.count);
  const modRows = modalidades.length
    ? modalidades.map(({ key, count }) => `
        <div class="stat-row">
          <div style="flex:1;min-width:0">
            <div class="stat-label">${EX_LABELS[key]}</div>
            ${bar(pct(count, totalDays))}
          </div>
          <div class="stat-value">${count}</div>
        </div>`).join("")
    : `<p class="muted" style="font-size:12px;margin:4px 0">sem registros no período</p>`;

  // ----- outros hábitos (range) -----
  const extraRows = EXTRAS_META
    .map(meta => ({ meta, count: extraCount[meta.key] || 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(({ meta, count }) => `
      <div class="stat-row">
        <span class="stat-label">${meta.icon} ${meta.label}</span>
        <span class="stat-value">${count}</span>
      </div>`).join("");

  // ----- recordes (all-time) -----
  const bDay = getBestDay(_days);
  const bWeek = getBestWeek(_days);
  const bMonth = getBestMonth(_days);
  const recRow = (label, rec, whenFmt) => rec
    ? `<div class="stat-row"><span class="stat-label">${label}<br><span class="muted" style="font-size:11px">${whenFmt(rec)}</span></span><span class="stat-value">${fmtPts(rec.total)} pts</span></div>`
    : `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value muted">—</span></div>`;

  el.innerHTML = `
    <section class="block">
      <div class="block-head"><h2>Pontos</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-value">${totalPts}</div>
            <div class="kpi-label">total desde o início</div>
          </div>
          <div class="kpi">
            <div class="kpi-value">${avgPtsDay}</div>
            <div class="kpi-label">média por dia</div>
          </div>
          <div class="kpi">
            <div class="kpi-value">${fmtPts(ptsWeek)}</div>
            <div class="kpi-label">esta semana</div>
          </div>
          <div class="kpi">
            <div class="kpi-value">${fmtPts(ptsMonth)}</div>
            <div class="kpi-label">este mês</div>
          </div>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Recordes</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        ${recRow("Melhor dia", bDay, r => fmtDayFull(r.date))}
        ${recRow("Melhor semana", bWeek, r => fmtWeekRange(r.weekStart))}
        ${recRow("Melhor mês", bMonth, r => fmtMonth(r.monthKey))}
      </div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Resumo do período</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="kpi-list">
          ${kpiRow(activeDays, "dias com algum registro", `/${totalDays}`)}
          ${kpiRow(exDays, "dias com exercício", `/${totalDays}`)}
          ${kpiRow(pct(cleanRange, cleanRange + dirtyRange), "refeições limpas", "%")}
          ${kpiRow(fmtLitres(avgWaterRange), "média de água por dia")}
          ${kpiRow(totalCigRange, "cigarros fumados no período")}
          ${kpiRow(fmtN(totalDays > 0 ? totalCigRange / totalDays : 0), "média de cigarros por dia")}
        </div>
      </div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Sequências</h2><span class="muted" style="font-size:11px">atual · recorde</span></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="stat-row">
          <span class="stat-label">🏋️ Exercício</span>
          <span class="stat-value">${exCur} <span class="muted" style="font-weight:500;font-size:12px">· ${exBest}</span></span>
        </div>
        <div class="stat-row">
          <span class="stat-label">🚭 Sem fumar</span>
          <span class="stat-value">${smokeCur} <span class="muted" style="font-weight:500;font-size:12px">· ${smokeBest}</span></span>
        </div>
        <div class="stat-row">
          <span class="stat-label">🥤 Sem refrigerante</span>
          <span class="stat-value">${sodaCur} <span class="muted" style="font-weight:500;font-size:12px">· ${sodaBest}</span></span>
        </div>
        <div class="stat-row">
          <span class="stat-label">🍰 Sem sobremesa</span>
          <span class="stat-value">${dessertCur} <span class="muted" style="font-weight:500;font-size:12px">· ${dessertBest}</span></span>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Totais · desde o início</h2><span class="muted" style="font-size:11px">X / dias registrados</span></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="stat-row"><span class="stat-label">🚭 Dias sem fumar</span><span class="stat-value">${diasSemFumarTotal}<span class="muted" style="font-weight:500;font-size:12px">/${cigReg}</span></span></div>
        <div class="stat-row"><span class="stat-label">🥤 Dias sem refrigerante</span><span class="stat-value">${diasSemRefri}<span class="muted" style="font-weight:500;font-size:12px">/${sodaReg}</span></span></div>
        <div class="stat-row"><span class="stat-label">🥤 Dias com refrigerante</span><span class="stat-value">${diasComRefri}<span class="muted" style="font-weight:500;font-size:12px">/${sodaReg}</span></span></div>
        <div class="stat-row"><span class="stat-label">🍰 Dias sem sobremesa</span><span class="stat-value">${diasSemSobremesa}<span class="muted" style="font-weight:500;font-size:12px">/${dessertReg}</span></span></div>
        <div class="stat-row"><span class="stat-label">🍰 Dias com sobremesa</span><span class="stat-value">${diasComSobremesa}<span class="muted" style="font-weight:500;font-size:12px">/${dessertReg}</span></span></div>
        <div class="stat-row"><span class="stat-label">🍱 Marmitas feitas</span><span class="stat-value">${marmitas}<span class="muted" style="font-weight:500;font-size:12px">/${activeDaysAll}</span></span></div>
        <div class="stat-row"><span class="stat-label">🚬 Cigarros fumados (total)</span><span class="stat-value">${totalCigAll}</span></div>
        <div class="stat-row"><span class="stat-label">💧 Água total</span><span class="stat-value">${fmtLitres(waterAll)}</span></div>
      </div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Outros hábitos</h2><span class="muted" style="font-size:11px">no período</span></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        ${extraRows || `<p class="muted" style="font-size:12px;margin:4px 0">nada marcado no período</p>`}
      </div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Exercícios por modalidade</h2><span class="muted" style="font-size:11px">no período</span></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">${modRows}</div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Alimentação</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        ${(() => {
          const ms = monthStartClamped();
          let cM = 0, sM = 0, cAll = 0, sAll = 0;
          for (const d of _days) {
            for (const slot of ["lunch", "dinner"]) {
              if (d[slot] === "limpo") {
                cAll++;
                if (d.date >= ms) cM++;
              } else if (d[slot] === "sujo") {
                sAll++;
                if (d.date >= ms) sM++;
              }
            }
          }
          return `
            <h3 class="stats-subhead">Mês atual</h3>
            ${semiDonut(cM, sM)}
            <h3 class="stats-subhead">Desde o início</h3>
            ${semiDonut(cAll, sAll)}
            <h3 class="stats-subhead">Refeições por dia da semana</h3>
            ${mealDowChart(_days)}
          `;
        })()}
      </div>
    </section>

    ${USER === "vinicius" ? jiuSectionHtml(computeJiuStats(_days), ACCENT) : ""}

    ${gymSectionHtml(
      computeGymStats(_days),
      ACCENT,
      new Set(_days.filter(d => (d.exercises || []).includes("jiujitsu")).map(d => d.date))
    )}
  `;
}

function monthStartClamped() {
  const t = new Date();
  const first = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-01`;
  return first < APP_START_DATE ? APP_START_DATE : first;
}

function setupToggle() {
  document.querySelectorAll("#stats-user-seg .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      _currentUser = btn.dataset.user;
      document.querySelectorAll("#stats-user-seg .seg-btn")
        .forEach(b => b.classList.toggle("is-on", b.dataset.user === _currentUser));
      render();
    });
  });
}

async function initStatsPage(user) {
  renderAuthFooter(user);
  setupToggle();
  const select = document.getElementById("vstat-range");
  select.addEventListener("change", () => { _currentRange = select.value; render(); });
  try {
    await loadAndApplyConfig();
    const results = await Promise.all(
      USERS.map(u => getRange(u, APP_START_DATE, todayISO()).catch(() => []))
    );
    USERS.forEach((u, i) => { _daysByUser[u] = results[i]; });
    _currentRange = select.value;
    render();
  } catch (err) {
    console.error(err);
    document.getElementById("vstat-content").innerHTML =
      `<p class="muted" style="padding:8px">erro ao carregar: ${err.message}</p>`;
  } finally {
    document.body.classList.remove("is-loading");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({ onAuthorized: (user) => initStatsPage(user) });
});
