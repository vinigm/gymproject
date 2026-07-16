import {
  cacheViniDietPlanDay,
  getViniDietPlanMap,
  setViniDietPlanDay,
} from "./diet-storage.js";
import { filterDateMapForTrackingScope } from "./tracking-cycle.js";
import { setViniFoodChecked, toggleViniFoodQuantity } from "./vini-diet-selection.js";
import { viniDietTrendsHTML } from "./vini-diet-trends.js";
import {
  VINI_FOOD_GROUPS,
  VINI_HYDRATION,
  VINI_PLAN_VERSION,
  VINI_REQUIRED_MEALS,
  calculateViniDietDay,
  emptyViniDietDay,
  foodForGroup,
  formatFoodQuantity,
  normalizeViniDietDay,
  nutritionForFoodQuantity,
  withViniDietSummary,
} from "./vini-diet-plan.js";

const USER = "vinicius";
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const tracker = {
  loaded: false,
  map: {},
  selectedDate: todayISO(),
  scope: "cycle",
  root: null,
  persistQueue: Promise.resolve(),
  saveSequence: 0,
  saveStatus: "",
};

function pad2(value) { return String(value).padStart(2, "0"); }
function toISODate(date) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; }
function fromISODate(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}
function todayISO() { return toISODate(new Date()); }
function addDaysISO(iso, amount) {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + amount);
  return toISODate(date);
}
function mondayISO(iso) {
  const date = fromISODate(iso);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return toISODate(date);
}
function fmtDateBR(iso, includeYear = false) {
  const [year, month, day] = String(iso || "").split("-");
  return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}
function weekdayShort(iso) { return WEEKDAYS[fromISODate(iso).getDay()]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function pctWidth(value) { return clamp(Math.round(Number(value) || 0), 0, 100); }
function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
function formatMacro(value) {
  const number = Number(value || 0);
  return formatNumber(number, Number.isInteger(number) ? 0 : 1);
}
function sumNutrition(target, value) {
  target.kcal += Number(value?.kcal) || 0;
  target.p += Number(value?.p) || 0;
  target.c += Number(value?.c) || 0;
  target.f += Number(value?.f) || 0;
}
function divideNutrition(total, divisor) {
  const by = Math.max(1, divisor);
  return {
    kcal: Math.round(total.kcal / by),
    p: Math.round((total.p / by) * 10) / 10,
    c: Math.round((total.c / by) * 10) / 10,
    f: Math.round((total.f / by) * 10) / 10,
  };
}

export async function loadViniDietTracker() {
  tracker.map = await getViniDietPlanMap(USER);
  tracker.loaded = true;
}

function currentDay() {
  return normalizeViniDietDay(tracker.map[tracker.selectedDate] || emptyViniDietDay());
}

function currentMapInScope() {
  return filterDateMapForTrackingScope(tracker.map, USER, tracker.scope);
}

function updateSaveStatus() {
  const el = tracker.root?.querySelector("#vini-diet-save-status");
  const button = tracker.root?.querySelector("[data-save-diet]");
  const message = tracker.saveStatus === "saving"
    ? "salvando…"
    : tracker.saveStatus === "error"
      ? "salvo neste aparelho; nuvem pendente"
      : tracker.saveStatus === "saved"
        ? "sincronizado com a nuvem ✓"
        : "";
  if (el) {
    el.textContent = message;
    el.classList.toggle("is-error", tracker.saveStatus === "error");
  }
  if (button) {
    button.disabled = tracker.saveStatus === "saving";
    button.textContent = tracker.saveStatus === "saving"
      ? "Salvando…"
      : tracker.saveStatus === "error"
        ? "Tentar sincronizar novamente"
        : tracker.saveStatus === "saved"
          ? "Salvo ✓"
          : "Salvar marcações";
    button.classList.toggle("is-saved", tracker.saveStatus === "saved");
    button.classList.toggle("is-error", tracker.saveStatus === "error");
  }
}

function queuePersist(date, payload) {
  const sequence = ++tracker.saveSequence;
  tracker.saveStatus = "saving";
  updateSaveStatus();
  tracker.persistQueue = tracker.persistQueue
    .catch(() => {})
    .then(() => setViniDietPlanDay(USER, date, payload))
    .then(() => {
      if (sequence !== tracker.saveSequence) return;
      tracker.saveStatus = "saved";
      updateSaveStatus();
      window.setTimeout(() => {
        if (sequence !== tracker.saveSequence || tracker.saveStatus !== "saved") return;
        tracker.saveStatus = "";
        updateSaveStatus();
      }, 1800);
    })
    .catch((error) => {
      console.warn("setViniDietPlanDay falhou:", error);
      if (sequence !== tracker.saveSequence) return;
      tracker.saveStatus = "error";
      updateSaveStatus();
    });
  return tracker.persistQueue;
}

function mutateCurrentDay(mutator) {
  const draft = currentDay();
  draft.version = VINI_PLAN_VERSION;
  draft.meals = {};
  draft.summary = null;
  const updatedDay = mutator(draft) || draft;
  const payload = withViniDietSummary(updatedDay);
  tracker.map[tracker.selectedDate] = payload;
  // O cache síncrono garante que até uma saída imediata da página preserve
  // a última marcação; o Firebase continua sendo sincronizado em seguida.
  cacheViniDietPlanDay(USER, tracker.selectedDate, payload);
  queuePersist(tracker.selectedDate, payload);
  renderTracker();
}

function persistCurrentDay() {
  const payload = withViniDietSummary(currentDay());
  tracker.map[tracker.selectedDate] = payload;
  cacheViniDietPlanDay(USER, tracker.selectedDate, payload);
  return queuePersist(tracker.selectedDate, payload);
}

function selectDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return;
  tracker.selectedDate = iso > todayISO() ? todayISO() : iso;
  tracker.saveStatus = "";
  renderTracker();
}

