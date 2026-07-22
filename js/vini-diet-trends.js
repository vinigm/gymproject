import { VINI_EXERCISE_TYPES } from "./vini-exercise.js";
import {
  VINI_BEVERAGES,
  VINI_DAILY_GOALS,
  formatFoodQuantity,
  nutritionForBeverageCount,
  nutritionForFoodQuantity,
} from "./vini-diet-plan.js";

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

function formatLongDate(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return String(iso || "");
  return new Date(year, month - 1, day, 12).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addNutrition(total, value) {
  total.kcal += Number(value?.kcal) || 0;
  total.p += Number(value?.p) || 0;
  total.c += Number(value?.c) || 0;
  total.f += Number(value?.f) || 0;
}

function compactNutritionHTML(nutrition) {
  return `
    <span>${formatNumber(nutrition?.kcal)} kcal</span>
    <span>P ${formatNumber(nutrition?.p, 1)} g</span>
    <span>C ${formatNumber(nutrition?.c, 1)} g</span>
    <span>G ${formatNumber(nutrition?.f, 1)} g</span>`;
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
      source: entry,
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
    const date = escapeHTML(point.entry.date);
    const pointLabel = `${formatDate(point.entry.date)} · ${formatNumber(value, Number.isInteger(value) ? 0 : 1)} ${metric.unit}. Toque para ver o registro completo.`;
    return `
      <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="13" class="vini-trend-hit"
              tabindex="0" role="button" aria-expanded="false" aria-label="${escapeHTML(pointLabel)}"
              data-trend-point data-trend-date="${date}" data-trend-metric="${metric.key}">
        <title>${escapeHTML(pointLabel)}</title>
      </circle>
      <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.4" class="vini-trend-dot" aria-hidden="true"></circle>`;
  }).join("");
  const xLabels = points.map((point) => `
    <text x="${point.x.toFixed(1)}" y="${H - 10}" class="vini-trend-xlabel" text-anchor="middle">${formatDate(point.entry.date)}</text>`).join("");
  const latest = values[values.length - 1] || 0;

  return `
    <article class="vini-trend-card ${metric.cls}" data-trend-card="${metric.key}">
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
      <div class="vini-trend-tooltip" id="vini-trend-tooltip-${metric.key}" data-trend-tooltip
           role="dialog" aria-label="Detalhes do registro nutricional" hidden></div>
    </article>`;
}

function foodQuantityLabel(food, amount) {
  if (food?.unquantified) return food.variants?.[0]?.portion || food.portion || "à vontade";
  return formatFoodQuantity(food, amount);
}

function foodGroupsDetailHTML(record) {
  const groups = Object.values(record?.summary?.foodGroups || {}).filter((entry) => (
    entry?.hasFood && Array.isArray(entry.selectedFoods) && entry.selectedFoods.length
  ));
  if (!groups.length) {
    return `<p class="vini-trend-tooltip-empty">Detalhes dos alimentos indisponíveis para este registro antigo.</p>`;
  }

  return groups.map((entry) => {
    const subtotal = { kcal: 0, p: 0, c: 0, f: 0 };
    const foods = entry.selectedFoods.map((food) => {
      const amount = entry.selectedAmounts?.[food.id] ?? food.defaultQuantity ?? 1;
      const nutrition = nutritionForFoodQuantity(food, amount);
      addNutrition(subtotal, nutrition);
      return `
        <li>
          <span><b>${escapeHTML(food.label)}</b><small>${escapeHTML(foodQuantityLabel(food, amount))}</small></span>
          <em>${nutrition ? `${formatNumber(nutrition.kcal)} kcal` : "sem estimativa"}</em>
        </li>`;
    }).join("");
    const group = entry.group || {};
    return `
      <section class="vini-trend-tooltip-meal">
        <header>
          <strong>${escapeHTML(group.icon || "🍽️")} ${escapeHTML(group.label || "Refeição")}</strong>
          <span>${formatNumber(subtotal.kcal)} kcal</span>
        </header>
        <ul>${foods}</ul>
        <div class="vini-trend-tooltip-subtotal">${compactNutritionHTML(subtotal)}</div>
      </section>`;
  }).join("");
}

function beverageDetailHTML(record) {
  const rows = VINI_BEVERAGES.map((beverage) => {
    const count = Number(record?.day?.beverages?.[beverage.id]) || 0;
    if (!count) return "";
    const nutrition = nutritionForBeverageCount(beverage, count);
    return `
      <li>
        <span><b>${escapeHTML(beverage.icon)} ${escapeHTML(beverage.label)}</b><small>${count} × ${escapeHTML(beverage.portion)}</small></span>
        <em>${formatNumber(nutrition?.kcal)} kcal</em>
      </li>`;
  }).filter(Boolean).join("");
  if (!rows) return "";
  return `
    <section class="vini-trend-tooltip-meal is-extra">
      <header><strong>🍻 Bebidas</strong></header>
      <ul>${rows}</ul>
    </section>`;
}

