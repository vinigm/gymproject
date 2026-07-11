// Página "Kg Vivi": registro de peso da Vivi com seletor de horário estilo
// despertador (rodas roláveis), gráfico de evolução e cálculos de IMC.

import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import {
  addWeightEntry, getWeightEntries, deleteWeightEntry,
  loadHeight, saveHeight, DEFAULT_HEIGHT_M,
  wasSeeded, markSeeded,
} from "./weight-storage.js";

const USER = "victoria";
const ITEM_H = 40; // altura de cada item das rodas (px) — casa com o CSS

const stateData = {
  entries: [],
  height: DEFAULT_HEIGHT_M,
};

// ─── Helpers de data/hora ─────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayISO() { return toISODate(new Date()); }
function offsetISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
function epochFor(dateISO, timeHHMM) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = (timeHHMM || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0).getTime();
}
function fmtDateBR(iso) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return `${pad2(d)}/${pad2(m)}`;
  } catch { return iso; }
}
function fmtWeight(kg) {
  return `${(Math.round(kg * 10) / 10).toString().replace(".", ",")}`;
}

// ─── IMC ──────────────────────────────────────────────────────────────
function bmi(weightKg, heightM) { return weightKg / (heightM * heightM); }
function bmiClass(v) {
  if (v < 18.5) return { label: "Abaixo do peso", cls: "imc--low" };
  if (v < 25)   return { label: "Peso normal",    cls: "imc--ok" };
  if (v < 30)   return { label: "Sobrepeso",      cls: "imc--warn" };
  return { label: "Obesidade", cls: "imc--high" };
}

