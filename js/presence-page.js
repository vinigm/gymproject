// Página de Status (presença no escritório): cada pessoa tem os switches
// "Ocupado" e "Pode falar". O painel sincroniza em tempo real entre os tablets.
// Inclui Wake Lock (manter a tela ligada) com toggle visível.

import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import { setPresence, subscribePresence } from "./presence-storage.js";

const USERS = [
  { id: "vinicius", name: "Vini", cls: "vini", emoji: "💙" },
  { id: "victoria", name: "Vivi", cls: "vic",  emoji: "💗" },
];

const STATUS_META = {
  livre:      { icon: "⚪", label: "Disponível",  sub: "sem sinal aceso",         cardCls: "" },
  ocupado:    { icon: "🔴", label: "Ocupado",     sub: "em foco — não interromper", cardCls: "is-ocupado" },
  pode_falar: { icon: "🟢", label: "Pode falar",  sub: "tô de boa, manda ver",     cardCls: "is-pode-falar" },
};

const current = { vinicius: "livre", victoria: "livre" };
const unsubs = [];

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
  if (!wakeSupported()) {
    status.textContent = "este navegador não permite manter a tela ligada";
  } else if (!wakeEnabled) {
    status.textContent = "a tela pode apagar normalmente";
  } else if (wakeLock) {
    status.textContent = "🔒 tela permanece ligada enquanto esta aba estiver aberta";
  } else {
    status.textContent = "tela será mantida ligada (toque na tela se não ativar)";
  }
}

// ─── Render ───────────────────────────────────────────────────────────
function cardHTML(u) {
  return `
  <article class="presence-card" data-user="${u.id}" id="pcard-${u.id}">
    <header class="presence-head">
      <span class="avatar avatar--${u.cls} avatar--md">${u.name[0]}</span>
      <span class="presence-name">${u.emoji} ${u.name}</span>
    </header>

    <div class="presence-banner">
      <span class="presence-banner-icon"></span>
      <span class="presence-banner-label"></span>
      <span class="presence-banner-sub"></span>
    </div>

    <div class="presence-switches">
      <button class="presence-switch presence-switch--busy" data-user="${u.id}" data-status="ocupado" aria-pressed="false">
        <span class="psw-label">Ocupado</span>
        <span class="psw-track"><span class="psw-thumb"></span></span>
      </button>
      <button class="presence-switch presence-switch--talk" data-user="${u.id}" data-status="pode_falar" aria-pressed="false">
        <span class="psw-label">Pode falar</span>
        <span class="psw-track"><span class="psw-thumb"></span></span>
      </button>
    </div>
  </article>`;
}

function render() {
  const root = document.getElementById("presence-content");
  if (!root) return;
  root.innerHTML = `
    <section class="block">
      <div class="two-col presence-grid">
        ${USERS.map(cardHTML).join("")}
      </div>
    </section>

    <section class="block presence-screen-bar">
      <button id="wake-toggle" class="presence-switch presence-switch--wake is-on" aria-pressed="true">
        <span class="psw-label">🔆 Manter a tela ligada</span>
        <span class="psw-track"><span class="psw-thumb"></span></span>
      </button>
      <p id="wake-status" class="muted"></p>
    </section>`;

  // Switches de status (mutuamente exclusivos: tocar no ativo volta pra "livre")
  root.querySelectorAll(".presence-switch[data-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.dataset.user;
      const status = btn.dataset.status;
      const next = current[userId] === status ? "livre" : status;
      applyState(userId, next);             // feedback otimista imediato
      setPresence(userId, next).catch((e) => console.warn("setPresence falhou:", e));
    });
  });

  // Toggle do Wake Lock
  const wakeBtn = document.getElementById("wake-toggle");
  if (wakeBtn) {
    wakeBtn.addEventListener("click", () => {
      wakeEnabled = !wakeEnabled;
      if (wakeEnabled) requestWakeLock();
      else releaseWakeLock();
      updateWakeUI();
    });
  }

  USERS.forEach((u) => applyState(u.id, current[u.id]));
  updateWakeUI();
}

function applyState(userId, status) {
  current[userId] = status;
  const meta = STATUS_META[status] || STATUS_META.livre;
  const card = document.getElementById(`pcard-${userId}`);
  if (!card) return;

  card.classList.remove("is-ocupado", "is-pode-falar");
  if (meta.cardCls) card.classList.add(meta.cardCls);

  card.querySelector(".presence-banner-icon").textContent = meta.icon;
  card.querySelector(".presence-banner-label").textContent = meta.label;
  card.querySelector(".presence-banner-sub").textContent = meta.sub;

  card.querySelectorAll(".presence-switch[data-status]").forEach((btn) => {
    const on = btn.dataset.status === status;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({
    onAuthorized: (user) => {
      try {
        renderAuthFooter(user);
        render();
        // Assina o status das duas pessoas pra refletir em tempo real
        USERS.forEach((u) => {
          unsubs.push(subscribePresence(u.id, (status) => applyState(u.id, status)));
        });
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
  unsubs.forEach((fn) => { try { fn && fn(); } catch (e) {} });
  releaseWakeLock();
});
