// Implementação compartilhada das páginas "Kg Vivi" e "Kg Vini".
// O usuário vem de data-kg-user no <body>; na ausência, mantém Vivi como padrão.
// São duas seções: Peso (registro + gráfico + IMC) e Dieta
// (checklist de refeições, histórico e estatísticas no Kg Vini).

import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import {
  addWeightEntry, getWeightEntries, deleteWeightEntry,
  loadHeight, saveHeight, DEFAULT_HEIGHT_M,
  wasSeeded, markSeeded,
} from "./weight-storage.js";
import { getDietDay, setDietDay, getDietMap } from "./diet-storage.js";
import { loadViniDietTracker, renderViniDietTracker } from "./vini-diet-ui.js";
import { renderViniOfficialDiet } from "./vini-official-diet.js";
import {
  DEFAULT_TRACKING_SCOPE,
  TRACKING_SCOPE,
  filterDateMapForTrackingScope,
  filterRecordsForTrackingScope,
  mountTrackingScopeControl,
} from "./tracking-cycle.js";

const USER = document.body.dataset.kgUser === "vinicius" ? "vinicius" : "victoria";
const IS_VINI = USER === "vinicius";
const PERSON_NAME = IS_VINI ? "Vini" : "Vivi";
const SECTION_KEY = IS_VINI ? "habitos-kg-section-vinicius" : "habitos-kg-section";

// Cardápio: cada refeição tem alimentos, cada alimento tem opções de quantidade
// e um perfil nutricional. `per: "unit"` = valores por unidade; `per: "100g"`
// = valores por 100 g (a quantidade escolhida em g é escalonada).
// Valores de referência aproximados (cozidos), pra estimativa — não é preciso.
const DIET_MENU = [
  { key: "cafe", icon: "🌅", label: "Café da manhã", foods: [
    { key: "ovo", label: "Ovo",         options: [1, 2, 3, 4], per: "unit",  kcal: 72, p: 6.3, c: 0.4, f: 4.8 },
    { key: "pao", label: "Pão (fatias)", options: [1, 2, 3],    per: "unit",  kcal: 65, p: 2.2, c: 12,  f: 0.8 },
  ]},
  { key: "lanche_manha", icon: "🥪", label: "Lanche da manhã", foods: [
    { key: "whey",    label: "Whey (doses)", options: [1, 2], per: "unit", kcal: 120, p: 24, c: 3,  f: 1.5 },
    { key: "iogurte", label: "Iogurte",      options: [1, 2], per: "unit", kcal: 100, p: 6,  c: 12, f: 3 },
    { key: "pao",     label: "Pão (fatias)", options: [1, 2], per: "unit", kcal: 65,  p: 2.2, c: 12, f: 0.8 },
  ]},
  { key: "almoco", icon: "☀️", label: "Almoço", foods: [
    { key: "arroz",  label: "Arroz (g)",  options: [50, 100, 150], per: "100g", kcal: 130, p: 2.7, c: 28, f: 0.3 },
    { key: "feijao", label: "Feijão (g)", options: [50, 100, 150], per: "100g", kcal: 80,  p: 5,   c: 14, f: 0.5 },
    { key: "carne",  label: "Carne (g)",  options: [50, 100, 150], per: "100g", kcal: 220, p: 26,  c: 0,  f: 12 },
    { key: "frango", label: "Frango (g)", options: [50, 100, 150], per: "100g", kcal: 165, p: 31,  c: 0,  f: 3.6 },
    { key: "peixe",  label: "Peixe (g)",  options: [50, 100, 150], per: "100g", kcal: 130, p: 26,  c: 0,  f: 3 },
  ]},
  { key: "janta", icon: "🌙", label: "Janta", foods: [
    { key: "arroz",  label: "Arroz (g)",  options: [50, 100, 150], per: "100g", kcal: 130, p: 2.7, c: 28, f: 0.3 },
    { key: "feijao", label: "Feijão (g)", options: [50, 100, 150], per: "100g", kcal: 80,  p: 5,   c: 14, f: 0.5 },
    { key: "carne",  label: "Carne (g)",  options: [50, 100, 150], per: "100g", kcal: 220, p: 26,  c: 0,  f: 12 },
    { key: "frango", label: "Frango (g)", options: [50, 100, 150], per: "100g", kcal: 165, p: 31,  c: 0,  f: 3.6 },
    { key: "peixe",  label: "Peixe (g)",  options: [50, 100, 150], per: "100g", kcal: 130, p: 26,  c: 0,  f: 3 },
  ]},
];

