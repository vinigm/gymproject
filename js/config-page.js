// Página de configuração da tabela de pontos.
// Lê os valores atuais (default + override do Firestore), monta um form,
// e salva as alterações em config/points.
//
// "Outros hábitos" é especial: lista dinâmica (EXTRAS_META), permite criar
// novos e remover customs.

import {
  DEFAULT_POINTS, POINTS,
  DEFAULT_EXTRAS_META, EXTRAS_META,
  applyPoints, resetPoints, resetExtrasMeta, applyExtrasCustom,
} from "./points-config.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { loadConfigOverrides, saveConfigOverrides, clearConfigOverrides } from "./storage.js";

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
      { path: "water.0\\.5L", label: "0,5L" },
      { path: "water.1L",     label: "1L"   },
      { path: "water.1\\.5L", label: "1,5L" },
      { path: "water.2L",     label: "2L"   },
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
    fields: [{ path: "cigarettes", label: "Por cigarro" }],
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
    dynamic: "extras",
  },
];

// --- helpers de path -----------------------------------------------
function pathToKeys(path) {
  const parts = [];
  let buf = "";
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === "\\" && path[i + 1] === ".") { buf += "."; i++; }
    else if (ch === ".") { parts.push(buf); buf = ""; }
    else { buf += ch; }
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

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "extra";
}
function uniqueKey(label, existing) {
  let base = slugify(label);
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

// --- estado do form ------------------------------------------------
let _dirty = false;
function markDirty() {
  _dirty = true;
  paintSaveButton(true);
}

function paintSaveButton(dirty) {
  const btn = document.getElementById("btn-config-save");
  btn.disabled = !dirty;
  btn.textContent = dirty ? "Salvar alterações" : "Tudo salvo";
}

function setStatus(msg, kind = "") {
  const el = document.getElementById("config-status");
  if (!msg) { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false;
  el.textContent = msg;
  el.dataset.kind = kind;
}

// --- render: linha padrão (não-extras) -----------------------------
function renderFieldRow(f) {
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
}

// --- render: seção "Outros hábitos" (dinâmica) ---------------------
function renderExtrasRow(meta) {
  const isCustom = !!meta.custom;
  const pts = POINTS.extras?.[meta.key] ?? 0;
  const defPts = DEFAULT_POINTS.extras?.[meta.key];
  const showsCustomPts = defPts !== undefined && pts !== defPts;

  // Para defaults: ícone e label como texto. Para customs: editáveis.
  const iconNode = isCustom
    ? `<input type="text" class="extra-icon-input" data-key="${meta.key}" maxlength="3" value="${meta.icon}" aria-label="Ícone" />`
    : `<span class="extra-icon">${meta.icon}</span>`;
  const labelNode = isCustom
    ? `<input type="text" class="extra-label-input" data-key="${meta.key}" value="${meta.label}" aria-label="Nome" />`
    : `<span class="extra-label-text">${meta.label}</span>`;

  return `
    <div class="config-row extra-row${isCustom ? " is-extra-custom" : ""}${showsCustomPts ? " is-custom" : ""}">
      <span class="extra-meta">${iconNode}${labelNode}</span>
      <input type="number" inputmode="numeric" step="1"
             class="config-input extra-pts-input"
             data-key="${meta.key}"
             value="${pts}" />
      ${isCustom
        ? `<button type="button" class="extra-del-btn" data-key="${meta.key}" aria-label="Remover">×</button>`
        : (defPts !== undefined ? `<span class="config-default">padrão: ${defPts}</span>` : "")
      }
    </div>
  `;
}

function renderExtrasSection() {
  const rows = EXTRAS_META.map(renderExtrasRow).join("");
  return `
    <fieldset class="config-section">
      <legend class="config-legend">✨ Outros hábitos</legend>
      <p class="config-note muted">edite pontos · adicione novos · personalizados podem ser removidos</p>
      ${rows}
      <div class="extra-new">
        <input type="text" id="new-extra-icon" maxlength="3" placeholder="🎯" class="extra-icon-input" aria-label="Ícone do novo hábito" />
        <input type="text" id="new-extra-label" placeholder="nome do hábito" class="extra-label-input" aria-label="Nome" />
        <input type="number" id="new-extra-pts" inputmode="numeric" step="1" placeholder="pts" class="config-input extra-pts-input" />
        <button type="button" id="btn-new-extra" class="extra-add-btn">+ Adicionar</button>
      </div>
    </fieldset>
  `;
}

// --- render: form completo -----------------------------------------
function renderForm() {
  const root = document.getElementById("config-sections");
  root.innerHTML = SECTIONS.map(section => {
    if (section.dynamic === "extras") {
      return renderExtrasSection();
    }
    const rows = section.fields.map(renderFieldRow).join("");
    return `
      <fieldset class="config-section">
        <legend class="config-legend">${section.title}</legend>
        ${section.note ? `<p class="config-note muted">${section.note}</p>` : ""}
        ${rows}
      </fieldset>
    `;
  }).join("");
  attachInputListeners();
}

function updateRowCustomFlag(input) {
  const path = input.dataset.path;
  if (!path) return;
  const raw = input.value;
  const val = raw === "" || raw === "-" ? 0 : Number(raw);
  const def = getAt(DEFAULT_POINTS, path);
  input.closest(".config-row").classList.toggle("is-custom", val !== def);
}

function attachInputListeners() {
  // Inputs normais (data-path)
  document.querySelectorAll(".config-input[data-path]").forEach(input => {
    input.addEventListener("input", () => {
      markDirty();
      updateRowCustomFlag(input);
    });
  });
  // Inputs de extras (pts, label, icon)
  document.querySelectorAll(".extra-pts-input[data-key], .extra-label-input[data-key], .extra-icon-input[data-key]").forEach(input => {
    input.addEventListener("input", () => markDirty());
  });
  // Botões de remover
  document.querySelectorAll(".extra-del-btn").forEach(btn => {
    btn.addEventListener("click", () => handleRemoveExtra(btn.dataset.key));
  });
  // Botão "+ Adicionar"
  const addBtn = document.getElementById("btn-new-extra");
  if (addBtn) addBtn.addEventListener("click", handleAddExtra);
}

// --- ações dos extras ----------------------------------------------
function handleAddExtra() {
  const iconEl = document.getElementById("new-extra-icon");
  const labelEl = document.getElementById("new-extra-label");
  const ptsEl = document.getElementById("new-extra-pts");
  const label = labelEl.value.trim();
  const icon = iconEl.value.trim() || "✨";
  const pts = Number(ptsEl.value);
  if (!label) {
    alert("Dê um nome pro hábito antes de adicionar.");
    labelEl.focus();
    return;
  }
  if (!Number.isFinite(pts)) {
    alert("Pontos precisa ser um número (positivo ou negativo).");
    ptsEl.focus();
    return;
  }
  const existingKeys = EXTRAS_META.map(e => e.key);
  const key = uniqueKey(label, existingKeys);
  EXTRAS_META.push({ key, label, icon, custom: true });
  POINTS.extras[key] = pts;
  markDirty();
  renderForm();
}

function handleRemoveExtra(key) {
  const meta = EXTRAS_META.find(e => e.key === key);
  if (!meta?.custom) return;
  if (!confirm(`Remover "${meta.label}"?\n\nOs registros antigos com esse hábito vão deixar de pontuar (mas continuam no histórico).`)) return;
  const idx = EXTRAS_META.findIndex(e => e.key === key);
  if (idx >= 0) EXTRAS_META.splice(idx, 1);
  delete POINTS.extras[key];
  markDirty();
  renderForm();
}

// --- build do override + save --------------------------------------
function buildOverride() {
  const override = {};

  // 1) Inputs normais (data-path) — só inclui se diferente do default
  document.querySelectorAll(".config-input[data-path]").forEach(input => {
    const path = input.dataset.path;
    const raw = input.value;
    const val = raw === "" || raw === "-" ? 0 : Number(raw);
    if (Number.isFinite(val) && val !== getAt(DEFAULT_POINTS, path)) {
      setAt(override, path, val);
    }
  });

  // 2) Pontos de extras DEFAULT alterados — vão em override.extras.{key}
  for (const meta of EXTRAS_META) {
    if (meta.custom) continue;
    const ptsInput = document.querySelector(`.extra-pts-input[data-key="${meta.key}"]`);
    if (!ptsInput) continue;
    const val = Number(ptsInput.value) || 0;
    const def = DEFAULT_POINTS.extras?.[meta.key];
    if (val !== def) {
      if (!override.extras) override.extras = {};
      override.extras[meta.key] = val;
    }
  }

  // 3) Extras CUSTOM — vão em override.extras_custom
  const customs = [];
  for (const meta of EXTRAS_META) {
    if (!meta.custom) continue;
    const iconInput = document.querySelector(`.extra-icon-input[data-key="${meta.key}"]`);
    const labelInput = document.querySelector(`.extra-label-input[data-key="${meta.key}"]`);
    const ptsInput = document.querySelector(`.extra-pts-input[data-key="${meta.key}"]`);
    customs.push({
      key: meta.key,
      icon: (iconInput?.value || meta.icon || "✨").trim() || "✨",
      label: (labelInput?.value || meta.label || meta.key).trim() || meta.key,
      points: Number(ptsInput?.value) || 0,
    });
  }
  if (customs.length > 0) override.extras_custom = customs;

  return override;
}

async function handleSave(e) {
  e.preventDefault();
  setStatus("salvando…", "info");
  try {
    const override = buildOverride();
    await saveConfigOverrides(override);
    // Atualiza runtime: reseta tudo, aplica override + customs
    resetPoints();
    resetExtrasMeta();
    applyPoints(override);
    applyExtrasCustom(override.extras_custom || []);
    _dirty = false;
    paintSaveButton(false);
    setStatus("salvo! os novos pontos já valem em todos os históricos.", "ok");
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
  if (!confirm("Restaurar TODOS os pontos pros valores padrão?\n\nIsso apaga as customizações salvas, incluindo hábitos personalizados.")) return;
  setStatus("restaurando…", "info");
  try {
    await clearConfigOverrides();
    resetPoints();
    resetExtrasMeta();
    _dirty = false;
    renderForm();
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
    resetPoints();
    resetExtrasMeta();
    const override = await loadConfigOverrides();
    if (override) {
      applyPoints(override);
      applyExtrasCustom(override.extras_custom || []);
    }
    renderForm();
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
