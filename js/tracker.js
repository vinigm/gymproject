import { getDay, saveDay } from "./storage.js";
import { getState, USERS } from "./app.js";

// Grupos que se comportam como multi-select (array de strings).
// Demais grupos são radio-like (string única ou null).
const MULTI_GROUPS = new Set(["exercises", "extras", "gym_groups"]);

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
  // Comparação estável (arrays ordenados, campos nulos virados em null)
  return {
    exercises: [...(d.exercises || [])].sort(),
    extras: [...(d.extras || [])].sort(),
    gym_groups: [...(d.gym_groups || [])].sort(),
    water: d.water ?? null,
    lunch: d.lunch ?? null,
    dinner: d.dinner ?? null,
    cigarettes: (d.cigarettes ?? null) === "" ? null : (d.cigarettes ?? null),
    dessert: d.dessert ?? null,
    soda: d.soda ?? null,
    jiu_session: d.jiu_session ?? null,
    jiu_spar_min: (d.jiu_spar_min === "" || d.jiu_spar_min == null) ? null : Number(d.jiu_spar_min),
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
      const on = MULTI_GROUPS.has(group)
        ? (d[group] || []).includes(v)
        : d[group] === v;
      chip.classList.toggle("is-on", on);
    });
  });
  // visibilidade condicional do bloco Academia
  const hasGym = (d.exercises || []).includes("academia");
  root.classList.toggle("has-gym", hasGym);
  // visibilidade condicional do bloco Jiu
  const hasJiu = (d.exercises || []).includes("jiujitsu");
  root.classList.toggle("has-jiu", hasJiu);
  root.classList.toggle("has-jiu-session", hasJiu && !!d.jiu_session);
  // restaura valor do input de luta
  const sparInput = root.querySelector(".spar-input");
  if (sparInput) {
    const val = d.jiu_spar_min;
    sparInput.value = (val == null || val === "") ? "" : String(val);
  }
}

function handleChipClick(userId, chip) {
  const grid = chip.closest(".chip-grid");
  const group = grid.dataset.group;
  const v = chip.dataset.value;
  const d = local[userId];

  if (MULTI_GROUPS.has(group)) {
    if (!Array.isArray(d[group])) d[group] = [];
    const i = d[group].indexOf(v);
    if (i >= 0) d[group].splice(i, 1);
    else d[group].push(v);
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
    // Input de tempo de luta no Jiu
    const sparInput = root.querySelector(".spar-input");
    if (sparInput) {
      sparInput.addEventListener("input", () => {
        const raw = sparInput.value.trim();
        local[userId].jiu_spar_min = raw === "" ? null : Number(raw);
        paintSaveButton();
      });
    }
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
