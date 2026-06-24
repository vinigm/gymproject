// Página de Status (presença no escritório): seleciona QUEM está usando este
// tablet (Vini ou Vivi) e mostra um painel de FOCO em ciclos Pomodoro.
// Ao iniciar, roda 25 min de foco (OCUPADO, vermelho) → 5 min de pausa
// (Disponível, verde) → repete, registrando cada segmento concluído.
// Tudo é derivado do instante de início (`since`), então os dois tablets
// veem o mesmo. Sincroniza em tempo real + Wake Lock (manter tela ligada).

import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import { setPresence, subscribePresence } from "./presence-storage.js";

const USERS = {
  vinicius: { name: "Vini", cls: "vini", emoji: "💙" },
  victoria: { name: "Vivi", cls: "vic",  emoji: "💗" },
};
const ACTIVE_USER_KEY = "habitos-presence-active-user";

// Ciclo Pomodoro (segundos)
const FOCUS_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;
const CYCLE_SECS = FOCUS_SECS + BREAK_SECS;

const state = {
  user: "vinicius",
  ocupado: false,
  since: null, // epoch ms de quando iniciou o ciclo (base de todo o cálculo)
};
let unsub = null;
let timerHandle = null;

// ─── Wake Lock ────────────────────────────────────────────────────────
let wakeLock = null;
let wakeEnabled = true; // ligado por padrão — é um painel pra ficar exposto

async function requestWakeLock() {
  if (!wakeEnabled) return;
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    }
  } catch (e) { /* iOS pode recusar fora de gesto — re-tenta no próximo toque */ }
  updateWakeUI();
}
async function releaseWakeLock() {
  try { if (wakeLock) await wakeLock.release(); } catch (e) {}
  wakeLock = null;
  updateWakeUI();
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && wakeEnabled) requestWakeLock();
});
function wakeSupported() { return "wakeLock" in navigator; }

function updateWakeUI() {
  const btn = document.getElementById("wake-toggle");
  const status = document.getElementById("wake-status");
  if (!btn) return;
  btn.classList.toggle("is-on", wakeEnabled);
  btn.setAttribute("aria-pressed", String(wakeEnabled));
  if (!status) return;
  if (!wakeSupported()) status.textContent = "este navegador não permite manter a tela ligada";
  else if (!wakeEnabled) status.textContent = "a tela pode apagar normalmente";
  else if (wakeLock) status.textContent = "🔒 tela permanece ligada enquanto esta aba estiver aberta";
  else status.textContent = "tela será mantida ligada (toque na tela se não ativar)";
}

// ─── Seletor de usuário ───────────────────────────────────────────────
function loadActiveUser() {
  try {
    const u = localStorage.getItem(ACTIVE_USER_KEY);
    if (u && USERS[u]) state.user = u;
  } catch {}
}
function saveActiveUser(u) {
  try { localStorage.setItem(ACTIVE_USER_KEY, u); } catch {}
}

function selectUser(userId) {
  if (!USERS[userId]) return;
  state.user = userId;
  saveActiveUser(userId);
  document.querySelectorAll("#presence-user-seg .seg-btn").forEach((b) => {
    b.classList.toggle("is-on", b.dataset.user === userId);
  });
  // Reassina o status da pessoa selecionada
  if (unsub) { try { unsub(); } catch {} unsub = null; }
  state.ocupado = false;
  state.since = null;
  applyState();
  unsub = subscribePresence(userId, ({ ocupado, since }) => {
    state.ocupado = ocupado;
    state.since = since;
    applyState();
  });
}

// ─── Render ───────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("presence-content");
  if (!root) return;
  root.innerHTML = `
    <div class="stats-toggle-bar">
      <div class="seg stats-user-seg" id="presence-user-seg">
        <button data-user="vinicius" class="seg-btn">💙 Vini</button>
        <button data-user="victoria" class="seg-btn">💗 Vivi</button>
      </div>
    </div>

    <button class="presence-hero" id="presence-hero" aria-pressed="false">
      <span class="presence-hero-state"></span>
      <div class="presence-log" id="presence-log"></div>
      <div class="presence-now" id="presence-now"></div>
      <span class="presence-hero-hint"></span>
    </button>

    <p id="presence-error" class="presence-error" hidden></p>

    <div class="presence-screen-bar">
      <button id="fs-toggle" class="presence-fs-btn">⛶ Tela cheia</button>
      <button id="wake-toggle" class="presence-switch presence-switch--wake is-on" aria-pressed="true">
        <span class="psw-label">🔆 Manter a tela ligada</span>
        <span class="psw-track"><span class="psw-thumb"></span></span>
      </button>
      <p id="wake-status" class="muted"></p>
    </div>

    <button id="fs-exit" class="presence-fs-exit" aria-label="Sair da tela cheia">✕</button>`;

  // Seletor Vini/Vivi
  root.querySelectorAll("#presence-user-seg .seg-btn").forEach((btn) => {
    btn.dataset.userClick = "1";
    btn.addEventListener("click", () => selectUser(btn.dataset.user));
  });

  // Hero = botão grande que alterna Ocupado
  const hero = document.getElementById("presence-hero");
  hero.addEventListener("click", () => {
    const next = !state.ocupado;
    state.ocupado = next;                       // feedback otimista imediato
    state.since = next ? Date.now() : null;
    applyState();
    setPresence(state.user, next)
      .then(() => showError(null))
      .catch((e) => {
        console.warn("setPresence falhou:", e);
        showError("não consegui salvar o status — confira as regras do Firestore");
      });
  });

  // Toggle do Wake Lock
  const wakeBtn = document.getElementById("wake-toggle");
  wakeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    wakeEnabled = !wakeEnabled;
    if (wakeEnabled) requestWakeLock();
    else releaseWakeLock();
    updateWakeUI();
  });

  // Tela cheia (modo painel)
  document.getElementById("fs-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFullscreen();
  });
  document.getElementById("fs-exit").addEventListener("click", (e) => {
    e.stopPropagation();
    exitFullscreen();
  });

  updateWakeUI();
}

