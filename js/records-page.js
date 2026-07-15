import { USERS } from "./app.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import {
  loadAllData,
  loadAndApplyConfig,
  getBestDay, getBestWeek, getBestMonth,
  fmtDayFull, fmtWeekRange, fmtMonth, fmtPts,
} from "./points-utils.js";
import {
  DEFAULT_TRACKING_SCOPE,
  filterDataByUserForTrackingScope,
  mountTrackingScopeControl,
} from "./tracking-cycle.js";

const NAMES = { vinicius: "Vinicius", victoria: "Vivi" };
const AVATAR_CLASS = { vinicius: "avatar--vini", victoria: "avatar--vic" };
let _allData = { vinicius: [], victoria: [] };
let _trackingScope = DEFAULT_TRACKING_SCOPE;

function computeAllRecords(dataByUser) {
  return Object.fromEntries(USERS.map(u => [u, {
    bestDay:   getBestDay(dataByUser[u]),
    bestWeek:  getBestWeek(dataByUser[u]),
    bestMonth: getBestMonth(dataByUser[u]),
  }]));
}

function findTopByPeriod(allRecords, field, fmtWhen) {
  let top = null;
  for (const u of USERS) {
    const rec = allRecords[u][field];
    if (!rec) continue;
    if (!top || rec.total > top.points) {
      top = { user: u, points: rec.total, when: fmtWhen(rec) };
    }
  }
  return top;
}

function renderRecordsBanner(allRecords) {
  const el = document.getElementById("records-banner");
  if (!el) return;

  const banners = [
    { label: "Recorde de dia",    top: findTopByPeriod(allRecords, "bestDay",   r => fmtDayFull(r.date)) },
    { label: "Recorde de semana", top: findTopByPeriod(allRecords, "bestWeek",  r => fmtWeekRange(r.weekStart)) },
    { label: "Recorde de mês",    top: findTopByPeriod(allRecords, "bestMonth", r => fmtMonth(r.monthKey)) },
  ];

  if (banners.every(b => !b.top)) {
    el.innerHTML = `<div class="banner-empty muted">sem recordes ainda — registre pontos pra começar</div>`;
    return;
  }

  el.innerHTML = banners.map(({ label, top }) => {
    if (!top) {
      return `
        <div class="banner-card banner-card--empty">
          <div class="banner-icon" aria-hidden="true">🏆</div>
          <div class="banner-body">
            <div class="banner-label">${label}</div>
            <div class="banner-value-empty">sem dados ainda</div>
          </div>
        </div>
      `;
    }
    return `
      <div class="banner-card" data-user="${top.user}">
        <div class="banner-icon" aria-hidden="true">🏆</div>
        <div class="banner-body">
          <div class="banner-label">${label}</div>
          <div class="banner-value">${fmtPts(top.points)} pts</div>
          <div class="banner-meta">
            <span class="avatar ${AVATAR_CLASS[top.user]} avatar--xs">V</span>
            <span>${NAMES[top.user]} · ${top.when}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderRecordCard(label, pts, whenLabel, lines) {
  const ptsKlass = pts < 0 ? "is-bad" : (pts > 0 ? "is-good" : "");
  const rows = lines.length === 0
    ? `<div class="rec-empty muted">sem itens</div>`
    : lines.map(l => `
        <div class="bd-row bd-row--${l.kind}">
          <span class="bd-label">${l.label}${l.count > 1 ? ` ×${l.count}` : ""}</span>
          <span class="bd-pts">${fmtPts(l.pts)}</span>
        </div>
      `).join("");
  return `
    <div class="rec-card">
      <div class="rec-head">
        <span class="rec-label">${label}</span>
        <span class="rec-pts ${ptsKlass}">${fmtPts(pts)} pts</span>
      </div>
      <div class="rec-when">${whenLabel}</div>
      <div class="rec-rows">${rows}</div>
    </div>
  `;
}

function renderEmptyRecord(label) {
  return `
    <div class="rec-card rec-card--empty">
      <div class="rec-head">
        <span class="rec-label">${label}</span>
        <span class="rec-pts muted">—</span>
      </div>
      <div class="rec-empty muted">sem dados ainda</div>
    </div>
  `;
}

function renderRecords(allRecords) {
  const el = document.getElementById("records");
  if (!el) return;
  const cols = USERS.map(u => {
    const { bestDay, bestWeek, bestMonth } = allRecords[u];
    const dayCard = bestDay
      ? renderRecordCard("Melhor dia", bestDay.total, fmtDayFull(bestDay.date), bestDay.lines)
      : renderEmptyRecord("Melhor dia");
    const weekCard = bestWeek
      ? renderRecordCard("Melhor semana", bestWeek.total, fmtWeekRange(bestWeek.weekStart), bestWeek.lines)
      : renderEmptyRecord("Melhor semana");
    const monthCard = bestMonth
      ? renderRecordCard("Melhor mês", bestMonth.total, fmtMonth(bestMonth.monthKey), bestMonth.lines)
      : renderEmptyRecord("Melhor mês");
    return `
      <div class="rec-col" data-user="${u}">
        <div class="rec-col-head">
          <span class="avatar ${AVATAR_CLASS[u]} avatar--sm">V</span>
          <span class="rec-col-name">${NAMES[u]}</span>
        </div>
        ${dayCard}
        ${weekCard}
        ${monthCard}
      </div>
    `;
  }).join("");
  el.innerHTML = cols;
}

function renderCurrentRecords() {
  const scopedData = filterDataByUserForTrackingScope(_allData, _trackingScope);
  const allRecords = computeAllRecords(scopedData);
  renderRecordsBanner(allRecords);
  renderRecords(allRecords);
}

function renderTrackingControl() {
  mountTrackingScopeControl("records-cycle-scope", {
    scope: _trackingScope,
    onChange: (nextScope) => {
      _trackingScope = nextScope;
      renderTrackingControl();
      renderCurrentRecords();
    },
  });
}

async function initRecordsPage(user) {
  renderAuthFooter(user);
  renderTrackingControl();
  try {
    await loadAndApplyConfig();
    _allData = await loadAllData();
    renderCurrentRecords();
  } catch (err) {
    console.error(err);
    document.getElementById("records").innerHTML =
      `<p class="muted" style="padding:8px">erro ao carregar: ${err.message}</p>`;
  } finally {
    document.body.classList.remove("is-loading");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({ onAuthorized: (user) => initRecordsPage(user) });
});