// No Kg Vini o almoço também acompanha salada em gramas.
// Valores aproximados por 100 g de uma salada simples, sem molho pesado.
if (IS_VINI) {
  DIET_MENU.find((meal) => meal.key === "almoco")?.foods.push({
    key: "salada",
    label: "Salada (g)",
    options: [50, 100, 150],
    per: "100g",
    kcal: 25,
    p: 1.5,
    c: 5,
    f: 0.3,
  });
}

// Índice alimento-id -> perfil nutricional (pra somar rápido).
const FOOD_NUTRI = {};
DIET_MENU.forEach((meal) => meal.foods.forEach((f) => {
  FOOD_NUTRI[`${meal.key}.${f.key}`] = f;
}));

function computeNutrition(foods) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  Object.keys(foods || {}).forEach((id) => {
    const q = Number(foods[id]);
    const info = FOOD_NUTRI[id];
    if (!q || !info) return;
    const factor = info.per === "100g" ? q / 100 : q;
    t.kcal += info.kcal * factor;
    t.p += info.p * factor;
    t.c += info.c * factor;
    t.f += info.f * factor;
  });
  return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) };
}

// ⚠️ METAS DIÁRIAS — números PROVISÓRIOS. Quando tiver os certos, troque só aqui.
const GOALS = { kcal: 2000, p: 90, c: 250, f: 65 };
const GOAL_META = [
  { key: "kcal", label: "Calorias", unit: "kcal", cls: "goal-kcal" },
  { key: "p",    label: "Proteína", unit: "g",    cls: "goal-p" },
  { key: "c",    label: "Carbo",    unit: "g",    cls: "goal-c" },
  { key: "f",    label: "Gordura",  unit: "g",    cls: "goal-f" },
];
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const stateData = {
  section: "peso",       // "peso" | "dieta"
  entries: [],
  height: IS_VINI ? null : DEFAULT_HEIGHT_M,
  dietFoods: {},         // mapa { "refeição.alimento": quantidade } do dia atual
  dietMap: {},           // date -> foods (histórico)
  trackingScope: DEFAULT_TRACKING_SCOPE,
};

// ─── Helpers de data ──────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayISO() { return toISODate(new Date()); }
function offsetISO(days) { const d = new Date(); d.setDate(d.getDate() + days); return toISODate(d); }
function epochFor(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}
function fmtDateBR(iso) {
  try { const [, m, d] = iso.split("-").map(Number); return `${pad2(d)}/${pad2(m)}`; }
  catch { return iso; }
}
function weekdayShort(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return WD[new Date(y, m - 1, d).getDay()];
}
function fmtWeight(kg) { return (Math.round(kg * 10) / 10).toString().replace(".", ","); }

// ─── IMC ──────────────────────────────────────────────────────────────
function bmi(w, h) { return w / (h * h); }
function bmiClass(v) {
  if (v < 18.5) return { label: "Abaixo do peso", cls: "imc--low" };
  if (v < 25)   return { label: "Peso normal",    cls: "imc--ok" };
  if (v < 30)   return { label: "Sobrepeso",      cls: "imc--warn" };
  return { label: "Obesidade", cls: "imc--high" };
}

// ─── Render raiz (seletor de seção) ───────────────────────────────────
function render() {
  const root = document.getElementById("kg-content");
  if (!root) return;
  root.innerHTML = `
    <div class="stats-toggle-bar">
      <div class="seg stats-user-seg kg-seg" id="kg-section-seg">
        <button data-section="peso"  class="seg-btn">⚖️ Peso</button>
        <button data-section="dieta" class="seg-btn">🍽️ Dieta</button>
      </div>
    </div>
    <div id="kg-cycle-scope"></div>
    <div id="kg-section"></div>`;

  root.querySelectorAll("#kg-section-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectSection(btn.dataset.section));
  });
  mountTrackingScopeControl("kg-cycle-scope", {
    scope: stateData.trackingScope,
    userIds: [USER],
    includeOfficialDiet: IS_VINI,
    onChange: (nextScope) => {
      stateData.trackingScope = nextScope;
      if (nextScope === TRACKING_SCOPE.OFFICIAL_DIET) {
        stateData.section = "dieta";
        try { localStorage.setItem(SECTION_KEY, "dieta"); } catch {}
      }
      render();
    },
  });
  selectSection(stateData.section);
}

