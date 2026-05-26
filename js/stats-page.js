// Página de estatísticas pessoais (Vini ou Vivi).
// O usuário vem de <body data-stats-user="vinicius|victoria">.
// Mesmo arquivo serve as duas páginas (vinicius.html e vivi-stats.html).

import { todayISO, APP_START_DATE } from "./app.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { getRange } from "./storage.js";
import { pointsForDay } from "./points-engine.js";
import { POINTS, EXTRAS_META } from "./points-config.js";
import {
  loadAndApplyConfig, pointsInPeriod, totalEarnedByUser,
  fmtPts, fmtDayFull, fmtWeekRange, fmtMonth,
  getBestDay, getBestWeek, getBestMonth,
} from "./points-utils.js";
import { mountNavMenu } from "./nav-menu.js";

const USER = document.body.dataset.statsUser === "victoria" ? "victoria" : "vinicius";
const NAME = USER === "vinicius" ? "Vini" : "Vivi";
const ACCENT = USER === "vinicius" ? "var(--vini)" : "var(--vic)";
const EX_LABELS = {
  academia: "Academia", corrida: "Corrida", yoga: "Yoga",
  jiujitsu: "Jiu Jitsu", bicicleta: "Bicicleta",
};

let _days = [];

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

function kpiRow(value, label, suffix = "") {
  return `
    <div class="kpi-row">
      <div class="kpi-value">${value}${suffix ? `<span class="kpi-suffix">${suffix}</span>` : ""}</div>
      <div class="kpi-label">${label}</div>
    </div>
  `;
}

function render(rangeDays) {
  const el = document.getElementById("vstat-content");
  const days = Number(rangeDays);
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
      <div class="block-head"><h2>Resumo do período</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        <div class="kpi-list">
          ${kpiRow(activeDays, "dias com algum registro", `/${totalDays}`)}
          ${kpiRow(exDays, "dias com exercício", `/${totalDays}`)}
          ${kpiRow(pct(cleanRange, cleanRange + dirtyRange), "refeições limpas", "%")}
          ${kpiRow(fmtLitres(avgWaterRange), "média de água por dia")}
          ${kpiRow(totalCigRange, "cigarros fumados no período")}
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
      <div class="block-head"><h2>Alimentação · mês</h2></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        ${(() => {
          const ms = monthStartClamped();
          const monthData = _days.filter(d => d.date >= ms);
          let c = 0, s = 0;
          for (const d of monthData) for (const slot of ["lunch","dinner"]) {
            if (d[slot] === "limpo") c++; else if (d[slot] === "sujo") s++;
          }
          return semiDonut(c, s);
        })()}
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
      <div class="block-head"><h2>Exercícios por modalidade</h2><span class="muted" style="font-size:11px">no período</span></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">${modRows}</div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Outros hábitos</h2><span class="muted" style="font-size:11px">no período</span></div>
      <div class="stat-card" style="border-top:3px solid ${ACCENT}">
        ${extraRows || `<p class="muted" style="font-size:12px;margin:4px 0">nada marcado no período</p>`}
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
  `;
}

function monthStartClamped() {
  const t = new Date();
  const first = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-01`;
  return first < APP_START_DATE ? APP_START_DATE : first;
}

async function initStatsPage(user) {
  renderAuthFooter(user);
  // título dinâmico ("Vini Stats" / "Vivi Stats")
  const brand = document.querySelector(".topbar .brand");
  if (brand) brand.textContent = `${NAME} Stats`;
  try {
    await loadAndApplyConfig();
    _days = await getRange(USER, APP_START_DATE, todayISO());
    const select = document.getElementById("vstat-range");
    render(select.value);
    select.addEventListener("change", () => render(select.value));
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
