// Página de estatísticas — Vini e Vivi numa página só, com toggle no topo.

import { todayISO, APP_START_DATE, USERS } from "./app.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { getRange } from "./storage.js";
import { getStretchSessions } from "./stretch-storage.js";
import { pointsForDay } from "./points-engine.js";
import { CATEGORY_START_DATES } from "./points-config.js";
import {
  loadAndApplyConfig, pointsInPeriod, totalEarnedByUser,
  fmtPts, fmtDayFull, fmtWeekRange, fmtMonth,
  getBestDay, getBestWeek, getBestMonth,
  mondayOfWeek,
} from "./points-utils.js";
import { mountNavMenu } from "./nav-menu.js";
import {
  DEFAULT_TRACKING_SCOPE,
  TRACKING_SCOPE,
  filterRecordsForTrackingScope,
  mountTrackingScopeControl,
  trackingScopeStart,
} from "./tracking-cycle.js";
import { waterLitres } from "./water-options.js";

const NAMES = { vinicius: "Vini", victoria: "Vivi" };
const ACCENTS = { vinicius: "var(--vini)", victoria: "var(--vic)" };
const EX_LABELS = {
  academia: "Academia", corrida: "Corrida", yoga: "Yoga",
  jiujitsu: "Jiu Jitsu", pilates: "Pilates", bicicleta: "Bicicleta", alongamento: "Alongamento",
};

// Badges que aparecem no mini-calendário da Academia pra marcar
// atividades extras (jiu / pilates / etc.) feitas no mesmo dia.
// Cada um tem cor própria pra distinguir dos grupos musculares.
const ACTIVITY_BADGES = {
  jiujitsu:    { icon: "🥋", label: "Jiu Jitsu",   color: "#6ee7b7", bg: "rgba(16, 185, 129, 0.14)",  border: "rgba(16, 185, 129, 0.55)"  },
  pilates:     { icon: "🧘", label: "Pilates",     color: "#c4b5fd", bg: "rgba(167, 139, 250, 0.16)", border: "rgba(167, 139, 250, 0.55)" },
  alongamento: { icon: "🤸", label: "Alongamento", color: "#fcd34d", bg: "rgba(250, 204, 21, 0.14)",  border: "rgba(250, 204, 21, 0.55)"  },
};

let _daysByUser = { vinicius: [], victoria: [] };
let _stretchByUser = { vinicius: [], victoria: [] };
let _currentUser = "vinicius";
let _currentRange = "30";
let _trackingScope = DEFAULT_TRACKING_SCOPE;

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

function currentStreak(byDate, statusFn, startDate = APP_START_DATE) {
  let streak = 0;
  let cursor = todayISO();
  const todayStatus = statusFn(byDate.get(cursor));
  if (todayStatus === "broken") return 0;
  if (todayStatus === "skip") cursor = shiftISO(cursor, -1);
  while (cursor >= startDate) {
    const s = statusFn(byDate.get(cursor));
    if (s === "satisfied") { streak++; cursor = shiftISO(cursor, -1); }
    else break;
  }
  return streak;
}
function bestStreak(byDate, statusFn, startDate = APP_START_DATE) {
  let best = 0, run = 0;
  let cursor = startDate;
  const today = todayISO();
  while (cursor <= today) {
    const s = statusFn(byDate.get(cursor));
    if (s === "satisfied") { run++; best = Math.max(best, run); }
    else { run = 0; } // broken OU skip quebram a sequência histórica
    cursor = shiftISO(cursor, 1);
  }
  return best;
}

