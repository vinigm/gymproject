// Página de pontuação — cálculo + renderização.
// Toda configuração editável fica em ./points-config.js.

import { getRange } from "./storage.js";
import { todayISO, USERS, APP_START_DATE } from "./app.js";
import { POINTS, REWARDS } from "./points-config.js";

const NAMES = { vinicius: "Vinicius", victoria: "Victoria" };
const AVATAR_CLASS = { vinicius: "avatar--vini", victoria: "avatar--vic" };

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PERIOD_LABELS = {
  weekly:  "esta semana",
  monthly: "este mês",
  all:     "total",
};

// --- pontos por dia -------------------------------------------------
function pointsForDay(day) {
  if (!day) return 0;
  let pts = 0;
  for (const ex of (day.exercises || [])) {
    pts += POINTS.exercises?.[ex] || 0;
  }
  if (day.water && POINTS.water?.[day.water] != null) {
    pts += POINTS.water[day.water];
  }
  if (day.lunch && POINTS.meals?.lunch?.[day.lunch] != null) {
    pts += POINTS.meals.lunch[day.lunch];
  }
  if (day.dinner && POINTS.meals?.dinner?.[day.dinner] != null) {
    pts += POINTS.meals.dinner[day.dinner];
  }
  if (day.cigarettes != null && day.cigarettes !== "") {
    pts += Number(day.cigarettes) * (POINTS.cigarettes || 0);
  }
  return pts;
}

// --- períodos -------------------------------------------------------
function weekStartISO() {
  // Segunda-feira da semana atual
  const t = new Date();
  const dow = t.getDay(); // 0=dom, 1=seg, ..., 6=sáb
  const offset = dow === 0 ? -6 : (1 - dow);
  const s = new Date(t.getFullYear(), t.getMonth(), t.getDate() + offset);
  return toISO(s);
}
function monthStartISO() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-01`;
}
function clampStart(iso) {
  return iso < APP_START_DATE ? APP_START_DATE : iso;
}
function periodRange(period) {
  const end = todayISO();
  let start;
  if (period === "weekly")       start = weekStartISO();
  else if (period === "monthly") start = monthStartISO();
  else                           start = APP_START_DATE;
  return [clampStart(start), end];
}

// --- soma por período -----------------------------------------------
function pointsInPeriod(userDays, period) {
  const [start, end] = periodRange(period);
  let total = 0;
  for (const d of userDays) {
    if (d.date >= start && d.date <= end) total += pointsForDay(d);
  }
  return total;
}

// --- carregamento ---------------------------------------------------
async function loadAllData() {
  const end = todayISO();
  const start = APP_START_DATE;
  const results = await Promise.all(
    USERS.map(u => getRange(u, start, end).catch(() => []))
  );
  return Object.fromEntries(USERS.map((u, i) => [u, results[i]]));
}

// --- render: totais -------------------------------------------------
function renderTotals(dataByUser) {
  const el = document.getElementById("totals");
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

// --- render: prêmios ------------------------------------------------
function renderRewards(dataByUser) {
  const el = document.getElementById("rewards");
  if (!REWARDS || REWARDS.length === 0) {
    el.innerHTML = `<p class="muted" style="padding:8px">nenhum prêmio configurado. edite <code>js/points-config.js</code> pra adicionar.</p>`;
    return;
  }

  const cards = REWARDS.map(r => {
    const combined =
      USERS.reduce((sum, u) => sum + pointsInPeriod(dataByUser[u], r.period), 0);
    const target = Math.max(1, r.target || 1);
    const rawPct = (combined / target) * 100;
    const pct = Math.max(0, Math.min(100, Math.round(rawPct)));
    const achieved = combined >= target;
    const missing = Math.max(0, target - combined);

    return `
      <div class="reward-card${achieved ? " is-achieved" : ""}">
        <div class="reward-header">
          <span class="reward-icon">${r.icon || "🎁"}</span>
          <div class="reward-name-wrap">
            <div class="reward-name">${r.name}</div>
            ${r.description ? `<div class="reward-desc">${r.description}</div>` : ""}
          </div>
          <span class="reward-period">${PERIOD_LABELS[r.period] || r.period}</span>
        </div>
        <div class="reward-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <div class="reward-stats">
          <span><span class="pts-current">${combined}</span> / ${target} pts</span>
          ${achieved
            ? `<span class="reward-status reward-status--good">✓ desbloqueado</span>`
            : `<span class="reward-status">faltam ${missing}</span>`}
        </div>
      </div>
    `;
  }).join("");

  el.innerHTML = cards;
}

// --- info de período no header --------------------------------------
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

// --- bootstrap ------------------------------------------------------
(async () => {
  try {
    renderHeaderPeriod();
    const data = await loadAllData();
    renderTotals(data);
    renderRewards(data);
  } catch (err) {
    console.error(err);
    document.getElementById("totals").innerHTML =
      `<p class="muted" style="padding:8px">erro ao carregar: ${err.message}</p>`;
    document.getElementById("rewards").innerHTML = "";
  }
})();
