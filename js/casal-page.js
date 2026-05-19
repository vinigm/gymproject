import { todayISO, APP_START_DATE, USERS } from "./app.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { getRange, addTransaction, getTransactions, deleteTransaction } from "./storage.js";
import { REWARDS } from "./points-config.js";
import {
  totalEarnedByUser, pointsInPeriod, fmtPts, loadAndApplyConfig,
} from "./points-utils.js";
import { mountNavMenu } from "./nav-menu.js";

const SCOPE = "shared";
const NAMES = { vinicius: "Vinicius", victoria: "Victoria" };
const AVATAR_CLASS = { vinicius: "avatar--vini", victoria: "avatar--vic" };

let _state = {
  daysByUser: { vinicius: [], victoria: [] },
  transactions: [],
  balance: 0,
};

function totalSpent(txs) {
  return txs.reduce((s, t) => s + (Number(t.price) || 0), 0);
}

function fmtTxDate(t) {
  if (!t) return "—";
  const d = t?.toMillis ? new Date(t.toMillis()) : new Date(t);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function renderWallet() {
  const el = document.getElementById("casal-wallet");
  if (!el) return;
  const earnedVini = totalEarnedByUser(_state.daysByUser.vinicius);
  const earnedVic  = totalEarnedByUser(_state.daysByUser.victoria);
  const earned = earnedVini + earnedVic;
  const spent = totalSpent(_state.transactions);
  const balance = earned - spent;
  _state.balance = balance;

  const ptsWeek  = USERS.reduce((s, u) => s + pointsInPeriod(_state.daysByUser[u], "weekly"), 0);
  const ptsMonth = USERS.reduce((s, u) => s + pointsInPeriod(_state.daysByUser[u], "monthly"), 0);

  const klass = balance < 0 ? "is-bad" : (balance > 0 ? "is-good" : "");
  el.innerHTML = `
    <div class="casal-balance-card">
      <div class="casal-balance-header">
        <div class="casal-avatars">
          <span class="avatar avatar--vini avatar--md">V</span>
          <span class="avatar avatar--vic avatar--md">V</span>
        </div>
        <span class="casal-balance-name">Carteira do casal</span>
      </div>
      <div class="casal-balance-value ${klass}">${balance} <span class="casal-balance-unit">pts</span></div>
      <div class="casal-balance-meta">
        <span>Vini <b>${earnedVini}</b></span>
        <span>·</span>
        <span>Vic <b>${earnedVic}</b></span>
        <span>·</span>
        <span>gasto <b>${spent}</b></span>
      </div>
      <div class="casal-balance-extra">
        <span>esta semana <b>${fmtPts(ptsWeek)}</b></span>
        <span>·</span>
        <span>este mês <b>${fmtPts(ptsMonth)}</b></span>
      </div>
    </div>
  `;
}

function renderStore() {
  const el = document.getElementById("casal-store");
  if (!el) return;
  if (!REWARDS || REWARDS.length === 0) {
    el.innerHTML = `<p class="muted" style="padding:8px">nenhum prêmio configurado. abra a <a href="./config.html">config</a>.</p>`;
    return;
  }
  el.innerHTML = REWARDS.map((r, idx) => {
    const canAfford = _state.balance >= r.price;
    return `
      <div class="reward-card vic-reward-card${canAfford ? " is-buyable" : ""}">
        <div class="reward-header">
          <span class="reward-icon">${r.icon || "🎁"}</span>
          <div class="reward-name-wrap">
            <div class="reward-name">${r.name}</div>
            ${r.description ? `<div class="reward-desc">${r.description}</div>` : ""}
          </div>
          <span class="reward-period">${r.price} pts</span>
        </div>
        <div class="vic-buy-row">
          <button class="buy-btn ${canAfford ? "" : "is-disabled"}" data-idx="${idx}" ${canAfford ? "" : "disabled"}>
            ${canAfford ? "Comprar" : `faltam ${r.price - _state.balance}`}
          </button>
        </div>
      </div>
    `;
  }).join("");

  el.querySelectorAll(".buy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.idx);
      const reward = REWARDS[idx];
      if (!reward) return;
      const ok = confirm(`Comprar "${reward.name}" por ${reward.price} pts?\n\nVai descontar do saldo do casal.\n(Não afeta o saldo pessoal da Vic.)`);
      if (!ok) return;
      btn.disabled = true;
      btn.textContent = "comprando…";
      try {
        await addTransaction({
          scope: SCOPE,
          item: reward.name,
          price: reward.price,
          note: reward.description || null,
        });
        await refreshAll();
      } catch (err) {
        console.error(err);
        alert(`Erro ao comprar: ${err.message || err.code}`);
        btn.disabled = false;
        btn.textContent = "Comprar";
      }
    });
  });
}

function renderHistory() {
  const el = document.getElementById("casal-history");
  if (!el) return;
  if (_state.transactions.length === 0) {
    el.innerHTML = `<p class="muted" style="padding:8px">nenhuma compra ainda</p>`;
    return;
  }
  el.innerHTML = `
    <ul class="vic-history-list">
      ${_state.transactions.map(t => `
        <li class="vic-history-item">
          <span class="vic-h-item">${t.item || "—"}</span>
          <span class="vic-h-date">${fmtTxDate(t.created_at)}</span>
          <span class="vic-h-price">-${t.price} pts</span>
          <button class="link-btn vic-h-undo" data-id="${t.id}" title="Desfazer compra">desfazer</button>
        </li>
      `).join("")}
    </ul>
  `;

  el.querySelectorAll(".vic-h-undo").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!id) return;
      const ok = confirm("Desfazer essa compra? Os pontos voltam pro saldo do casal.");
      if (!ok) return;
      try {
        await deleteTransaction(id);
        await refreshAll();
      } catch (err) {
        console.error(err);
        alert(`Erro ao desfazer: ${err.message || err.code}`);
      }
    });
  });
}

async function refreshAll() {
  const [viniDays, vicDays, txs] = await Promise.all([
    getRange("vinicius", APP_START_DATE, todayISO()),
    getRange("victoria", APP_START_DATE, todayISO()),
    getTransactions({ scope: SCOPE }),
  ]);
  _state.daysByUser = { vinicius: viniDays, victoria: vicDays };
  _state.transactions = txs;
  renderWallet();
  renderStore();
  renderHistory();
}

async function initCasalPage(user) {
  renderAuthFooter(user);
  try {
    await loadAndApplyConfig();
    await refreshAll();
  } catch (err) {
    console.error(err);
    document.getElementById("casal-wallet").innerHTML =
      `<p class="muted" style="padding:8px">erro ao carregar: ${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({ onAuthorized: (user) => initCasalPage(user) });
});
