// Página de Status (presença no escritório): seleciona QUEM está usando este
// tablet (Vini ou Vivi) e mostra um único botão grande de "Ocupado".
// Ligado = OCUPADO em vermelhão; desligado = Disponível em verde.
// Sincroniza em tempo real entre os tablets. Inclui Wake Lock (manter tela ligada).

import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import { setPresence, subscribePresence } from "./presence-storage.js";

const USERS = {
  vinicius: { name: "Vini", cls: "vini", emoji: "💙" },
  victoria: { name: "Vivi", cls: "vic",  emoji: "💗" },
};
const ACTIVE_USER_KEY = "habitos-presence-active-user";

const state = {
  user: "vinicius",
  ocupado: false,
};
let unsub = null;

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
  applyState();
  unsub = subscribePresence(userId, (ocupado) => {
    state.ocupado = ocupado;
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
      <span class="presence-hero-who"></span>
      <span class="presence-hero-state"></span>
      <span class="presence-hero-hint"></span>
    </button>

    <div class="presence-screen-bar">
      <button id="wake-toggle" class="presence-switch presence-switch--wake is-on" aria-pressed="true">
        <span class="psw-label">🔆 Manter a tela ligada</span>
        <span class="psw-track"><span class="psw-thumb"></span></span>
      </button>
      <p id="wake-status" class="muted"></p>
    </div>`;

  // Seletor Vini/Vivi
  root.querySelectorAll("#presence-user-seg .seg-btn").forEach((btn) => {
    btn.dataset.userClick = "1";
    btn.addEventListener("click", () => selectUser(btn.dataset.user));
  });

  // Hero = botão grande que alterna Ocupado
  const hero = document.getElementById("presence-hero");
  hero.addEventListener("click", () => {
    const next = !state.ocupado;
    state.ocupado = next;          // feedback otimista imediato
    applyState();
    setPresence(state.user, next).catch((e) => console.warn("setPresence falhou:", e));
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

  updateWakeUI();
}

function applyState() {
  const hero = document.getElementById("presence-hero");
  if (!hero) return;
  const u = USERS[state.user];
  const ocupado = state.ocupado;

  hero.classList.toggle("is-ocupado", ocupado);
  hero.classList.toggle("is-livre", !ocupado);
  hero.setAttribute("aria-pressed", String(ocupado));

  hero.querySelector(".presence-hero-who").textContent = `${u.emoji} ${u.name}`;
  hero.querySelector(".presence-hero-state").textContent = ocupado ? "OCUPADO" : "Disponível";
  hero.querySelector(".presence-hero-hint").textContent = ocupado
    ? "em foco — toque para liberar"
    : "toque para marcar ocupado";

  document.body.classList.toggle("presence-busy", ocupado);
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
  releaseWakeLock();
});
