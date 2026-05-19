// Página de pontuação (geral) — totais, detalhamento por pessoa e loja conjunta.
// Recordes e Placares migraram pra páginas próprias (recordes.html, placares.html).
// Loja pessoal da Vic está em victoria.html.

import { todayISO, USERS, APP_START_DATE } from "./app.js";
import { POINTS, REWARDS } from "./points-config.js";
import { pointsForDay } from "./points-engine.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import {
  loadAllData,
  loadAndApplyConfig,
  pointsInPeriod,
  breakdownForDays, breakdownByDay,
  fmtPts, fmtDayFull, fmtDayShort,
  PERIOD_LABELS, periodRange,
} from "./points-utils.js";

const NAMES = { vinicius: "Vinicius", victoria: "Victoria" };
const AVATAR_CLASS = { vinicius: "avatar--vini", victoria: "avatar--vic" };

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DOW_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const pad = (n) => String(n).padStart(2, "0");

// estado do calendário/breakdown (acessível pelos handlers)
let _data = null;
let _calState = { year: null, month: null, selectedDate: null };
let _currentPeriod = "weekly";

// --- render: totais por período -------------------------------------
function renderTotals(dataByUser) {
  const el = document.getElementById("totals");
  if (!el) return;
  const periods = ["weekly", "monthly", "all"];

  const cards = periods.map(period => {
    const perUser = USERS.map(u => pointsInPeriod(dataByUser[u], period));
    const sum = perUser.reduce((a, b) => a + b, 0);
    const sumClass = sum < 0 ? " totals-value--bad" : "";
    return `
      <div class="totals-card">
        <div class="totals-label">${PERIOD_LABELS[period]}</div>
        <div class="totals-value${sumClass}">${sum}<span class="totals-unit"> pts</span></div>
        <div class="totals-breakdown">
          ${USERS.map((u, i) => `
            <span class="totals-user">
              <span class="avatar ${AVATAR_CLASS[u]} avatar--xs">V</span>
              <span>${NAMES[u]} <b>${perUser[i]}</b></span>
            </span>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  el.innerHTML = cards;
}

// --- render: detalhamento por pessoa (por dia) ----------------------
function renderBreakdown(dataByUser, opts = {}) {
  const { period = _currentPeriod, singleDate = _calState.selectedDate } = opts;
  const el = document.getElementById("breakdown");
  const combinedEl = document.getElementById("breakdown-combined");

  const filterFn = singleDate
    ? (d) => d.date === singleDate
    : (() => {
        const [start, end] = periodRange(period);
        return (d) => d.date >= start && d.date <= end;
      })();

  const perUserResult = USERS.map(u => {
    const days = dataByUser[u].filter(filterFn);
    const dayBreakdowns = breakdownByDay(days);
    const total = dayBreakdowns.reduce((s, b) => s + b.total, 0);
    return { user: u, dayBreakdowns, total };
  });

  const renderDayBlock = ({ date, lines, total: subtotal }) => {
    const subKlass = subtotal < 0 ? "is-bad" : (subtotal > 0 ? "is-good" : "");
    const rows = lines.map(l => `
      <div class="bd-row bd-row--${l.kind}">
        <span class="bd-label">${l.label}${l.count > 1 ? ` ×${l.count}` : ""}</span>
        <span class="bd-pts">${fmtPts(l.pts)}</span>
      </div>
    `).join("");
    return `
      <div class="bd-day">
        <div class="bd-day-label">${fmtDayFull(date)}</div>
        <div class="bd-day-rows">${rows}</div>
        <div class="bd-day-subtotal ${subKlass}">
          <span>Subtotal</span>
          <span>${fmtPts(subtotal)} pts</span>
        </div>
      </div>
    `;
  };

  const cols = perUserResult.map(({ user, dayBreakdowns, total }) => {
    const totalKlass = total < 0 ? "is-bad" : (total > 0 ? "is-good" : "");
    const body = dayBreakdowns.length === 0
      ? `<div class="bd-empty muted">nada marcado no período</div>`
      : dayBreakdowns.map(renderDayBlock).join("");
    return `
      <div class="bd-card" data-user="${user}">
        <div class="bd-head">
          <span class="avatar ${AVATAR_CLASS[user]} avatar--sm">V</span>
          <span class="bd-name">${NAMES[user]}</span>
        </div>
        <div class="bd-body">${body}</div>
        <div class="bd-total ${totalKlass}">
          <span>Total</span>
          <span>${fmtPts(total)} pts</span>
        </div>
      </div>
    `;
  }).join("");

  el.innerHTML = cols;

  const combinedTotal = perUserResult.reduce((s, r) => s + r.total, 0);
  const combinedKlass = combinedTotal < 0 ? "is-bad" : "";
  const label = singleDate
    ? `dia · ${fmtDayFull(singleDate)}`
    : `somado · ${PERIOD_LABELS[period]}`;
  const clearBtn = singleDate
    ? `<button type="button" class="link-btn" id="bd-clear-day" style="margin-left:10px">voltar pro período</button>`
    : "";
  combinedEl.innerHTML = `
    <div class="bd-combined-card ${combinedKlass}">
      <span class="bd-combined-label">${label}${clearBtn}</span>
      <span class="bd-combined-value">${fmtPts(combinedTotal)} pts</span>
    </div>
  `;
  const clearEl = document.getElementById("bd-clear-day");
  if (clearEl) clearEl.addEventListener("click", () => {
    _calState.selectedDate = null;
    renderBreakdown(_data);
    renderDailyCalendar();
  });
}

// --- calendário diário dinâmico ------------------------------------
function ensureCalInit() {
  if (_calState.year === null) {
    const t = new Date();
    _calState.year = t.getFullYear();
    _calState.month = t.getMonth();
  }
}

function renderDailyCalendar() {
  ensureCalInit();
  const grid = document.getElementById("dcal-grid");
  if (!grid || !_data) return;
  const { year, month, selectedDate } = _calState;
  const today = todayISO();

  document.getElementById("dcal-month-label").textContent = `${MONTHS_PT[month]} ${year}`;

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const viniByDate = new Map(_data.vinicius.map(d => [d.date, pointsForDay(d)]));
  const vicByDate  = new Map(_data.victoria.map(d => [d.date, pointsForDay(d)]));

  let html = DOW_PT.map(d => `<div class="dcal-head">${d}</div>`).join("");
  for (let i = 0; i < firstDow; i++) {
    html += `<div class="dcal-cell is-empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const isBeforeStart = dateStr < APP_START_DATE;
    const isFuture = dateStr > today;
    const viniPts = viniByDate.get(dateStr) || 0;
    const vicPts  = vicByDate.get(dateStr) || 0;
    const combined = viniPts + vicPts;
    const hasAny = viniByDate.has(dateStr) || vicByDate.has(dateStr);

    let cls = "dcal-cell";
    if (isToday) cls += " is-today";
    if (isSelected) cls += " is-selected";
    if (isBeforeStart || isFuture) cls += " is-disabled";
    if (!isBeforeStart && !isFuture && hasAny) {
      if (combined > 0) cls += " has-bonus";
      else if (combined < 0) cls += " has-penalty";
    }

    const fmt = (n) => n > 0 ? `+${n}` : (n < 0 ? `${n}` : "");
    const showScores = hasAny && (viniPts !== 0 || vicPts !== 0);

    html += `
      <div class="${cls}" data-date="${dateStr}">
        <span class="dcal-day-num">${d}</span>
        ${showScores ? `
          <div class="dcal-scores">
            <span class="dcal-pts dcal-pts--vini">${fmt(viniPts)}</span>
            <span class="dcal-pts dcal-pts--vic">${fmt(vicPts)}</span>
          </div>
        ` : ""}
      </div>
    `;
  }
  grid.innerHTML = html;

  // listeners
  grid.querySelectorAll(".dcal-cell:not(.is-empty):not(.is-disabled)").forEach(cell => {
    cell.addEventListener("click", () => {
      const date = cell.dataset.date;
      if (!date) return;
      if (_calState.selectedDate === date) {
        // toggle off — volta pro modo período
        _calState.selectedDate = null;
      } else {
        _calState.selectedDate = date;
      }
      renderBreakdown(_data);
      renderDailyCalendar();
      // rola pra cima pra ver o breakdown atualizado
      const bdEl = document.getElementById("breakdown");
      if (bdEl && _calState.selectedDate) {
        bdEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function attachCalendarNav() {
  const prev = document.getElementById("dcal-prev");
  const next = document.getElementById("dcal-next");
  if (prev) prev.addEventListener("click", () => {
    ensureCalInit();
    _calState.month -= 1;
    if (_calState.month < 0) { _calState.month = 11; _calState.year -= 1; }
    renderDailyCalendar();
  });
  if (next) next.addEventListener("click", () => {
    ensureCalInit();
    _calState.month += 1;
    if (_calState.month > 11) { _calState.month = 0; _calState.year += 1; }
    renderDailyCalendar();
  });
}

function fmtDayMonthBR(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function renderHeaderPeriod() {
  const el = document.getElementById("period-info");
  if (!el) return;
  const [ws] = periodRange("weekly");
  el.textContent = `semana desde ${fmtDayMonthBR(ws)}`;
}

async function initPointsPage(user) {
  renderAuthFooter(user);
  try {
    renderHeaderPeriod();
    await loadAndApplyConfig();
    _data = await loadAllData();
    renderTotals(_data);
    renderBreakdown(_data);
    renderDailyCalendar();
    attachCalendarNav();
    document.getElementById("breakdown-period").addEventListener("change", (e) => {
      _currentPeriod = e.target.value;
      // mudar período sai do modo "single day"
      _calState.selectedDate = null;
      renderBreakdown(_data);
      renderDailyCalendar();
    });
  } catch (err) {
    console.error(err);
    document.getElementById("totals").innerHTML =
      `<p class="muted" style="padding:8px">erro ao carregar: ${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({ onAuthorized: (user) => initPointsPage(user) });
});
