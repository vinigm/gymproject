import { getRange } from "./storage.js";
import { todayISO, USERS } from "./app.js";

const EX_LABELS = {
  academia: "Academia", corrida: "Corrida", yoga: "Yoga",
  jiujitsu: "Jiu Jitsu", bicicleta: "Bicicleta"
};
const NAMES = { vinicius: "Vinicius", victoria: "Victoria" };
const AVATAR_CLASS = { vinicius: "avatar--vini", victoria: "avatar--vic" };

function shiftISO(iso, deltaDays) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const bar = (p) => `<div class="bar"><i style="width:${p}%"></i></div>`;

function monthStartISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-01`;
}
function daysElapsedInMonth() {
  return new Date().getDate(); // 1..31
}

function waterLitres(v) {
  if (v === "1L") return 1;
  if (v === "1.5L") return 1.5;
  if (v === "2L") return 2;
  return 0;
}

function fmtLitres(n) {
  return n.toFixed(1).replace(".", ",") + "L";
}

function streakOfExercise(byDate) {
  let streak = 0;
  let cursor = todayISO();
  while (true) {
    const day = byDate.get(cursor);
    if (day && day.exercises && day.exercises.length > 0) {
      streak++;
      cursor = shiftISO(cursor, -1);
    } else break;
  }
  return streak;
}

function semiDonut(clean, dirty) {
  const total = clean + dirty;
  const pClean = total > 0 ? (clean / total) * 100 : 0;
  const pDirty = total > 0 ? 100 - pClean : 0;

  return `
    <div class="donut">
      <svg viewBox="0 0 200 130" class="donut-svg" aria-hidden="true">
        <path d="M 20 100 A 80 80 0 0 1 180 100"
              class="donut-bg" pathLength="100"/>
        <path d="M 20 100 A 80 80 0 0 1 180 100"
              class="donut-fg" pathLength="100"
              stroke-dasharray="${pClean} 100"/>
        <text x="100" y="88" class="donut-total">${total}</text>
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

function renderUserCol(userId, rangeData, monthData, totalDays) {
  const byDate = new Map(rangeData.map(d => [d.date, d]));

  // === RANGE (7/30/90) ===
  const exCount = {};
  let exDays = 0;
  for (const d of rangeData) {
    const arr = d.exercises || [];
    if (arr.length > 0) exDays++;
    for (const e of arr) exCount[e] = (exCount[e] || 0) + 1;
  }
  const streak = streakOfExercise(byDate);
  // refeições % no range só pra KPI rápido
  let cleanRange = 0, dirtyRange = 0;
  for (const d of rangeData) {
    for (const slot of ["lunch", "dinner"]) {
      if (d[slot] === "limpo") cleanRange++;
      else if (d[slot] === "sujo") dirtyRange++;
    }
  }

  // === MÊS ATUAL ===
  const daysInMonth = daysElapsedInMonth();
  const totalWater = monthData.reduce((s, d) => s + waterLitres(d.water), 0);
  const avgWater = daysInMonth > 0 ? totalWater / daysInMonth : 0;

  let cleanMonth = 0, dirtyMonth = 0;
  for (const d of monthData) {
    for (const slot of ["lunch", "dinner"]) {
      if (d[slot] === "limpo") cleanMonth++;
      else if (d[slot] === "sujo") dirtyMonth++;
    }
  }

  // Modalidades — só as que têm registros
  const modalidades = Object.keys(EX_LABELS)
    .map(key => ({ key, count: exCount[key] || 0 }))
    .filter(m => m.count > 0)
    .sort((a, b) => b.count - a.count);

  const exRows = modalidades.length
    ? modalidades.map(({ key, count }) => {
        const p = pct(count, totalDays);
        return `
          <div class="stat-row">
            <div style="flex:1;min-width:0">
              <div class="stat-label">${EX_LABELS[key]}</div>
              ${bar(p)}
            </div>
            <div class="stat-value">${count}</div>
          </div>`;
      }).join("")
    : `<p class="muted" style="font-size:12px;margin:4px 0">sem registros no período</p>`;

  return `
    <div class="person-tag">
      <span class="avatar ${AVATAR_CLASS[userId]} avatar--md">V</span>
      <span>${NAMES[userId]}</span>
    </div>

    <div class="stat-card">
      <h3>Resumo</h3>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-value">${exDays}<span class="muted" style="font-size:12px;font-weight:500">/${totalDays}</span></div>
          <div class="kpi-label">dias c/ exerc.</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${streak}</div>
          <div class="kpi-label">streak (dias)</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${fmtLitres(avgWater)}</div>
          <div class="kpi-label">água/dia · mês</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${pct(cleanRange, cleanRange + dirtyRange)}<span class="muted" style="font-size:12px;font-weight:500">%</span></div>
          <div class="kpi-label">refeições limpas</div>
        </div>
      </div>
    </div>

    <div class="stat-card">
      <h3>Modalidades</h3>
      ${exRows}
    </div>

    <div class="stat-card">
      <h3>Alimentação · mês atual</h3>
      ${semiDonut(cleanMonth, dirtyMonth)}
    </div>
  `;
}

export async function renderStats() {
  const select = document.getElementById("stats-range");

  const render = async () => {
    const days = Number(select.value);
    const end = todayISO();
    const rangeStart = shiftISO(end, -(days - 1));
    const mStart = monthStartISO();
    // Busca tudo de uma vez (do mais antigo entre range e mês até hoje)
    const fetchStart = rangeStart < mStart ? rangeStart : mStart;

    USERS.forEach(u => {
      const el = document.getElementById(`stats-${u}`);
      el.dataset.user = u;
      el.innerHTML = `<p class="muted" style="padding:8px">carregando…</p>`;
    });

    const results = await Promise.all(
      USERS.map(u => getRange(u, fetchStart, end).catch(() => []))
    );

    USERS.forEach((u, i) => {
      const all = results[i];
      const rangeData = all.filter(d => d.date >= rangeStart);
      const monthData = all.filter(d => d.date >= mStart);
      const el = document.getElementById(`stats-${u}`);
      el.innerHTML = renderUserCol(u, rangeData, monthData, days);
    });
  };

  select.onchange = render;
  await render();
}