function selectSection(section) {
  if (section === "peso" && stateData.trackingScope === TRACKING_SCOPE.OFFICIAL_DIET) {
    stateData.trackingScope = TRACKING_SCOPE.CYCLE;
    stateData.section = "peso";
    render();
    return;
  }
  stateData.section = section;
  try { localStorage.setItem(SECTION_KEY, section); } catch {}
  document.querySelectorAll("#kg-section-seg .seg-btn").forEach((b) => {
    b.classList.toggle("is-on", b.dataset.section === section);
  });
  if (section === "dieta") renderDiet();
  else renderWeight();
}

// ─── Seção PESO ───────────────────────────────────────────────────────
function renderWeight() {
  const el = document.getElementById("kg-section");
  if (!el) return;
  const entries = filterRecordsForTrackingScope(stateData.entries, USER, stateData.trackingScope);
  const latest = entries[entries.length - 1] || null;
  const prev = entries[entries.length - 2] || null;
  const baseline = entries[0] || null;
  const defaultWeight = latest ? latest.weight : "";

  el.innerHTML = `
    ${heroHTML(latest, prev, baseline)}

    <section class="block">
      <div class="block-head"><h2>Registrar pesagem</h2></div>
      <div class="kg-form">
        <label class="kg-field">
          <span class="kg-label">Peso (kg)</span>
          <input type="number" inputmode="decimal" step="0.1" min="0" id="kg-weight"
                 class="kg-weight-input" value="${defaultWeight}" placeholder="ex.: 80,0" />
        </label>
        <label class="kg-check">
          <input type="checkbox" id="kg-fasting" checked />
          <span>Em jejum</span>
        </label>
        <button id="kg-save" class="save-btn kg-save-btn">Salvar pesagem</button>
        <p id="kg-msg" class="kg-msg" hidden></p>
      </div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Evolução do peso</h2>
        <span class="muted" style="font-size:11px">${entries.length} registro${entries.length === 1 ? "" : "s"}</span>
      </div>
      <div class="kg-chart-wrap">${chartHTML(entries)}</div>
    </section>

    <section class="block">
      <div class="block-head"><h2>IMC & cálculos</h2></div>
      ${imcHTML(latest)}
      <label class="kg-field kg-height">
        <span class="kg-label">Altura (m)</span>
        <input type="number" inputmode="decimal" step="0.01" min="0.5" max="2.5"
               id="kg-height" class="kg-height-input" value="${stateData.height ?? ""}" placeholder="ex.: 1,75" />
      </label>
    </section>

    <section class="block">
      <div class="block-head"><h2>Últimos registros</h2></div>
      ${listHTML(entries)}
    </section>`;

  bindWeight();
}

function heroHTML(latest, prev, baseline) {
  if (!latest) {
    const emptyLabel = stateData.trackingScope === TRACKING_SCOPE.CYCLE
      ? "Sem pesagens no ciclo atual — registre o novo ponto de partida 👇"
      : "Sem registros ainda — registre a primeira pesagem 👇";
    return `<section class="kg-hero"><span class="kg-hero-empty">${emptyLabel}</span></section>`;
  }
  let delta = "";
  if (prev) {
    const d = latest.weight - prev.weight;
    const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
    const txt = d === 0 ? "sem mudança" : `${arrow} ${fmtWeight(Math.abs(d))} kg vs anterior`;
    delta = `<span class="kg-hero-delta">${txt}</span>`;
  }
  let cycleDelta = "";
  if (baseline && baseline.id !== latest.id) {
    const d = latest.weight - baseline.weight;
    const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
    const period = stateData.trackingScope === TRACKING_SCOPE.CYCLE ? "início do ciclo" : "primeiro registro";
    const txt = d === 0 ? `sem mudança desde o ${period}` : `${arrow} ${fmtWeight(Math.abs(d))} kg desde o ${period}`;
    cycleDelta = `<span class="kg-hero-cycle-delta">${txt}</span>`;
  }
  return `
    <section class="kg-hero">
      <span class="kg-hero-value">${fmtWeight(latest.weight)}<small>kg</small></span>
      ${delta}
      ${cycleDelta}
      <span class="kg-hero-sub">${fmtDateBR(latest.date)}${latest.fasting ? " · em jejum" : ""}</span>
    </section>`;
}

