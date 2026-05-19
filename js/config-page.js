// Página de configuração da tabela de pontos.
// Lê os valores atuais (default + override do Firestore), monta um form,
// e salva as alterações em config/points.

import { DEFAULT_POINTS, POINTS, applyPoints, resetPoints } from "./points-config.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { loadConfigOverrides, saveConfigOverrides, clearConfigOverrides } from "./storage.js";

// Define as seções e seus campos
const SECTIONS = [
  {
    title: "💪 Exercícios",
    fields: [
      { path: "exercises.academia",  label: "Academia" },
      { path: "exercises.corrida",   label: "Corrida" },
      { path: "exercises.yoga",      label: "Yoga" },
      { path: "exercises.jiujitsu",  label: "Jiu Jitsu" },
      { path: "exercises.bicicleta", label: "Bicicleta" },
    ],
  },
  {
    title: "💧 Hidratação",
    fields: [
      { path: "water.0\\.5L", label: "0,5L", key: "0.5L" },
      { path: "water.1L",   label: "1L"   },
      { path: "water.1\\.5L", label: "1,5L", key: "1.5L" },
      { path: "water.2L",   label: "2L"   },
    ],
  },
  {
    title: "🍽️ Refeições",
    fields: [
      { path: "meals.lunch.limpo",  label: "Almoço limpo" },
      { path: "meals.lunch.sujo",   label: "Almoço sujo" },
      { path: "meals.dinner.limpo", label: "Janta limpa" },
      { path: "meals.dinner.sujo",  label: "Janta suja" },
    ],
  },
  {
    title: "🚬 Cigarros",
    note: "Por cigarro fumado (multiplica pela quantidade marcada).",
    fields: [
      { path: "cigarettes", label: "Por cigarro" },
    ],
  },
  {
    title: "🍰 Sobremesa",
    fields: [
      { path: "dessert.nao", label: "Não comeu" },
      { path: "dessert.sim", label: "Comeu" },
    ],
  },
  {
    title: "🥤 Refrigerante",
    fields: [
      { path: "soda.nao", label: "Não tomou" },
      { path: "soda.sim", label: "Tomou" },
    ],
  },
  {
    title: "✨ Outros hábitos",
    fields: [
      { path: "extras.marmita",    label: "Marmita" },
      { path: "extras.vegetais",   label: "Vegetais" },
      { path: "extras.fruta",      label: "Fruta" },
      { path: "extras.cafe",       label: "Café manhã" },
      { path: "extras.mercado",    label: "Mercado planejado" },
      { path: "extras.escada",     label: "Escada" },
      { path: "extras.leitura",    label: "Leitura" },
      { path: "extras.conversa",   label: "Conversa em casal" },
      { path: "extras.skincare",   label: "Skincare" },
      { path: "extras.suplemento", label: "Suplemento" },
    ],
  },
];

// path → array de chaves; "water.0\\.5L" → ["water", "0.5L"]
function pathToKeys(path) {
  // suporta escape \\.  -> .
  const parts = [];
  let buf = "";
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === "\\" && path[i + 1] === ".") {
      buf += ".";
      i++;
    } else if (ch === ".") {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  parts.push(buf);
  return parts;
}
function getAt(obj, path) {
  const keys = pathToKeys(path);
  let cur = obj;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}