// ─── Tela cheia / modo painel ─────────────────────────────────────────
function isFullscreen() {
  return document.body.classList.contains("presence-fullscreen");
}
function enterFullscreen() {
  document.body.classList.add("presence-fullscreen");
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}
function exitFullscreen() {
  document.body.classList.remove("presence-fullscreen");
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
}
function toggleFullscreen() {
  if (isFullscreen()) exitFullscreen();
  else enterFullscreen();
}
// Mantém a classe em sincronia se o usuário sair pelo Esc / gesto do sistema
function onFsChange() {
  const real = document.fullscreenElement || document.webkitFullscreenElement;
  // Só remove a classe se de fato saímos do fullscreen real (em PWA/iOS pode
  // não haver fullscreen real e a gente segue no modo painel via CSS).
  if (!real && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
    document.body.classList.remove("presence-fullscreen");
  }
}
document.addEventListener("fullscreenchange", onFsChange);
document.addEventListener("webkitfullscreenchange", onFsChange);

function inSession() { return state.ocupado && !!state.since; }

function applyState() {
  const hero = document.getElementById("presence-hero");
  if (!hero) return;

  if (!inSession()) {
    // Ocioso — Disponível em verde, sem ciclo rodando
    stopTick();
    hero.classList.remove("is-ocupado");
    hero.classList.add("is-livre");
    hero.setAttribute("aria-pressed", "false");
    hero.querySelector(".presence-hero-state").textContent = "Disponível";
    const hint = hero.querySelector(".presence-hero-hint");
    hint.textContent = "toque para iniciar o foco";
    hint.style.display = "";
    document.getElementById("presence-log").innerHTML = "";
    document.getElementById("presence-now").textContent = "";
    document.body.classList.remove("presence-busy");
    return;
  }

  // Em sessão — garante o tick de 1s e desenha
  hero.querySelector(".presence-hero-hint").style.display = "none";
  if (!timerHandle) timerHandle = setInterval(tick, 1000);
  tick();
}

// Deriva fase, segmentos concluídos e cronômetro atual a partir do tempo decorrido.
function computeCycle(elapsedSec) {
  const full = Math.floor(elapsedSec / CYCLE_SECS); // ciclos foco+pausa completos
  const pos = elapsedSec % CYCLE_SECS;
  const done = [];
  for (let i = 0; i < full; i++) {
    done.push({ kind: "focus", secs: FOCUS_SECS });
    done.push({ kind: "break", secs: BREAK_SECS });
  }
  let phase, current;
  if (pos < FOCUS_SECS) {
    phase = "focus";
    current = pos;
  } else {
    done.push({ kind: "focus", secs: FOCUS_SECS }); // o foco deste ciclo já fechou
    phase = "break";
    current = pos - FOCUS_SECS;
  }
  return { done, phase, current };
}

function tick() {
  const hero = document.getElementById("presence-hero");
  if (!hero || !inSession()) { stopTick(); return; }

  const elapsed = Math.max(0, Math.floor((Date.now() - state.since) / 1000));
  const c = computeCycle(elapsed);
  const isFocus = c.phase === "focus";

  hero.classList.toggle("is-ocupado", isFocus);
  hero.classList.toggle("is-livre", !isFocus);
  hero.setAttribute("aria-pressed", "true");
  document.body.classList.toggle("presence-busy", isFocus);
  hero.querySelector(".presence-hero-state").textContent = isFocus ? "OCUPADO" : "Disponível";

  // Histórico dos segmentos já concluídos (🍅 foco 25:00 / ☕ pausa 5:00)
  document.getElementById("presence-log").innerHTML = c.done
    .map((seg) => `<div class="cyc-line">${seg.kind === "focus" ? "🍅" : "☕"} ${fmtClock(seg.secs)}</div>`)
    .join("");

  // Cronômetro corrente (grande), contando até o alvo da fase
  const icon = isFocus ? "🍅" : "☕";
  document.getElementById("presence-now").textContent = `${icon} ${fmtClock(c.current)}`;
}

function stopTick() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function showError(msg) {
  const el = document.getElementById("presence-error");
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; }
  else { el.textContent = ""; el.hidden = true; }
}

// ─── Boot ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({
    onAuthorized: (user) => {
      try {
        renderAuthFooter(user);
        loadActiveUser();
        render();
        selectUser(state.user); // marca o seg ativo + assina o status
        requestWakeLock();
      } catch (err) {
        console.error("Erro ao inicializar Status:", err);
        const root = document.getElementById("presence-content");
        if (root && !root.children.length) {
          root.innerHTML = `<section class="block"><div class="stat-card">
            <p class="muted">Erro ao carregar o painel. Verifique as regras do Firestore no console.</p>
          </div></section>`;
        }
      } finally {
        document.body.classList.remove("is-loading");
      }
    },
  });
});

window.addEventListener("pagehide", () => {
  if (unsub) { try { unsub(); } catch {} }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  releaseWakeLock();
});