export function renderViniDietTracker(root, { scope = "cycle" } = {}) {
  tracker.root = root;
  tracker.scope = scope;
  renderTracker();
}

function renderTracker() {
  if (!tracker.root) return;
  if (!tracker.loaded) {
    tracker.root.innerHTML = `<section class="block"><p class="muted" style="padding:8px">Carregando plano alimentar…</p></section>`;
    return;
  }

  const day = currentDay();
  const summary = calculateViniDietDay(day, { useSnapshot: true });
  const isToday = tracker.selectedDate === todayISO();
  tracker.root.innerHTML = `
    ${dateNavigatorHTML(isToday)}
    ${dailySummaryHTML(summary)}

    <section class="block vini-plan-block">
      <div class="block-head">
        <h2>Alimentos de hoje</h2>
        <span class="muted" style="font-size:11px">${summary.itemsChecked} marcado${summary.itemsChecked === 1 ? "" : "s"}</span>
      </div>
      <p class="vini-checklist-help">Marque somente cada alimento que você realmente comeu.</p>
      <div class="vini-food-groups">
        ${VINI_FOOD_GROUPS.map((group) => foodGroupHTML(group, day)).join("")}
      </div>
    </section>

    ${hydrationHTML(day, summary)}
    ${saveControlsHTML()}
    ${weeklyHTML()}
    ${cycleStatsHTML()}
    ${historyHTML()}
    ${viniDietTrendsHTML(recordsInScope(), { viewportWidth: Math.max(320, tracker.root.clientWidth - 48) })}`;

  bindTracker();
  updateSaveStatus();
}

function dateNavigatorHTML(isToday) {
  const pretty = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(fromISODate(tracker.selectedDate));
  return `
    <section class="vini-date-card">
      <div class="vini-date-copy">
        <span class="vini-date-kicker">Registro alimentar</span>
        <strong>${isToday ? "Hoje · " : ""}${pretty}</strong>
      </div>
      <div class="vini-date-nav">
        <button class="ghost-btn vini-date-arrow" data-date-shift="-1" aria-label="Dia anterior">‹</button>
        <input type="date" id="vini-diet-date" value="${tracker.selectedDate}" max="${todayISO()}" aria-label="Data do registro" />
        <button class="ghost-btn vini-date-arrow" data-date-shift="1" ${isToday ? "disabled" : ""} aria-label="Próximo dia">›</button>
        ${isToday ? "" : `<button class="ghost-btn vini-today-btn" data-date-today>Hoje</button>`}
      </div>
    </section>`;
}