function setAt(obj, path, value) {
  const keys = pathToKeys(path);
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== "object" || cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function setStatus(msg, kind = "") {
  const el = document.getElementById("config-status");
  if (!msg) { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false;
  el.textContent = msg;
  el.dataset.kind = kind;
}

function paintSaveButton(dirty) {
  const btn = document.getElementById("btn-config-save");
  btn.disabled = !dirty;
  btn.textContent = dirty ? "Salvar alterações" : "Tudo salvo";
}

function renderForm() {
  const root = document.getElementById("config-sections");
  root.innerHTML = SECTIONS.map(section => {
    const rows = section.fields.map(f => {
      const current = getAt(POINTS, f.path);
      const def     = getAt(DEFAULT_POINTS, f.path);
      const inputId = `cfg-${f.path.replace(/\\\./g, "_").replace(/\./g, "-")}`;
      const isCustom = current !== def;
      return `
        <div class="config-row${isCustom ? " is-custom" : ""}">
          <label for="${inputId}" class="config-label">${f.label}</label>
          <input type="number" inputmode="numeric" step="1"
                 id="${inputId}" class="config-input"
                 data-path="${f.path}"
                 value="${current}" />
          <span class="config-default">padrão: ${def}</span>
        </div>
      `;
    }).join("");
    return `
      <fieldset class="config-section">
        <legend class="config-legend">${section.title}</legend>
        ${section.note ? `<p class="config-note muted">${section.note}</p>` : ""}
        ${rows}
      </fieldset>
    `;
  }).join("");
}

function readFormIntoOverride() {
  // Retorna apenas os campos que diferem dos defaults — minimiza o doc
  const override = {};
  document.querySelectorAll(".config-input").forEach(input => {
    const path = input.dataset.path;
    const raw = input.value;
    const val = raw === "" || raw === "-" ? 0 : Number(raw);
    if (Number.isFinite(val) && val !== getAt(DEFAULT_POINTS, path)) {
      setAt(override, path, val);
    }
  });
  return override;
}

function isFormDirtyVsCurrent() {
  for (const input of document.querySelectorAll(".config-input")) {
    const path = input.dataset.path;
    const raw = input.value;
    const val = raw === "" || raw === "-" ? 0 : Number(raw);
    if (val !== getAt(POINTS, path)) return true;
  }
  return false;
}

function updateRowCustomFlag(input) {
  const path = input.dataset.path;
  const raw = input.value;
  const val = raw === "" || raw === "-" ? 0 : Number(raw);
  const def = getAt(DEFAULT_POINTS, path);
  input.closest(".config-row").classList.toggle("is-custom", val !== def);
}

function attachInputListeners() {
  document.querySelectorAll(".config-input").forEach(input => {
    input.addEventListener("input", () => {
      paintSaveButton(isFormDirtyVsCurrent());
      updateRowCustomFlag(input);
    });
  });
}

async function handleSave(e) {
  e.preventDefault();
  setStatus("salvando…", "info");
  try {
    const override = readFormIntoOverride();
    await saveConfigOverrides(override);
    // Aplica em runtime imediatamente
    applyPoints(override);
    paintSaveButton(false);
    setStatus("salvo! os pontos novos já valem em todos os históricos.", "ok");
    setTimeout(() => {
      const el = document.getElementById("config-status");
      if (el.dataset.kind === "ok") setStatus("");
    }, 3000);
  } catch (err) {
    console.error(err);
    setStatus(`erro ao salvar: ${err.message || err.code}`, "err");
  }
}

async function handleReset() {
  if (!confirm("Restaurar TODOS os pontos pros valores padrão?\n\nIsso apaga as customizações salvas e volta tudo ao código.")) return;
  setStatus("restaurando…", "info");
  try {
    await clearConfigOverrides();
    resetPoints();
    renderForm();
    attachInputListeners();
    paintSaveButton(false);
    setStatus("padrões restaurados.", "ok");
    setTimeout(() => {
      const el = document.getElementById("config-status");
      if (el.dataset.kind === "ok") setStatus("");
    }, 3000);
  } catch (err) {
    console.error(err);
    setStatus(`erro ao restaurar: ${err.message || err.code}`, "err");
  }
}

async function initConfigPage(user) {
  renderAuthFooter(user);
  try {
    const override = await loadConfigOverrides();
    if (override) applyPoints(override);
    renderForm();
    attachInputListeners();
    paintSaveButton(false);
    document.getElementById("config-form").addEventListener("submit", handleSave);
    document.getElementById("btn-config-reset").addEventListener("click", handleReset);
  } catch (err) {
    console.error(err);
    document.getElementById("config-sections").innerHTML =
      `<p class="muted" style="padding:8px">erro ao carregar config: ${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupAuthGate({ onAuthorized: (user) => initConfigPage(user) });
});
