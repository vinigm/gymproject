import { setupAuthGate, renderAuthFooter } from "./auth.js";
import { mountNavMenu } from "./nav-menu.js";

function formatToday() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
}

function initHomePage(user) {
  const date = document.getElementById("topbar-date");
  if (date) date.textContent = formatToday();
  renderAuthFooter(user);
  document.body.classList.remove("is-loading");
}

document.addEventListener("DOMContentLoaded", () => {
  mountNavMenu();
  setupAuthGate({ onAuthorized: (user) => initHomePage(user) });
});