function chartHTML(entries) {
  if (!entries.length) {
    return `<p class="muted" style="padding:20px 8px;text-align:center">Registre pesagens pra ver o gráfico.</p>`;
  }
  const W = 320, H = 180, padL = 34, padR = 12, padT = 14, padB = 26;
  const ws = entries.map((e) => e.weight);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  if (hi - lo < 1) { const mid = (hi + lo) / 2; lo = mid - 0.5; hi = mid + 0.5; }
  const range = hi - lo; lo -= range * 0.15; hi += range * 0.15;

  const n = entries.length;
  const x = (i) => padL + (n === 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
  const y = (w) => padT + (1 - (w - lo) / (hi - lo)) * (H - padT - padB);

  const gridVals = [hi, (hi + lo) / 2, lo];
  const grid = gridVals.map((gv) => {
    const gy = y(gv).toFixed(1);
    return `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" class="kgc-grid"/>
            <text x="${padL - 4}" y="${(+gy + 3).toFixed(1)}" class="kgc-ylabel">${fmtWeight(gv)}</text>`;
  }).join("");

  const pts = entries.map((e, i) => [x(i), y(e.weight)]);
  const lineD = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const areaD = `${lineD} L${pts[pts.length - 1][0].toFixed(1)} ${H - padB} L${pts[0][0].toFixed(1)} ${H - padB} Z`;
  const dots = pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === n - 1 ? 4 : 2.6}" class="kgc-dot${i === n - 1 ? " kgc-dot--last" : ""}"/>`).join("");
  const xlabels = `
    <text x="${x(0).toFixed(1)}" y="${H - 8}" class="kgc-xlabel" text-anchor="start">${fmtDateBR(entries[0].date)}</text>
    ${n > 1 ? `<text x="${x(n - 1).toFixed(1)}" y="${H - 8}" class="kgc-xlabel" text-anchor="end">${fmtDateBR(entries[n - 1].date)}</text>` : ""}`;

  return `
    <svg viewBox="0 0 ${W} ${H}" class="kg-chart" preserveAspectRatio="none" role="img" aria-label="Evolução do peso">
      ${grid}
      <path d="${areaD}" class="kgc-area"/>
      <path d="${lineD}" class="kgc-line"/>
      ${dots}
      ${xlabels}
    </svg>`;
}

function imcHTML(latest) {
  const h = stateData.height;
  if (!latest) return `<p class="muted" style="padding:8px">Registre um peso pra calcular o IMC.</p>`;
  if (!h) return `<p class="muted" style="padding:8px">Informe a altura abaixo para calcular o IMC.</p>`;
  const v = bmi(latest.weight, h);
  const c = bmiClass(v);
  const normalLo = 18.5 * h * h, normalHi = 24.9 * h * h;
  const toNormalTxt = latest.weight < normalLo ? `${fmtWeight(normalLo - latest.weight)} kg até a faixa normal`
    : latest.weight > normalHi ? `${fmtWeight(latest.weight - normalHi)} kg acima da faixa normal`
    : "dentro da faixa normal";
  return `
    <div class="kg-imc-grid">
      <div class="kg-stat ${c.cls}">
        <span class="kg-stat-value">${v.toFixed(1).replace(".", ",")}</span>
        <span class="kg-stat-label">IMC</span>
        <span class="kg-stat-tag">${c.label}</span>
      </div>
      <div class="kg-stat">
        <span class="kg-stat-value">${fmtWeight(normalLo)}–${fmtWeight(normalHi)}</span>
        <span class="kg-stat-label">faixa normal (kg)</span>
        <span class="kg-stat-tag">IMC 18,5–24,9</span>
      </div>
      <div class="kg-stat">
        <span class="kg-stat-value">${fmtWeight(latest.weight)}<small>kg</small></span>
        <span class="kg-stat-label">peso atual</span>
        <span class="kg-stat-tag">${toNormalTxt}</span>
      </div>
    </div>
    <p class="muted kg-imc-note">Classificação OMS para ${PERSON_NAME}, considerando altura de ${String(h).replace(".", ",")} m. É só referência, não é avaliação médica.</p>`;
}

