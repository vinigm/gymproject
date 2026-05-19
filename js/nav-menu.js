// Menu de navegação compacto, compartilhado em todas as páginas.
// Mount com mountNavMenu() em um <div id="nav-menu"></div>.
// Detecta automaticamente a página atual e destaca o item correspondente.

const NAV_ITEMS = [
  { href: "./",              icon: "🏠", label: "Hábitos",  match: ["", "index.html"] },
  { href: "./points.html",   icon: "🏆", label: "Pontos",   match: ["points.html"] },
  { href: "./casal.html",    icon: "🎁", label: "Prêmios",  match: ["casal.html"] },
  { href: "./recordes.html", icon: "⭐", label: "Recordes", match: ["recordes.html"] },
  { href: "./placares.html", icon: "🏅", label: "Placares", match: ["placares.html"] },
  { href: "./victoria.html", icon: "💖", label: "Vivi",     match: ["victoria.html"] },
  { href: "./config.html",   icon: "⚙️", label: "Config",   match: ["config.html"] },
];

function currentFile() {
  const path = window.location.pathname;
  const parts = path.split("/");
  return parts[parts.length - 1] || "";
}

export function mountNavMenu(containerId = "nav-menu") {
  const el = document.getElementById(containerId);
  if (!el) return;
  const file = currentFile();
  el.classList.add("nav-menu");
  el.setAttribute("aria-label", "Navegação");
  el.innerHTML = NAV_ITEMS.map(item => {
    const isActive = item.match.includes(file);
    return `
      <a href="${item.href}" class="nav-item${isActive ? " is-active" : ""}"${isActive ? ' aria-current="page"' : ""}>
        <span class="nav-item-icon">${item.icon}</span>
        <span class="nav-item-label">${item.label}</span>
      </a>
    `;
  }).join("");
}
