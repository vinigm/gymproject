// Página de Alongamento: sessões guiadas com timer interativo.
// 3 durações (5/10/15 min), 1 minuto por exercício, auto-avanço.

import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";

// ─────────────────────────────────────────────────────────────────────
//  CONFIGURAÇÃO DAS SESSÕES
// ---------------------------------------------------------------------
//  Lista de exercícios por duração. 1 minuto por exercício — então 5min
//  = 5 exercícios, 10min = 10, 15min = 15. Pra editar, é só mexer aqui.
// ─────────────────────────────────────────────────────────────────────
const SESSIONS = {
  5: {
    label: "5 min",
    tagline: "Sessão rápida",
    exercises: [
      "Alongamento das duas pernas juntas pra frente",
      "Alongamento de uma só perna",
      "Alongamento da outra perna",
      "Abertura de espacato",
      "Borboleta",
    ],
  },
  10: {
    label: "10 min",
    tagline: "Sessão completa",
    exercises: [],
  },
  15: {
    label: "15 min",
    tagline: "Sessão extensa",
    exercises: [],
  },
};

const SECONDS_PER_EXERCISE = 60;

// ─────────────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────────────
const state = {
  view: "selector",       // "selector" | "timer" | "done"
  sessionKey: null,       // 5 | 10 | 15
  exerciseIdx: 0,
  remaining: SECONDS_PER_EXERCISE,
  isPaused: false,
};

let tickHandle = null;
let audioCtx = null;
let wakeLock = null;

// ─────────────────────────────────────────────────────────────────────
//  ÁUDIO (beeps de transição)
// ---------------------------------------------------------------------
//  iOS exige interação do usuário pra criar AudioContext, então a
//  criação acontece no click do "Começar".
// ─────────────────────────────────────────────────────────────────────
function ensureAudioCtx() {
  if (audioCtx) return audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  } catch (e) {
    audioCtx = null;
  }
  return audioCtx;
}

function beep(freq = 880, durMs = 150, gain = 0.12) {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(ctx.destination);
    const t0 = ctx.currentTime;
    o.start(t0);
    // fade out leve pra não estourar
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000);
    o.stop(t0 + durMs / 1000 + 0.02);
  } catch (e) { /* ignora */ }
}

function beepTransition() {
  // dois beeps curtos pra mudança de exercício
  beep(660, 120);
  setTimeout(() => beep(880, 150), 160);
}

function beepFinal() {
  // três beeps mais longos pra fim da sessão
  beep(880, 200);
  setTimeout(() => beep(990, 200), 240);
  setTimeout(() => beep(1100, 400), 480);
}

// ─────────────────────────────────────────────────────────────────────
//  WAKE LOCK (manter tela acesa durante a sessão)
// ─────────────────────────────────────────────────────────────────────
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (e) { /* ignora */ }
}

async function releaseWakeLock() {
  try {
    if (wakeLock) await wakeLock.release();
  } catch (e) { /* ignora */ }
  wakeLock = null;
}

// Se o user volta pra aba e o wake lock caiu, reabilita
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.view === "timer") {
    requestWakeLock();
  }
});

// ─────────────────────────────────────────────────────────────────────
//  TIMER LOOP
// ─────────────────────────────────────────────────────────────────────
function startTick() {
  stopTick();
  tickHandle = setInterval(() => {
    if (state.isPaused) return;
    state.remaining -= 1;
    if (state.remaining <= 0) {
      advanceExercise();
    } else {
      updateCountdown();
    }
  }, 1000);
}

function stopTick() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function advanceExercise() {
  const sess = SESSIONS[state.sessionKey];
  const nextIdx = state.exerciseIdx + 1;
  if (nextIdx >= sess.exercises.length) {
    finishSession();
    return;
  }
  state.exerciseIdx = nextIdx;
  state.remaining = SECONDS_PER_EXERCISE;
  beepTransition();
  renderTimer();
}

function finishSession() {
  stopTick();
  releaseWakeLock();
  beepFinal();
  state.view = "done";
  render();
}

// ─────────────────────────────────────────────────────────────────────
//  CONTROLES
// ─────────────────────────────────────────────────────────────────────
function startSession(key) {
  state.sessionKey = key;
  state.exerciseIdx = 0;
  state.remaining = SECONDS_PER_EXERCISE;
  state.isPaused = false;
  state.view = "timer";
  ensureAudioCtx();
  requestWakeLock();
  render();
  startTick();
}

function togglePause() {
  state.isPaused = !state.isPaused;
  updatePauseBtn();
}

function stopSession() {
  if (!confirm("Encerrar a sessão de alongamento?")) return;
  stopTick();
  releaseWakeLock();
  state.view = "selector";
  state.sessionKey = null;
  state.exerciseIdx = 0;
  state.isPaused = false;
  render();
}

function skipExercise() {
  // pula instantaneamente pro próximo (útil pra debug ou quando travou)
  state.remaining = 0;
  advanceExercise();
}

