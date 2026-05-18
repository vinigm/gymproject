import { getDay, saveDay } from "./storage.js";
import { getState, USERS } from "./app.js";

// Snapshot por usuário do que está NO BANCO (após carregar/salvar)
const saved = {};
// Estado local que o usuário está mexendo (pode estar dirty)
const local = {};

function setStatus(text, kind = "") {
  const el = document.getElementById("sync-status");
  el.textContent = text;
  el.dataset.kind = kind;
}

function isDirtyUser(userId) {
  const a = saved[userId], b = local[userId];
  if (!a || !b) return false;
  return JSON.stringify(normalize(a)) !== JSON.stringify(normalize(b));
}

function normalize(d) {
  // Comparação estável (exercises ordenado, campos nulos virados em null)
  return {
    exercises: [...(d.exercises || [])].sort(),
    water: d.water ?? null,
    lunch: d.lunch ?? null,
    dinner: d.dinner ?? null,
    cigarettes: (d.cigarettes ?? null) === "" ? null : (d.cigarettes ?? null)
  };
}

function dirtyCount() {
  return USERS.reduce((acc, u) => acc + (isDirtyUser(u) ? 1 : 0), 0);
}

export function hasUnsavedChanges() {
  return dirtyCount() > 0;
}

function paintSaveButton() {
  const btn = document.getElementById("btn-save");
  const n = dirtyCount();
  if (n === 0) {
    btn.disabled = true;
    btn.classList.remove("is-dirty");
    btn.textContent = "Tudo salvo";
  } else {
    btn.disabled = false;
    btn.classList.add("is-dirty");
    btn.textContent = n === 1
      ? "Salvar 1 alteração"
      : `Salvar ${n} alterações`;
  }
  // marca a coluna que tem mudança pendente
  USERS.forEach(u => {
    const card = document.querySelector(`.person-card[data-user="${u}"]`);
    if (card) card.classList.toggle("has-pending", isDirtyUser(u));
  });
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
  paintSaveButton();
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
  // O handler do botão Salvar fica em app.js pra poder
  // re-renderizar Estatísticas/Histórico/Calendário após salvar.
}

export async function saveAllDirty() {
  const dirty = USERS.filter(isDirtyUser);
  if (dirty.length === 0) return;

  const { date } = getState();
  setStatus("salvando…");
  try {
    await Promise.all(dirty.map(u => saveDay(u, date, local[u])));
    // atualiza snapshot pro estado considerar limpo
    dirty.forEach(u => { saved[u] = JSON.parse(JSON.stringify(local[u])); });
    paintSaveButton();
    setStatus("salvo!", "ok");
    setTimeout(() => {
      if (document.getElementById("sync-status").dataset.kind === "ok") setStatus("");
    }, 1500);
  } catch (err) {
    console.error(err);
    setStatus("erro ao salvar — tente novamente", "err");
  }
}

export async function refreshAllTrackers() {
  setStatus("carregando…");
  try {
    const { date } = getState();
    const results = await Promise.all(USERS.map(u => getDay(u, date)));
    USERS.forEach((u, i) => {
      const d = results[i];
      d.exercises = d.exercises || [];
      saved[u] = JSON.parse(JSON.stringify(d));
      local[u] = JSON.parse(JSON.stringify(d));
      paintCard(u);
    });
    paintSaveButton();
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("erro ao carregar", "err");
  }
}
