import { getRange } from "./storage.js";
import { todayISO, USERS, APP_START_DATE } from "./app.js";

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
  const first = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-01`;
  return first < APP_START_DATE ? APP_START_DATE : first;
}
function effectiveStartDayOfMonth() {
  const t = new Date();
  const [sy, sm, sd] = APP_START_DATE.split("-").map(Number);
  return (sy === t.getFullYear() && sm === t.getMonth() + 1) ? sd : 1;
}
function daysElapsedInMonth() {
  // dias decorridos desde o efetivo início do mês (mínimo 1 quando hoje >= APP_START_DATE)
  return Math.max(1, new Date().getDate() - effectiveStartDayOfMonth() + 1);
}
function daysInCurrentMonth() {
  // dias totais possíveis no mês a partir do efetivo início
  const t = new Date();
  const lastDay = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return lastDay - effectiveStartDayOfMonth() + 1;
}
function daysBetweenInclusive(startISO, endISO) {
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  return Math.round((e - s) / 86400000) + 1;
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

// Status semântico de um dia em relação a um hábito:
//   "satisfied" = conta pra streak (avança)
//   "broken"    = quebra a streak (zera)
//   "skip"      = não registrado / neutro (não conta nem quebra hoje;
//                 mas QUEBRA se for um dia do meio da streak)
function exerciseStatus(d) {
  if (!d) return "skip";
  if (!d.exercises || d.exercises.length === 0) return "skip";
  return "satisfied";
}
function smokeFreeStatus(d) {
  if (!d) return "skip";
  const c = d.cigarettes;
  if (c == null || c === "") return "skip";
  if (c === "0" || c === 0) return "satisfied";
  return "broken";
}

function streakBackwards(byDate, statusFn) {
  let streak = 0;
  let cursor = todayISO();

  // Hoje recebe tratamento especial:
  // - satisfied: conta no loop normalmente
  // - broken: zera (streak quebrada hoje)
  // - skip: pula hoje, começa a contar de ontem
  const todayStatus = statusFn(byDate.get(cursor));
  if (todayStatus === "broken") return 0;
  if (todayStatus === "skip") cursor = shiftISO(cursor, -1);

  while (cursor >= APP_START_DATE) {
    const s = statusFn(byDate.get(cursor));
    if (s === "satisfied") {
      streak++;
      cursor = shiftISO(cursor, -1);
    } else break;
  }
  return streak;
}

function semiDonut(clean, dirty, totalPossible) {
  const logged = clean + dirty;
  const pClean = logged > 0 ? (clean / logged) * 100 : 0;
  const pDirty = logged > 0 ? 100 - pClean : 0;

  return `
    <div class="donut">
      <svg viewBox="0 0 200 130" class="donut-svg" aria-hidden="true">
        <path d="M 20 100 A 80 80 0 0 1 180 100"
              class="donut-bg" pathLength="100"/>
        <path d="M 20 100 A 80 80 0 0 1 180 100"
              class="donut-fg" pathLength="100"
              stroke-dasharray="${pClean} 100"/>
        <text x="100" y="86" class="donut-total">${logged}<tspan class="donut-of"> / ${totalPossible}</tspan></text>
        <text x="100" y="110" class="donut-sub">refeições logadas</text>
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

function renderUserCol(userId, rangeData, monthData, totalDays, allData) {
  const fullByDate = new Map(allData.map(d => [d.date, d]));

  // === RANGE (7/30/90) ===
  const exCount = {};
  let exDays = 0;
  let totalCig = 0;
  for (const d of rangeData) {
    const arr = d.exercises || [];
    if (arr.length > 0) exDays++;
    for (const e of arr) exCount[e] = (exCount[e] || 0) + 1;
    if (d.cigarettes != null && d.cigarettes !== "") {
      totalCig += Number(d.cigarettes);
    }
  }
  const exStreak = streakBackwards(fullByDate, exerciseStatus);
  const smokeFreeStreak = streakBackwards(fullByDate, smokeFreeStatus);
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
      <div class="kpi-list">
        <div class="kpi-row">
          <div class="kpi-value">${exDays}<span class="kpi-suffix">/${totalDays}</span></div>
          <div class="kpi-label">dias com exercício no período</div>
        </div>
        <div class="kpi-row">
          <div class="kpi-value">${exStreak}</div>
          <div class="kpi-label">${exStreak === 1 ? "dia" : "dias"} de exercício em sequência</div>
        </div>
        <div class="kpi-row">
          <div class="kpi-value">${fmtLitres(avgWater)}</div>
          <div class="kpi-label">média de água por dia · mês</div>
        </div>
        <div class="kpi-row">
          <div class="kpi-value">${pct(cleanRange, cleanRange + dirtyRange)}<span class="kpi-suffix">%</span></div>
          <div class="kpi-label">refeições limpas no período</div>
        </div>
        <div class="kpi-row">
          <div class="kpi-value">${totalCig}</div>
          <div class="kpi-label">cigarros fumados no período</div>
        </div>
        <div class="kpi-row kpi-row--good">
          <div class="kpi-value">${smokeFreeStreak}</div>
          <div class="kpi-label">${smokeFreeStreak === 1 ? "dia" : "dias"} sem fumar em sequência</div>
        </div>
      </div>
    </div>

    <div class="stat-card">
      <h3>Modalidades</h3>
      ${exRows}
    </div>

    <div class="stat-card">
      <h3>Alimentação · mês atual</h3>
      ${semiDonut(cleanMonth, dirtyMonth, 2 * daysInCurrentMonth())}
    </div>
  `;
}

export async function renderStats() {
  const select = document.getElementById("stats-range");

  const render = async () => {
    const days = Number(select.value);
    const end = todayISO();
    let rangeStart = shiftISO(end, -(days - 1));
    if (rangeStart < APP_START_DATE) rangeStart = APP_START_DATE;
    const effectiveDays = daysBetweenInclusive(rangeStart, end);
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
      el.innerHTML = renderUserCol(u, rangeData, monthData, effectiveDays, all);
    });
  };

  select.onchange = render;
  await render();
}
