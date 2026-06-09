import { storageMode, getRange, getTransactions } from "./storage.js";
import { initTracker, refreshAllTrackers, hasUnsavedChanges, saveAllDirty } from "./tracker.js";
import { renderHistory } from "./history.js";
import { pointsForDay } from "./points-engine.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { loadAndApplyConfig } from "./points-utils.js";
import { EXTRAS_META } from "./points-config.js";
import { mountNavMenu } from "./nav-menu.js";

export const USERS = ["vinicius", "victoria"];

// Data a partir da qual o app começa a registrar/exibir.
// Antes dessa data nada aparece nem pode ser registrado.
// Mude essa linha pra deslocar o início.
export const APP_START_DATE = "2026-05-18";

const state = { date: todayISO() };
export function getState() { return state; }

if (state.date < APP_START_DATE) state.date = APP_START_DATE;

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateBR(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long"
  });
}

function paintDateUI() {
  const isToday = state.date === todayISO();
  document.getElementById("registro-title").textContent =
    isToday ? "Registro de hoje" : "Editando registro";
  document.getElementById("topbar-date").textContent = fmtDateBR(state.date);
  document.getElementById("date-input").value = state.date;
  document.getElementById("btn-today").hidden = isToday;
}

// Renderiza os chips de "Outros hábitos" dinamicamente em ambos os cards.
// Chamada após loadAndApplyConfig (que populou EXTRAS_META).
function renderExtrasChips() {
  USERS.forEach(userId => {
    const grid = document.querySelector(`.person-card[data-user="${userId}"] .chip-grid[data-group="extras"]`);
    if (!grid) return;
    grid.innerHTML = EXTRAS_META
      .map(e => `<button class="chip" data-value="${e.key}">${e.icon} ${e.label}</button>`)
      .join("");
  });
}

async function refreshPointsBadge() {
  const el = document.getElementById("topbar-points");
  if (!el) return;
  try {
    const end = todayISO();
    const start = APP_START_DATE;
    const [dayResults, sharedTxs] = await Promise.all([
      Promise.all(USERS.map(u => getRange(u, start, end).catch(() => []))),
      getTransactions({ scope: "shared" }).catch(() => []),
    ]);
    const earned = dayResults.flat().reduce((s, d) => s + pointsForDay(d), 0);
    const spent = sharedTxs.reduce((s, t) => s + (Number(t.price) || 0), 0);
    const balance = earned - spent;
    el.textContent = String(balance);
  } catch (err) {
    console.error(err);
    el.textContent = "···";
  }
}

async function refreshDependentViews() {
  // Tudo que depende do estado salvo no banco — chamar após save ou nav
  await Promise.all([
    renderHistory(),
    refreshPointsBadge(),
  ]);
}

async function saveAndRefresh() {
  await saveAllDirty();
  await refreshDependentViews();
}

async function navigateToDate(newDate) {
  if (newDate < APP_START_DATE) newDate = APP_START_DATE;
  if (newDate === state.date) return;

  if (hasUnsavedChanges()) {
    const ok = confirm("Você tem alterações não salvas. Deseja salvá-las antes de mudar de data?\n\nOK = salvar e mudar\nCancelar = descartar e mudar");
    if (ok) {
      await saveAndRefresh();
    }
    // se cancelar, descarta e segue
  }
  state.date = newDate;
  paintDateUI();
  await refreshAllTrackers();
}

export function jumpToDate(iso) {
  // Usado pelo calendário pra navegar pra um dia editar
  navigateToDate(iso).then(() => {
    document.querySelector("#registro-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function initApp(user) {
  paintDateUI();
  document.getElementById("date-input").min = APP_START_DATE;

  const badge = document.getElementById("storage-badge");
  badge.textContent = storageMode === "firebase"
    ? "sincronizado · firebase"
    : "modo local — configure o firebase pra sincronizar entre celulares";

  renderAuthFooter(user);

  document.getElementById("date-input").addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) return;
    navigateToDate(v);
  });
  document.getElementById("btn-today").addEventListener("click", () => {
    navigateToDate(todayISO());
  });
  document.getElementById("btn-save").addEventListener("click", () => {
    saveAndRefresh();
  });

  // Aviso antes de fechar a aba com alterações pendentes
  window.addEventListener("beforeunload", (e) => {
    if (hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  try {
    await loadAndApplyConfig();
    renderExtrasChips();
    initTracker();
    await refreshAllTrackers();
    await renderHistory();
    await refreshPointsBadge();
  } finally {
    document.body.classList.remove("is-loading");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // app.js também é importado por outras páginas (pra reusar APP_START_DATE etc.).
  // Se não estamos na página principal, não há nada pra inicializar.
  if (!document.getElementById("date-input")) return;

  mountNavMenu();
  // Espera o auth confirmar antes de carregar qualquer coisa do banco
  setupAuthGate({
    onAuthorized: (user) => { initApp(user); }
  });
});