function saveControlsHTML() {
  return `
    <section class="vini-save-row">
      <button type="button" class="save-btn is-dirty vini-diet-save-btn" data-save-diet>Salvar marcações</button>
      <span id="vini-diet-save-status" class="vini-save-status" aria-live="polite"></span>
    </section>`;
}

function dailySummaryHTML(summary) {
  const consumed = summary.consumed;
  return `
    <section class="block">
      <div class="block-head"><h2>Resumo do dia</h2></div>
      <div class="vini-day-summary">
        <div class="vini-kcal-hero">
          <span class="vini-kcal-value">${formatNumber(consumed.kcal)}</span>
          <span class="vini-kcal-unit">kcal registradas</span>
          <span class="vini-kcal-plan">soma dos alimentos marcados</span>
        </div>
        <div class="vini-summary-macros">
          ${macroSummaryHTML("Proteína", "P", consumed.p, "vini-macro-p")}
          ${macroSummaryHTML("Carboidrato", "C", consumed.c, "vini-macro-c")}
          ${macroSummaryHTML("Gordura", "G", consumed.f, "vini-macro-f")}
        </div>
        <div class="vini-log-kpis">
          <div><strong>${summary.itemsChecked}</strong><span>alimentos marcados</span></div>
          <div><strong>${summary.mainMealsLogged}/${summary.requiredMeals}</strong><span>momentos principais</span></div>
          <div><strong>${Math.min(999, summary.hydrationPct)}%</strong><span>hidratação</span></div>
        </div>
        ${summary.unquantifiedItemsChecked ? `<p class="vini-nutri-alert">${summary.unquantifiedItemsChecked} item “à vontade” foi marcado, mas não entrou nos macros por não ter quantidade definida.</p>` : ""}
        <p class="muted nutri-note">Valores nutricionais estimados. Porções vêm da nutricionista; receitas e rótulos ainda serão refinados quando tivermos os dados exatos.</p>
      </div>
    </section>`;
}

function macroSummaryHTML(label, short, value, cls) {
  return `
    <div class="vini-macro-card ${cls}">
      <div><span>${short}</span><strong>${formatMacro(value)} g</strong></div>
      <small>${label}</small>
    </div>`;
}

function foodGroupHTML(group, day) {
  const selected = new Set(day.foods[group.id] || []);
  const selectedCount = selected.size;
  const hasRecipeEstimate = group.foods.some((food) => food.estimatedRecipe);
  const hasUnquantified = group.foods.some((food) => food.unquantified);
  return `
    <article class="vini-food-group-card${selectedCount ? " has-food" : ""}">
      <header class="vini-food-group-head">
        <div>
          <span>${group.icon}</span>
          <div><strong>${group.label}</strong><small>${group.time || (group.required ? "refeição principal" : "quando consumir")}</small></div>
        </div>
        <b>${selectedCount ? `${selectedCount} marcado${selectedCount === 1 ? "" : "s"}` : "nenhum"}</b>
      </header>
      <div class="vini-checkbox-list">
        ${group.foods.map((food) => foodCheckboxHTML(
          group,
          food,
          selected.has(food.id),
          day.amounts[group.id]?.[food.id] ?? food.defaultQuantity
        )).join("")}
      </div>
      ${hasRecipeEstimate ? `<p class="vini-estimate-note">* Receitas sem ficha técnica usam macros provisórios.</p>` : ""}
      ${hasUnquantified ? `<p class="vini-estimate-note">* Item “à vontade” é salvo, mas não entra nos macros.</p>` : ""}
    </article>`;
}

