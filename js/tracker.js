import { getDay, saveDay } from "./storage.js";
import { getState, USERS } from "./app.js";

// Estado por usuário
const local = {}; // { vinicius: dayObj, victoria: dayObj }
const saveTimers = {};

function setStatus(text) {
  document.getElementById("sync-status").textContent = text;
}
function pulseSaved() {
  const pill = document.getElementById("today-saved");
  pill.hidden = false;
  clearTimeout(pulseSaved._t);
  pulseSaved._t = setTimeout(() => { pill.hidden = true; }, 1400);
}

function paintCard(userId) {
  const root = document.querySelector(`.person-card[data-user="${userId}"]`);
  const d = local[userId];
  root.querySelectorAll(".chip-grid").forEach(grid => {
    const group = grid.dataset.group;
    grid.querySelectorAll(".chip").forEach(chip => {
      const v = chip.dataset.value;
      const on = group === "exercises"
        ? d.exercises.includes(v)
        : d[group] === v;
      chip.classList.toggle("is-on", on);
    });
  });
}

function scheduleSave(userId) {
  setStatus("salvando…");
  clearTimeout(saveTimers[userId]);
  saveTimers[userId] = setTimeout(async () => {
    try {
      await saveDay(userId, getState().date, local[userId]);
      setStatus("");
      pulseSaved();
    } catch (err) {
      console.error(err);
      setStatus("erro ao salvar — tente novamente");
    }
  }, 350);
}

function handleChipClick(userId, chip) {
  const grid = chip.closest(".chip-grid");
  const group = grid.dataset.group;
  const v = chip.dataset.value;
  const d = local[userId];

  if (group === "exercises") {
    const i = d.exercises.indexOf(v);
    if (i >= 0) d.exercises.splice(i, 1);
    else d.exercises.push(v);
  } else {
    d[group] = d[group] === v ? null : v;
  }
  paintCard(userId);
  scheduleSave(userId);
}

export function initTracker() {
  USERS.forEach(userId => {
    const root = document.querySelector(`.person-card[data-user="${userId}"]`);
    root.querySelectorAll(".chip-grid").forEach(grid => {
      grid.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (chip) handleChipClick(userId, chip);
      });
    });
  });
}

export async function refreshAllTrackers() {
  setStatus("carregando…");
  try {
    const { date } = getState();
    const results = await Promise.all(USERS.map(u => getDay(u, date)));
    USERS.forEach((u, i) => {
      const d = results[i];
      d.exercises = d.exercises || [];
      local[u] = d;
      paintCard(u);
    });
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("erro ao carregar");
  }
}
