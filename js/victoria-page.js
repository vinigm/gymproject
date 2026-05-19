import { todayISO, APP_START_DATE } from "./app.js";
import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";
import { getRange, addTransaction, getTransactions, deleteTransaction } from "./storage.js";
import { REWARDS_VICTORIA } from "./points-config.js";
import {
  totalEarnedByUser, pointsInPeriod, fmtPts, fmtDayShort,
  loadAndApplyConfig,
} from "./points-utils.js";

const SCOPE = "personal-victoria";

let _state = {
  days: [],
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
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function renderWallet() {
  const el = document.getElementById("vic-wallet");
  if (!el) return;
  const earned = totalEarnedByUser(_state.days);
  const spent = totalSpent(_state.transactions);
  const balance = earned - spent;
  _state.balance = balance;

  const ptsWeek  = pointsInPeriod(_state.days, "weekly");
  const ptsMonth = pointsInPeriod(_state.days, "monthly");

  const klass = balance < 0 ? "is-bad" : (balance > 0 ? "is-good" : "");
  el.innerHTML = `
    <div class="vic-balance-card">
      <div class="vic-balance-header">
        <span class="avatar avatar--vic avatar--md">V</span>
        <span class="vic-balance-name">Carteira pessoal · Vivi</span>
      </div>
      <div class="vic-balance-value ${klass}">${balance} <span class="vic-balance-unit">pts</span></div>
      <div class="vic-balance-meta">
        <span>ganhou <b>${earned}</b></span>
        <span>·</span>
        <span>gastou <b>${spent}</b></span>
      </div>
      <div class="vic-balance-extra">
        <span>esta semana <b>${fmtPts(ptsWeek)}</b></span>
        <span>·</span>
        <span>este mês <b>${fmtPts(ptsMonth)}</b></span>
      </div>
    </div>
  `;
}

function renderStore() {
  const el = document.getElementById("vic-store");
  if (!el) return;
  if (!REWARDS_VICTORIA || REWARDS_VICTORIA.length === 0) {
    el.innerHTML = `<p class="muted" style="padding:8px">nenhum item na loja. edite <code>js/points-config.js</code> pra adicionar.</p>`;
    return;
  }
  el.innerHTML = REWARDS_VICTORIA.map((r, idx) => {
    const canAfford = _state.balance >= r.price;
    const pct = Math.max(0, Math.min(100, Math.round((_state.balance / Math.max(1, r.price)) * 100)));
    const cappedCurrent = Math.max(0, Math.min(_state.balance, r.price));
    return `
      <div class="reward-card vic-reward-card${canAfford ? " is-buyable is-achieved" : ""}">
        <div class="reward-header">
          <span class="reward-icon">${r.icon || "🎁"}</span>
          <div class="reward-name-wrap">
            <div class="reward-name">${r.name}</div>
            ${r.description ? `<div class="reward-desc">${r.description}</div>` : ""}
          </div>
          <span class="reward-period">${r.price} pts</span>
        </div>
        <div class="reward-progress" aria-hidden="true">
          <i style="width:${pct}%"></i>
        </div>
        <div class="reward-stats">
          <span><span class="pts-current">${cappedCurrent}</span> / ${r.price} pts</span>
          ${canAfford
            ? '<span class="reward-status reward-status--good">✓ pode comprar</span>'
            : `<span class="reward-status">faltam ${r.price - _state.balance}</span>`}
        </div>
        <div class="vic-buy-row">
          <button class="buy-btn ${canAfford ? "" : "is-disabled"}" data-idx="${idx}" ${canAfford ? "" : "disabled"}>
            ${canAfford ? "Comprar" : "saldo insuficiente"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  el.querySelectorAll(".buy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.idx);
      const reward = REWARDS_VICTORIA[idx];
      if (!reward) return;
      const ok = confirm(`Comprar "${reward.name}" por ${reward.price} pts?\n\nVai descontar do seu saldo pessoal.`);
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
  const el = document.getElementById("vic-history");
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
      const ok = confirm("Desfazer essa compra? Os pontos voltam pro saldo.");
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
  // Recarrega dados e re-renderiza tudo
  const [days, txs] = await Promise.all([
    getRange("victoria", APP_START_DATE, todayISO()),
    getTransactions({ scope: SCOPE }),
  ]);
  _state.days = days;
  _state.transactions = txs;
  renderWallet();
  renderStore();
  renderHistory();
}

async function initVictoriaPage(user) {
  renderAuthFooter(user);
  try {
    await loadAndApplyConfig();
    await refreshAll();
  } catch (err) {
    console.error(err);
    document.getElementById("vic-wallet").innerHTML =
      `<p class="muted" style="padding:8px">erro ao carregar: ${err.message}</p>`;
  } finally {
    document.body.classList.remove("is-loading");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({ onAuthorized: (user) => initVictoriaPage(user) });
});
