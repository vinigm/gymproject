// Página de Alongamento: sessões guiadas com timer interativo.
// 3 durações (5/10/15 min), 1 minuto por exercício, auto-avanço.

import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import { getDay, saveDay } from "./storage.js";
import { saveStretchSession, getStretchSessions } from "./stretch-storage.js";

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
  user: "vinicius",       // "vinicius" | "victoria" — quem tá fazendo
  sessionKey: null,       // 5 | 10 | 15
  exerciseIdx: 0,
  remaining: SECONDS_PER_EXERCISE,
  isPaused: false,
  sessions: [],           // histórico do usuário atual (timestamp + duração)
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

async function finishSession() {
  stopTick();
  releaseWakeLock();
  beepFinal();
  // Auto-salva: 1) histórico com timestamp em stretch_sessions
  //             2) marca o dia no day-record (pra valer pontos no engine)
  const sessionKey = state.sessionKey;
  const userId = state.user;
  state.view = "done";
  render();
  try {
    const completedAt = new Date().toISOString();
    await saveStretchSession({ userId, duration_min: sessionKey, completedAt });
    await markDayWithStretch(userId, sessionKey, completedAt.slice(0, 10));
    // recarrega histórico em background pra calendário/stats refletirem
    state.sessions = await getStretchSessions(userId);
    if (state.view === "done") render(); // só re-renderiza se ainda tá na done view
  } catch (err) {
    console.error("Falha ao salvar sessão de alongamento:", err);
  }
}

// Marca o dia (today por padrão) do usuário com "alongamento" no array
// de exercises + stretch_min, preservando todos os outros campos.
async function markDayWithStretch(userId, durationMin, date) {
  try {
    const day = await getDay(userId, date);
    const exercises = Array.isArray(day.exercises) ? [...day.exercises] : [];
    if (!exercises.includes("alongamento")) exercises.push("alongamento");
    const updated = {
      ...day,
      exercises,
      stretch_min: Number(durationMin),
    };
    await saveDay(userId, date, updated);
  } catch (err) {
    console.error("Falha ao atualizar day-record:", err);
  }
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

function userToggleHtml() {
  return `
    <div class="along-user-toggle">
      <button class="along-user-card${state.user === "vinicius" ? " is-on" : ""}" data-user="vinicius">
        <span class="along-user-avatar avatar avatar--vini">V</span>
        <span class="along-user-name">Vini</span>
      </button>
      <button class="along-user-card${state.user === "victoria" ? " is-on" : ""}" data-user="victoria">
        <span class="along-user-avatar avatar avatar--vic">V</span>
        <span class="along-user-name">Vivi</span>
      </button>
    </div>
  `;
}

function pad2(n) { return String(n).padStart(2, "0"); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function weekStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtDurationMin(min) {
  if (!min) return "0min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${pad2(m)}`;
}
function fmtTimeOfDay(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  } catch { return ""; }
}
function fmtDateBR(iso) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return iso; }
}

function statsForRange(sessions, minDate) {
  const out = { totalMin: 0, count: 0 };
  for (const s of sessions) {
    if (s.date && s.date < minDate) continue;
    out.totalMin += Number(s.duration_min) || 0;
    out.count += 1;
  }
  return out;
}

function statsCardHtml() {
  const today = todayISO();
  const weekStart = weekStartISO();
  const today_ = statsForRange(state.sessions, today);
  const week_  = statsForRange(state.sessions, weekStart);
  const total_ = statsForRange(state.sessions, "0000-00-00");
  const avg = total_.count > 0 ? total_.totalMin / total_.count : 0;

  const panel = (title, data) => `
    <div class="along-stats-panel">
      <h3 class="stats-subhead">${title}</h3>
      <div class="kpi-grid" style="grid-template-columns: 1fr 1fr">
        <div class="kpi"><div class="kpi-value">${fmtDurationMin(data.totalMin)}</div><div class="kpi-label">tempo</div></div>
        <div class="kpi"><div class="kpi-value">${data.count}</div><div class="kpi-label">${data.count === 1 ? "sessão" : "sessões"}</div></div>
      </div>
    </div>
  `;

  return `
    <section class="block">
      <div class="block-head"><h2>📊 Tempo alongado</h2></div>
      <div class="stat-card along-stats">
        ${panel("Hoje", today_)}
        ${panel("Esta semana", week_)}
        ${panel("Total", total_)}
        ${total_.count > 0 ? `
          <p class="muted" style="text-align:center;margin:4px 0 0;font-size:12px">
            Média por sessão: <strong style="color:var(--text)">${fmtDurationMin(Math.round(avg))}</strong>
          </p>` : ""}
      </div>
    </section>
  `;
}