// === distribuição geral das refeições em uma única barra de 0 a 100% ===
function mealSplitBar(clean, dirty) {
  const total = clean + dirty;
  const pClean = total > 0 ? Math.round((clean / total) * 100) : 0;
  const pDirty = total > 0 ? 100 - pClean : 0;
  return `
    <div class="meal-split">
      <div class="meal-split-labels">
        <strong class="meal-split-clean">${pClean}% limpas</strong>
        <strong class="meal-split-dirty">${pDirty}% sujas</strong>
      </div>
      <div class="meal-split-track" role="img" aria-label="${pClean}% de refeições limpas e ${pDirty}% de refeições sujas">
        ${total === 0
          ? `<span class="meal-split-empty"></span>`
          : `
            ${pClean > 0 ? `<span class="meal-split-segment meal-split-segment--clean" style="width:${pClean}%"></span>` : ""}
            ${pDirty > 0 ? `<span class="meal-split-segment meal-split-segment--dirty" style="width:${pDirty}%"></span>` : ""}
          `}
      </div>
      <div class="meal-split-scale" aria-hidden="true">
        <span>0%</span><span>100%</span>
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
            return `<div class="gym-dow-seg" style="width:${pct}%; background:${g.color}"><span class="gym-dow-seg-lbl">${g.label}</span></div>`;
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
function gymCalendar(gymDays, extrasByDate = new Map()) {
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
    const extras = extrasByDate.get(dateStr) || [];
    const isToday = dateStr === todayStr;
    const groupBadges = groups.map(g => {
      const meta = GYM_LOOKUP[g];
      if (!meta) return "";
      return `<span class="gym-cal-grp" style="background:${meta.color}">${meta.label}</span>`;
    }).join("");
    const extraBadges = extras.map(act => {
      const meta = ACTIVITY_BADGES[act];
      if (!meta) return "";
      return `<span class="gym-cal-extra" style="color:${meta.color};background:${meta.bg};border-color:${meta.border}">${meta.icon} ${meta.label}</span>`;
    }).join("");
    const badges = groupBadges + extraBadges;
    const hasActivity = groups.length > 0 || extras.length > 0;
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

function gymSectionHtml(stats, ACCENT, extrasByDate = new Map(), startDate = CATEGORY_START_DATES.academia) {
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
        <p class="muted stats-meta">${startInfoLine(startDate, activeWeeks, activeMonths)}</p>

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
          ${gymCalendar(gymDays, extrasByDate)}
        `}
      </div>
    </section>
  `;
}

// === Helpers compartilhados de tempo e dia da semana ===
const DOW_PT_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

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

// Mapeia data → lista de atividades extras (jiu, pilates) feitas naquele dia.
// Usado pelo calendário da Academia pra mostrar badges das outras modalidades.
function buildExtrasByDate(days) {
  const map = new Map();
  for (const d of days) {
    const acts = (d.exercises || []).filter(ex => ACTIVITY_BADGES[ex]);
    if (acts.length) map.set(d.date, acts);
  }
  return map;
}

// ─── Alongamento (stretch_sessions: lista de sessões com timestamp) ───
function computeStretchStats(sessions) {
  const total = sessions.length;
  const totalMin = sessions.reduce((s, x) => s + (Number(x.duration_min) || 0), 0);
  // dias únicos (pra "dias ativos")
  const days = new Set(sessions.map(s => s.date).filter(Boolean));
  // semanas/meses ativos: usa o conjunto de dias
  const fakeDays = [...days].map(d => ({ date: d }));
  const { weeks: activeWeeks, months: activeMonths } = activeWeeksMonths(fakeDays);
  const aw = Math.max(1, activeWeeks);
  const am = Math.max(1, activeMonths);
  return {
    sessions,
    total,
    totalMin,
    distinctDays: days.size,
    activeWeeks, activeMonths,
    avgMinPerSession: total > 0 ? totalMin / total : 0,
    minPerActiveWeek: totalMin / aw,
    minPerActiveMonth: totalMin / am,
    sessionsPerActiveWeek: total / aw,
  };
}

function stretchSectionHtml(stats, ACCENT) {
  const { total, totalMin, distinctDays, activeWeeks, activeMonths, avgMinPerSession, minPerActiveWeek, sessions } = stats;
  // dow chart precisa de objetos com .date
  const fakeDays = sessions.map(s => ({ date: s.date }));
  return `
    <section class="block">
      <div class="block-head"><h2>🤸 Alongamento</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr)">
          <div class="kpi"><div class="kpi-value">${total}</div><div class="kpi-label">sessões totais</div></div>
          <div class="kpi"><div class="kpi-value">${fmtHours(totalMin)}</div><div class="kpi-label">tempo total</div></div>
          <div class="kpi"><div class="kpi-value">${distinctDays}</div><div class="kpi-label">${distinctDays === 1 ? "dia" : "dias"} c/ alongamento</div></div>
        </div>
        ${activeWeeks > 0 ? `<p class="muted stats-meta">
          ${activeWeeks} ${activeWeeks === 1 ? "semana ativa" : "semanas ativas"} ·
          ${activeMonths} ${activeMonths === 1 ? "mês ativo" : "meses ativos"}
        </p>` : ""}

        ${total === 0 ? '<p class="muted" style="font-size:12px;margin:8px 0 0">sem sessões de alongamento ainda</p>' : `
          <h3 class="stats-subhead">Médias</h3>
          <div class="stat-row"><span class="stat-label">⏱️ Min / sessão</span><span class="stat-value">${Math.round(avgMinPerSession)}min</span></div>
          <div class="stat-row"><span class="stat-label">📅 Min / semana ativa</span><span class="stat-value">${fmtHours(Math.round(minPerActiveWeek))}</span></div>

          <h3 class="stats-subhead">Sessões por dia da semana</h3>
          ${dowChart(fakeDays)}
        `}
      </div>
    </section>
  `;
}

function computePilatesStats(days) {
  const pilatesDays = days.filter(d => (d.exercises || []).includes("pilates"));
  const total = pilatesDays.length;
  const { weeks: activeWeeks, months: activeMonths } = activeWeeksMonths(pilatesDays);
  const aw = Math.max(1, activeWeeks);
  const am = Math.max(1, activeMonths);
  return {
    pilatesDays,
    total,
    activeWeeks, activeMonths,
    avgPerActiveWeek: total / aw,
    avgPerActiveMonth: total / am,
  };
}

function pilatesSectionHtml(stats, ACCENT, startDate = CATEGORY_START_DATES.pilates) {
  const { total, pilatesDays, activeWeeks, activeMonths, avgPerActiveWeek, avgPerActiveMonth } = stats;
  return `
    <section class="block">
      <div class="block-head"><h2>🧘 Pilates</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr)">
          <div class="kpi"><div class="kpi-value">${total}</div><div class="kpi-label">aulas totais</div></div>
          <div class="kpi"><div class="kpi-value">${fmtN(avgPerActiveWeek)}</div><div class="kpi-label">aulas / semana ativa</div></div>
          <div class="kpi"><div class="kpi-value">${fmtN(avgPerActiveMonth)}</div><div class="kpi-label">aulas / mês ativo</div></div>
        </div>
        <p class="muted stats-meta">${startInfoLine(startDate, activeWeeks, activeMonths)}</p>

        ${total === 0 ? '<p class="muted" style="font-size:12px;margin:8px 0 0">sem aulas de pilates ainda</p>' : `
          <h3 class="stats-subhead">Aulas por dia da semana</h3>
          ${dowChart(pilatesDays)}
        `}
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

