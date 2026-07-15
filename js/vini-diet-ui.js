import {
  getViniDietPlanMap,
  setViniDietPlanDay,
} from "./diet-storage.js";
import { filterDateMapForTrackingScope } from "./tracking-cycle.js";
import {
  VINI_HYDRATION,
  VINI_MEALS,
  VINI_REQUIRED_MEALS,
  calculateViniDietDay,
  emptyViniDietDay,
  normalizeViniDietDay,
  optionForMeal,
  optionNutrition,
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
  if (!el) return;
  el.textContent = tracker.saveStatus === "saving"
    ? "salvando…"
    : tracker.saveStatus === "error"
      ? "erro ao salvar"
      : tracker.saveStatus === "saved"
        ? "salvo ✓"
        : "";
  el.classList.toggle("is-error", tracker.saveStatus === "error");
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
}

function mutateCurrentDay(mutator) {
  const draft = currentDay();
  draft.summary = null;
  mutator(draft);
  const payload = withViniDietSummary(draft);
  tracker.map[tracker.selectedDate] = payload;
  queuePersist(tracker.selectedDate, payload);
  renderTracker();
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
        <h2>Plano do dia</h2>
        <span class="muted" style="font-size:11px">${summary.completedMeals}/${summary.requiredMeals} principais completas</span>
      </div>
      <div class="vini-meal-list">
        ${VINI_MEALS.map((meal) => mealHTML(meal, day, summary)).join("")}
      </div>
    </section>

    ${hydrationHTML(day, summary)}
    ${weeklyHTML()}
    ${cycleStatsHTML()}
    ${historyHTML()}`;

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
        <span id="vini-diet-save-status" class="vini-save-status"></span>
      </div>
      <div class="vini-date-nav">
        <button class="ghost-btn vini-date-arrow" data-date-shift="-1" aria-label="Dia anterior">‹</button>
        <input type="date" id="vini-diet-date" value="${tracker.selectedDate}" max="${todayISO()}" aria-label="Data do registro" />
        <button class="ghost-btn vini-date-arrow" data-date-shift="1" ${isToday ? "disabled" : ""} aria-label="Próximo dia">›</button>
        ${isToday ? "" : `<button class="ghost-btn vini-today-btn" data-date-today>Hoje</button>`}
      </div>
    </section>`;
}

function dailySummaryHTML(summary) {
  const consumed = summary.consumed;
  const planned = summary.planned;
  return `
    <section class="block">
      <div class="block-head"><h2>Resumo do dia</h2></div>
      <div class="vini-day-summary">
        <div class="vini-kcal-hero">
          <span class="vini-kcal-value">${formatNumber(consumed.kcal)}</span>
          <span class="vini-kcal-unit">kcal registradas</span>
          <span class="vini-kcal-plan">${planned.kcal > 0 ? `de ~${formatNumber(planned.kcal)} kcal nas opções escolhidas` : "escolha as opções do dia"}</span>
        </div>
        <div class="vini-summary-macros">
          ${macroSummaryHTML("Proteína", "P", consumed.p, planned.p, "vini-macro-p")}
          ${macroSummaryHTML("Carboidrato", "C", consumed.c, planned.c, "vini-macro-c")}
          ${macroSummaryHTML("Gordura", "G", consumed.f, planned.f, "vini-macro-f")}
        </div>
        <div class="vini-adherence-grid">
          <div class="vini-progress-card">
            <div><strong>${summary.adherencePct}%</strong><span>aderência alimentar</span></div>
            <div class="goal-bar"><div class="goal-fill" style="width:${pctWidth(summary.adherencePct)}%"></div></div>
          </div>
          <div class="vini-progress-card">
            <div><strong>${Math.min(999, summary.hydrationPct)}%</strong><span>hidratação</span></div>
            <div class="goal-bar"><div class="goal-fill vini-water-fill" style="width:${pctWidth(summary.hydrationPct)}%"></div></div>
          </div>
        </div>
        ${summary.unquantifiedItemsChecked ? `<p class="vini-nutri-alert">${summary.unquantifiedItemsChecked} item “à vontade” foi marcado, mas não entrou nos macros por não ter quantidade definida.</p>` : ""}
        <p class="muted nutri-note">Valores nutricionais estimados. Porções vêm da nutricionista; receitas e rótulos ainda serão refinados quando tivermos os dados exatos.</p>
      </div>
    </section>`;
}

