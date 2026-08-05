// Navegação compartilhada em todas as páginas.
// A home é um destino direto; as demais páginas ficam agrupadas em três
// submenus para o topo continuar compacto mesmo com o crescimento do app.

export const HOME_NAV_ITEM = Object.freeze({
  href: "./",
  icon: "🏠",
  label: "Início",
  match: Object.freeze(["", "index.html"]),
});

function group(id, icon, label, items) {
  return Object.freeze({
    id,
    icon,
    label,
    items: Object.freeze(items.map((item) => Object.freeze(item))),
  });
}

export const NAV_GROUPS = Object.freeze([
  group("game", "🎮", "Game", [
    { href: "./points.html", icon: "🏆", label: "Pontos", description: "Pontuação do casal", match: ["points.html"] },
    { href: "./casal.html", icon: "🎁", label: "Prêmios", description: "Loja compartilhada", match: ["casal.html"] },
    { href: "./recordes.html", icon: "⭐", label: "Recordes", description: "Melhores marcas", match: ["recordes.html"] },
    { href: "./placares.html", icon: "🏅", label: "Placares", description: "Vini x Vivi", match: ["placares.html"] },
    { href: "./victoria.html", icon: "💖", label: "Vivi", description: "Carteira pessoal", match: ["victoria.html"] },
  ]),
  group("tracking", "📈", "Tracking", [
    { href: "./habitos.html", icon: "✅", label: "Hábitos", description: "Registro diário", match: ["habitos.html"] },
    { href: "./stats.html", icon: "📊", label: "Estatísticas", description: "Visão geral", match: ["stats.html"] },
    { href: "./kg-vini.html", icon: "⚖️", label: "Dieta Vini", description: "Peso, dieta e evolução", match: ["kg-vini.html"] },
    { href: "./kg-vivi.html", icon: "⚖️", label: "Dieta Vivi", description: "Peso, dieta e evolução", match: ["kg-vivi.html"] },
  ]),
  group("other", "🧰", "Outros", [
    { href: "./alongamento.html", icon: "🧘", label: "Alongar", description: "Sessão guiada", match: ["alongamento.html"] },
    { href: "./pomodoro.html", icon: "⏱", label: "Pomodoro", description: "Foco e pausas", match: ["pomodoro.html"] },
    { href: "./presence.html", icon: "🚦", label: "Status", description: "Painel de presença", match: ["presence.html"] },
    { href: "./config.html", icon: "⚙️", label: "Config", description: "Pontos e recompensas", match: ["config.html"] },
  ]),
]);

export function currentFile(pathname = window.location.pathname) {
  const parts = String(pathname).split("/");
  return parts[parts.length - 1] || "";
}

function isItemActive(item, file) {
  return item.match.includes(file);
}

function submenuItemMarkup(item, file) {
  const active = isItemActive(item, file);
  return `
    <a href="${item.href}" class="nav-submenu-item${active ? " is-active" : ""}"${active ? ' aria-current="page"' : ""}>
      <span class="nav-submenu-icon">${item.icon}</span>
      <span class="nav-submenu-copy">
        <strong>${item.label}</strong>
        <small>${item.description}</small>
      </span>
      <span class="nav-submenu-arrow" aria-hidden="true">›</span>
    </a>
  `;
}

function groupMarkup(navGroup, file) {
  const active = navGroup.items.some((item) => isItemActive(item, file));
  return `
    <details class="nav-group${active ? " is-active" : ""}" data-nav-group="${navGroup.id}">
      <summary class="nav-group-toggle">
        <span class="nav-item-icon">${navGroup.icon}</span>
        <span class="nav-item-label">${navGroup.label}</span>
        <span class="nav-group-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="nav-group-panel">
        <div class="nav-group-panel-head">
          <span>${navGroup.icon}</span>
          <strong>${navGroup.label}</strong>
        </div>
        ${navGroup.items.map((item) => submenuItemMarkup(item, file)).join("")}
      </div>
    </details>
  `;
}

export function mountNavMenu(containerId = "nav-menu") {
  const el = document.getElementById(containerId);
  if (!el) return;
  const file = currentFile();
  const homeActive = isItemActive(HOME_NAV_ITEM, file);

  el.classList.add("nav-menu");
  el.setAttribute("aria-label", "Navegação principal");
  el.innerHTML = `
    <a href="${HOME_NAV_ITEM.href}" class="nav-item${homeActive ? " is-active" : ""}"${homeActive ? ' aria-current="page"' : ""}>
      <span class="nav-item-icon">${HOME_NAV_ITEM.icon}</span>
      <span class="nav-item-label">${HOME_NAV_ITEM.label}</span>
    </a>
    ${NAV_GROUPS.map((navGroup) => groupMarkup(navGroup, file)).join("")}
  `;

  const groups = [...el.querySelectorAll(".nav-group")];
  groups.forEach((openedGroup) => {
    openedGroup.addEventListener("toggle", () => {
      if (!openedGroup.open) return;
      groups.forEach((otherGroup) => {
        if (otherGroup !== openedGroup) otherGroup.open = false;
      });
    });
  });

  const closeMenus = (event) => {
    if (el.contains(event.target)) return;
    groups.forEach((navGroup) => { navGroup.open = false; });
  };
  document.addEventListener("pointerdown", closeMenus);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const opened = groups.find((navGroup) => navGroup.open);
    if (!opened) return;
    opened.open = false;
    opened.querySelector("summary")?.focus();
  });

  // Posiciona o nav logo abaixo do topbar e expõe a altura combinada para
  // outros elementos sticky. O painel do submenu não altera essa medida.
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    const setOffsets = () => {
      const tb = topbar.offsetHeight;
      el.style.top = `${tb}px`;
      document.documentElement.style.setProperty("--stack-top", `${tb + el.offsetHeight}px`);
    };
    setOffsets();
    window.addEventListener("resize", setOffsets);
    setTimeout(setOffsets, 250);
  }
}
