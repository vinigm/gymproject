import { VINI_OFFICIAL_MEALS } from "./vini-diet-plan.js";

export function renderViniOfficialDiet(root) {
  if (!root) return;
  root.innerHTML = viniOfficialDietHTML();
}

export function viniOfficialDietHTML() {
  const optionCount = VINI_OFFICIAL_MEALS.reduce((sum, meal) => sum + meal.options.length, 0);
  return `
    <section class="vini-official-intro">
      <span class="vini-official-kicker">Consulta · plano da nutricionista</span>
      <h2>Dieta Oficial</h2>
      <p>As refeições abaixo reproduzem as composições completas dos prints. Esta área é somente para consulta e não altera seus registros.</p>
      <div class="vini-official-summary">
        <strong>${optionCount}</strong><span>opções completas</span>
        <strong>${VINI_OFFICIAL_MEALS.length}</strong><span>momentos alimentares</span>
      </div>
      <small>Os screenshots repetidos foram consolidados; nenhuma composição foi removida.</small>
    </section>

    <div class="vini-official-meals">
      ${VINI_OFFICIAL_MEALS.map(officialMealHTML).join("")}
    </div>

    <section class="vini-official-hydration">
      <div><span>💧</span><strong>Hidratação</strong></div>
      <p>Consumo médio de 2,5 litros de água + 500 ml - 1 litro durante o treino</p>
      <small>Fonte: IMG_3083.PNG</small>
    </section>`;
}

function officialMealHTML(meal) {
  return `
    <section class="vini-official-meal">
      <header class="vini-official-meal-head">
        <span>${meal.icon}</span>
        <div><strong>${meal.label}</strong><small>${meal.time || (meal.contextual ? "quando consumir" : "refeição principal")}</small></div>
        <b>${meal.options.length} ${meal.options.length === 1 ? "opção" : "opções"}</b>
      </header>
      <div class="vini-official-options">
        ${meal.options.map((option, index) => officialOptionHTML(meal, option, index)).join("")}
      </div>
    </section>`;
}

function officialOptionHTML(meal, option, index) {
  const title = meal.options.length > 1 ? `Opção ${index + 1}` : "Composição original";
  return `
    <article class="vini-official-option">
      <header>
        <div><span>${title}</span><strong>${option.label}</strong></div>
        <small>${option.source}</small>
      </header>
      <div class="vini-official-foods">
        ${option.items.map((entry) => `
          <div class="vini-official-food">
            <strong>${entry.label}${entry.optional && !/\(opcional\)/i.test(entry.label) ? " <em>opcional</em>" : ""}</strong>
            <span>${entry.portion}</span>
          </div>`).join("")}
      </div>
      ${option.description ? `<p class="vini-official-note"><strong>Observação:</strong> ${option.description}</p>` : ""}
    </article>`;
}