function listHTML(entries) {
  if (!entries.length) return `<p class="muted" style="padding:8px">Nada por aqui ainda.</p>`;
  const recent = entries.slice(-8).reverse();
  return `<div class="kg-list">${recent.map((e) => `
    <div class="kg-list-row" data-id="${e.id}">
      <span class="kg-list-w">${fmtWeight(e.weight)} kg</span>
      <span class="kg-list-meta">${fmtDateBR(e.date)}${e.fasting ? " · jejum" : ""}</span>
      <button class="kg-del" data-id="${e.id}" aria-label="Remover">✕</button>
    </div>`).join("")}</div>`;
}

function bindWeight() {
  const saveBtn = document.getElementById("kg-save");
  if (saveBtn) saveBtn.addEventListener("click", onSaveWeight);

  const heightInput = document.getElementById("kg-height");
  if (heightInput) {
    heightInput.addEventListener("change", () => {
      const h = Number(heightInput.value);
      if (h > 0) { stateData.height = h; saveHeight(USER, h); renderWeight(); }
    });
  }
  document.querySelectorAll(".kg-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("Remover esta pesagem?")) return;
      try {
        await deleteWeightEntry(USER, id);
        stateData.entries = stateData.entries.filter((e) => e.id !== id);
        renderWeight();
      } catch (e) {
        console.warn("deleteWeightEntry falhou:", e);
        showMsg("não consegui remover — confira as regras do Firestore", true);
      }
    });
  });
}

function showMsg(text, isError) {
  const el = document.getElementById("kg-msg");
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle("is-error", !!isError);
  if (!isError) setTimeout(() => { el.hidden = true; }, 2500);
}

async function onSaveWeight() {
  const weight = Number(document.getElementById("kg-weight").value);
  const fasting = document.getElementById("kg-fasting").checked;
  if (!weight || weight <= 0) { showMsg("informe um peso válido", true); return; }
  const date = todayISO();
  const btn = document.getElementById("kg-save");
  if (btn) { btn.disabled = true; btn.textContent = "Salvando…"; }
  try {
    const rec = await addWeightEntry({ userId: USER, weight, fasting, date, time: "", at: Date.now() });
    stateData.entries.push(rec);
    stateData.entries.sort((a, b) => (a.at || 0) - (b.at || 0));
    renderWeight();
    showMsg("pesagem salva ✓", false);
  } catch (e) {
    console.warn("addWeightEntry falhou:", e);
    if (btn) { btn.disabled = false; btn.textContent = "Salvar pesagem"; }
    showMsg("não consegui salvar — confira as regras do Firestore", true);
  }
}

// ─── Seção DIETA ──────────────────────────────────────────────────────
function foodId(mealKey, foodKey) { return `${mealKey}.${foodKey}`; }

function renderDiet() {
  const el = document.getElementById("kg-section");
  if (!el) return;

  if (IS_VINI) {
    if (stateData.trackingScope === TRACKING_SCOPE.OFFICIAL_DIET) renderViniOfficialDiet(el);
    else renderViniDietTracker(el, { scope: stateData.trackingScope });
    return;
  }

  el.innerHTML = `
    <section class="block">
      <div class="block-head"><h2>Resumo de hoje</h2></div>
      <div id="diet-nutri">${nutriHTML(computeNutrition(stateData.dietFoods))}</div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Metas de hoje</h2></div>
      <div id="diet-goals">${goalsHTML(computeNutrition(stateData.dietFoods))}</div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Comidas de hoje</h2>
        <span class="muted" id="diet-count" style="font-size:11px">${countItems(stateData.dietFoods)}</span>
      </div>
      ${DIET_MENU.map(mealHTML).join("")}
      <p id="kg-diet-msg" class="kg-msg" hidden></p>
    </section>

    <section class="block">
      <div class="block-head"><h2>Histórico</h2></div>
      <div id="diet-hist-wrap">${dietHistoryHTML()}</div>
    </section>

    <div id="diet-stats-wrap">${dietStatsSectionHTML()}</div>`;

  bindDiet();
}