function exerciseDetailHTML(record) {
  const exercises = Array.isArray(record?.summary?.exercises) ? record.summary.exercises : [];
  if (!exercises.length) return "";
  return `
    <section class="vini-trend-tooltip-exercise">
      <strong>🔥 Exercício registrado</strong>
      ${exercises.map((exercise) => {
        const type = VINI_EXERCISE_TYPES[exercise.typeId];
        const intensity = type?.intensities?.[exercise.intensity];
        return `<span>${escapeHTML(type?.icon || "🏃")} ${escapeHTML(type?.label || exercise.typeId)} · ${escapeHTML(intensity?.label || exercise.intensity)} · ${formatNumber(exercise.minutes)} min <b>−${formatNumber(exercise.kcal)} kcal</b></span>`;
      }).join("")}
      <small>Kcal líquidas do dia: ${formatNumber(record.summary?.netKcal)} kcal</small>
    </section>`;
}

export function viniTrendDetailHTML(record, metricKey = "kcal") {
  const metric = VINI_TREND_METRICS.find((entry) => entry.key === metricKey) || VINI_TREND_METRICS[0];
  const consumed = record?.summary?.consumed || { kcal: 0, p: 0, c: 0, f: 0 };
  const metricValue = Number(consumed[metric.key]) || 0;
  const additionalKcal = Number(record?.summary?.additionalKcal ?? record?.day?.additionalKcal) || 0;
  const hydration = Number(record?.summary?.hydrationMl ?? record?.day?.hydrationMl) || 0;
  return `
    <div class="vini-trend-tooltip-head">
      <div>
        <small>${escapeHTML(formatLongDate(record?.date))}</small>
        <strong>${escapeHTML(metric.label)} · ${formatNumber(metricValue, Number.isInteger(metricValue) ? 0 : 1)} ${metric.unit}</strong>
      </div>
      <button type="button" data-trend-close aria-label="Fechar detalhes">×</button>
    </div>
    <div class="vini-trend-tooltip-totals" aria-label="Totais nutricionais do dia">
      <span><small>Calorias</small><b>${formatNumber(consumed.kcal)} kcal</b></span>
      <span><small>Proteína</small><b>${formatNumber(consumed.p, 1)} g</b></span>
      <span><small>Carboidrato</small><b>${formatNumber(consumed.c, 1)} g</b></span>
      <span><small>Gordura</small><b>${formatNumber(consumed.f, 1)} g</b></span>
    </div>
    <div class="vini-trend-tooltip-content">
      ${foodGroupsDetailHTML(record)}
      ${beverageDetailHTML(record)}
      ${additionalKcal ? `<p class="vini-trend-tooltip-extra">🍬 Kcal adicionais: <b>+${formatNumber(additionalKcal)} kcal</b></p>` : ""}
      ${hydration ? `<p class="vini-trend-tooltip-water">💧 Água registrada: <b>${formatNumber(hydration)} ml</b></p>` : ""}
      ${exerciseDetailHTML(record)}
    </div>
    <button type="button" class="vini-trend-tooltip-open" data-trend-open-date="${escapeHTML(record?.date)}">Ver registro do dia</button>`;
}

