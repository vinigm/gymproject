// Página de pontuação (geral) — totais, detalhamento por pessoa e loja conjunta.
// Recordes e Placares migraram pra páginas próprias (recordes.html, placares.html).
// Loja pessoal da Vic está em victoria.html.

import { todayISO, USERS, APP_START_DATE } from "./app.js";
import { POINTS, REWARDS } from "./points-config.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import {
  loadAllData,
  pointsInPeriod,
  breakdownForDays, breakdownByDay,
  fmtPts, fmtDayFull, fmtDayShort,
  PERIOD_LABELS, periodRange,
} from "./points-utils.js";

const NAMES = { vinicius: "Vinicius", victoria: "Victoria" };
const AVATAR_CLASS = { vinicius: "avatar--vini", victoria: "avatar--vic" };

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
function renderBreakdown(dataByUser, period) {
  const el = document.getElementById("breakdown");
  const combinedEl = document.getElementById("breakdown-combined");
  const [start, end] = periodRange(period);

  const perUserResult = USERS.map(u => {
    const days = dataByUser[u].filter(d => d.date >= start && d.date <= end);
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
  combinedEl.innerHTML = `
    <div class="bd-combined-card ${combinedKlass}">
      <span class="bd-combined-label">somado · ${PERIOD_LABELS[period]}</span>
      <span class="bd-combined-value">${fmtPts(combinedTotal)} pts</span>
    </div>
  `;
}

// --- render: prêmios conjuntos --------------------------------------
function renderRewards(dataByUser) {
  const el = document.getElementById("rewards");
  if (!REWARDS || REWARDS.length === 0) {
    el.innerHTML = `<p class="muted" style="padding:8px">nenhum prêmio configurado. edite <code>js/points-config.js</code>.</p>`;
    return;
  }
  // Por enquanto cada prêmio mede o acumulado de todo histórico (sem desconto).
  const cards = REWARDS.map(r => {
    const combined = USERS.reduce((sum, u) => sum + pointsInPeriod(dataByUser[u], "all"), 0);
    const price = Math.max(1, r.price ?? r.target ?? 1);
    const pct = Math.max(0, Math.min(100, Math.round((combined / price) * 100)));
    const achieved = combined >= price;
    const missing = Math.max(0, price - combined);
    return `
      <div class="reward-card${achieved ? " is-achieved" : ""}">
        <div class="reward-header">
          <span class="reward-icon">${r.icon || "🎁"}</span>
          <div class="reward-name-wrap">
            <div class="reward-name">${r.name}</div>
            ${r.description ? `<div class="reward-desc">${r.description}</div>` : ""}
          </div>
          <span class="reward-period">${price} pts</span>
        </div>
        <div class="reward-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <div class="reward-stats">
          <span><span class="pts-current">${combined}</span> / ${price} pts</span>
          ${achieved
            ? `<span class="reward-status reward-status--good">✓ pode comprar</span>`
            : `<span class="reward-status">faltam ${missing}</span>`}
        </div>
      </div>
    `;
  }).join("");
  el.innerHTML = cards;
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
    const data = await loadAllData();
    renderTotals(data);
    renderBreakdown(data, "weekly");
    renderRewards(data);
    document.getElementById("breakdown-period").addEventListener("change", (e) => {
      renderBreakdown(data, e.target.value);
    });
  } catch (err) {
    console.error(err);
    document.getElementById("totals").innerHTML =
      `<p class="muted" style="padding:8px">erro ao carregar: ${err.message}</p>`;
    document.getElementById("rewards").innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupAuthGate({ onAuthorized: (user) => initPointsPage(user) });
});
