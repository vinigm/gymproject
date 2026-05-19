// Auth: tela de login (Google) + checagem de email autorizado.
// O conjunto de emails permitidos também tá nas Regras do Firestore.

import { auth, GoogleAuthProvider } from "./firebase-config.js";
import {
  signInWithRedirect, signInWithPopup, getRedirectResult,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const AUTHORIZED_EMAILS = [
  "vinigm@gmail.com",
  "victoria.cerutti@gmail.com",
];

export function isAuthorizedEmail(email) {
  if (!email) return false;
  return AUTHORIZED_EMAILS.includes(email.toLowerCase());
}

// Cache otimista: marca que o usuário JÁ logou nesse browser, pra esconder
// a tela de login imediatamente em navegações subsequentes. O Firebase Auth
// confirma de fato em ~100ms; se contradisser, mostramos a tela de novo.
const AUTH_CACHE_KEY = "habitos-auth-uid";
function getCachedAuthUid() {
  try { return localStorage.getItem(AUTH_CACHE_KEY); } catch { return null; }
}
function setCachedAuthUid(uid) {
  try {
    if (uid) localStorage.setItem(AUTH_CACHE_KEY, uid);
    else localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
  // Sincroniza a classe no <html> usada pelo inline script de cada page
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("auth-hidden", !!uid);
  }
}

const provider = auth ? new GoogleAuthProvider() : null;
if (provider) provider.setCustomParameters({ prompt: "select_account" });

// Processa retorno do redirect (caso a versão anterior tenha disparado um)
if (auth) {
  getRedirectResult(auth).catch(err => {
    console.error("redirect result error:", err);
  });
}

// Tenta SEMPRE popup primeiro (funciona em browser e em PWA iOS 16+).
// Redirect é fallback de último caso — em PWA o redirect quebra a sessão
// porque iOS abre a navegação no Safari (fora do escopo do PWA).
export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase não configurado");
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("popup signin error:", err);
    const fallbackCodes = [
      "auth/popup-blocked",
      "auth/cancelled-popup-request",
    ];
    if (fallbackCodes.includes(err.code)) {
      console.log("popup bloqueado — caindo pra redirect");
      await signInWithRedirect(auth, provider);
    } else if (err.code === "auth/popup-closed-by-user") {
      // usuário fechou — não erra
      throw new Error("Login cancelado");
    } else {
      throw err;
    }
  }
}

export async function signOutUser() {
  if (!auth) return;
  setCachedAuthUid(null);
  await signOut(auth);
  // Recarrega pra limpar todo o estado em memória
  location.reload();
}

// Cuida da tela #auth-gate. Quando autorizado, chama onAuthorized(user).
export function setupAuthGate({ onAuthorized }) {
  const gate = document.getElementById("auth-gate");
  if (!gate) {
    console.error("auth-gate não encontrado no HTML");
    onAuthorized && onAuthorized(null);
    return;
  }
  const loginBtn = document.getElementById("btn-google-login");
  const loadingEl = document.getElementById("auth-loading");
  const errorEl = document.getElementById("auth-error");

  function showLoading(msg = "verificando…") {
    if (loadingEl) { loadingEl.hidden = false; loadingEl.textContent = msg; }
    if (loginBtn) loginBtn.hidden = true;
    if (errorEl) errorEl.hidden = true;
  }
  function showLogin() {
    if (loadingEl) loadingEl.hidden = true;
    if (loginBtn) loginBtn.hidden = false;
    if (errorEl) errorEl.hidden = true;
  }
  function showError(html) {
    if (loadingEl) loadingEl.hidden = true;
    if (loginBtn) loginBtn.hidden = true;
    if (errorEl) { errorEl.hidden = false; errorEl.innerHTML = html; }
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      showLoading("abrindo Google…");
      try {
        await signInWithGoogle();
      } catch (err) {
        console.error(err);
        showError(`Erro: ${err.message || err.code || "desconhecido"}`);
        // mostra botão de novo
        if (loginBtn) loginBtn.hidden = false;
      }
    });
  }

  if (!auth) {
    showError("Firebase não configurado — verifique <code>firebase-config.js</code>");
    return;
  }

  // Esconde a tela imediatamente se temos cache de auth anterior — evita
  // flash do login em navegações entre páginas.
  if (getCachedAuthUid()) {
    gate.classList.add("is-hidden");
  }

  let initialized = false;
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      setCachedAuthUid(null);
      showLogin();
      gate.classList.remove("is-hidden");
      return;
    }
    if (!isAuthorizedEmail(user.email)) {
      setCachedAuthUid(null);
      showError(`
        <strong>Acesso negado</strong>
        <p>Esta conta (<code>${user.email}</code>) não tem permissão.</p>
        <button class="link-btn" id="auth-retry">sair e tentar outra conta</button>
      `);
      const retry = document.getElementById("auth-retry");
      if (retry) retry.addEventListener("click", () => signOutUser());
      gate.classList.remove("is-hidden");
      return;
    }
    // Autorizado
    setCachedAuthUid(user.uid);
    gate.classList.add("is-hidden");
    if (!initialized) {
      initialized = true;
      onAuthorized && onAuthorized(user);
    }
  });
}

// Adiciona linha "logado como X · sair" no footer
export function renderAuthFooter(user) {
  const el = document.getElementById("auth-info");
  if (!el || !user) return;
  el.innerHTML = `${user.email} · <button class="link-btn" id="footer-signout">sair</button>`;
  const btn = document.getElementById("footer-signout");
  if (btn) btn.addEventListener("click", () => signOutUser());
}