function goalsHTML(t) {
  return `<div class="goals">
    ${GOAL_META.map((g) => {
      const cur = t[g.key];
      const goal = Number(GOALS[g.key]) || 0;
      const pct = goal > 0 ? Math.round((cur / goal) * 100) : 0;
      const w = Math.max(0, Math.min(100, pct));
      return `
        <div class="goal-row ${g.cls}${pct >= 100 ? " is-met" : ""}">
          <div class="goal-head">
            <span class="goal-label">${g.label}</span>
            <span class="goal-val">${cur} / ${goal} ${g.unit} · ${pct}%</span>
          </div>
          <div class="goal-bar"><div class="goal-fill" style="width:${w}%"></div></div>
        </div>`;
    }).join("")}
    <p class="muted nutri-note">metas provisórias — ajuste quando tiver os números certos</p>
  </div>`;
}

function nutriHTML(t) {
  return `
    <div class="nutri">
      <div class="nutri-kcal">
        <span class="nutri-kcal-val">${t.kcal}</span>
        <span class="nutri-kcal-unit">kcal</span>
      </div>
      <div class="nutri-macros">
        <div class="nutri-macro nutri-p"><b>${t.p} g</b><span>Proteína</span></div>
        <div class="nutri-macro nutri-c"><b>${t.c} g</b><span>Carbo</span></div>
        <div class="nutri-macro nutri-f"><b>${t.f} g</b><span>Gordura</span></div>
      </div>
      <p class="muted nutri-note">estimativa aproximada dos valores</p>
    </div>`;
}

function countItems(foods) {
  const n = Object.keys(foods || {}).length;
  return n === 0 ? "nada ainda" : `${n} ${n === 1 ? "item" : "itens"}`;
}

function mealHTML(meal) {
  return `
    <div class="diet-meal-group">
      <h3 class="diet-meal-title">${meal.icon} ${meal.label}</h3>
      ${meal.foods.map((f) => {
        const id = foodId(meal.key, f.key);
        const sel = stateData.dietFoods[id];
        return `
          <div class="food-row">
            <span class="food-name">${f.label}</span>
            <div class="food-opts" data-food="${id}">
              ${f.options.map((o) => `<button class="chip food-chip${sel === o ? " is-on" : ""}" data-food="${id}" data-val="${o}">${o}</button>`).join("")}
            </div>
          </div>`;
      }).join("")}
    </div>`;
}

function dietHistoryHTML() {
  const today = todayISO();
  const map = filterDateMapForTrackingScope(
    { ...stateData.dietMap, [today]: stateData.dietFoods },
    USER,
    stateData.trackingScope
  );
  const days = Object.keys(map)
    .filter((d) => Object.keys(map[d] || {}).length > 0)
    .sort((a, b) => b.localeCompare(a)); // mais recente primeiro
  if (!days.length) return `<p class="muted" style="padding:8px">Nenhum registro ainda.</p>`;
  return `<div class="diet-days">${days.map((d) => {
    const foods = map[d];
    const n = Object.keys(foods).length;
    const kcal = computeNutrition(foods).kcal;
    return `<div class="diet-day-row${d === today ? " is-today" : ""}">
      <span class="diet-day-date">${weekdayShort(d)} ${fmtDateBR(d)}</span>
      <span class="diet-day-meta">${n} ${n === 1 ? "item" : "itens"} · ~${kcal} kcal</span>
    </div>`;
  }).join("")}</div>`;
}

