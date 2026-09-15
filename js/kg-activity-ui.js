import { getDay, saveDay } from "./storage.js";
import {
  RUN_KM_OPTIONS,
  normalizeTrackerDay,
  toggleTrackerValue,
} from "./tracker-model.js";
import {
  WATER_LITRES_OPTIONS,
  formatWaterLitres,
  waterKey,
} from "./water-options.js";

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
  state.day = cleanDay(await getDay(userId, state.selectedDate));
  state.savedDay = cloneDay(state.day);
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
  return `
    ${dateNavigatorHTML()}
    <section class="block kg-activity-block">
      <div class="block-head"><h2>🏃 Corrida</h2><span class="muted">registro inicial</span></div>
      <div class="kg-activity-card">
        <div class="chip-grid chip-grid--1">
          ${chip(hasRun ? "Corrida realizada ✓" : "Marcar corrida", "exercises", "corrida", "kg-activity-main-chip")}
        </div>
        <div class="kg-activity-detail${hasRun ? " is-open" : ""}">
          <h3 class="mini-title">Distância percorrida</h3>
          <div class="chip-grid chip-grid--3">
            ${RUN_KM_OPTIONS.map((km) => chip(`${String(km).replace(".", ",")} km`, "run_km", km)).join("")}
          </div>
        </div>
      </div>
    </section>
    <section class="block kg-running-next">
      <div class="kg-running-next-icon">🗺️</div>
      <div><h2>Planilha de corrida</h2><p>Na próxima etapa vamos definir juntos frequência, progressão, ritmos e recuperação. Por enquanto esta aba registra o que foi realizado.</p></div>
    </section>
    ${saveHTML()}`;
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