// ─── Cigarros & Chicletes de Nicotina ────────────────────────────────
function computeCigStats(days, statsStartDate = APP_START_DATE) {
  const byDate = new Map(days.map(d => [d.date, d]));
  const today = todayISO();

  // Só conta "sem fumar" quando o dia foi explicitamente registrado com zero.
  const noSmokeStatus = (d) => {
    if (!d || d.cigarettes == null || d.cigarettes === "") return "skip";
    const c = Number(d.cigarettes);
    return (c > 0) ? "broken" : "satisfied";
  };
  const curNoSmoke = currentStreak(byDate, noSmokeStatus, statsStartDate);
  const bestNoSmoke = bestStreak(byDate, noSmokeStatus, statsStartDate);

  // Acumuladores
  let totalCigs = 0, totalGum = 0;
  let smokeDays = 0, gumDays = 0;
  const dowCigs = [0, 0, 0, 0, 0, 0, 0];
  const dowGum  = [0, 0, 0, 0, 0, 0, 0];

  // Período atual: hoje, esta semana, este mês
  const weekStart = (() => {
    const [y, m, d] = today.split("-").map(Number);
    const t = new Date(y, m - 1, d);
    t.setDate(t.getDate() - t.getDay()); // dom = início da semana
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  })();
  const monthStart = today.slice(0, 7) + "-01";

  let todayCigs = 0, weekCigs = 0, monthCigs = 0;
  let todayGum = 0,  weekGum = 0,  monthGum = 0;

  for (const d of days) {
    const c = Number(d.cigarettes) || 0;
    const g = Number(d.nicotine_gum) || 0;
    totalCigs += c;
    totalGum += g;
    if (c > 0) smokeDays++;
    if (g > 0) gumDays++;

    const [yy, mm, dd] = d.date.split("-").map(Number);
    const dow = new Date(yy, mm - 1, dd).getDay();
    dowCigs[dow] += c;
    dowGum[dow]  += g;

    if (d.date === today) { todayCigs += c; todayGum += g; }
    if (d.date >= weekStart) { weekCigs += c; weekGum += g; }
    if (d.date >= monthStart) { monthCigs += c; monthGum += g; }
  }

  // Dias decorridos dentro do escopo atual pras médias
  const totalDays = Math.max(1, daysBetweenInclusive(statsStartDate, today));
  const weeksElapsed = Math.max(1, totalDays / 7);
  const monthsElapsed = Math.max(1, totalDays / 30);

  return {
    totalCigs, totalGum,
    smokeDays, gumDays,
    curNoSmoke, bestNoSmoke,
    todayCigs, weekCigs, monthCigs,
    todayGum, weekGum, monthGum,
    avgCigsPerDay: totalCigs / totalDays,
    avgCigsPerWeek: totalCigs / weeksElapsed,
    avgCigsPerMonth: totalCigs / monthsElapsed,
    avgGumPerDay: totalGum / totalDays,
    avgGumPerWeek: totalGum / weeksElapsed,
    dowCigs, dowGum,
    totalDays,
    substitutionRatio: totalCigs > 0 ? totalGum / totalCigs : 0,
  };
}