function dietStatsSectionHTML() {
  const today = todayISO();
  const map = filterDateMapForTrackingScope(
    { ...stateData.dietMap, [today]: stateData.dietFoods },
    USER,
    stateData.trackingScope
  );
  const recordedDays = Object.entries(map)
    .filter(([, foods]) => Object.keys(foods || {}).length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  if (recordedDays.length === 0) {
    return `
      <section class="block">
        <div class="block-head"><h2>📊 Estatísticas da alimentação</h2></div>
        <div class="stat-card">
          <p class="muted" style="font-size:13px;margin:0">Marque os alimentos para começar a formar as estatísticas.</p>
        </div>
      </section>`;
  }

  const foodStats = {};
  const mealStats = Object.fromEntries(DIET_MENU.map((meal) => [meal.key, {
    label: meal.label,
    icon: meal.icon,
    days: new Set(),
    selections: 0,
  }]));
  const totals = { kcal: 0, p: 0, c: 0, f: 0, selections: 0 };

  for (const [date, foods] of recordedDays) {
    const nutrition = computeNutrition(foods);
    totals.kcal += nutrition.kcal;
    totals.p += nutrition.p;
    totals.c += nutrition.c;
    totals.f += nutrition.f;

    for (const [id, rawQuantity] of Object.entries(foods)) {
      const quantity = Number(rawQuantity) || 0;
      const info = FOOD_NUTRI[id];
      if (!info || quantity <= 0) continue;
      const mealKey = id.split(".")[0];
      if (!foodStats[id]) {
        const meal = mealStats[mealKey];
        foodStats[id] = {
          id,
          label: `${meal?.icon || "🍽️"} ${info.label}`,
          info,
          days: 0,
          quantity: 0,
        };
      }
      foodStats[id].days += 1;
      foodStats[id].quantity += quantity;
      totals.selections += 1;
      if (mealStats[mealKey]) {
        mealStats[mealKey].days.add(date);
        mealStats[mealKey].selections += 1;
      }
    }
  }

  const dayCount = recordedDays.length;
  const avg = (value) => Math.round(value / dayCount);
  const topFoods = Object.values(foodStats)
    .sort((a, b) => b.days - a.days || b.quantity - a.quantity)
    .slice(0, 8);
  const salad = foodStats["almoco.salada"] || { days: 0, quantity: 0 };
  const saladAvg = salad.days > 0 ? Math.round(salad.quantity / salad.days) : 0;

  const foodRows = topFoods.map((food) => {
    const quantity = food.info.per === "100g"
      ? `${Math.round(food.quantity)} g`
      : `${Math.round(food.quantity)} un.`;
    return `
      <div class="stat-row">
        <span class="stat-label">${food.label}</span>
        <span class="stat-value">${food.days}d <span class="muted" style="font-size:11px;font-weight:500">· ${quantity}</span></span>
      </div>`;
  }).join("");

  const mealRows = DIET_MENU.map((meal) => {
    const stat = mealStats[meal.key];
    return `
      <div class="stat-row">
        <span class="stat-label">${meal.icon} ${meal.label}</span>
        <span class="stat-value">${stat.days.size}d <span class="muted" style="font-size:11px;font-weight:500">· ${stat.selections} itens</span></span>
      </div>`;
  }).join("");

  return `
    <section class="block">
      <div class="block-head">
        <h2>📊 Estatísticas da alimentação</h2>
        <span class="muted" style="font-size:11px">por dia registrado</span>
      </div>
      <div class="stat-card diet-stats-card">
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-value">${dayCount}</div><div class="kpi-label">dias registrados</div></div>
          <div class="kpi"><div class="kpi-value">${avg(totals.kcal)}</div><div class="kpi-label">kcal médias / dia</div></div>
          <div class="kpi"><div class="kpi-value">${avg(totals.p)}g</div><div class="kpi-label">proteína média / dia</div></div>
          <div class="kpi"><div class="kpi-value">${avg(totals.c)}g</div><div class="kpi-label">carbo médio / dia</div></div>
          <div class="kpi"><div class="kpi-value">${avg(totals.f)}g</div><div class="kpi-label">gordura média / dia</div></div>
          <div class="kpi"><div class="kpi-value">${totals.selections}</div><div class="kpi-label">alimentos marcados</div></div>
        </div>

        ${IS_VINI ? `
          <h3 class="stats-subhead">🥗 Salada no almoço</h3>
          <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
            <div class="kpi"><div class="kpi-value">${salad.days}</div><div class="kpi-label">dias com salada</div></div>
            <div class="kpi"><div class="kpi-value">${Math.round(salad.quantity)}g</div><div class="kpi-label">total consumido</div></div>
            <div class="kpi"><div class="kpi-value">${saladAvg}g</div><div class="kpi-label">média por consumo</div></div>
          </div>` : ""}

        <h3 class="stats-subhead">Por refeição</h3>
        ${mealRows}

        <h3 class="stats-subhead">Mais consumidos</h3>
        ${foodRows}
      </div>
    </section>`;
}

function bindDiet() {
  document.querySelectorAll(".food-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.food;
      const val = Number(chip.dataset.val);
      const cur = stateData.dietFoods[id];
      if (cur === val) delete stateData.dietFoods[id]; // toca no selecionado → desmarca
      else stateData.dietFoods[id] = val;

      // Atualiza os chips deste alimento no lugar (sem re-render pra não pular scroll)
      const group = chip.closest(".food-opts");
      group.querySelectorAll(".food-chip").forEach((c) => {
        c.classList.toggle("is-on", Number(c.dataset.val) === stateData.dietFoods[id]);
      });

      // Atualiza resumo nutricional + contador + histórico (sem re-render total)
      const today = todayISO();
      stateData.dietMap[today] = { ...stateData.dietFoods };
      const totals = computeNutrition(stateData.dietFoods);
      const nutri = document.getElementById("diet-nutri");
      if (nutri) nutri.innerHTML = nutriHTML(totals);
      const goals = document.getElementById("diet-goals");
      if (goals) goals.innerHTML = goalsHTML(totals);
      const count = document.getElementById("diet-count");
      if (count) count.textContent = countItems(stateData.dietFoods);
      const hist = document.getElementById("diet-hist-wrap");
      if (hist) hist.innerHTML = dietHistoryHTML();
      const stats = document.getElementById("diet-stats-wrap");
      if (stats) stats.innerHTML = dietStatsSectionHTML();

      persistDiet();
    });
  });
}

