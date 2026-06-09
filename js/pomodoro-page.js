// Página de Pomodoro: timer Foco / Pausa curta / Pausa longa, com tracking
// por categoria e estatísticas por usuário (Vini / Vivi).

import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import {
  loadPomodoroConfig, savePomodoroConfig,
  getPomodoroSessions, savePomodoroSession,
  DEFAULT_POMODORO_CONFIG,
} from "./pomodoro-storage.js";

// ─────────────────────────────────────────────────────────────────────
//  STATE (por usuário ativo)
// ─────────────────────────────────────────────────────────────────────
const _state = {
  user: "vinicius",
  config: { ...DEFAULT_POMODORO_CONFIG },
  sessions: [],
  // timer state
  mode: "foco",          // "foco" | "short" | "long"
  remaining: 25 * 60,    // segundos
  running: false,
  paused: false,
  category: "Trabalho",
  pomodorosCompleted: 0, // contador da sessão atual (zera ao recarregar)
  startedAt: null,
};

let tickHandle = null;
let audioCtx = null;
let wakeLock = null;
let configSaveTimer = null;

// ─────────────────────────────────────────────────────────────────────
//  ÁUDIO
// ─────────────────────────────────────────────────────────────────────
function ensureAudioCtx() {
  if (!audioCtx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}
function beep(freq = 880, durMs = 150, gain = 0.18) {
  const ctx = ensureAudioCtx();
  if (!ctx || ctx.state !== "running") return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    o.start(t0);
    o.stop(t0 + durMs / 1000 + 0.02);
  } catch (e) {}
}
function beepTick() { beep(880, 80, 0.22); }
function beepFocusDone() {
  // 3 beeps subindo = fim do foco
  beep(660, 180);
  setTimeout(() => beep(880, 180), 220);
  setTimeout(() => beep(1100, 320, 0.22), 460);
}
function beepBreakDone() {
  // 2 beeps = fim da pausa, hora de focar
  beep(990, 160);
  setTimeout(() => beep(660, 220, 0.2), 200);
}

// ─────────────────────────────────────────────────────────────────────
//  WAKE LOCK
// ─────────────────────────────────────────────────────────────────────
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
  } catch (e) {}
}
async function releaseWakeLock() {
  try { if (wakeLock) await wakeLock.release(); } catch (e) {}
  wakeLock = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && _state.running) requestWakeLock();
});

// ─────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekStartISO() {
  // domingo como início da semana
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.max(0, secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtDurationMin(min) {
  if (!min || min === 0) return "0min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
function fmtTimeOfDay(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return ""; }
}
function fmtDateBR(iso) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return iso; }
}

function modeLabel(m) {
  if (m === "foco") return "🎯 Foco";
  if (m === "short") return "☕ Pausa curta";
  return "🛋️ Pausa longa";
}
function modeDurationMin() {
  if (_state.mode === "foco") return _state.config.focus_min;
  if (_state.mode === "short") return _state.config.short_min;
  return _state.config.long_min;
}
function modeTotalSecs() { return modeDurationMin() * 60; }

function nextBreakMode() {
  // chamado após completar 1 foco — decide se a próxima pausa é longa ou curta
  // pomodorosCompleted já foi incrementado no momento da chamada
  const n = _state.pomodorosCompleted;
  const k = Math.max(1, _state.config.cycles_per_long || 1);
  return (n % k === 0) ? "long" : "short";
}

// ─────────────────────────────────────────────────────────────────────
//  TIMER CONTROL
// ─────────────────────────────────────────────────────────────────────
function startTimer() {
  if (_state.running) return;
  ensureAudioCtx();
  requestWakeLock();
  if (!_state.startedAt) _state.startedAt = new Date().toISOString();
  _state.running = true;
  _state.paused = false;
  tickHandle = setInterval(onTick, 1000);
  render();
}

function pauseTimer() {
  if (!_state.running) return;
  _state.paused = !_state.paused;
  updatePauseBtn();
}

function stopTimer() {
  // Para sem salvar a sessão (descarta progresso atual)
  if (_state.running && !confirm("Parar o timer? O ciclo atual não será salvo.")) return;
  clearInterval(tickHandle); tickHandle = null;
  releaseWakeLock();
  _state.running = false;
  _state.paused = false;
  _state.remaining = modeTotalSecs();
  _state.startedAt = null;
  render();
}

