import { getDay, getRange, saveDay } from "./storage.js";
import {
  normalizeTrackerDay,
  toggleTrackerValue,
} from "./tracker-model.js";
import {
  WATER_LITRES_OPTIONS,
  formatWaterLitres,
  waterKey,
} from "./water-options.js";
import { trackingCycleFor } from "./tracking-cycle.js";
import {
  RUN_SESSION_TYPES,
  RUNNING_PLAN,
  currentRunPlanWeek,
  runPlanCompletions,
} from "./running-plan.js";

export const KG_GYM_GROUPS = Object.freeze([
  Object.freeze({ id: "costa", label: "Costa" }),
  Object.freeze({ id: "triceps", label: "Tríceps" }),
  Object.freeze({ id: "peito", label: "Peito" }),
  Object.freeze({ id: "biceps", label: "Bíceps" }),
  Object.freeze({ id: "perna", label: "Perna" }),
  Object.freeze({ id: "ombro", label: "Ombro" }),
  Object.freeze({ id: "lombar", label: "Lombar" }),
  Object.freeze({ id: "abdominal", label: "Abdominal" }),
]);

const state = {
  userId: "vinicius",
  selectedDate: todayISO(),
  day: null,
  savedDay: null,
  root: null,
  view: "academia",
  loading: false,
  status: "",
  onSaved: null,
  activityDays: [],
};

function pad2(value) { return String(value).padStart(2, "0"); }
function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function shiftDate(iso, amount) {
  const [year, month, day] = String(iso).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function cloneDay(day) {
  return JSON.parse(JSON.stringify(day || {}));
}
function cleanDay(day) {
  return { ...day, ...normalizeTrackerDay(day) };
}
function isOn(group, value) {
  const current = state.day?.[group];
  return Array.isArray(current)
    ? current.includes(String(value))
    : current != null && String(current) === String(value);
}
function isDirty() {
  return JSON.stringify(normalizeTrackerDay(state.day || {}))
    !== JSON.stringify(normalizeTrackerDay(state.savedDay || {}));
}
function chip(label, group, value, extraClass = "") {
  return `<button type="button" class="chip${extraClass ? ` ${extraClass}` : ""}${isOn(group, value) ? " is-on" : ""}"
    data-activity-group="${group}" data-activity-value="${value}">${label}</button>`;
}

export async function loadKgActivityTracker(userId = "vinicius") {
  state.userId = userId;
  state.selectedDate = todayISO();
  const startDate = trackingCycleFor(userId)?.startDate || state.selectedDate;
  const [day, activityDays] = await Promise.all([
    getDay(userId, state.selectedDate),
    getRange(userId, startDate, todayISO()),
  ]);
  state.day = cleanDay(day);
  state.savedDay = cloneDay(state.day);
  state.activityDays = activityDays;
  state.status = "";
}

async function loadSelectedDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return;
  const previousDate = state.selectedDate;
  const previousDay = cloneDay(state.day);
  const previousSavedDay = cloneDay(state.savedDay);
  state.selectedDate = iso > todayISO() ? todayISO() : iso;
  state.loading = true;
  state.status = "";
  render();
  try {
    state.day = cleanDay(await getDay(state.userId, state.selectedDate));
    state.savedDay = cloneDay(state.day);
  } catch (error) {
    console.warn("Não foi possível carregar o treino:", error);
    state.selectedDate = previousDate;
    state.day = previousDay;
    state.savedDay = previousSavedDay;
    state.status = "error";
  } finally {
    state.loading = false;
    render();
  }
}

function dateNavigatorHTML() {
  const isToday = state.selectedDate === todayISO();
  return `
    <section class="kg-activity-date-card">
      <div><span>REGISTRO DE ATIVIDADE</span><strong>${isToday ? "Hoje" : "Dia selecionado"}</strong></div>
      <div class="kg-activity-date-nav">
        <button type="button" data-activity-date-step="-1" aria-label="Dia anterior">‹</button>
        <input type="date" data-activity-date value="${state.selectedDate}" max="${todayISO()}" />
        <button type="button" data-activity-date-step="1" aria-label="Próximo dia" ${isToday ? "disabled" : ""}>›</button>
      </div>
    </section>`;
}