async function persistDiet() {
  try {
    await setDietDay(USER, todayISO(), stateData.dietFoods);
  } catch (e) {
    console.warn("setDietDay falhou:", e);
    const msg = document.getElementById("kg-diet-msg");
    if (msg) { msg.textContent = "não consegui salvar — confira as regras do Firestore"; msg.hidden = false; msg.classList.add("is-error"); }
  }
}

// ─── Seed inicial do peso ─────────────────────────────────────────────
async function seedIfEmpty() {
  if (IS_VINI) return;
  if (stateData.entries.length > 0 || wasSeeded(USER)) return;
  const yest = offsetISO(-1), today = todayISO();
  try {
    const a = await addWeightEntry({ userId: USER, weight: 45.2, fasting: true, date: yest, time: "", at: epochFor(yest) });
    const b = await addWeightEntry({ userId: USER, weight: 44.6, fasting: true, date: today, time: "", at: epochFor(today) });
    stateData.entries.push(a, b);
    stateData.entries.sort((x, y) => (x.at || 0) - (y.at || 0));
    markSeeded(USER);
  } catch (e) {
    console.warn("seed inicial falhou (regras do Firestore?):", e);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({
    onAuthorized: async (user) => {
      try {
        renderAuthFooter(user);
        try { const s = localStorage.getItem(SECTION_KEY); if (s === "peso" || s === "dieta") stateData.section = s; } catch {}
        stateData.height = loadHeight(USER, IS_VINI ? null : DEFAULT_HEIGHT_M);
        stateData.entries = await getWeightEntries(USER);
        await seedIfEmpty();
        if (IS_VINI) {
          await loadViniDietTracker();
        } else {
          stateData.dietFoods = await getDietDay(USER, todayISO());
          stateData.dietMap = await getDietMap(USER);
        }
        render();
      } catch (err) {
        console.error(`Erro ao inicializar Kg ${PERSON_NAME}:`, err);
        const root = document.getElementById("kg-content");
        if (root && !root.children.length) {
          root.innerHTML = `<section class="block"><div class="stat-card">
            <p class="muted">Erro ao carregar. Verifique as regras do Firestore no console.</p>
          </div></section>`;
        }
      } finally {
        document.body.classList.remove("is-loading");
      }
    },
  });
});