// ─────────────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────────────
function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.max(0, secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function selectorViewHtml() {
  const cards = Object.entries(SESSIONS).map(([key, sess]) => {
    const n = sess.exercises.length;
    const ready = n > 0;
    return `
      <button class="along-session-card${ready ? "" : " is-disabled"}" data-key="${key}" ${ready ? "" : "disabled"}>
        <div class="along-session-label">${sess.label}</div>
        <div class="along-session-tag">${sess.tagline}</div>
        <div class="along-session-count">${n} ${n === 1 ? "exercício" : "exercícios"}</div>
        ${ready ? '<div class="along-session-go">▶ Começar</div>' : '<div class="along-session-tbd muted">em breve</div>'}
      </button>
    `;
  }).join("");
  return `
    <section class="block">
      <div class="block-head"><h2>🧘 Escolha a sessão</h2></div>
      <p class="muted" style="margin:0 0 12px;font-size:13px">
        Cada exercício dura 1 minuto. O timer avança automático com um beep entre exercícios.
      </p>
      <div class="along-grid">${cards}</div>
    </section>
  `;
}

function timerViewHtml() {
  const sess = SESSIONS[state.sessionKey];
  const total = sess.exercises.length;
  const idx = state.exerciseIdx;
  const current = sess.exercises[idx];
  const next = sess.exercises[idx + 1];
  const progressPct = ((idx + (1 - state.remaining / SECONDS_PER_EXERCISE)) / total) * 100;

  return `
    <section class="along-timer">
      <div class="along-timer-head">
        <div class="along-timer-progress-text">
          Exercício <strong>${idx + 1}</strong> / ${total}
        </div>
        <button class="ghost-btn along-stop-btn" id="along-stop">✕ Sair</button>
      </div>

      <div class="along-progress-bar">
        <div class="along-progress-fill" style="width:${progressPct}%"></div>
      </div>

      <div class="along-current">
        <div class="along-current-label muted">Exercício atual</div>
        <div class="along-current-name">${current}</div>
      </div>

      <div class="along-countdown${state.remaining <= 10 ? " is-final" : ""}${state.isPaused ? " is-paused" : ""}">
        ${fmtTime(state.remaining)}
      </div>

      <div class="along-controls">
        <button class="along-ctrl-btn" id="along-pause">${state.isPaused ? "▶ Continuar" : "⏸ Pausar"}</button>
        <button class="along-ctrl-btn along-ctrl-btn--ghost" id="along-skip">⏭ Pular</button>
      </div>

      <div class="along-next">
        ${next
          ? `<span class="muted">Próximo:</span> <span class="along-next-name">${next}</span>`
          : `<span class="muted">Último exercício 🎯</span>`}
      </div>
    </section>
  `;
}

function doneViewHtml() {
  const sess = SESSIONS[state.sessionKey];
  return `
    <section class="block">
      <div class="along-done">
        <div class="along-done-emoji">🎉</div>
        <h2 class="along-done-title">Sessão concluída!</h2>
        <p class="muted">Você completou os ${sess.exercises.length} exercícios de ${sess.label}.</p>
        <button class="along-ctrl-btn" id="along-restart">Fazer outra sessão</button>
      </div>
    </section>
  `;
}

function render() {
  const root = document.getElementById("along-content");
  if (!root) return;
  if (state.view === "selector") {
    root.innerHTML = selectorViewHtml();
    document.body.classList.remove("along-timer-mode");
    bindSelector();
  } else if (state.view === "timer") {
    root.innerHTML = timerViewHtml();
    document.body.classList.add("along-timer-mode");
    bindTimer();
  } else {
    root.innerHTML = doneViewHtml();
    document.body.classList.remove("along-timer-mode");
    bindDone();
  }
}

// re-render do conteúdo do timer sem rebuild completo (suave)
function renderTimer() {
  if (state.view !== "timer") return;
  const root = document.getElementById("along-content");
  if (!root) return;
  root.innerHTML = timerViewHtml();
  bindTimer();
}

function updateCountdown() {
  const el = document.querySelector(".along-countdown");
  if (!el) return;
  el.textContent = fmtTime(state.remaining);
  if (state.remaining <= 10) el.classList.add("is-final");
  else el.classList.remove("is-final");

  // atualiza só a barra de progresso suavemente
  const sess = SESSIONS[state.sessionKey];
  const total = sess.exercises.length;
  const idx = state.exerciseIdx;
  const progressPct = ((idx + (1 - state.remaining / SECONDS_PER_EXERCISE)) / total) * 100;
  const fill = document.querySelector(".along-progress-fill");
  if (fill) fill.style.width = progressPct + "%";
}

function updatePauseBtn() {
  const btn = document.getElementById("along-pause");
  if (btn) btn.textContent = state.isPaused ? "▶ Continuar" : "⏸ Pausar";
  const cd = document.querySelector(".along-countdown");
  if (cd) cd.classList.toggle("is-paused", state.isPaused);
}

function bindSelector() {
  document.querySelectorAll(".along-session-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = Number(btn.dataset.key);
      if (SESSIONS[key]?.exercises.length > 0) startSession(key);
    });
  });
}

function bindTimer() {
  document.getElementById("along-pause")?.addEventListener("click", togglePause);
  document.getElementById("along-stop")?.addEventListener("click", stopSession);
  document.getElementById("along-skip")?.addEventListener("click", skipExercise);
}

function bindDone() {
  document.getElementById("along-restart")?.addEventListener("click", () => {
    state.view = "selector";
    state.sessionKey = null;
    state.exerciseIdx = 0;
    state.isPaused = false;
    render();
  });
}

// Aviso ao tentar fechar a aba/navegar embora durante o timer
window.addEventListener("beforeunload", (e) => {
  if (state.view === "timer") {
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
    onAuthorized: (user) => {
      renderAuthFooter(user);
      render();
      document.body.classList.remove("is-loading");
    }
  });
});