function academyHTML() {
  const hasGym = isOn("exercises", "academia");
  return `
    ${dateNavigatorHTML()}
    <section class="block kg-activity-block">
      <div class="block-head"><h2>🏋️ Academia</h2><span class="muted">marque o treino realizado</span></div>
      <div class="kg-activity-card">
        <div class="chip-grid chip-grid--1">
          ${chip(hasGym ? "Academia realizada ✓" : "Marcar academia", "exercises", "academia", "kg-activity-main-chip")}
        </div>
        <div class="kg-activity-detail${hasGym ? " is-open" : ""}">
          <h3 class="mini-title">Grupos musculares</h3>
          <div class="chip-grid chip-grid--2">
            ${KG_GYM_GROUPS.map((group) => chip(group.label, "gym_groups", group.id)).join("")}
          </div>
        </div>
      </div>
    </section>
    ${waterHTML()}
    ${saveHTML()}`;
}

function waterHTML() {
  return `
    <section class="block kg-activity-block">
      <div class="block-head"><h2>💧 Água</h2><span class="muted">total do dia</span></div>
      <div class="kg-activity-card">
        <div class="chip-grid chip-grid--2">
          ${WATER_LITRES_OPTIONS.map((litres) => (
            chip(`${formatWaterLitres(litres)}L`, "water", waterKey(litres))
          )).join("")}
        </div>
      </div>
    </section>`;
}

