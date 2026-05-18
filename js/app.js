import { storageMode } from "./storage.js";
import { initTracker, refreshAllTrackers } from "./tracker.js";
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

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("topbar-date").textContent = fmtDateBR(state.date);

  const badge = document.getElementById("storage-badge");
  badge.textContent = storageMode === "firebase"
    ? "sincronizado · firebase"
    : "modo local — configure o firebase pra sincronizar entre celulares";

  initTracker();
  await refreshAllTrackers();
  await renderStats();
  await renderHistory();
  await renderCalendar();
});