function calendarCardHtml() {
  // Agrupa sessões por dia → total de minutos
  const byDate = new Map();
  for (const s of state.sessions) {
    if (!s.date) continue;
    byDate.set(s.date, (byDate.get(s.date) || 0) + (Number(s.duration_min) || 0));
  }
  const t = new Date();
  const year = t.getFullYear();
  const month = t.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${year}-${pad2(month + 1)}-${pad2(t.getDate())}`;

  const heads = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
    .map(d => `<div class="along-cal-head">${d}</div>`).join("");
  let cells = "";
  for (let i = 0; i < firstDow; i++) cells += `<div class="along-cal-cell is-empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const mins = byDate.get(dateStr) || 0;
    const isToday = dateStr === todayStr;
    const klass = `along-cal-cell${mins > 0 ? " has-stretch" : ""}${isToday ? " is-today" : ""}`;
    cells += `
      <div class="${klass}">
        <span class="along-cal-day">${day}</span>
        ${mins > 0 ? `<span class="along-cal-min">${mins}min</span>` : ""}
      </div>
    `;
  }
  const monthLabel = new Date(year, month, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return `
    <section class="block">
      <div class="block-head"><h2>📅 Calendário do mês</h2></div>
      <div class="stat-card">
        <p class="muted" style="text-align:center;margin:0 0 10px;font-size:12px;text-transform:capitalize">${monthLabel}</p>
        <div class="along-cal-grid">${heads}${cells}</div>
      </div>
    </section>
  `;
}

function historyCardHtml() {
  const recent = state.sessions.slice(0, 12);
  if (recent.length === 0) {
    return `
      <section class="block">
        <div class="block-head"><h2>🕘 Histórico</h2></div>
        <div class="stat-card">
          <p class="muted" style="font-size:13px;margin:0">Nenhuma sessão registrada ainda. Comece uma sessão pra aparecer aqui!</p>
        </div>
      </section>
    `;
  }
  const rows = recent.map(s => `
    <div class="along-hist-row">
      <div class="along-hist-date">${fmtDateBR(s.date || (s.completedAt || "").slice(0, 10))}</div>
      <div class="along-hist-time">${fmtTimeOfDay(s.completedAt)}</div>
      <div class="along-hist-dur">${s.duration_min}min</div>
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
    ${userToggleHtml()}
    <section class="block">
      <div class="block-head"><h2>🧘 Escolha a sessão</h2></div>
      <p class="muted" style="margin:0 0 12px;font-size:13px">
        Cada exercício dura 1 minuto. O timer avança automático com um beep entre exercícios.
        A sessão fica salva no histórico de <strong style="color:var(--text)">${state.user === "vinicius" ? "Vini" : "Vivi"}</strong> quando você concluir.
      </p>
      <div class="along-grid">${cards}</div>
    </section>
    ${statsCardHtml()}
    ${calendarCardHtml()}
    ${historyCardHtml()}
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
  // Toggle Vini/Vivi
  document.querySelectorAll(".along-user-card").forEach(btn => {
    btn.addEventListener("click", async () => {
      const newUser = btn.dataset.user;
      if (newUser === state.user) return;
      state.user = newUser;
      state.sessions = await getStretchSessions(newUser);
      render();
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
    onAuthorized: async (user) => {
      renderAuthFooter(user);
      try {
        state.sessions = await getStretchSessions(state.user);
      } catch (e) {
        console.warn("Falha ao carregar sessões:", e);
      }
      render();
      document.body.classList.remove("is-loading");
    }
  });
});