function dowSumChart(values, accentColor) {
  const max = Math.max(1, ...values);
  return `
    <div class="dow-chart">
      ${values.map((c, i) => `
        <div class="dow-col">
          <div class="dow-bar-wrap">
            <div class="dow-bar${c === 0 ? " is-zero" : ""}" style="height:${(c / max) * 100}%;${accentColor ? `background:${accentColor};` : ""}"></div>
          </div>
          <div class="dow-count">${c}</div>
          <div class="dow-label">${DOW_PT_SHORT[i]}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function cigSectionHtml(stats, ACCENT, scopeSinceLabel = "desde o início") {
  const {
    totalCigs, totalGum, curNoSmoke, bestNoSmoke,
    todayCigs, weekCigs, monthCigs,
    todayGum, weekGum, monthGum,
    avgCigsPerDay, avgCigsPerWeek, avgCigsPerMonth,
    avgGumPerDay, dowCigs, dowGum,
    substitutionRatio, smokeDays, gumDays,
  } = stats;

  return `
    <section class="block">
      <div class="block-head"><h2>🚬 Cigarros & Nicotina</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr)">
          <div class="kpi"><div class="kpi-value">${totalCigs}</div><div class="kpi-label">cigarros total</div></div>
          <div class="kpi"><div class="kpi-value" style="color:var(--good)">${curNoSmoke}</div><div class="kpi-label">${curNoSmoke === 1 ? "dia sem fumar" : "dias sem fumar"}</div></div>
          <div class="kpi"><div class="kpi-value">${bestNoSmoke}</div><div class="kpi-label">recorde sem fumar</div></div>
        </div>

        <h3 class="stats-subhead">Cigarros no período</h3>
        <div class="stat-row"><span class="stat-label">🚬 Hoje</span><span class="stat-value">${todayCigs}</span></div>
        <div class="stat-row"><span class="stat-label">🚬 Esta semana</span><span class="stat-value">${weekCigs}</span></div>
        <div class="stat-row"><span class="stat-label">🚬 Este mês</span><span class="stat-value">${monthCigs}</span></div>

        <h3 class="stats-subhead">Médias (${scopeSinceLabel})</h3>
        <div class="stat-row"><span class="stat-label">Por dia</span><span class="stat-value">${fmtN(avgCigsPerDay)}</span></div>
        <div class="stat-row"><span class="stat-label">Por semana</span><span class="stat-value">${fmtN(avgCigsPerWeek)}</span></div>
        <div class="stat-row"><span class="stat-label">Por mês</span><span class="stat-value">${fmtN(avgCigsPerMonth)}</span></div>
        <p class="muted" style="font-size:11px;margin:6px 0 0">${smokeDays} ${smokeDays === 1 ? "dia" : "dias"} em que fumou ao menos 1 cigarro</p>

        <h3 class="stats-subhead">Cigarros por dia da semana</h3>
        ${dowSumChart(dowCigs, "rgba(248, 113, 113, 0.85)")}

        <h3 class="stats-subhead">🍬 Chicletes de nicotina</h3>
        <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr)">
          <div class="kpi"><div class="kpi-value">${totalGum}</div><div class="kpi-label">chicletes total</div></div>
          <div class="kpi"><div class="kpi-value">${fmtN(avgGumPerDay)}</div><div class="kpi-label">média / dia</div></div>
          <div class="kpi"><div class="kpi-value">${substitutionRatio > 0 ? fmtN(substitutionRatio) : "—"}</div><div class="kpi-label">${substitutionRatio > 0 ? "chicletes / cigarro" : "—"}</div></div>
        </div>
        <div class="stat-row"><span class="stat-label">🍬 Hoje</span><span class="stat-value">${todayGum}</span></div>
        <div class="stat-row"><span class="stat-label">🍬 Esta semana</span><span class="stat-value">${weekGum}</span></div>
        <div class="stat-row"><span class="stat-label">🍬 Este mês</span><span class="stat-value">${monthGum}</span></div>
        ${gumDays > 0 ? `<p class="muted" style="font-size:11px;margin:6px 0 0">${gumDays} ${gumDays === 1 ? "dia" : "dias"} mascando chiclete</p>` : ""}

        ${totalGum > 0 ? `
          <h3 class="stats-subhead">Chicletes por dia da semana</h3>
          ${dowSumChart(dowGum, "rgba(110, 231, 183, 0.85)")}
        ` : ""}
      </div>
    </section>
  `;
}

function render() {
  const USER = _currentUser;
  const ACCENT = ACCENTS[USER];
  const statsStartDate = trackingScopeStart(USER, _trackingScope, APP_START_DATE);
  const _days = filterRecordsForTrackingScope(_daysByUser[USER], USER, _trackingScope);
  const stretchSessions = filterRecordsForTrackingScope(_stretchByUser[USER], USER, _trackingScope);
  const scopeSinceLabel = _trackingScope === TRACKING_SCOPE.CYCLE ? "no ciclo atual" : "desde o início";
  const categoryStartDate = (category) => (
    CATEGORY_START_DATES[category] > statsStartDate ? CATEGORY_START_DATES[category] : statsStartDate
  );
  const el = document.getElementById("vstat-content");
  const days = Number(_currentRange);
  const end = todayISO();
  let rangeStart = shiftISO(end, -(days - 1));
  if (rangeStart < statsStartDate) rangeStart = statsStartDate;
  const totalDays = daysBetweenInclusive(rangeStart, end);

  const byDate = new Map(_days.map(d => [d.date, d]));
  const rangeData = _days.filter(d => d.date >= rangeStart && d.date <= end);

  // ----- período (range) -----
  let exDays = 0, activeDays = 0, totalCigRange = 0;
  let cleanRange = 0, dirtyRange = 0;
  const exCount = {};
  for (const d of rangeData) {
    if (hasData(d)) activeDays++;
    const arr = d.exercises || [];
    if (arr.length) exDays++;
    for (const e of arr) exCount[e] = (exCount[e] || 0) + 1;
    for (const slot of ["lunch", "dinner"]) {
      if (d[slot] === "limpo") cleanRange++;
      else if (d[slot] === "sujo") dirtyRange++;
    }
    if (d.cigarettes != null && d.cigarettes !== "") totalCigRange += Number(d.cigarettes);
  }
  const waterRange = rangeData.reduce((s, d) => s + waterLitres(d.water), 0);
  const avgWaterRange = totalDays > 0 ? waterRange / totalDays : 0;

  const totalPts = totalEarnedByUser(_days);
  const ptsWeek = pointsInPeriod(_days, "weekly");
  const ptsMonth = pointsInPeriod(_days, "monthly");
  const daysSinceStart = Math.max(1, daysBetweenInclusive(statsStartDate, end));
  const avgPtsDay = Math.round(totalPts / daysSinceStart);

  // ----- streaks (atual + recorde) -----
  const exCur = currentStreak(byDate, exStatus, statsStartDate);
  const exBest = bestStreak(byDate, exStatus, statsStartDate);
  const smokeCur = currentStreak(byDate, smokeFreeStatus, statsStartDate);
  const smokeBest = bestStreak(byDate, smokeFreeStatus, statsStartDate);
  const sodaCur = currentStreak(byDate, sodaFreeStatus, statsStartDate);
  const sodaBest = bestStreak(byDate, sodaFreeStatus, statsStartDate);
  const dessertCur = currentStreak(byDate, dessertFreeStatus, statsStartDate);
  const dessertBest = bestStreak(byDate, dessertFreeStatus, statsStartDate);

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
            <div class="kpi-label">total ${scopeSinceLabel}</div>
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
      <div class="block-head"><h2>Exercícios por modalidade</h2><span class="muted" style="font-size:11px">no período</span></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">${modRows}</div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Alimentação</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        ${(() => {
          let cAll = 0, sAll = 0;
          for (const d of _days) {
            for (const slot of ["lunch", "dinner"]) {
              if (d[slot] === "limpo") cAll++;
              else if (d[slot] === "sujo") sAll++;
            }
          }
          return `
            ${mealSplitBar(cAll, sAll)}
            <h3 class="stats-subhead">Refeições por dia da semana</h3>
            ${mealDowChart(_days)}
          `;
        })()}
      </div>
    </section>

    ${cigSectionHtml(computeCigStats(_days, statsStartDate), ACCENT, scopeSinceLabel)}

    ${USER === "victoria" ? pilatesSectionHtml(computePilatesStats(_days), ACCENT, categoryStartDate("pilates")) : ""}

    ${stretchSectionHtml(computeStretchStats(stretchSessions), ACCENT)}

    ${gymSectionHtml(
      computeGymStats(_days),
      ACCENT,
      buildExtrasByDate(_days),
      categoryStartDate("academia")
    )}
  `;
}

function setupToggle() {
  document.querySelectorAll("#stats-user-seg .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      _currentUser = btn.dataset.user;
      document.querySelectorAll("#stats-user-seg .seg-btn")
        .forEach(b => b.classList.toggle("is-on", b.dataset.user === _currentUser));
      renderTrackingControl();
      render();
    });
  });
}

function renderTrackingControl() {
  mountTrackingScopeControl("stats-cycle-scope", {
    scope: _trackingScope,
    userIds: [_currentUser],
    onChange: (nextScope) => {
      _trackingScope = nextScope;
      renderTrackingControl();
      render();
    },
  });
}

async function initStatsPage(user) {
  renderAuthFooter(user);
  setupToggle();
  renderTrackingControl();
  const select = document.getElementById("vstat-range");
  select.addEventListener("change", () => { _currentRange = select.value; render(); });
  try {
    await loadAndApplyConfig();
    const [daysResults, stretchResults] = await Promise.all([
      Promise.all(USERS.map(u => getRange(u, APP_START_DATE, todayISO()).catch(() => []))),
      Promise.all(USERS.map(u => getStretchSessions(u).catch(() => []))),
    ]);
    USERS.forEach((u, i) => {
      _daysByUser[u] = daysResults[i];
      _stretchByUser[u] = stretchResults[i];
    });
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
