// Página "Kg Vivi": duas seções — Peso (registro + gráfico + IMC) e Dieta
// (checklist de café/almoço/janta com histórico).

import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import {
  addWeightEntry, getWeightEntries, deleteWeightEntry,
  loadHeight, saveHeight, DEFAULT_HEIGHT_M,
  wasSeeded, markSeeded,
} from "./weight-storage.js";
import { getDietDay, setDietDay, getDietMap } from "./diet-storage.js";

const USER = "victoria";
const SECTION_KEY = "habitos-kg-section";

const MEALS = [
  { key: "breakfast", icon: "🌅", label: "Café da manhã" },
  { key: "lunch",     icon: "☀️", label: "Almoço" },
  { key: "dinner",    icon: "🌙", label: "Janta" },
];
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const stateData = {
  section: "peso",       // "peso" | "dieta"
  entries: [],
  height: DEFAULT_HEIGHT_M,
  dietToday: { breakfast: false, lunch: false, dinner: false },
  dietMap: {},
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
    <div id="kg-section"></div>`;

  root.querySelectorAll("#kg-section-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectSection(btn.dataset.section));
  });
  selectSection(stateData.section);
}

function selectSection(section) {
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
  const entries = stateData.entries;
  const latest = entries[entries.length - 1] || null;
  const prev = entries[entries.length - 2] || null;
  const defaultWeight = latest ? latest.weight : 44.6;

  el.innerHTML = `
    ${heroHTML(latest, prev)}

    <section class="block">
      <div class="block-head"><h2>Registrar pesagem</h2></div>
      <div class="kg-form">
        <label class="kg-field">
          <span class="kg-label">Peso (kg)</span>
          <input type="number" inputmode="decimal" step="0.1" min="0" id="kg-weight"
                 class="kg-weight-input" value="${defaultWeight}" />
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
               id="kg-height" class="kg-height-input" value="${stateData.height}" />
      </label>
    </section>

    <section class="block">
      <div class="block-head"><h2>Últimos registros</h2></div>
      ${listHTML(entries)}
    </section>`;

  bindWeight();
}

function heroHTML(latest, prev) {
  if (!latest) {
    return `<section class="kg-hero"><span class="kg-hero-empty">Sem registros ainda — registre a primeira pesagem 👇</span></section>`;
  }
  let delta = "";
  if (prev) {
    const d = latest.weight - prev.weight;
    const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
    const txt = d === 0 ? "sem mudança" : `${arrow} ${fmtWeight(Math.abs(d))} kg vs anterior`;
    delta = `<span class="kg-hero-delta">${txt}</span>`;
  }
  return `
    <section class="kg-hero">
      <span class="kg-hero-value">${fmtWeight(latest.weight)}<small>kg</small></span>
      ${delta}
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
    <p class="muted kg-imc-note">Classificação OMS pra altura de ${String(h).replace(".", ",")} m. É só referência, não é avaliação médica.</p>`;
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
function renderDiet() {
  const el = document.getElementById("kg-section");
  if (!el) return;
  const done = MEALS.filter((m) => stateData.dietToday[m.key]).length;

  el.innerHTML = `
    <section class="block">
      <div class="block-head"><h2>Refeições de hoje</h2>
        <span class="muted" style="font-size:11px">${done}/3</span>
      </div>
      <div class="diet-checklist">
        ${MEALS.map((m) => `
          <button class="diet-meal ${stateData.dietToday[m.key] ? "is-done" : ""}" data-meal="${m.key}">
            <span class="diet-meal-icon">${m.icon}</span>
            <span class="diet-meal-label">${m.label}</span>
            <span class="diet-meal-check" aria-hidden="true"></span>
          </button>`).join("")}
      </div>
      <p id="kg-diet-msg" class="kg-msg" hidden></p>
    </section>

    <section class="block">
      <div class="block-head"><h2>Últimos 7 dias</h2></div>
      ${dietHistoryHTML()}
      <p class="muted diet-legend">🌅 café · ☀️ almoço · 🌙 janta</p>
    </section>`;

  bindDiet();
}

function dietHistoryHTML() {
  const days = Array.from({ length: 7 }, (_, i) => offsetISO(-(6 - i)));
  const today = todayISO();
  return `<div class="diet-hist">${days.map((d) => {
    const meals = d === today ? stateData.dietToday : (stateData.dietMap[d] || {});
    const dots = MEALS.map((m) => `<span class="diet-dot ${meals[m.key] ? "on" : ""}"></span>`).join("");
    return `<div class="diet-hist-col${d === today ? " is-today" : ""}">
      <div class="diet-hist-dots">${dots}</div>
      <span class="diet-hist-wd">${weekdayShort(d)}</span>
      <span class="diet-hist-day">${d.slice(8)}</span>
    </div>`;
  }).join("")}</div>`;
}

function bindDiet() {
  document.querySelectorAll(".diet-meal").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.meal;
      const next = !stateData.dietToday[key];
      stateData.dietToday = { ...stateData.dietToday, [key]: next };
      stateData.dietMap[todayISO()] = { ...stateData.dietToday };
      renderDiet(); // feedback imediato
      try {
        await setDietDay(USER, todayISO(), stateData.dietToday);
      } catch (e) {
        console.warn("setDietDay falhou:", e);
        const msg = document.getElementById("kg-diet-msg");
        if (msg) { msg.textContent = "não consegui salvar — confira as regras do Firestore"; msg.hidden = false; msg.classList.add("is-error"); }
      }
    });
  });
}

// ─── Seed inicial do peso ─────────────────────────────────────────────
async function seedIfEmpty() {
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
        stateData.height = loadHeight(USER);
        stateData.entries = await getWeightEntries(USER);
        await seedIfEmpty();
        stateData.dietToday = await getDietDay(USER, todayISO());
        stateData.dietMap = await getDietMap(USER);
        render();
      } catch (err) {
        console.error("Erro ao inicializar Kg Vivi:", err);
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