function resetCycle() {
  // Reseta o contador de ciclos (volta pro foco do zero)
  if (_state.running) {
    if (!confirm("Resetar o ciclo? O timer atual vai parar.")) return;
    clearInterval(tickHandle); tickHandle = null;
    releaseWakeLock();
  }
  _state.running = false;
  _state.paused = false;
  _state.mode = "foco";
  _state.remaining = _state.config.focus_min * 60;
  _state.pomodorosCompleted = 0;
  _state.startedAt = null;
  render();
}

function onTick() {
  if (_state.paused) return;
  _state.remaining -= 1;
  if (_state.remaining > 0 && _state.remaining <= 5) beepTick();
  if (_state.remaining <= 0) {
    onPeriodComplete();
  } else {
    updateCountdownDom();
  }
}

async function onPeriodComplete() {
  clearInterval(tickHandle); tickHandle = null;
  if (_state.mode === "foco") {
    // Salva a sessão de foco completa
    const dur = _state.config.focus_min;
    try {
      await savePomodoroSession({
        userId: _state.user,
        category: _state.category,
        duration_min: dur,
        completedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Falha ao salvar pomodoro:", e);
    }
    _state.pomodorosCompleted += 1;
    beepFocusDone();
    // Auto-transição pra pausa
    const breakMode = nextBreakMode();
    _state.mode = breakMode;
    _state.remaining = modeTotalSecs();
    _state.startedAt = new Date().toISOString();
    tickHandle = setInterval(onTick, 1000);   // pausa começa automática
    _state.sessions = await getPomodoroSessions(_state.user);
    render();
  } else {
    // Pausa terminou — volta pra Foco mas NÃO começa automático
    beepBreakDone();
    _state.mode = "foco";
    _state.remaining = _state.config.focus_min * 60;
    _state.running = false;
    _state.paused = false;
    _state.startedAt = null;
    releaseWakeLock();
    render();
  }
}

// ─────────────────────────────────────────────────────────────────────
//  CATEGORIAS
// ─────────────────────────────────────────────────────────────────────
function setCategory(cat) {
  _state.category = cat;
  // só repinta os chips de categoria, sem rerender completo
  document.querySelectorAll(".pom-cat-chip").forEach(el => {
    el.classList.toggle("is-on", el.dataset.cat === cat);
  });
}

async function addCategory() {
  const name = (prompt("Nome da nova categoria:") || "").trim();
  if (!name) return;
  if (_state.config.categories.includes(name)) {
    alert("Essa categoria já existe.");
    return;
  }
  _state.config.categories.push(name);
  await savePomodoroConfig(_state.user, _state.config);
  _state.category = name;
  render();
}

async function removeCategory(name) {
  if (_state.config.categories.length <= 1) {
    alert("Mantenha pelo menos uma categoria.");
    return;
  }
  if (!confirm(`Remover categoria "${name}"?\n\nAs sessões já registradas com essa categoria continuam guardadas.`)) return;
  _state.config.categories = _state.config.categories.filter(c => c !== name);
  if (_state.category === name) _state.category = _state.config.categories[0];
  await savePomodoroConfig(_state.user, _state.config);
  render();
}

// ─────────────────────────────────────────────────────────────────────
//  CONFIG (durações + ciclos)
// ─────────────────────────────────────────────────────────────────────
function scheduleConfigSave() {
  if (configSaveTimer) clearTimeout(configSaveTimer);
  configSaveTimer = setTimeout(async () => {
    await savePomodoroConfig(_state.user, _state.config);
  }, 400);
}

function onConfigInput(field, valStr) {
  const v = Math.max(1, Math.min(180, Number(valStr) || 1));
  _state.config[field] = v;
  // Se não estiver rodando, atualiza o remaining pra refletir nova duração
  if (!_state.running && (
    (field === "focus_min" && _state.mode === "foco") ||
    (field === "short_min" && _state.mode === "short") ||
    (field === "long_min"  && _state.mode === "long")
  )) {
    _state.remaining = v * 60;
    updateCountdownDom();
  }
  updateCycleIndicator();
  scheduleConfigSave();
}

// ─────────────────────────────────────────────────────────────────────
//  STATS / HISTÓRICO
// ─────────────────────────────────────────────────────────────────────
function statsForRange(sessions, minDate) {
  const out = { totalMin: 0, cycles: 0, byCategory: {} };
  for (const s of sessions) {
    if (s.date && s.date < minDate) continue;
    out.totalMin += Number(s.duration_min) || 0;
    out.cycles += 1;
    const cat = s.category || "—";
    out.byCategory[cat] = (out.byCategory[cat] || 0) + (Number(s.duration_min) || 0);
  }
  return out;
}

function categoryRowsHtml(byCategory) {
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '<div class="muted" style="font-size:12px;padding:6px 0">sem sessões no período</div>';
  return entries.map(([cat, min]) => `
    <div class="stat-row">
      <span class="stat-label">${cat}</span>
      <span class="stat-value">${fmtDurationMin(min)}</span>
    </div>
  `).join("");
}

// ─────────────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────────────
function configCardHtml() {
  const c = _state.config;
  return `
    <section class="block">
      <div class="block-head"><h2>⚙️ Configuração</h2></div>
      <div class="stat-card">
        <div class="pom-cfg-grid">
          <label class="pom-cfg-field">
            <span class="pom-cfg-label">Foco</span>
            <input type="number" min="1" max="180" inputmode="numeric"
                   class="pom-cfg-input" data-field="focus_min" value="${c.focus_min}" />
            <span class="pom-cfg-unit">min</span>
          </label>
          <label class="pom-cfg-field">
            <span class="pom-cfg-label">Pausa curta</span>
            <input type="number" min="1" max="60" inputmode="numeric"
                   class="pom-cfg-input" data-field="short_min" value="${c.short_min}" />
            <span class="pom-cfg-unit">min</span>
          </label>
          <label class="pom-cfg-field">
            <span class="pom-cfg-label">Pausa longa</span>
            <input type="number" min="1" max="60" inputmode="numeric"
                   class="pom-cfg-input" data-field="long_min" value="${c.long_min}" />
            <span class="pom-cfg-unit">min</span>
          </label>
          <label class="pom-cfg-field">
            <span class="pom-cfg-label">Ciclos até pausa longa</span>
            <input type="number" min="1" max="10" inputmode="numeric"
                   class="pom-cfg-input" data-field="cycles_per_long" value="${c.cycles_per_long}" />
            <span class="pom-cfg-unit">ciclos</span>
          </label>
        </div>
      </div>
    </section>
  `;
}

function categoryChipsHtml() {
  const cats = _state.config.categories;
  const chips = cats.map(c => `
    <button class="pom-cat-chip${c === _state.category ? " is-on" : ""}" data-cat="${c}">
      <span class="pom-cat-name">${c}</span>
      <span class="pom-cat-x" data-action="remove" data-cat="${c}" title="Remover" aria-label="Remover">×</span>
    </button>
  `).join("");
  return `
    <div class="pom-cats">
      ${chips}
      <button class="pom-cat-add" id="pom-cat-add">+ Nova</button>
    </div>
  `;
}

function timerCardHtml() {
  const k = Math.max(1, _state.config.cycles_per_long || 1);
  const cycleNow = (_state.pomodorosCompleted % k) + 1;
  const isFoco = _state.mode === "foco";
  const total = modeTotalSecs();
  const pct = total > 0 ? ((total - _state.remaining) / total) * 100 : 0;

  return `
    <section class="block">
      <div class="block-head"><h2>⏱ Pomodoro</h2></div>
      <div class="stat-card pom-timer-card pom-mode--${_state.mode}${_state.running ? " is-running" : ""}${_state.paused ? " is-paused" : ""}${_state.remaining <= 5 && _state.running ? " is-final" : ""}">
        <div class="pom-mode-tabs">
          <button class="pom-tab${_state.mode === "foco" ? " is-on" : ""}" data-mode="foco" ${_state.running ? "disabled" : ""}>🎯 Foco</button>
          <button class="pom-tab${_state.mode === "short" ? " is-on" : ""}" data-mode="short" ${_state.running ? "disabled" : ""}>☕ Pausa curta</button>
          <button class="pom-tab${_state.mode === "long" ? " is-on" : ""}" data-mode="long" ${_state.running ? "disabled" : ""}>🛋️ Pausa longa</button>
        </div>

        <div class="pom-countdown-wrap">
          <div class="pom-countdown" id="pom-countdown">${fmtTime(_state.remaining)}</div>
          <div class="pom-progress-bar">
            <div class="pom-progress-fill" id="pom-progress-fill" style="width:${pct}%"></div>
          </div>
        </div>

        ${isFoco ? `
          <h3 class="stats-subhead" style="margin-top:14px">Categoria</h3>
          ${categoryChipsHtml()}
        ` : `
          <p class="muted" style="text-align:center;margin:8px 0 0;font-size:13px">
            ${_state.mode === "short" ? "Pausa curta — relaxe um pouco" : "Pausa longa — afaste-se da tela"}
          </p>
        `}

        <div class="pom-controls">
          ${_state.running
            ? `<button class="pom-btn pom-btn--primary" id="pom-pause">${_state.paused ? "▶ Continuar" : "⏸ Pausar"}</button>
               <button class="pom-btn pom-btn--ghost" id="pom-stop">⏹ Parar</button>`
            : `<button class="pom-btn pom-btn--primary" id="pom-start">▶ Começar ${modeLabel(_state.mode).replace(/^\S+\s/, "")}</button>
               <button class="pom-btn pom-btn--ghost" id="pom-reset">↺ Resetar</button>`
          }
        </div>

        <div class="pom-cycle-info" id="pom-cycle-info">
          Ciclo <strong>${cycleNow}</strong> / ${k} até a pausa longa
          · <span class="muted">${_state.pomodorosCompleted} concluído${_state.pomodorosCompleted === 1 ? "" : "s"} hoje</span>
        </div>
      </div>
    </section>
  `;
}

function statsCardHtml() {
  const today = todayISO();
  const weekStart = weekStartISO();
  const today_ = statsForRange(_state.sessions, today);
  const week_  = statsForRange(_state.sessions, weekStart);
  const total_ = statsForRange(_state.sessions, "0000-00-00");

  const panel = (title, data) => `
    <div class="pom-stats-panel">
      <h3 class="stats-subhead">${title}</h3>
      <div class="kpi-grid" style="grid-template-columns: 1fr 1fr">
        <div class="kpi"><div class="kpi-value">${fmtDurationMin(data.totalMin)}</div><div class="kpi-label">tempo focado</div></div>
        <div class="kpi"><div class="kpi-value">${data.cycles}</div><div class="kpi-label">${data.cycles === 1 ? "ciclo" : "ciclos"}</div></div>
      </div>
      ${categoryRowsHtml(data.byCategory)}
    </div>
  `;

  return `
    <section class="block">
      <div class="block-head"><h2>📊 Tempo focado</h2></div>
      <div class="stat-card pom-stats">
        ${panel("Hoje", today_)}
        ${panel("Esta semana", week_)}
        ${panel("Total", total_)}
      </div>
    </section>
  `;
}

function historyCardHtml() {
  const recent = _state.sessions.slice(0, 10);
  if (recent.length === 0) {
    return `
      <section class="block">
        <div class="block-head"><h2>🕘 Histórico</h2></div>
        <div class="stat-card">
          <p class="muted" style="font-size:13px;margin:0">Nenhuma sessão concluída ainda. Comece um foco pra registrar!</p>
        </div>
      </section>
    `;
  }
  const rows = recent.map(s => `
    <div class="pom-hist-row">
      <div class="pom-hist-time">${fmtTimeOfDay(s.completedAt)}</div>
      <div class="pom-hist-meta">
        <div class="pom-hist-cat">${s.category || "—"}</div>
        <div class="pom-hist-date muted">${fmtDateBR(s.date || (s.completedAt || "").slice(0, 10))}</div>
      </div>
      <div class="pom-hist-dur">${s.duration_min}min</div>
    </div>
  `).join("");
  return `
    <section class="block">
      <div class="block-head"><h2>🕘 Histórico recente</h2></div>
      <div class="stat-card">
        ${rows}
      </div>
    </section>
  `;
}

function render() {
  const root = document.getElementById("pom-content");
  if (!root) return;
  root.innerHTML = [
    configCardHtml(),
    timerCardHtml(),
    statsCardHtml(),
    historyCardHtml(),
  ].join("");
  bindAll();
}

function updateCountdownDom() {
  const el = document.getElementById("pom-countdown");
  if (el) el.textContent = fmtTime(_state.remaining);
  const total = modeTotalSecs();
  const pct = total > 0 ? ((total - _state.remaining) / total) * 100 : 0;
  const fill = document.getElementById("pom-progress-fill");
  if (fill) fill.style.width = pct + "%";
  const card = document.querySelector(".pom-timer-card");
  if (card) {
    card.classList.toggle("is-final", _state.remaining <= 5 && _state.running);
  }
}

function updatePauseBtn() {
  const btn = document.getElementById("pom-pause");
  if (btn) btn.textContent = _state.paused ? "▶ Continuar" : "⏸ Pausar";
  const card = document.querySelector(".pom-timer-card");
  if (card) card.classList.toggle("is-paused", _state.paused);
}

function updateCycleIndicator() {
  const el = document.getElementById("pom-cycle-info");
  if (!el) return;
  const k = Math.max(1, _state.config.cycles_per_long || 1);
  const cycleNow = (_state.pomodorosCompleted % k) + 1;
  el.innerHTML = `
    Ciclo <strong>${cycleNow}</strong> / ${k} até a pausa longa
    · <span class="muted">${_state.pomodorosCompleted} concluído${_state.pomodorosCompleted === 1 ? "" : "s"} hoje</span>
  `;
}

// ─────────────────────────────────────────────────────────────────────
//  BINDINGS
// ─────────────────────────────────────────────────────────────────────
function bindAll() {
  // Config inputs
  document.querySelectorAll(".pom-cfg-input").forEach(inp => {
    inp.addEventListener("input", () => onConfigInput(inp.dataset.field, inp.value));
  });

  // Tabs de modo (só quando NÃO rodando — disabled cobre o resto)
  document.querySelectorAll(".pom-tab").forEach(t => {
    t.addEventListener("click", () => {
      if (_state.running) return;
      _state.mode = t.dataset.mode;
      _state.remaining = modeTotalSecs();
      render();
    });
  });

  // Categoria chips
  document.querySelectorAll(".pom-cat-chip").forEach(c => {
    c.addEventListener("click", (e) => {
      // x interno: remove
      const x = e.target.closest(".pom-cat-x");
      if (x) {
        e.stopPropagation();
        removeCategory(x.dataset.cat);
        return;
      }
      setCategory(c.dataset.cat);
    });
  });
  document.getElementById("pom-cat-add")?.addEventListener("click", addCategory);

  // Botões
  document.getElementById("pom-start")?.addEventListener("click", startTimer);
  document.getElementById("pom-pause")?.addEventListener("click", pauseTimer);
  document.getElementById("pom-stop")?.addEventListener("click", stopTimer);
  document.getElementById("pom-reset")?.addEventListener("click", resetCycle);
}

// ─────────────────────────────────────────────────────────────────────
//  TROCA DE USUÁRIO
// ─────────────────────────────────────────────────────────────────────
async function loadUserData(userId) {
  _state.user = userId;
  const [cfg, sessions] = await Promise.all([
    loadPomodoroConfig(userId),
    getPomodoroSessions(userId),
  ]);
  _state.config = cfg;
  _state.sessions = sessions;
  // se a categoria atual sumiu, fallback pra primeira
  if (!cfg.categories.includes(_state.category)) {
    _state.category = cfg.categories[0] || "Trabalho";
  }
  // reset do timer ao trocar de usuário
  _state.mode = "foco";
  _state.remaining = cfg.focus_min * 60;
  _state.running = false;
  _state.paused = false;
  _state.pomodorosCompleted = 0;
  _state.startedAt = null;
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  releaseWakeLock();
  render();
}

function bindUserToggle() {
  document.querySelectorAll("#pom-user-seg .seg-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const user = btn.dataset.user;
      if (user === _state.user) return;
      if (_state.running) {
        if (!confirm("Trocar de usuário vai parar o timer atual. Continuar?")) return;
      }
      document.querySelectorAll("#pom-user-seg .seg-btn").forEach(b => b.classList.toggle("is-on", b === btn));
      await loadUserData(user);
    });
  });
}

// Aviso ao fechar com timer rodando
window.addEventListener("beforeunload", (e) => {
  if (_state.running) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ─────────────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({
    onAuthorized: async (user) => {
      renderAuthFooter(user);
      bindUserToggle();
      await loadUserData(_state.user);
      document.body.classList.remove("is-loading");
    }
  });
});