function macroSummaryHTML(label, short, value, planned, cls) {
  const pct = planned > 0 ? (value / planned) * 100 : 0;
  return `
    <div class="vini-macro-card ${cls}">
      <div><span>${short}</span><strong>${formatMacro(value)} g</strong></div>
      <small>${label}${planned > 0 ? ` · ~${formatMacro(planned)} g planejados` : ""}</small>
      <div class="goal-bar"><div class="goal-fill" style="width:${pctWidth(pct)}%"></div></div>
    </div>`;
}

function mealHTML(meal, day, summary) {
  const saved = day.meals[meal.id] || null;
  const actualOption = optionForMeal(meal, saved?.optionId);
  const displayOption = actualOption || (meal.options.length === 1 ? meal.options[0] : null);
  const result = summary.meals[meal.id];
  const completion = Math.round((result?.completion || 0) * 100);
  const stateClass = result?.complete ? " is-complete" : actualOption ? " has-progress" : "";
  const optionalLabel = meal.required ? "principal" : "contextual";

  return `
    <article class="vini-meal-card${stateClass}" data-meal-card="${meal.id}">
      <header class="vini-meal-head">
        <div class="vini-meal-title">
          <span class="vini-meal-icon">${meal.icon}</span>
          <div><strong>${meal.label}</strong><small>${meal.time ? `${meal.time} · ` : ""}${optionalLabel}</small></div>
        </div>
        <span class="vini-meal-pct">${result?.complete ? "✓ completa" : `${completion}%`}</span>
      </header>
      ${meal.options.length > 1 ? optionPickerHTML(meal, actualOption) : ""}
      ${displayOption ? optionDetailHTML(meal, displayOption, saved) : `
        <p class="vini-option-empty">Escolha a opção consumida para liberar os alimentos.</p>`}
    </article>`;
}

function optionPickerHTML(meal, selectedOption) {
  return `
    <div class="vini-option-picker" role="group" aria-label="Opções de ${meal.label}">
      ${meal.options.map((option_) => `
        <button class="vini-option-btn${selectedOption?.id === option_.id ? " is-on" : ""}"
                data-meal="${meal.id}" data-option="${option_.id}">${option_.label}</button>`).join("")}
    </div>`;
}

function optionDetailHTML(meal, option_, saved) {
  const checked = new Set(saved?.optionId === option_.id ? saved.checked : []);
  const requiredItems = option_.items.filter((entry) => !entry.optional);
  const allRequiredChecked = requiredItems.length > 0 && requiredItems.every((entry) => checked.has(entry.id));
  const total = optionNutrition(option_);
  const hasRecipeEstimate = option_.items.some((entry) => entry.estimatedRecipe);
  const hasUnquantified = option_.items.some((entry) => entry.unquantified);
  return `
    <div class="vini-option-detail">
      <div class="vini-option-head">
        <div>
          <strong>${option_.label}</strong>
          <span>~${formatNumber(total.kcal)} kcal · P ${formatMacro(total.p)}g · C ${formatMacro(total.c)}g · G ${formatMacro(total.f)}g</span>
        </div>
        <button class="ghost-btn vini-mark-all" data-mark-all data-meal="${meal.id}" data-option="${option_.id}">
          ${allRequiredChecked ? "Limpar" : "Marcar refeição"}
        </button>
      </div>
      ${option_.description ? `<p class="vini-option-note">${option_.description}</p>` : ""}
      <div class="vini-food-list">
        ${option_.items.map((entry) => itemHTML(meal, option_, entry, checked.has(entry.id))).join("")}
      </div>
      ${hasRecipeEstimate ? `<p class="vini-estimate-note">* Receita sem ficha técnica: macro provisório.</p>` : ""}
      ${hasUnquantified ? `<p class="vini-estimate-note">* Item “à vontade” é registrado, mas fica fora da soma nutricional.</p>` : ""}
      ${meal.options.length > 1 && saved?.optionId ? `<button class="vini-clear-meal" data-clear-meal data-meal="${meal.id}">Limpar escolha</button>` : ""}
    </div>`;
}