// ─── Render principal ─────────────────────────────────────────────────
function render() {
  const root = document.getElementById("kg-content");
  if (!root) return;

  const entries = stateData.entries;
  const latest = entries[entries.length - 1] || null;
  const prev = entries[entries.length - 2] || null;
  const now = new Date();
  const defaultWeight = latest ? latest.weight : 44.6;

  root.innerHTML = `
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

        <div class="kg-field">
          <span class="kg-label">Horário</span>
          ${timeWheelHTML(now.getHours(), now.getMinutes())}
        </div>

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
    </section>
  `;

  bindForm();
  initWheels(now.getHours(), now.getMinutes());
  bindList();
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
      <span class="kg-hero-sub">${fmtDateBR(latest.date)} · ${latest.time || "--:--"}${latest.fasting ? " · em jejum" : ""}</span>
    </section>`;
}

// ─── Roda de horário (estilo despertador) ─────────────────────────────
function timeWheelHTML(h, m) {
  const col = (unit, count) => `
    <div class="wheel" data-unit="${unit}" tabindex="0" aria-label="${unit === 'h' ? 'horas' : 'minutos'}">
      ${Array.from({ length: count }, (_, i) => `<div class="wheel-item">${pad2(i)}</div>`).join("")}
    </div>`;
  return `
    <div class="time-wheel" id="time-wheel">
      ${col("h", 24)}
      <span class="wheel-colon">:</span>
      ${col("m", 60)}
      <div class="wheel-band" aria-hidden="true"></div>
    </div>`;
}

function initWheels(h, m) {
  const wh = document.querySelector('.wheel[data-unit="h"]');
  const wm = document.querySelector('.wheel[data-unit="m"]');
  if (wh) setupWheel(wh, h);
  if (wm) setupWheel(wm, m);
}

function setupWheel(el, initialIdx) {
  const mark = () => {
    const idx = Math.round(el.scrollTop / ITEM_H);
    el.querySelectorAll(".wheel-item").forEach((it, i) => it.classList.toggle("is-sel", i === idx));
  };
  // Posiciona no valor inicial (depois do layout assentar)
  const setInitial = () => { el.scrollTop = initialIdx * ITEM_H; mark(); };
  setInitial();
  requestAnimationFrame(setInitial);
  setTimeout(setInitial, 60);
  el.addEventListener("scroll", () => { mark(); }, { passive: true });
  // Clicar num número centraliza ele (útil no desktop; no touch o scroll já rola)
  el.querySelectorAll(".wheel-item").forEach((it, i) => {
    it.addEventListener("click", () => el.scrollTo({ top: i * ITEM_H, behavior: "smooth" }));
  });
}

function wheelValue(unit) {
  const el = document.querySelector(`.wheel[data-unit="${unit}"]`);
  if (!el) return 0;
  const count = unit === "h" ? 24 : 60;
  return Math.max(0, Math.min(count - 1, Math.round(el.scrollTop / ITEM_H)));
}

// ─── Gráfico de linha (SVG) ───────────────────────────────────────────
function chartHTML(entries) {
  if (!entries.length) {
    return `<p class="muted" style="padding:20px 8px;text-align:center">Registre pesagens pra ver o gráfico.</p>`;
  }
  const W = 320, H = 180, padL = 34, padR = 12, padT = 14, padB = 26;
  const ws = entries.map((e) => e.weight);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  if (hi - lo < 1) { const mid = (hi + lo) / 2; lo = mid - 0.5; hi = mid + 0.5; }
  const range = hi - lo;
  lo -= range * 0.15; hi += range * 0.15;

  const n = entries.length;
  const x = (i) => padL + (n === 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
  const y = (w) => padT + (1 - (w - lo) / (hi - lo)) * (H - padT - padB);

  // Grade horizontal (3 linhas) + labels
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

  // Labels de data: primeiro e último (evita poluir)
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

// ─── IMC ────────────────────────────────────────────────────────────
function imcHTML(latest) {
  const h = stateData.height;
  if (!latest) {
    return `<p class="muted" style="padding:8px">Registre um peso pra calcular o IMC.</p>`;
  }
  const v = bmi(latest.weight, h);
  const c = bmiClass(v);
  const normalLo = 18.5 * h * h;
  const normalHi = 24.9 * h * h;
  const toNormal = latest.weight < normalLo ? normalLo - latest.weight
                 : latest.weight > normalHi ? latest.weight - normalHi : 0;
  const toNormalTxt = toNormal === 0
    ? "dentro da faixa normal"
    : (latest.weight < normalLo
        ? `${fmtWeight(toNormal)} kg até a faixa normal`
        : `${fmtWeight(toNormal)} kg acima da faixa normal`);

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

// ─── Lista de registros ───────────────────────────────────────────────
function listHTML(entries) {
  if (!entries.length) return `<p class="muted" style="padding:8px">Nada por aqui ainda.</p>`;
  const recent = entries.slice(-8).reverse();
  return `<div class="kg-list">${recent.map((e) => `
    <div class="kg-list-row" data-id="${e.id}">
      <span class="kg-list-w">${fmtWeight(e.weight)} kg</span>
      <span class="kg-list-meta">${fmtDateBR(e.date)} · ${e.time || "--:--"}${e.fasting ? " · jejum" : ""}</span>
      <button class="kg-del" data-id="${e.id}" aria-label="Remover">✕</button>
    </div>`).join("")}</div>`;
}

// ─── Bindings ─────────────────────────────────────────────────────────
function bindForm() {
  const saveBtn = document.getElementById("kg-save");
  if (saveBtn) saveBtn.addEventListener("click", onSave);

  const heightInput = document.getElementById("kg-height");
  if (heightInput) {
    heightInput.addEventListener("change", () => {
      const h = Number(heightInput.value);
      if (h > 0) {
        stateData.height = h;
        saveHeight(USER, h);
        render(); // recalcula IMC
      }
    });
  }
}

function bindList() {
  document.querySelectorAll(".kg-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("Remover esta pesagem?")) return;
      try {
        await deleteWeightEntry(USER, id);
        stateData.entries = stateData.entries.filter((e) => e.id !== id);
        render();
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

async function onSave() {
  const weight = Number(document.getElementById("kg-weight").value);
  const fasting = document.getElementById("kg-fasting").checked;
  if (!weight || weight <= 0) { showMsg("informe um peso válido", true); return; }

  const hh = wheelValue("h");
  const mm = wheelValue("m");
  const time = `${pad2(hh)}:${pad2(mm)}`;
  const date = todayISO();

  const btn = document.getElementById("kg-save");
  if (btn) { btn.disabled = true; btn.textContent = "Salvando…"; }
  try {
    const rec = await addWeightEntry({ userId: USER, weight, fasting, date, time, at: epochFor(date, time) });
    stateData.entries.push(rec);
    stateData.entries.sort((a, b) => (a.at || 0) - (b.at || 0));
    render();
    showMsg("pesagem salva ✓", false);
  } catch (e) {
    console.warn("addWeightEntry falhou:", e);
    if (btn) { btn.disabled = false; btn.textContent = "Salvar pesagem"; }
    showMsg("não consegui salvar — confira as regras do Firestore", true);
  }
}

// ─── Seed inicial ─────────────────────────────────────────────────────
async function seedIfEmpty() {
  if (stateData.entries.length > 0 || wasSeeded(USER)) return;
  const yest = offsetISO(-1);
  const today = todayISO();
  try {
    const a = await addWeightEntry({ userId: USER, weight: 45.2, fasting: true, date: yest, time: "07:00", at: epochFor(yest, "07:00") });
    const b = await addWeightEntry({ userId: USER, weight: 44.6, fasting: true, date: today, time: "07:00", at: epochFor(today, "07:00") });
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
        stateData.height = loadHeight(USER);
        stateData.entries = await getWeightEntries(USER);
        await seedIfEmpty();
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
