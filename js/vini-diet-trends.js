import { VINI_DAILY_GOALS } from "./vini-diet-plan.js";

export const VINI_TREND_METRICS = Object.freeze([
  Object.freeze({ key: "kcal", label: "Calorias", short: "kcal", unit: "kcal", cls: "is-kcal" }),
  Object.freeze({ key: "p", label: "Proteína", short: "P", unit: "g", cls: "is-protein" }),
  Object.freeze({ key: "c", label: "Carboidrato", short: "C", unit: "g", cls: "is-carbs" }),
  Object.freeze({ key: "f", label: "Gordura", short: "G", unit: "g", cls: "is-fat" }),
]);

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(iso) {
  const [, month, day] = String(iso || "").split("-");
  return day && month ? `${day}/${month}` : iso;
}

function dateEpoch(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function niceCeiling(value) {
  const safe = Math.max(1, Number(value) || 0);
  const magnitude = 10 ** Math.floor(Math.log10(safe));
  const scaled = safe / magnitude;
  const step = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .find((candidate) => candidate >= scaled) || 10;
  return step * magnitude;
}

function normalizedRecords(records) {
  return (Array.isArray(records) ? records : [])
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || "")))
    .map((entry) => ({
      date: entry.date,
      consumed: {
        kcal: Math.max(0, Number(entry.summary?.consumed?.kcal) || 0),
        p: Math.max(0, Number(entry.summary?.consumed?.p) || 0),
        c: Math.max(0, Number(entry.summary?.consumed?.c) || 0),
        f: Math.max(0, Number(entry.summary?.consumed?.f) || 0),
      },
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function chartHTML(records, metric, goals, viewportWidth) {
  const goal = Math.max(0, Number(goals?.[metric.key]) || 0);
  const values = records.map((entry) => entry.consumed[metric.key]);
  const lastRecord = records[records.length - 1];
  const maxY = niceCeiling(Math.max(goal, ...values, 1) * 1.1);
  const elapsedDays = Math.max(1, (dateEpoch(lastRecord.date) - dateEpoch(records[0].date)) / 86400000);
  const W = Math.max(viewportWidth, Math.min(1200, 64 + elapsedDays * 34));
  const H = 210;
  const padL = 42;
  const padR = 14;
  const padT = 20;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const firstEpoch = dateEpoch(records[0].date);
  const lastEpoch = dateEpoch(lastRecord.date);
  const span = Math.max(1, lastEpoch - firstEpoch);
  const x = (entry) => padL + (records.length === 1
    ? plotW / 2
    : ((dateEpoch(entry.date) - firstEpoch) / span) * plotW);
  const y = (value) => padT + (1 - Math.max(0, Number(value) || 0) / maxY) * plotH;
  const points = records.map((entry) => ({
    entry,
    x: x(entry),
    y: y(entry.consumed[metric.key]),
  }));
  const line = points.map((point, index) => (
    `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  )).join(" ");
  const ticks = Array.from({ length: 5 }, (_, index) => maxY * (1 - index / 4));
  const grid = ticks.map((tick) => {
    const tickY = y(tick).toFixed(1);
    return `
      <line x1="${padL}" y1="${tickY}" x2="${W - padR}" y2="${tickY}" class="vini-trend-grid" />
      <text x="${padL - 6}" y="${(Number(tickY) + 3).toFixed(1)}" class="vini-trend-ylabel">${formatNumber(tick)}</text>`;
  }).join("");
  const goalY = y(goal).toFixed(1);
  const dots = points.map((point) => {
    const value = point.entry.consumed[metric.key];
    return `
      <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.4" class="vini-trend-dot">
        <title>${formatDate(point.entry.date)} · ${formatNumber(value, Number.isInteger(value) ? 0 : 1)} ${metric.unit}</title>
      </circle>`;
  }).join("");
  const xLabels = points.map((point) => `
    <text x="${point.x.toFixed(1)}" y="${H - 10}" class="vini-trend-xlabel" text-anchor="middle">${formatDate(point.entry.date)}</text>`).join("");
  const latest = values[values.length - 1] || 0;

  return `
    <article class="vini-trend-card ${metric.cls}">
      <header class="vini-trend-head">
        <div><strong>${metric.label}</strong><small>último: ${formatNumber(latest, Number.isInteger(latest) ? 0 : 1)} ${metric.unit}</small></div>
        <span><i></i> meta estimada ${formatNumber(goal)} ${metric.unit}</span>
      </header>
      <div class="vini-trend-scroll">
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="vini-trend-chart" style="width:${W}px" role="img"
             aria-label="Consumo de ${metric.label.toLowerCase()} ao longo do tempo; linha de referência em ${formatNumber(goal)} ${metric.unit}">
          ${grid}
          <line x1="${padL}" y1="${goalY}" x2="${W - padR}" y2="${goalY}" class="vini-trend-goal" />
          <path d="${line}" class="vini-trend-line" />
          ${dots}
          ${xLabels}
        </svg>
      </div>
    </article>`;
}

export function viniDietTrendsHTML(records, {
  goals = VINI_DAILY_GOALS,
  viewportWidth = 360,
} = {}) {
  const clean = normalizedRecords(records);
  const chartWidth = Math.max(320, Math.min(900, Number(viewportWidth) || 360));
  return `
    <section class="block vini-trends-block">
      <div class="block-head">
        <h2>📈 Evolução nutricional</h2>
        <span class="muted" style="font-size:11px">${clean.length} dia${clean.length === 1 ? "" : "s"}</span>
      </div>
      <p class="vini-trends-note">Cada gráfico mostra o consumo registrado por data. A linha tracejada é uma referência estimada das porções oficiais, pois os prints não informam metas clínicas.</p>
      ${clean.length ? `<div class="vini-trends-list">${VINI_TREND_METRICS.map((metric) => chartHTML(clean, metric, goals, chartWidth)).join("")}</div>` : `
        <div class="stat-card"><p class="muted" style="margin:0">Registre alimentos para acompanhar kcal e macros ao longo do tempo.</p></div>`}
    </section>`;
}