function itemHTML(meal, option_, entry, isChecked) {
  const nutri = entry.nutrition;
  return `
    <button class="vini-food-check${isChecked ? " is-on" : ""}"
            data-food-check data-meal="${meal.id}" data-option="${option_.id}" data-item="${entry.id}">
      <span class="vini-food-box">${isChecked ? "✓" : ""}</span>
      <span class="vini-food-copy">
        <strong>${entry.label}${entry.optional ? " <em>opcional</em>" : ""}</strong>
        <small>${entry.portion}</small>
      </span>
      <span class="vini-food-nutri">${nutri ? `~${formatNumber(nutri.kcal)} kcal` : "sem quantidade"}</span>
    </button>`;
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
    .map(([date, day]) => ({ date, day, summary: calculateViniDietDay(day, { useSnapshot: true }) }))
    .filter((entry) => entry.summary.hasData)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateRecords(records) {
  const totals = { kcal: 0, p: 0, c: 0, f: 0 };
  let adherence = 0;
  let hydration = 0;
  let hydrationHits = 0;
  for (const entry of records) {
    sumNutrition(totals, entry.summary.consumed);
    adherence += entry.summary.adherencePct;
    hydration += entry.summary.hydrationMl;
    if (entry.summary.hydrationMl >= entry.summary.hydrationTargetMl) hydrationHits += 1;
  }
  return {
    days: records.length,
    totals,
    averages: divideNutrition(totals, records.length),
    adherenceAvg: records.length ? Math.round(adherence / records.length) : 0,
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
            <div class="kpi"><div class="kpi-value">${stats.adherenceAvg}%</div><div class="kpi-label">aderência média</div></div>
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
        <em>${entry ? `${entry.summary.adherencePct}%` : ""}</em>
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
  const optionCounts = {};
  const mealCompletion = Object.fromEntries(VINI_REQUIRED_MEALS.map((mealId) => [mealId, { sum: 0, days: 0 }]));
  for (const entry of records) {
    for (const meal of VINI_MEALS) {
      const selected = entry.day.meals?.[meal.id];
      if (selected?.optionId) {
        const option_ = optionForMeal(meal, selected.optionId);
        const key = `${meal.id}.${selected.optionId}`;
        if (!optionCounts[key]) optionCounts[key] = { meal, option: option_, count: 0 };
        optionCounts[key].count += 1;
      }
      if (meal.required) {
        mealCompletion[meal.id].sum += entry.summary.meals[meal.id]?.completion || 0;
        mealCompletion[meal.id].days += 1;
      }
    }
  }

  const topOptions = Object.values(optionCounts)
    .filter((entry) => entry.option)
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
          <div class="kpi"><div class="kpi-value">${stats.adherenceAvg}%</div><div class="kpi-label">aderência média</div></div>
          <div class="kpi"><div class="kpi-value">${formatNumber(stats.hydrationAvg)}</div><div class="kpi-label">ml médios / registro</div></div>
          <div class="kpi"><div class="kpi-value">${stats.hydrationHits}</div><div class="kpi-label">metas de água atingidas</div></div>
          <div class="kpi"><div class="kpi-value">${streak.best}</div><div class="kpi-label">melhor sequência</div></div>
        </div>

        <div class="vini-milestone">
          <div><strong>${records.length} dias registrados</strong><span>${nextMilestone ? `próximo marco: ${nextMilestone} dias` : "um ano de registros alcançado"}</span></div>
          ${nextMilestone ? `<div class="goal-bar"><div class="goal-fill" style="width:${pctWidth((records.length / nextMilestone) * 100)}%"></div></div>` : ""}
        </div>

        <h3 class="stats-subhead">Aderência por refeição</h3>
        ${VINI_REQUIRED_MEALS.map((mealId) => {
          const meal = VINI_MEALS.find((entry) => entry.id === mealId);
          const value = mealCompletion[mealId];
          const pct = value.days ? Math.round((value.sum / value.days) * 100) : 0;
          return `<div class="vini-stat-progress"><div><span>${meal.icon} ${meal.label}</span><strong>${pct}%</strong></div><div class="goal-bar"><div class="goal-fill" style="width:${pctWidth(pct)}%"></div></div></div>`;
        }).join("")}

        <h3 class="stats-subhead">Opções mais escolhidas</h3>
        ${topOptions.length ? topOptions.map((entry) => `
          <div class="stat-row"><span class="stat-label">${entry.meal.icon} ${entry.option.label}</span><span class="stat-value">${entry.count}x</span></div>`).join("") : `<p class="muted" style="font-size:12px">Nenhuma opção escolhida ainda.</p>`}
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
          <span class="vini-history-date"><strong>${weekdayShort(entry.date)} ${fmtDateBR(entry.date)}</strong><small>${entry.summary.completedMeals}/${entry.summary.requiredMeals} refeições principais</small></span>
          <span class="vini-history-nutri"><strong>${formatNumber(entry.summary.consumed.kcal)} kcal</strong><small>P ${formatMacro(entry.summary.consumed.p)} · C ${formatMacro(entry.summary.consumed.c)} · G ${formatMacro(entry.summary.consumed.f)}</small></span>
          <span class="vini-history-score">${entry.summary.adherencePct}%</span>
        </button>`).join("")}</div>` : `<p class="muted" style="padding:8px">Nenhum registro neste escopo.</p>`}
    </section>`;
}

function bindTracker() {
  tracker.root.querySelectorAll("[data-date-shift]").forEach((button) => {
    button.addEventListener("click", () => selectDate(addDaysISO(tracker.selectedDate, Number(button.dataset.dateShift))));
  });
  tracker.root.querySelector("#vini-diet-date")?.addEventListener("change", (event) => selectDate(event.target.value));
  tracker.root.querySelector("[data-date-today]")?.addEventListener("click", () => selectDate(todayISO()));
  tracker.root.querySelectorAll("[data-open-date]").forEach((button) => {
    button.addEventListener("click", () => selectDate(button.dataset.openDate));
  });

  tracker.root.querySelectorAll(".vini-option-btn").forEach((button) => {
    button.addEventListener("click", () => mutateCurrentDay((day) => {
      const mealId = button.dataset.meal;
      const optionId = button.dataset.option;
      const current = day.meals[mealId];
      if (current?.optionId === optionId) return;
      day.meals[mealId] = { optionId, checked: [] };
    }));
  });

  tracker.root.querySelectorAll("[data-food-check]").forEach((button) => {
    button.addEventListener("click", () => mutateCurrentDay((day) => {
      const mealId = button.dataset.meal;
      const optionId = button.dataset.option;
      const itemId = button.dataset.item;
      if (day.meals[mealId]?.optionId !== optionId) day.meals[mealId] = { optionId, checked: [] };
      const checked = new Set(day.meals[mealId].checked || []);
      if (checked.has(itemId)) checked.delete(itemId);
      else checked.add(itemId);
      day.meals[mealId].checked = [...checked];
    }));
  });

  tracker.root.querySelectorAll("[data-mark-all]").forEach((button) => {
    button.addEventListener("click", () => mutateCurrentDay((day) => {
      const mealId = button.dataset.meal;
      const optionId = button.dataset.option;
      const meal = VINI_MEALS.find((entry) => entry.id === mealId);
      const option_ = optionForMeal(meal, optionId);
      if (!option_) return;
      const requiredIds = option_.items.filter((entry) => !entry.optional).map((entry) => entry.id);
      const existing = day.meals[mealId]?.optionId === optionId ? day.meals[mealId].checked || [] : [];
      const checked = new Set(existing);
      const allRequired = requiredIds.every((itemId) => checked.has(itemId));
      day.meals[mealId] = {
        optionId,
        checked: allRequired ? [] : [...new Set([...existing.filter((itemId) => option_.items.some((entry) => entry.optional && entry.id === itemId)), ...requiredIds])],
      };
    }));
  });

  tracker.root.querySelectorAll("[data-clear-meal]").forEach((button) => {
    button.addEventListener("click", () => mutateCurrentDay((day) => { delete day.meals[button.dataset.meal]; }));
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