function foodCheckboxHTML(group, food, isChecked, amount) {
  const nutrition = nutritionForFoodQuantity(food, amount);
  const prescribed = food.variants.map((variant) => variant.portion).join(" / ");
  return `
    <div class="vini-food-entry${isChecked ? " is-checked" : ""}">
      <label class="vini-checkbox-row${isChecked ? " is-checked" : ""}">
        <input type="checkbox" data-food-checkbox data-group="${group.id}" data-food="${food.id}" ${isChecked ? "checked" : ""} />
        <span class="vini-checkbox-copy">
          <strong>${food.label}${food.optional ? " <em>opcional</em>" : ""}</strong>
          <small>${isChecked && !food.unquantified ? `Registrado: ${formatFoodQuantity(food, amount)} · ` : ""}Referência: ${prescribed}</small>
        </span>
        <span class="vini-checkbox-nutri">${nutrition ? `~${formatNumber(nutrition.kcal)} kcal` : "não calculado"}</span>
      </label>
      ${food.quantityChoices.length ? `
        <div class="vini-quantity-picker" role="group" aria-label="Quantidade de ${food.label}">
          <span>${isChecked ? "Quantidade registrada · toque na opção ativa para retirar" : "Escolha quanto comeu"}</span>
          <div class="vini-quantity-options">
            ${food.quantityChoices.map((choice) => `
              <button type="button" class="vini-quantity-btn${isChecked && Number(amount) === choice ? " is-on" : ""}"
                      data-food-quantity data-group="${group.id}" data-food="${food.id}" data-amount="${choice}"
                      aria-pressed="${isChecked && Number(amount) === choice}"
                      aria-label="${formatFoodQuantity(food, choice)}${isChecked && Number(amount) === choice ? ", selecionado; toque novamente para retirar" : ""}">${formatFoodQuantity(food, choice)}${isChecked && Number(amount) === choice ? " ×" : ""}</button>`).join("")}
          </div>
        </div>` : ""}
    </div>`;
}

function hydrationHTML(day, summary) {
  const target = summary.hydrationTargetMl;
  const baseReached = day.hydrationMl >= VINI_HYDRATION.baseMl;
  const trainingExtra = Math.max(0, day.hydrationMl - VINI_HYDRATION.baseMl);
  return `
    <section class="block">
      <div class="block-head"><h2>💧 Hidratação</h2><span class="muted" style="font-size:11px">meta mínima ${formatNumber(target)} ml</span></div>
      <div class="vini-water-card">
        <div class="vini-water-value"><strong>${formatNumber(day.hydrationMl)}</strong><span>ml registrados</span></div>
        <div class="goal-bar"><div class="goal-fill vini-water-fill" style="width:${pctWidth(summary.hydrationPct)}%"></div></div>
        <div class="vini-water-actions">
          <button class="chip" data-water-add="250">+250 ml</button>
          <button class="chip" data-water-add="500">+500 ml</button>
          <button class="chip" data-water-add="-250" ${day.hydrationMl <= 0 ? "disabled" : ""}>−250 ml</button>
          <button class="chip" data-water-reset ${day.hydrationMl <= 0 ? "disabled" : ""}>zerar</button>
        </div>
        <label class="vini-water-input-label">
          <span>Volume exato</span>
          <input type="number" id="vini-water-input" min="0" max="10000" step="50" value="${day.hydrationMl}" inputmode="numeric" />
          <small>ml</small>
        </label>
        <label class="kg-check vini-training-check">
          <input type="checkbox" id="vini-training-day" ${day.trainingDay ? "checked" : ""} />
          <span>Treinei hoje — considerar 500 ml a 1 L adicionais</span>
        </label>
        <p class="vini-water-note ${baseReached ? "is-good" : ""}">
          ${baseReached ? `Base de 2,5 L atingida${day.trainingDay ? ` · adicional registrado: ${formatNumber(trainingExtra)} ml` : ""}.` : `Faltam ${formatNumber(VINI_HYDRATION.baseMl - day.hydrationMl)} ml para a base de 2,5 L.`}
        </p>
      </div>
    </section>`;
}

