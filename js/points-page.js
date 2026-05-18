// Página de pontuação — cálculo + renderização.
// Toda configuração editável fica em ./points-config.js.

import { getRange } from "./storage.js";
import { todayISO, USERS, APP_START_DATE } from "./app.js";
import { POINTS, REWARDS } from "./points-config.js";
import { pointsForDay } from "./points-engine.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";

const NAMES = { vinicius: "Vinicius", victoria: "Victoria" };
const AVATAR_CLASS = { vinicius: "avatar--vini", victoria: "avatar--vic" };
const EX_LABELS = {
  academia: "Academia", corrida: "Corrida", yoga: "Yoga",
  jiujitsu: "Jiu Jitsu", bicicleta: "Bicicleta"
};
const EXTRA_LABELS = {
  marmita: "Marmita", vegetais: "Vegetais", fruta: "Fruta",
  cafe: "Café manhã", mercado: "Mercado", escada: "Escada",
  leitura: "Leitura", conversa: "Conversa", skincare: "Skincare",
  suplemento: "Suplemento"
};

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PERIOD_LABELS = {
  weekly:  "esta semana",
  monthly: "este mês",
  all:     "total",
};

// --- pontos por dia: importado de ./points-engine.js ---------------

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

// --- breakdown por categoria ----------------------------------------
// Retorna lista de linhas mostrando o que somou/perdeu cada categoria,
// pra exibir item a item por pessoa.
function breakdownForDays(days) {
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

  // Exercícios — uma linha por modalidade praticada
  for (const [ex, count] of Object.entries(exerciseCounts)) {
    const ptsPer = POINTS.exercises?.[ex] || 0;
    if (count > 0 && ptsPer !== 0) {
      lines.push({
        label: EX_LABELS[ex] || ex,
        count, pts: ptsPer * count,
        kind: ptsPer > 0 ? "good" : "bad"
      });
    }
  }

  // Água — uma linha só, agregada (dias com água marcada)
  if (waterDays > 0 && waterPts !== 0) {
    lines.push({
      label: "Água",
      count: waterDays, pts: waterPts,
      kind: waterPts > 0 ? "good" : "bad"
    });
  }

  // Refeições — separar limpo / sujo por slot
  const mealRow = (label, c, pPer) => {
    if (c > 0 && pPer !== 0) {
      lines.push({ label, count: c, pts: pPer * c, kind: pPer > 0 ? "good" : "bad" });
    }
  };
  mealRow("Almoço limpo", lunchClean,  POINTS.meals?.lunch?.limpo  || 0);
  mealRow("Almoço sujo",  lunchDirty,  POINTS.meals?.lunch?.sujo   || 0);
  mealRow("Janta limpa",  dinnerClean, POINTS.meals?.dinner?.limpo || 0);
  mealRow("Janta suja",   dinnerDirty, POINTS.meals?.dinner?.sujo  || 0);

  // Cigarros — count é o total de cigarros, não dias
  if (cigTotal > 0 && (POINTS.cigarettes || 0) !== 0) {
    const pPer = POINTS.cigarettes;
    lines.push({
      label: "Cigarros",
      count: cigTotal, pts: pPer * cigTotal,
      kind: pPer > 0 ? "good" : "bad"
    });
  }

  // Sobremesa
  const yesNoRow = (label, c, pPer) => {
    if (c > 0 && pPer !== 0) {
      lines.push({ label, count: c, pts: pPer * c, kind: pPer > 0 ? "good" : "bad" });
    }
  };
  yesNoRow("Sem sobremesa",   dessertNao, POINTS.dessert?.nao || 0);
  yesNoRow("Sobremesa (sim)", dessertSim, POINTS.dessert?.sim || 0);
  yesNoRow("Sem refrigerante",   sodaNao, POINTS.soda?.nao || 0);
  yesNoRow("Refrigerante (sim)", sodaSim, POINTS.soda?.sim || 0);

  // Outros hábitos — uma linha por hábito praticado
  for (const [key, count] of Object.entries(extrasCounts)) {
    const ptsPer = POINTS.extras?.[key] || 0;
    if (count > 0 && ptsPer !== 0) {
      lines.push({
        label: EXTRA_LABELS[key] || key,
        count, pts: ptsPer * count,
        kind: ptsPer > 0 ? "good" : "bad"
      });
    }
  }

  // Positivos primeiro, depois negativos; cada grupo ordenado por magnitude
  lines.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "good" ? -1 : 1;
    return Math.abs(b.pts) - Math.abs(a.pts);
  });

  const total = lines.reduce((s, l) => s + l.pts, 0);
  return { lines, total };
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

// --- render: detalhamento por pessoa --------------------------------
function fmtPts(n) {
  return `${n >= 0 ? "+" : ""}${n}`;
}

function fmtDayFull(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  // "segunda-feira" → "Segunda Feira"
  const wkRaw = date.toLocaleDateString("pt-BR", { weekday: "long" });
  const wk = wkRaw.split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${dd}/${mm}/${y} - ${wk}`;
}

// --- recordes -------------------------------------------------------

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function mondayOfWeek(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const offset = dow === 0 ? -6 : (1 - dow);
  date.setDate(date.getDate() + offset);
  return toISO(date);
}

function fmtWeekRange(startISO) {
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const dm = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${dm(start)} – ${dm(end)}/${end.getFullYear()}`;
}