function runHTML() {
  const hasRun = isOn("exercises", "corrida");
  const planDays = activityDaysWithDraft();
  const currentWeek = currentRunPlanWeek(planDays);
  return `
    ${dateNavigatorHTML()}
    <section class="block kg-activity-block">
      <div class="block-head"><h2>🏃 Corrida de hoje</h2><span class="muted">registre o que realmente aconteceu</span></div>
      <div class="kg-activity-card" id="kg-run-form">
        <div class="chip-grid chip-grid--1">
          ${chip(hasRun ? "Corrida realizada ✓" : "Marcar corrida", "exercises", "corrida", "kg-activity-main-chip")}
        </div>
        <div class="kg-activity-detail${hasRun ? " is-open" : ""}">
          <div class="kg-run-fields">
            <label><span>Distância</span><div class="kg-run-input"><input type="number" min="0.1" max="100" step="0.1" inputmode="decimal" data-run-field="run_km" value="${state.day.run_km ?? ""}" placeholder="0,0"><em>km</em></div></label>
            <label><span>Tempo total</span><div class="kg-run-input"><input type="number" min="1" max="1440" step="1" inputmode="decimal" data-run-field="run_duration_min" value="${state.day.run_duration_min ?? ""}" placeholder="0"><em>min</em></div></label>
            <label class="kg-run-session-field"><span>Treino da planilha</span><select data-run-field="run_plan">
              <option value="">Corrida livre</option>
              ${RUNNING_PLAN.map((item) => RUN_SESSION_TYPES.map((session) => {
                const selected = Number(state.day.run_plan_week) === item.number && state.day.run_plan_session === session.id;
                return `<option value="${item.number}:${session.id}" ${selected ? "selected" : ""}>Semana ${item.number} · ${session.label}</option>`;
              }).join("")).join("")}
            </select></label>
            <label class="kg-run-notes-field"><span>Observações</span><textarea rows="2" maxlength="240" data-run-field="run_notes" placeholder="Como foi o treino?">${escapeHTML(state.day.run_notes || "")}</textarea></label>
          </div>
        </div>
      </div>
    </section>
    ${runningPlanHTML(planDays, currentWeek)}
    ${saveHTML()}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function activityDaysWithDraft() {
  const byDate = new Map((state.activityDays || []).map((day) => [day.date, day]));
  byDate.set(state.selectedDate, { ...state.day, date: state.selectedDate, userId: state.userId });
  return [...byDate.values()];
}

function runningPlanHTML(days, currentWeek) {
  const completions = runPlanCompletions(days);
  const completedCount = completions.size;
  const total = RUNNING_PLAN.length * RUN_SESSION_TYPES.length;
  return `
    <section class="block kg-running-plan">
      <div class="block-head"><div><h2>🗺️ Planilha rumo aos 5 km</h2><p>Três sessões por etapa, realizadas nos dias que funcionarem para você.</p></div><strong>${completedCount}/${total}</strong></div>
      <div class="kg-running-progress"><i style="width:${(completedCount / total) * 100}%"></i></div>
      <p class="kg-running-guidance">Base sugerida: leve na segunda, intervalado na quarta e longo no sábado. Faça 5 min de caminhada antes e depois; repita uma etapa se precisar.</p>
      <div class="kg-running-plan-grid">
        ${RUNNING_PLAN.map((item) => `
          <article class="kg-running-week${item.number === currentWeek ? " is-current" : ""}${item.number < currentWeek ? " is-complete" : ""}">
            <header><span>Etapa</span><strong>${item.number}</strong>${item.number === currentWeek ? "<em>atual</em>" : ""}</header>
            <div class="kg-running-week-sessions">
              ${RUN_SESSION_TYPES.map((session) => {
                const completion = completions.get(`${item.number}:${session.id}`);
                const isDraft = completion?.date === state.selectedDate && isDirty();
                return `<button type="button" class="kg-run-plan-session${completion ? " is-done" : ""}${isDraft ? " is-draft" : ""}"
                  data-run-plan-week="${item.number}" data-run-plan-session="${session.id}" data-run-plan-date="${completion?.date || ""}">
                  <span class="kg-run-plan-check">${completion ? "✓" : ""}</span>
                  <span><strong>${session.icon} ${session.label}</strong><small>${item.sessions[session.id]}</small>${completion ? `<em>${formatDateBR(completion.date)} · ${formatRunAmount(completion.run_km)} km</em>` : ""}</span>
                </button>`;
              }).join("")}
            </div>
          </article>`).join("")}
      </div>
    </section>`;
}

function formatDateBR(iso) {
  const [, month, day] = String(iso || "").split("-");
  return day && month ? `${day}/${month}` : "";
}

function formatRunAmount(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function saveHTML() {
  const dirty = isDirty();
  const label = state.status === "saving"
    ? "Salvando…"
    : state.status === "saved"
      ? "Salvo ✓"
      : state.status === "error"
        ? "Tentar salvar novamente"
        : dirty
          ? "Salvar registro"
          : "Tudo salvo";
  return `
    <div class="kg-activity-save-wrap">
      <button type="button" class="save-btn kg-activity-save${state.status === "saved" ? " is-saved" : ""}"
        data-activity-save ${!dirty || state.status === "saving" ? "disabled" : ""}>${label}</button>
      ${state.status === "error" ? `<p class="kg-msg is-error">Não consegui salvar. Confira a conexão e tente novamente.</p>` : ""}
    </div>`;
}

function render() {
  if (!state.root) return;
  if (state.loading || !state.day) {
    state.root.innerHTML = `<section class="block"><p class="muted" style="padding:8px">carregando registro…</p></section>`;
    return;
  }
  state.root.innerHTML = state.view === "corrida" ? runHTML() : academyHTML();
  bind();
}

function mutate(group, value) {
  if (group === "gym_groups" && !isOn("exercises", "academia")) {
    toggleTrackerValue(state.day, "exercises", "academia");
  }
  if (group === "run_km" && !isOn("exercises", "corrida")) {
    toggleTrackerValue(state.day, "exercises", "corrida");
  }
  toggleTrackerValue(state.day, group, value);
  if (group === "exercises" && value === "academia" && !isOn("exercises", "academia")) {
    state.day.gym_groups = [];
  }
  state.status = "";
  render();
}

async function persist() {
  if (!isDirty() || state.status === "saving") return;
  state.status = "saving";
  render();
  try {
    const payload = cleanDay(state.day);
    await saveDay(state.userId, state.selectedDate, payload);
    state.day = payload;
    state.savedDay = cloneDay(payload);
    const index = state.activityDays.findIndex((day) => day.date === state.selectedDate);
    const stored = { ...payload, date: state.selectedDate, userId: state.userId };
    if (index >= 0) state.activityDays[index] = stored;
    else state.activityDays.push(stored);
    state.status = "saved";
    state.onSaved?.(cloneDay(payload));
  } catch (error) {
    console.warn("Não foi possível salvar o treino:", error);
    state.status = "error";
  }
  render();
}

function bind() {
  state.root.querySelectorAll("[data-activity-group]").forEach((button) => {
    button.addEventListener("click", () => mutate(
      button.dataset.activityGroup,
      button.dataset.activityValue,
    ));
  });
  state.root.querySelectorAll("[data-activity-date-step]").forEach((button) => {
    button.addEventListener("click", () => loadSelectedDate(
      shiftDate(state.selectedDate, Number(button.dataset.activityDateStep)),
    ));
  });
  state.root.querySelector("[data-activity-date]")?.addEventListener("change", (event) => {
    loadSelectedDate(event.target.value);
  });
  state.root.querySelector("[data-activity-save]")?.addEventListener("click", persist);
  state.root.querySelectorAll("[data-run-field]").forEach((field) => {
    const eventName = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, () => updateRunField(field));
  });
  state.root.querySelectorAll("[data-run-plan-session]").forEach((button) => {
    button.addEventListener("click", async () => {
      const completedDate = button.dataset.runPlanDate;
      if (completedDate && completedDate !== state.selectedDate) {
        await loadSelectedDate(completedDate);
      } else {
        selectRunPlanSession(Number(button.dataset.runPlanWeek), button.dataset.runPlanSession);
      }
      state.root.querySelector("#kg-run-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function updateRunField(field) {
  const key = field.dataset.runField;
  if (key === "run_plan") {
    const [week, session] = String(field.value || "").split(":");
    state.day.run_plan_week = week ? Number(week) : null;
    state.day.run_plan_session = session || null;
  } else if (key === "run_notes") {
    state.day.run_notes = field.value;
  } else {
    state.day[key] = field.value === "" ? null : Number(field.value);
  }
  if (!isOn("exercises", "corrida")) toggleTrackerValue(state.day, "exercises", "corrida");
  state.status = "";
  updateSaveButtonOnly();
}

function updateSaveButtonOnly() {
  const wrap = state.root?.querySelector(".kg-activity-save-wrap");
  if (!wrap) return;
  const container = document.createElement("div");
  container.innerHTML = saveHTML();
  wrap.replaceWith(container.firstElementChild);
  state.root.querySelector("[data-activity-save]")?.addEventListener("click", persist);
}

function selectRunPlanSession(week, session) {
  if (!isOn("exercises", "corrida")) toggleTrackerValue(state.day, "exercises", "corrida");
  const same = Number(state.day.run_plan_week) === week && state.day.run_plan_session === session;
  state.day.run_plan_week = same ? null : week;
  state.day.run_plan_session = same ? null : session;
  state.status = "";
  render();
}

export function renderKgActivityTracker(root, {
  userId = "vinicius",
  view = "academia",
  onSaved = null,
} = {}) {
  state.root = root;
  state.userId = userId;
  state.view = view === "corrida" ? "corrida" : "academia";
  state.onSaved = onSaved;
  render();
}
