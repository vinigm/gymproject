import { getDay, saveDay } from "./storage.js";
import { getState, USERS } from "./app.js";
import { isTrackerMultiGroup, normalizeTrackerDay, toggleTrackerValue } from "./tracker-model.js";

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
  return JSON.stringify(normalizeTrackerDay(a)) !== JSON.stringify(normalizeTrackerDay(b));
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
      const on = isTrackerMultiGroup(group)
        ? (d[group] || []).includes(v)
        : (d[group] != null && String(d[group]) === v);
      chip.classList.toggle("is-on", on);
    });
  });
  // visibilidade condicional do bloco Academia
  const hasGym = (d.exercises || []).includes("academia");
  root.classList.toggle("has-gym", hasGym);
  // visibilidade condicional do bloco Corrida
  const hasRun = (d.exercises || []).includes("corrida");
  root.classList.toggle("has-run", hasRun);
  // visibilidade condicional do bloco Jiu
  const hasJiu = (d.exercises || []).includes("jiujitsu");
  root.classList.toggle("has-jiu", hasJiu);
  root.classList.toggle("has-jiu-session", hasJiu && !!d.jiu_session);
  // visibilidade condicional do bloco Alongamento
  const hasStretch = (d.exercises || []).includes("alongamento");
  root.classList.toggle("has-stretch", hasStretch);
}

function handleChipClick(userId, chip) {
  const grid = chip.closest(".chip-grid");
  const group = grid.dataset.group;
  const v = chip.dataset.value;
  const d = local[userId];

  toggleTrackerValue(d, group, v);
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
      d.extras = d.extras || [];
      d.gym_groups = d.gym_groups || [];
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