function recordsInScope() {
  return Object.entries(currentMapInScope())
    .map(([date, raw]) => {
      const day = normalizeViniDietDay(raw);
      return { date, day, summary: calculateViniDietDay(day, { useSnapshot: true }) };
    })
    .filter((entry) => entry.summary.hasData)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateRecords(records) {
  const totals = { kcal: 0, p: 0, c: 0, f: 0 };
  let foods = 0;
  let mainMealMoments = 0;
  let hydration = 0;
  let hydrationHits = 0;
  for (const entry of records) {
    sumNutrition(totals, entry.summary.consumed);
    foods += entry.summary.itemsChecked;
    mainMealMoments += entry.summary.mainMealsLogged;
    hydration += entry.summary.hydrationMl;
    if (entry.summary.hydrationMl >= entry.summary.hydrationTargetMl) hydrationHits += 1;
  }
  return {
    days: records.length,
    totals,
    averages: divideNutrition(totals, records.length),
    foodsTotal: foods,
    foodsAvg: records.length ? Math.round((foods / records.length) * 10) / 10 : 0,
    mainMealMomentsAvg: records.length ? Math.round((mainMealMoments / records.length) * 10) / 10 : 0,
    hydrationAvg: records.length ? Math.round(hydration / records.length) : 0,
    hydrationHits,
  };
}

function weekRecords(weekStart, allRecords = recordsInScope()) {
  const end = addDaysISO(weekStart, 6);
  return allRecords.filter((entry) => entry.date >= weekStart && entry.date <= end);
}

function weeklyHTML() {
  const start = mondayISO(tracker.selectedDate);
  const end = addDaysISO(start, 6);
  const allRecords = recordsInScope();
  const records = weekRecords(start, allRecords);
  const stats = aggregateRecords(records);
  const previous = aggregateRecords(weekRecords(addDaysISO(start, -7), allRecords));
  const comparison = previous.days > 0
    ? stats.averages.kcal - previous.averages.kcal
    : null;

  return `
    <section class="block">
      <div class="block-head">
        <h2>📅 Semana</h2>
        <span class="muted" style="font-size:11px">${fmtDateBR(start)}–${fmtDateBR(end)}</span>
      </div>
      ${stats.days === 0 ? `<div class="stat-card"><p class="muted" style="margin:0">Nenhum registro nesta semana.</p></div>` : `
        <div class="stat-card vini-week-card">
          <div class="kpi-grid">
            <div class="kpi"><div class="kpi-value">${stats.days}/7</div><div class="kpi-label">dias registrados</div></div>
            <div class="kpi"><div class="kpi-value">${formatNumber(stats.totals.kcal)}</div><div class="kpi-label">kcal na semana</div></div>
            <div class="kpi"><div class="kpi-value">${formatNumber(stats.averages.kcal)}</div><div class="kpi-label">kcal médias / registro</div></div>
            <div class="kpi"><div class="kpi-value">${formatNumber(stats.foodsAvg, 1)}</div><div class="kpi-label">alimentos / registro</div></div>
          </div>
          <h3 class="stats-subhead">Macros da semana</h3>
          <div class="vini-week-macros">
            <div><span>Proteína</span><strong>${formatMacro(stats.totals.p)} g</strong><small>${formatMacro(stats.averages.p)} g/dia registrado</small></div>
            <div><span>Carboidrato</span><strong>${formatMacro(stats.totals.c)} g</strong><small>${formatMacro(stats.averages.c)} g/dia registrado</small></div>
            <div><span>Gordura</span><strong>${formatMacro(stats.totals.f)} g</strong><small>${formatMacro(stats.averages.f)} g/dia registrado</small></div>
          </div>
          ${macroDistributionHTML(stats.totals)}
          <h3 class="stats-subhead">Dia a dia</h3>
          ${weekStripHTML(start, records)}
          ${comparison === null ? "" : `<p class="vini-week-compare">Média por dia registrado ${comparison === 0 ? "igual à" : `${Math.abs(comparison)} kcal ${comparison > 0 ? "acima da" : "abaixo da"}`} semana anterior.</p>`}
        </div>`}
    </section>`;
}

function macroDistributionHTML(nutrition) {
  const energy = {
    p: nutrition.p * 4,
    c: nutrition.c * 4,
    f: nutrition.f * 9,
  };
  const total = energy.p + energy.c + energy.f;
  if (total <= 0) return "";
  const p = Math.round((energy.p / total) * 100);
  const c = Math.round((energy.c / total) * 100);
  const f = Math.max(0, 100 - p - c);
  return `
    <div class="vini-macro-distribution" aria-label="Distribuição calórica estimada dos macros">
      <span class="is-p" style="width:${p}%" title="Proteína ${p}%"></span>
      <span class="is-c" style="width:${c}%" title="Carboidrato ${c}%"></span>
      <span class="is-f" style="width:${f}%" title="Gordura ${f}%"></span>
    </div>
    <div class="vini-macro-legend"><span class="is-p">P ${p}%</span><span class="is-c">C ${c}%</span><span class="is-f">G ${f}%</span></div>`;
}

function weekStripHTML(start, records) {
  const byDate = Object.fromEntries(records.map((entry) => [entry.date, entry]));
  return `<div class="vini-week-strip">${Array.from({ length: 7 }, (_, index) => {
    const date = addDaysISO(start, index);
    const entry = byDate[date];
    return `
      <button class="vini-week-day${date === tracker.selectedDate ? " is-selected" : ""}${entry ? " has-data" : ""}"
              data-open-date="${date}" ${date > todayISO() ? "disabled" : ""}>
        <span>${weekdayShort(date)}</span><b>${fmtDateBR(date).slice(0, 2)}</b>
        <small>${entry ? `${formatNumber(entry.summary.consumed.kcal)} kcal` : "—"}</small>
        <em>${entry ? `${entry.summary.itemsChecked} itens` : ""}</em>
      </button>`;
  }).join("")}</div>`;
}

function cycleStatsHTML() {
  const records = recordsInScope();
  if (!records.length) {
    return `
      <section class="block">
        <div class="block-head"><h2>📊 Estatísticas do ciclo</h2></div>
        <div class="stat-card"><p class="muted" style="margin:0">As estatísticas aparecem conforme os dias forem registrados.</p></div>
      </section>`;
  }

  const stats = aggregateRecords(records);
  const streak = streakStats(records.map((entry) => entry.date));
  const foodCounts = {};
  const groupFrequency = Object.fromEntries(VINI_REQUIRED_MEALS.map((groupId) => [groupId, 0]));
  for (const entry of records) {
    for (const group of VINI_FOOD_GROUPS) {
      const selected = new Set(entry.day.foods?.[group.id] || []);
      if (group.required && selected.size) groupFrequency[group.id] += 1;
      for (const foodId of selected) {
        const food = foodForGroup(group, foodId);
        if (!food) continue;
        const key = `${group.id}.${food.id}`;
        if (!foodCounts[key]) foodCounts[key] = { group, food, count: 0, totalAmount: 0 };
        foodCounts[key].count += 1;
        foodCounts[key].totalAmount += entry.day.amounts?.[group.id]?.[food.id] ?? food.defaultQuantity;
      }
    }
  }

  const topFoods = Object.values(foodCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const nextMilestone = [7, 14, 30, 60, 90, 180, 365].find((value) => value > records.length);

  return `
    <section class="block">
      <div class="block-head"><h2>📊 Estatísticas do ciclo</h2><span class="muted" style="font-size:11px">${stats.days} dias</span></div>
      <div class="stat-card diet-stats-card">
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-value">${formatNumber(stats.averages.kcal)}</div><div class="kpi-label">kcal médias / registro</div></div>
          <div class="kpi"><div class="kpi-value">${formatMacro(stats.averages.p)}g</div><div class="kpi-label">proteína média</div></div>
          <div class="kpi"><div class="kpi-value">${formatNumber(stats.foodsAvg, 1)}</div><div class="kpi-label">alimentos / registro</div></div>
          <div class="kpi"><div class="kpi-value">${formatNumber(stats.hydrationAvg)}</div><div class="kpi-label">ml médios / registro</div></div>
          <div class="kpi"><div class="kpi-value">${stats.hydrationHits}</div><div class="kpi-label">metas de água atingidas</div></div>
          <div class="kpi"><div class="kpi-value">${streak.best}</div><div class="kpi-label">melhor sequência</div></div>
        </div>

        <div class="vini-milestone">
          <div><strong>${records.length} dias registrados</strong><span>${nextMilestone ? `próximo marco: ${nextMilestone} dias` : "um ano de registros alcançado"}</span></div>
          ${nextMilestone ? `<div class="goal-bar"><div class="goal-fill" style="width:${pctWidth((records.length / nextMilestone) * 100)}%"></div></div>` : ""}
        </div>

        <h3 class="stats-subhead">Frequência por momento</h3>
        ${VINI_REQUIRED_MEALS.map((groupId) => {
          const group = VINI_FOOD_GROUPS.find((entry) => entry.id === groupId);
          const days = groupFrequency[groupId];
          const pct = stats.days ? Math.round((days / stats.days) * 100) : 0;
          return `<div class="vini-stat-progress"><div><span>${group.icon} ${group.label}</span><strong>${days}/${stats.days} dias</strong></div><div class="goal-bar"><div class="goal-fill" style="width:${pctWidth(pct)}%"></div></div></div>`;
        }).join("")}

        <h3 class="stats-subhead">Alimentos mais marcados</h3>
        ${topFoods.length ? topFoods.map((entry) => `
          <div class="stat-row"><span class="stat-label">${entry.group.icon} ${entry.food.label}</span><span class="stat-value">${entry.count}x${entry.food.unquantified ? "" : ` · ${formatFoodQuantity(entry.food, entry.totalAmount)}`}</span></div>`).join("") : `<p class="muted" style="font-size:12px">Nenhum alimento marcado ainda.</p>`}
      </div>
    </section>`;
}

function streakStats(dates) {
  const unique = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let previous = null;
  for (const date of unique) {
    run = previous && addDaysISO(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return { best };
}

function historyHTML() {
  const records = recordsInScope().slice().reverse();
  return `
    <section class="block">
      <div class="block-head"><h2>Histórico alimentar</h2><span class="muted" style="font-size:11px">toque para editar</span></div>
      ${records.length ? `<div class="vini-history-list">${records.slice(0, 30).map((entry) => `
        <button class="vini-history-row${entry.date === tracker.selectedDate ? " is-selected" : ""}" data-open-date="${entry.date}">
          <span class="vini-history-date"><strong>${weekdayShort(entry.date)} ${fmtDateBR(entry.date)}</strong><small>${entry.summary.mainMealsLogged}/${entry.summary.requiredMeals} momentos · ${entry.summary.itemsChecked} alimentos</small></span>
          <span class="vini-history-nutri"><strong>${formatNumber(entry.summary.consumed.kcal)} kcal</strong><small>P ${formatMacro(entry.summary.consumed.p)} · C ${formatMacro(entry.summary.consumed.c)} · G ${formatMacro(entry.summary.consumed.f)}</small></span>
          <span class="vini-history-score"><strong>${entry.summary.itemsChecked}</strong><small>itens</small></span>
        </button>`).join("")}</div>` : `<p class="muted" style="padding:8px">Nenhum registro neste escopo.</p>`}
    </section>`;
}

function bindTracker() {
  tracker.root.querySelector("[data-save-diet]")?.addEventListener("click", persistCurrentDay);
  tracker.root.querySelectorAll("[data-date-shift]").forEach((button) => {
    button.addEventListener("click", () => selectDate(addDaysISO(tracker.selectedDate, Number(button.dataset.dateShift))));
  });
  tracker.root.querySelector("#vini-diet-date")?.addEventListener("change", (event) => selectDate(event.target.value));
  tracker.root.querySelector("[data-date-today]")?.addEventListener("click", () => selectDate(todayISO()));
  tracker.root.querySelectorAll("[data-open-date]").forEach((button) => {
    button.addEventListener("click", () => selectDate(button.dataset.openDate));
  });

  tracker.root.querySelectorAll("[data-food-checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      const checked = input.checked;
      const groupId = input.dataset.group;
      const foodId = input.dataset.food;
      mutateCurrentDay((day) => setViniFoodChecked(day, { groupId, foodId, checked }));
    });
  });

  tracker.root.querySelectorAll("[data-food-quantity]").forEach((button) => {
    button.addEventListener("click", () => mutateCurrentDay((day) => {
      const groupId = button.dataset.group;
      const foodId = button.dataset.food;
      const amount = Number(button.dataset.amount);
      return toggleViniFoodQuantity(day, { groupId, foodId, amount });
    }));
  });

  tracker.root.querySelectorAll("[data-water-add]").forEach((button) => {
    button.addEventListener("click", () => mutateCurrentDay((day) => {
      day.hydrationMl = clamp(day.hydrationMl + Number(button.dataset.waterAdd), 0, 10000);
    }));
  });
  tracker.root.querySelector("[data-water-reset]")?.addEventListener("click", () => mutateCurrentDay((day) => { day.hydrationMl = 0; }));
  tracker.root.querySelector("#vini-water-input")?.addEventListener("change", (event) => mutateCurrentDay((day) => {
    day.hydrationMl = clamp(Math.round(Number(event.target.value) || 0), 0, 10000);
  }));
  tracker.root.querySelector("#vini-training-day")?.addEventListener("change", (event) => mutateCurrentDay((day) => {
    day.trainingDay = event.target.checked;
  }));
}
