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
    exercises: [
      "Alongamento das duas pernas juntas pra frente",
      "Alongamento de uma só perna",
      "Alongamento da outra perna",
      "Abertura de espacato",
      "Borboleta",
      "Posição do agradecimento",
      "Posição da cobra",
      "Alongamento do ombro",
      "Alongamento do outro ombro",
      "Alongamento das duas pernas (de novo)",
    ],
  },
  15: {
    label: "15 min",
    tagline: "Sessão extensa",
    exercises: [
      "Alongamento das duas pernas juntas pra frente",
      "Alongamento de uma só perna",
      "Alongamento da outra perna",
      "Abertura de espacato",
      "Borboleta",
      "Alongamento das duas pernas (de novo)",
      "Posição da cobra",
      "Posição do agradecimento",
      "Alongamento das duas pernas (de novo)",
      "Alongamento do ombro",
      "Alongamento do outro ombro",
      "Abertura de espacato (de novo)",
      "Alongamento das duas pernas (de novo)",
      "Borboleta (de novo)",
      "Posição da cobra (de novo)",
    ],
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
  if (!audioCtx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    } catch (e) {
      audioCtx = null;
    }
  }
  // iOS frequentemente cria suspenso — precisa resumir após user gesture
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
    // attack rápido + decay exponencial (evita click do início)
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    o.start(t0);
    o.stop(t0 + durMs / 1000 + 0.02);
  } catch (e) { /* ignora */ }
}

function beepTick() {
  // tick curto e seco pros 5s finais
  beep(880, 80, 0.22);
}

function beepTransition() {
  // dois beeps mais altos = "mudou o exercício"
  beep(660, 120);
  setTimeout(() => beep(990, 180, 0.22), 160);
}

function beepFinal() {
  // três beeps crescentes = fim da sessão
  beep(880, 220);
  setTimeout(() => beep(990, 220), 260);
  setTimeout(() => beep(1175, 450, 0.24), 520);
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
    // beep nos últimos 5 segundos (5, 4, 3, 2, 1)
    if (state.remaining > 0 && state.remaining <= 5) {
      beepTick();
    }
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
  const elapsed = SECONDS_PER_EXERCISE - state.remaining;
  const currentPct = (elapsed / SECONDS_PER_EXERCISE) * 100;
  const isFinal = state.remaining <= 5;

  const cards = sess.exercises.map((name, i) => {
    let klass = "along-card";
    let pct = 0;
    let timeStr = "";
    let badge = String(i + 1);
    if (i < idx) {
      klass += " is-done";
      pct = 100;
      badge = "✓";
    } else if (i === idx) {
      klass += " is-current";
      if (isFinal) klass += " is-final";
      if (state.isPaused) klass += " is-paused";
      pct = currentPct;
      timeStr = fmtTime(state.remaining);
    } else {
      klass += " is-future";
    }
    return `
      <div class="${klass}" data-idx="${i}">
        <div class="along-card-progress" style="width:${pct}%"></div>
        <div class="along-card-num">${badge}</div>
        <div class="along-card-name">${name}</div>
        ${i === idx ? `<div class="along-card-time">${timeStr}</div>` : ""}
      </div>
    `;
  }).join("");

  return `
    <section class="along-timer">
      <div class="along-timer-head">
        <div class="along-timer-progress-text">
          Exercício <strong>${idx + 1}</strong> / ${total}
        </div>
        <button class="ghost-btn along-stop-btn" id="along-stop">✕ Sair</button>
      </div>

      <div class="along-list">${cards}</div>

      <div class="along-controls">
        <button class="along-ctrl-btn" id="along-pause">${state.isPaused ? "▶ Continuar" : "⏸ Pausar"}</button>
        <button class="along-ctrl-btn along-ctrl-btn--ghost" id="along-skip">⏭ Pular</button>
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
  scrollCurrentIntoView();
}

function updateCountdown() {
  const card = document.querySelector(".along-card.is-current");
  if (!card) return;
  const fill = card.querySelector(".along-card-progress");
  const time = card.querySelector(".along-card-time");
  const elapsed = SECONDS_PER_EXERCISE - state.remaining;
  const pct = (elapsed / SECONDS_PER_EXERCISE) * 100;
  if (fill) fill.style.width = pct + "%";
  if (time) time.textContent = fmtTime(state.remaining);
  card.classList.toggle("is-final", state.remaining <= 5);
}

function updatePauseBtn() {
  const btn = document.getElementById("along-pause");
  if (btn) btn.textContent = state.isPaused ? "▶ Continuar" : "⏸ Pausar";
  const card = document.querySelector(".along-card.is-current");
  if (card) card.classList.toggle("is-paused", state.isPaused);
}

function scrollCurrentIntoView() {
  const card = document.querySelector(".along-card.is-current");
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
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