function fmtMonth(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${MONTHS_PT[m - 1]} ${y}`;
}

function getBestDay(userDays) {
  let best = null;
  for (const d of userDays) {
    const { lines, total } = breakdownForDays([d]);
    if (lines.length === 0) continue;
    if (!best || total > best.total) {
      best = { date: d.date, total, lines };
    }
  }
  return best;
}

function getBestWeek(userDays) {
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
    if (!best || total > best.total) {
      best = { weekStart: wkStart, total, lines };
    }
  }
  return best;
}

function getBestMonth(userDays) {
  const months = new Map();
  for (const d of userDays) {
    const key = d.date.slice(0, 7); // YYYY-MM
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(d);
  }
  let best = null;
  for (const [key, days] of months) {
    const { lines, total } = breakdownForDays(days);
    if (lines.length === 0) continue;
    if (!best || total > best.total) {
      best = { monthKey: key, total, lines };
    }
  }
  return best;
}

// Quebra os dias em blocos individuais com o breakdown de cada um
function breakdownByDay(days) {
  return [...days]
    .sort((a, b) => b.date.localeCompare(a.date))  // mais recente primeiro
    .map(d => {
      const { lines, total } = breakdownForDays([d]);
      return { date: d.date, lines, total };
    })
    .filter(b => b.lines.length > 0);
}

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

  // total combinado (que conta pros prêmios desse período)
  const combinedTotal = perUserResult.reduce((s, r) => s + r.total, 0);
  const combinedKlass = combinedTotal < 0 ? "is-bad" : "";
  combinedEl.innerHTML = `
    <div class="bd-combined-card ${combinedKlass}">
      <span class="bd-combined-label">somado · ${PERIOD_LABELS[period]}</span>
      <span class="bd-combined-value">${fmtPts(combinedTotal)} pts</span>
    </div>
  `;
}

// --- render: recordes -----------------------------------------------
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

function computeAllRecords(dataByUser) {
  return Object.fromEntries(USERS.map(u => {
    const days = dataByUser[u];
    return [u, {
      bestDay:   getBestDay(days),
      bestWeek:  getBestWeek(days),
      bestMonth: getBestMonth(days),
    }];
  }));
}

function findTopRecord(allRecords) {
  const entries = [
    { kind: "Melhor dia",    field: "bestDay",   when: r => fmtDayFull(r.date) },
    { kind: "Melhor semana", field: "bestWeek",  when: r => fmtWeekRange(r.weekStart) },
    { kind: "Melhor mês",    field: "bestMonth", when: r => fmtMonth(r.monthKey) },
  ];
  let top = null;
  for (const u of USERS) {
    for (const e of entries) {
      const rec = allRecords[u][e.field];
      if (!rec) continue;
      if (!top || rec.total > top.points) {
        top = { user: u, kind: e.kind, points: rec.total, when: e.when(rec) };
      }
    }
  }
  return top;
}

function renderRecordsBanner(allRecords) {
  const el = document.getElementById("records-banner");
  if (!el) return;
  const top = findTopRecord(allRecords);
  if (!top) {
    el.innerHTML = `<div class="banner-empty muted">sem recordes ainda — registre pontos pra começar</div>`;
    return;
  }
  el.innerHTML = `
    <div class="banner-card" data-user="${top.user}">
      <div class="banner-icon" aria-hidden="true">🏆</div>
      <div class="banner-body">
        <div class="banner-label">Recorde geral</div>
        <div class="banner-value">${fmtPts(top.points)} pts</div>
        <div class="banner-meta">
          <span class="avatar ${AVATAR_CLASS[top.user]} avatar--xs">V</span>
          <span>${NAMES[top.user]} · ${top.kind} · ${top.when}</span>
        </div>
      </div>
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

// --- render: prêmios ------------------------------------------------
function renderRewards(dataByUser) {
  const el = document.getElementById("rewards");
  if (!REWARDS || REWARDS.length === 0) {
    el.innerHTML = `<p class="muted" style="padding:8px">nenhum prêmio configurado. edite <code>js/points-config.js</code> pra adicionar.</p>`;
    return;
  }

  // Por enquanto cada prêmio mede o acumulado de todo o histórico ("all").
  // Quando virmos o wallet/loja com botão de comprar, isso muda.
  const cards = REWARDS.map(r => {
    const combined =
      USERS.reduce((sum, u) => sum + pointsInPeriod(dataByUser[u], "all"), 0);
    const price = Math.max(1, r.price ?? r.target ?? 1);
    const rawPct = (combined / price) * 100;
    const pct = Math.max(0, Math.min(100, Math.round(rawPct)));
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
async function initPointsPage(user) {
  renderAuthFooter(user);
  try {
    renderHeaderPeriod();
    const data = await loadAllData();
    renderTotals(data);
    renderBreakdown(data, "weekly");
    renderRewards(data);
    const allRecords = computeAllRecords(data);
    renderRecordsBanner(allRecords);
    renderRecords(allRecords);

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
  // Só inicializa após autenticação confirmada e email autorizado
  setupAuthGate({
    onAuthorized: (user) => { initPointsPage(user); }
  });
});