export function bindViniTrendTooltips(root, { records = [], onOpenDate } = {}) {
  if (!root) return () => {};
  const byDate = new Map((Array.isArray(records) ? records : []).map((entry) => [entry.date, entry]));
  const controller = new AbortController();
  const { signal } = controller;
  let active = null;
  let hideTimer = 0;
  let suppressFocusOpen = false;

  const clearHideTimer = () => {
    if (!hideTimer) return;
    window.clearTimeout(hideTimer);
    hideTimer = 0;
  };

  const close = ({ restoreFocus = false } = {}) => {
    clearHideTimer();
    if (!active) return;
    const { point, tooltip } = active;
    active = null;
    point.setAttribute("aria-expanded", "false");
    point.classList.remove("is-active");
    tooltip.hidden = true;
    tooltip.style.removeProperty("left");
    tooltip.style.removeProperty("top");
    if (restoreFocus) {
      // No Safari móvel, devolver o foco pode disparar `focus` depois do
      // clique e reabrir imediatamente o painel que acabou de ser fechado.
      suppressFocusOpen = true;
      point.focus({ preventScroll: true });
      window.requestAnimationFrame(() => { suppressFocusOpen = false; });
    }
  };

  const position = () => {
    if (!active || active.tooltip.hidden) return;
    if (window.matchMedia("(max-width: 620px)").matches) {
      active.tooltip.style.removeProperty("left");
      active.tooltip.style.removeProperty("top");
      return;
    }
    const cardRect = active.card.getBoundingClientRect();
    const pointRect = active.point.getBoundingClientRect();
    const tooltipRect = active.tooltip.getBoundingClientRect();
    const centered = pointRect.left + pointRect.width / 2 - cardRect.left - tooltipRect.width / 2;
    const maxLeft = Math.max(8, cardRect.width - tooltipRect.width - 8);
    const left = Math.max(8, Math.min(maxLeft, centered));
    const above = pointRect.top - cardRect.top - tooltipRect.height - 10;
    const below = pointRect.bottom - cardRect.top + 10;
    const minTop = Math.max(8, 8 - cardRect.top);
    const maxTop = Math.max(minTop, window.innerHeight - cardRect.top - tooltipRect.height - 8);
    const desiredTop = above >= minTop ? above : below;
    active.tooltip.style.left = `${Math.round(left)}px`;
    active.tooltip.style.top = `${Math.round(Math.max(minTop, Math.min(maxTop, desiredTop)))}px`;
  };

  const show = (point, { pinned = false } = {}) => {
    const card = point.closest("[data-trend-card]");
    const tooltip = card?.querySelector("[data-trend-tooltip]");
    const record = byDate.get(point.dataset.trendDate);
    if (!card || !tooltip || !record) return;
    if (active && active.point !== point) close();
    clearHideTimer();
    tooltip.innerHTML = viniTrendDetailHTML(record, point.dataset.trendMetric);
    tooltip.hidden = false;
    point.setAttribute("aria-expanded", "true");
    point.classList.add("is-active");
    active = { point, card, tooltip, record, pinned };
    window.requestAnimationFrame(position);
  };

  const scheduleClose = () => {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      if (!active?.pinned && !active?.tooltip.matches(":hover") && document.activeElement !== active?.point) close();
    }, 180);
  };

  root.querySelectorAll("[data-trend-point]").forEach((point) => {
    point.addEventListener("mouseenter", () => {
      if (!active?.pinned) show(point);
    }, { signal });
    point.addEventListener("mouseleave", scheduleClose, { signal });
    point.addEventListener("focus", () => {
      if (!suppressFocusOpen && !active?.pinned) show(point);
    }, { signal });
    point.addEventListener("blur", scheduleClose, { signal });
    point.addEventListener("click", (event) => {
      event.stopPropagation();
      if (active?.point === point && active.pinned) close();
      else show(point, { pinned: true });
    }, { signal });
    point.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close({ restoreFocus: true });
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (active?.point === point && active.pinned) close();
        else show(point, { pinned: true });
      }
    }, { signal });
  });

  root.querySelectorAll("[data-trend-tooltip]").forEach((tooltip) => {
    tooltip.addEventListener("mouseenter", clearHideTimer, { signal });
    tooltip.addEventListener("mouseleave", scheduleClose, { signal });
    tooltip.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.target.closest("[data-trend-close]")) {
        close();
        return;
      }
      const openButton = event.target.closest("[data-trend-open-date]");
      if (openButton) {
        const date = openButton.dataset.trendOpenDate;
        close();
        onOpenDate?.(date);
      }
    }, { signal });
  });

  document.addEventListener("click", (event) => {
    if (active && !active.tooltip.contains(event.target) && event.target !== active.point) close();
  }, { signal });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active) close({ restoreFocus: true });
  }, { signal });
  window.addEventListener("resize", position, { signal });

  return () => {
    close();
    controller.abort();
  };
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
        <div class="vini-trends-actions">
          <span class="muted">${clean.length} dia${clean.length === 1 ? "" : "s"}</span>
          ${clean.length ? `<button type="button" class="ghost-btn vini-export-pdf-btn" data-export-diet-pdf>Exportar PDF</button>` : ""}
        </div>
      </div>
      <p class="vini-trends-note">Cada gráfico mostra o consumo registrado por data. A linha tracejada é uma referência estimada das porções oficiais, pois os prints não informam metas clínicas.</p>
      ${clean.length ? `<div class="vini-trends-list">${VINI_TREND_METRICS.map((metric) => chartHTML(clean, metric, goals, chartWidth)).join("")}</div>` : `
        <div class="stat-card"><p class="muted" style="margin:0">Registre alimentos para acompanhar kcal e macros ao longo do tempo.</p></div>`}
    </section>`;
}
