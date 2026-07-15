import { USERS } from "./app.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import { pointsForDay } from "./points-engine.js";
import {
  loadAllData,
  loadAndApplyConfig,
  aggregateByWeek, aggregateByMonth,
} from "./points-utils.js";
import {
  DEFAULT_TRACKING_SCOPE,
  filterDataByUserForTrackingScope,
  mountTrackingScopeControl,
} from "./tracking-cycle.js";

const AVATAR_CLASS = { vinicius: "avatar--vini", victoria: "avatar--vic" };
let _allData = { vinicius: [], victoria: [] };
let _trackingScope = DEFAULT_TRACKING_SCOPE;

function compareBuckets(vMap, cMap) {
  const all = new Set([...vMap.keys(), ...cMap.keys()]);
  let v = 0, c = 0;
  for (const k of all) {
    const a = vMap.get(k) || 0;
    const b = cMap.get(k) || 0;
    if (a > b) v++;
    else if (b > a) c++;
  }
  return { vinicius: v, victoria: c };
}

function computeScores(dataByUser) {
  const allDates = new Set();
  USERS.forEach(u => dataByUser[u].forEach(d => allDates.add(d.date)));
  const vDays = new Map(dataByUser.vinicius.map(d => [d.date, pointsForDay(d)]));
  const cDays = new Map(dataByUser.victoria.map(d => [d.date, pointsForDay(d)]));
  const filteredV = new Map([...vDays].filter(([k]) => allDates.has(k)));
  const filteredC = new Map([...cDays].filter(([k]) => allDates.has(k)));
  return {
    days:   compareBuckets(filteredV, filteredC),
    weeks:  compareBuckets(aggregateByWeek(dataByUser.vinicius),  aggregateByWeek(dataByUser.victoria)),
    months: compareBuckets(aggregateByMonth(dataByUser.vinicius), aggregateByMonth(dataByUser.victoria)),
  };
}

function renderScoreboards(scores) {
  const el = document.getElementById("scoreboards");
  if (!el) return;

  const items = [
    { key: "days",   label: "Dias",    sing: "dia",    plur: "dias" },
    { key: "weeks",  label: "Semanas", sing: "semana", plur: "semanas" },
    { key: "months", label: "Meses",   sing: "mês",    plur: "meses" },
  ];

  el.innerHTML = items.map(({ key, label, sing, plur }) => {
    const s = scores[key];
    const vini = s.vinicius;
    const vic  = s.victoria;
    const diff = Math.abs(vini - vic);
    const total = vini + vic;

    let headline, leaderData = "";
    if (total === 0) {
      headline = `<span class="sb-headline sb-headline--neutral">Sem placares ainda</span>`;
    } else if (vini === vic) {
      headline = `<span class="sb-headline sb-headline--neutral">Empate</span>`;
    } else if (vini > vic) {
      leaderData = `data-leader="vinicius"`;
      headline = `
        <span class="avatar avatar--vini avatar--sm">V</span>
        <span class="sb-headline sb-headline--vini">Vinicius ganhando por ${diff} ${diff === 1 ? sing : plur}</span>
      `;
    } else {
      leaderData = `data-leader="victoria"`;
      headline = `
        <span class="avatar avatar--vic avatar--sm">V</span>
        <span class="sb-headline sb-headline--vic">Vivi ganhando por ${diff} ${diff === 1 ? sing : plur}</span>
      `;
    }

    const viniLeading = vini > vic;
    const vicLeading  = vic > vini;

    return `
      <div class="sb-card" ${leaderData}>
        <div class="sb-label">🏅 ${label}</div>
        <div class="sb-headline-row">${headline}</div>
        <div class="sb-score">
          <span class="sb-side sb-side--vini${viniLeading ? " is-winning" : ""}">
            <span class="avatar avatar--vini avatar--xs">V</span>
            <span class="sb-side-name">Vini</span>
            <span class="sb-side-num">${vini}</span>
          </span>
          <span class="sb-x">×</span>
          <span class="sb-side sb-side--vic${vicLeading ? " is-winning" : ""}">
            <span class="sb-side-num">${vic}</span>
            <span class="sb-side-name">Vivi</span>
            <span class="avatar avatar--vic avatar--xs">V</span>
          </span>
        </div>
      </div>
    `;
  }).join("");
}

function renderCurrentScoreboards() {
  const scopedData = filterDataByUserForTrackingScope(_allData, _trackingScope);
  renderScoreboards(computeScores(scopedData));
}

function renderTrackingControl() {
  mountTrackingScopeControl("scoreboards-cycle-scope", {
    scope: _trackingScope,
    onChange: (nextScope) => {
      _trackingScope = nextScope;
      renderTrackingControl();
      renderCurrentScoreboards();
    },
  });
}

async function initPlacaresPage(user) {
  renderAuthFooter(user);
  renderTrackingControl();
  try {
    await loadAndApplyConfig();
    _allData = await loadAllData();
    renderCurrentScoreboards();
  } catch (err) {
    console.error(err);
    document.getElementById("scoreboards").innerHTML =
      `<p class="muted" style="padding:8px">erro ao carregar: ${err.message}</p>`;
  } finally {
    document.body.classList.remove("is-loading");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({ onAuthorized: (user) => initPlacaresPage(user) });
});
