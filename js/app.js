import { storageMode } from "./storage.js";
import { initTracker, refreshAllTrackers, hasUnsavedChanges, saveAllDirty } from "./tracker.js";
import { renderStats } from "./stats.js";
import { renderHistory } from "./history.js";
import { renderCalendar } from "./calendar.js";

export const USERS = ["vinicius", "victoria"];

const state = { date: todayISO() };
export function getState() { return state; }

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

async function refreshDependentViews() {
  // Tudo que depende do estado salvo no banco — chamar após save ou nav
  await Promise.all([renderStats(), renderHistory(), renderCalendar()]);
}

async function saveAndRefresh() {
  await saveAllDirty();
  await refreshDependentViews();
}

async function navigateToDate(newDate) {
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

document.addEventListener("DOMContentLoaded", async () => {
  paintDateUI();

  const badge = document.getElementById("storage-badge");
  badge.textContent = storageMode === "firebase"
    ? "sincronizado · firebase"
    : "modo local — configure o firebase pra sincronizar entre celulares";

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

  initTracker();
  await refreshAllTrackers();
  await renderStats();
  await renderHistory();
  await renderCalendar();
});
