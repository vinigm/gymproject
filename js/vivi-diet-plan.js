// Plano alimentar estruturado da Vivi.
// Fonte clínica: DIETA_VIVI.md e dieta_vivi/Plano alimentar vivi.pdf.
//
// O documento não informa metas clínicas de kcal/macros. As referências
// nutricionais abaixo servem somente para o acompanhamento do tracker.

import {
  estimateViniExercises,
  hasViniExercise,
  normalizeViniExercises,
} from "./vini-exercise.js";

export const VIVI_PLAN_VERSION = "vivi-nutri-2026-02-v5";

// Mantém as referências provisórias que a página da Vivi já utilizava.
export const VIVI_DAILY_GOALS = Object.freeze({
  kcal: 2000,
  p: 90,
  c: 250,
  f: 65,
});

const ZERO = Object.freeze({ kcal: 0, p: 0, c: 0, f: 0 });

function nutrition(kcal, p, c, f, quality = "reference") {
  return Object.freeze({ kcal, p, c, f, quality });
}

function item(id, label, portion, nutri, extra = {}) {
  return Object.freeze({ id, label, portion, nutrition: nutri, ...extra });
}

function option(id, label, source, items, description = "") {
  return Object.freeze({ id, label, source, description, items: Object.freeze(items) });
}

export const VIVI_BEVERAGES = Object.freeze([
  Object.freeze({
    id: "cerveja",
    icon: "🍺",
    label: "Cerveja",
    portion: "1 lata · 350 ml",
    nutrition: nutrition(150, 1.3, 13, 0, "generic-estimate"),
  }),
  Object.freeze({
    id: "destilado",
    icon: "🥃",
    label: "Destilado",
    portion: "1 dose · 50 ml",
    nutrition: nutrition(110, 0, 0, 0, "generic-estimate"),
  }),
  Object.freeze({
    id: "energetico_normal",
    icon: "⚡",
    label: "Energético normal",
    portion: "1 lata · 250 ml",
    nutrition: nutrition(110, 0, 27, 0, "generic-estimate"),
  }),
]);

const FOODS = Object.freeze({
  fruit125: item(
    "fruta",
    "Fruta fresca",
    "100–150 g",
    nutrition(75, 0.6, 18.8, 0.3, "generic-estimate"),
    { trackerDefaultQuantity: 125, trackerReferenceQuantity: 125 }
  ),
  fruit100: item("fruta", "Fruta", "1 unidade · aproximadamente 100 g", nutrition(60, 0.5, 15, 0.2, "generic-estimate")),
  egg1: item("ovo", "Ovo de galinha", "1 unidade", nutrition(72, 6.3, 0.4, 4.8)),
  bread25: item("pao_integral", "Pão integral ou com grãos", "1 fatia · 25 g", nutrition(65, 2.5, 12, 1, "generic-estimate")),
  bread50: item("pao_integral", "Pão integral ou com grãos", "2 fatias · 50 g", nutrition(130, 5, 24, 2, "generic-estimate")),
  quark20: item("quark_cottage", "Quark cremoso ou cottage", "1 colher de sopa · 20 g", nutrition(20, 2.4, 0.8, 0.7, "generic-estimate")),
  seeds10: item("sementes", "Chia, linhaça, girassol ou abóbora", "1 colher de sobremesa · 10 g", nutrition(55, 2, 2, 4.5, "generic-estimate")),
  milk100: item("leite_semidesnatado", "Leite semidesnatado", "100 ml", nutrition(46, 3.2, 4.8, 1.6)),
  milk300: item("leite_semidesnatado", "Leite semidesnatado", "300 ml ou 3 colheres de sopa de leite em pó", nutrition(138, 9.6, 14.4, 4.8)),
  panalose15: item("panalose", "Panalose", "15 g", nutrition(60, 0, 15, 0, "product-estimate"), { estimatedRecipe: true }),
  collagen15: item("body_balance", "Body Balance · proteína de colágeno neutra", "15 g", nutrition(54, 13.5, 0, 0, "product-estimate"), { estimatedRecipe: true }),
  leanProtein100: item("proteina_magra", "Proteína animal magra", "1 pedaço médio · aproximadamente 100 g", nutrition(180, 29, 0, 6, "generic-estimate")),
  cookedCarb100: item("carbo_cozido", "Arroz, quinoa, milho, massa ou cuscuz", "5 colheres de sopa · aproximadamente 100 g", nutrition(130, 3, 28, 1, "generic-estimate")),
  potato130: item("batata", "Batata", "1 unidade grande · 130 g", nutrition(100, 2.5, 23, 0.1, "generic-estimate")),
  cassava100: item("mandioca", "Mandioca", "100 g", nutrition(125, 1, 30, 0.3)),
  legumes60: item("leguminosa", "Feijão, lentilha, ervilha ou grão-de-bico", "1 concha pequena · 60 g", nutrition(46, 3, 8, 0.3, "generic-estimate")),
  vegetables: item(
    "vegetais_folhas",
    "Vegetais e folhas",
    "No mínimo 2 variedades/cores · sem necessidade de pesar",
    null,
    { unquantified: true }
  ),
  oliveOil5: item("azeite", "Azeite de oliva extravirgem", "1 fio · aproximadamente 5 ml", nutrition(41, 0, 0, 4.6, "generic-estimate")),
  readyMeal350: item("refeicao_pronta", "Refeição congelada ou pronta", "Porções personalizadas · aproximadamente 350 kcal", nutrition(350, 25, 40, 10, "meal-estimate"), { estimatedRecipe: true }),
  yogurt150: item("iogurte_kefir", "Iogurte natural integral ou kefir", "1 pote · aproximadamente 150 g", nutrition(110, 6, 9, 5, "generic-estimate")),
  granola30: item("granola", "Granola com sementes e castanhas", "30 g", nutrition(130, 3, 20, 4.5, "generic-estimate")),
  nuts15: item("oleaginosas", "Castanhas ou oleaginosas", "15 g", nutrition(90, 3, 3, 8, "generic-estimate")),
  cereal20: item("aveia_cereal", "Aveia, cereal de milho ou de arroz", "20 g", nutrition(75, 2.5, 13, 1.5, "generic-estimate")),
  proteinBar: item("barra_proteina", "Barra de proteína", "1 unidade", nutrition(200, 15, 20, 7, "generic-estimate")),
  bakedSnack: item("salgado_assado", "Salgado assado congelado pronto", "1 porção · aproximadamente 220 kcal", nutrition(220, 8, 28, 8, "meal-estimate"), { estimatedRecipe: true }),
  banana1: item("banana", "Banana-prata média", "1 unidade", nutrition(80, 1, 20, 0.2)),
  oats30: item("aveia", "Aveia", "2 colheres de sopa cheias · aproximadamente 30 g", nutrition(114, 4, 20, 2.4)),
  mariola2: item("mariola", "Mariola com açaí sem adição de açúcar Da Colônia", "2 unidades pequenas", nutrition(80, 0, 20, 0, "product-estimate"), { estimatedRecipe: true }),
  nuts20: item("castanhas", "Castanhas", "1 punhado · 20 g", nutrition(120, 4, 4, 10.7, "generic-estimate")),
  proteinYogurt: item("iogurte_proteico", "Iogurte proteico com pelo menos 15 g de proteína", "1 unidade", nutrition(150, 15, 15, 3, "generic-estimate")),
  nudeDrink: item("nude_proteico", "Bebida proteica NUDE", "1 unidade", nutrition(160, 15, 12, 5, "product-estimate"), { estimatedRecipe: true }),
  cheese30: item("queijo_minas_bufala", "Queijo Minas Frescal ou de búfala", "1 fatia · 30 g", nutrition(80, 6, 1, 6, "generic-estimate")),
});

export const VIVI_MEALS = Object.freeze([
  Object.freeze({
    id: "desjejum",
    icon: "🌅",
    label: "Desjejum",
    required: true,
    options: Object.freeze([
      option("desjejum_oficial", "Composição do plano", "página 5", [
        FOODS.fruit125,
        FOODS.egg1,
        FOODS.bread25,
        FOODS.quark20,
        FOODS.seeds10,
        FOODS.milk100,
      ], "Café preto de boa qualidade e especiarias podem ser acrescentados."),
    ]),
  }),
  Object.freeze({
    id: "lanche_manha",
    icon: "🥛",
    label: "Lanche da manhã",
    required: false,
    contextual: true,
    options: Object.freeze([
      option("lanche_manha_oficial", "Leite + Panalose + Body Balance", "página 5", [
        FOODS.milk300,
        FOODS.panalose15,
        FOODS.collagen15,
      ], "Café e especiarias em pó são opcionais."),
    ]),
  }),
  Object.freeze({
    id: "almoco",
    icon: "☀️",
    label: "Almoço",
    required: true,
    options: Object.freeze([
      option("almoco_cereal", "Proteína + cereal cozido", "páginas 5–6", [
        FOODS.leanProtein100,
        FOODS.cookedCarb100,
        FOODS.legumes60,
        FOODS.vegetables,
        FOODS.oliveOil5,
      ], "A leguminosa é indicada pelo menos uma vez por semana."),
      option("almoco_batata", "Proteína + batata", "páginas 5–6", [
        FOODS.leanProtein100,
        FOODS.potato130,
        FOODS.legumes60,
        FOODS.vegetables,
        FOODS.oliveOil5,
      ], "A leguminosa é indicada pelo menos uma vez por semana."),
      option("almoco_mandioca", "Proteína + mandioca", "páginas 5–6", [
        FOODS.leanProtein100,
        FOODS.cassava100,
        FOODS.legumes60,
        FOODS.vegetables,
        FOODS.oliveOil5,
      ], "A leguminosa é indicada pelo menos uma vez por semana."),
      option("almoco_pronto", "Refeição pronta", "página 6", [
        FOODS.readyMeal350,
      ], "Opção congelada personalizada ou pronta de aproximadamente 350 kcal."),
    ]),
  }),
  Object.freeze({
    id: "lanche_tarde",
    icon: "🥣",
    label: "Lanche da tarde",
    required: true,
    options: Object.freeze([
      option("lanche_tigela_granola", "Tigela · granola", "página 6", [
        FOODS.fruit125,
        FOODS.yogurt150,
        FOODS.granola30,
      ]),
      option("lanche_tigela_castanhas", "Tigela · castanhas", "página 6", [
        FOODS.fruit125,
        FOODS.yogurt150,
        FOODS.nuts15,
      ]),
      option("lanche_tigela_cereal", "Tigela · aveia ou cereal", "página 6", [
        FOODS.fruit125,
        FOODS.yogurt150,
        FOODS.cereal20,
      ]),
      option("lanche_barra", "Fruta + barra de proteína", "página 7", [
        FOODS.fruit125,
        FOODS.proteinBar,
      ]),
      option("lanche_salgado", "Fruta + salgado assado", "página 7", [
        FOODS.fruit125,
        FOODS.bakedSnack,
      ]),
      option("lanche_panqueca", "Panqueca ou bolinho de caneca", "página 7", [
        FOODS.banana1,
        FOODS.oats30,
        FOODS.egg1,
        FOODS.seeds10,
      ], "Especiarias, fermento e frutas vermelhas são opcionais."),
    ]),
  }),
  Object.freeze({
    id: "pre_treino",
    icon: "🏃",
    label: "Pré-treino",
    time: "30–45 min antes",
    required: false,
    contextual: true,
    options: Object.freeze([
      option("pre_treino_oficial", "Mariola + castanhas", "página 7", [
        FOODS.mariola2,
        FOODS.nuts20,
      ]),
    ]),
  }),
  Object.freeze({
    id: "lanche_aula",
    icon: "🎓",
    label: "Lanche em dia de aula",
    required: false,
    contextual: true,
    options: Object.freeze([
      option("aula_iogurte", "Iogurte proteico", "página 7", [FOODS.proteinYogurt]),
      option("aula_nude", "Bebida proteica NUDE", "página 7", [FOODS.nudeDrink]),
      option("aula_sanduiche", "Sanduíche + fruta", "página 8", [
        FOODS.bread50,
        FOODS.quark20,
        FOODS.cheese30,
        FOODS.fruit100,
      ]),
    ]),
  }),
  Object.freeze({
    id: "jantar",
    icon: "🌙",
    label: "Jantar",
    required: true,
    options: Object.freeze([
      option("jantar_cereal", "Proteína + cereal cozido", "página 7", [
        FOODS.leanProtein100,
        FOODS.cookedCarb100,
        FOODS.vegetables,
        FOODS.oliveOil5,
      ], "Mesma estrutura do almoço, sem leguminosas."),
      option("jantar_batata", "Proteína + batata", "página 7", [
        FOODS.leanProtein100,
        FOODS.potato130,
        FOODS.vegetables,
        FOODS.oliveOil5,
      ], "Mesma estrutura do almoço, sem leguminosas."),
      option("jantar_mandioca", "Proteína + mandioca", "página 7", [
        FOODS.leanProtein100,
        FOODS.cassava100,
        FOODS.vegetables,
        FOODS.oliveOil5,
      ], "Mesma estrutura do almoço, sem leguminosas."),
    ]),
  }),
]);

export const VIVI_REQUIRED_MEALS = Object.freeze(
  VIVI_MEALS.filter((meal) => meal.required).map((meal) => meal.id)
);

// A visualização oficial usa a organização acima, preservando alternativas,
// quantidades e referências de página do PDF.
export const VIVI_OFFICIAL_MEALS = VIVI_MEALS;

export const VIVI_HYDRATION = Object.freeze({
  baseMl: 1600,
  trainingMinMl: 1600,
  trainingMaxMl: 1600,
});

const QUANTITY_RULES = Object.freeze({
  fruta: { unit: "g", values: [50, 80, 100, 125, 150, 180, 200, 250] },
  ovo: { unit: "un", values: [1, 2, 3, 4, 5, 6] },
  ovo_cozido: { unit: "un", values: [1, 2, 3, 4, 5, 6] },
  pao_integral: { unit: "fatia", values: [1, 2, 3, 4, 5, 6] },
  quark_cottage: { unit: "g", values: [10, 15, 20, 30, 40, 50, 60] },
  sementes: { unit: "g", values: [5, 10, 15, 20, 25, 30] },
  leite_semidesnatado: { unit: "ml", values: [100, 150, 200, 250, 300, 400, 500] },
  panalose: { unit: "g", values: [5, 10, 15, 20, 25, 30] },
  body_balance: { unit: "g", values: [5, 10, 15, 20, 25, 30] },
  proteina_magra: { unit: "g", values: [50, 80, 100, 120, 150, 180, 200, 250] },
  carbo_cozido: { unit: "g", values: [50, 80, 100, 130, 150, 180, 200, 250] },
  batata: { unit: "g", values: [80, 100, 130, 150, 180, 200, 250] },
  mandioca: { unit: "g", values: [50, 80, 100, 130, 150, 180, 200] },
  leguminosa: { unit: "g", values: [30, 60, 80, 100, 120, 150] },
  azeite: { unit: "ml", values: [5, 10, 15, 20, 25] },
  refeicao_pronta: { unit: "porcao", values: [1, 2] },
  iogurte_kefir: { unit: "g", values: [100, 150, 170, 200, 250, 300] },
  granola: { unit: "g", values: [15, 20, 30, 40, 50, 60] },
  oleaginosas: { unit: "g", values: [10, 15, 20, 25, 30, 40] },
  aveia_cereal: { unit: "g", values: [10, 20, 30, 40, 50] },
  barra_proteina: { unit: "un", values: [1, 2, 3] },
  salgado_assado: { unit: "porcao", values: [1, 2, 3] },
  banana: { unit: "un", values: [1, 2, 3, 4, 5] },
  maca: { unit: "un", values: [1, 2, 3, 4, 5] },
  aveia: { unit: "g", values: [15, 20, 30, 40, 50, 60] },
  mariola: { unit: "un", values: [1, 2, 3, 4, 5, 6] },
  castanhas: { unit: "g", values: [10, 15, 20, 25, 30, 40, 50] },
  iogurte_proteico: { unit: "un", values: [1, 2, 3] },
  nude_proteico: { unit: "un", values: [1, 2, 3] },
  queijo_minas_bufala: { unit: "g", values: [15, 20, 30, 40, 50, 60] },
  whey_probiotica: { unit: "g", values: [10, 15, 18, 20, 25, 30, 31, 35, 40, 45, 50, 60] },
  aveia_floco_g: { unit: "g", values: [15, 20, 30, 40, 50, 60, 80, 100] },
  banana_prata_g: { unit: "g", values: [50, 70, 80, 100, 120, 150, 180, 200, 250] },
  alcatra_grelhada: { unit: "g", values: [50, 80, 100, 120, 150, 180, 200, 250] },
  aipim_cozido: { unit: "g", values: [50, 80, 100, 130, 150, 170, 180, 200, 250] },
  azeite_g: { unit: "g", values: [5, 10, 15, 20, 25, 30] },
  mariola_g: { unit: "g", values: [17, 30, 34, 40, 50, 60] },
  pasta_amendopower: { unit: "g", values: [5, 10, 15, 20, 25, 30, 40, 50] },
  maca_fuji: { unit: "g", values: [30, 50, 80, 100, 130, 150, 180, 200] },
  castanha_caju: { unit: "g", values: [10, 15, 20, 25, 30, 40, 50, 60] },
});

// Itens pessoais acrescentados ao tracker sem alterar a consulta estática da
// dieta oficial. O ovo cozido usa a referência por unidade do ovo do plano,
// sem óleo; banana e aveia reaproveitam as porções já usadas na panqueca.
const OVO_COZIDO_1 = item(
  "ovo_cozido",
  "Ovo cozido",
  "1 unidade",
  nutrition(72, 6.3, 0.4, 4.8, "generic-estimate")
);

const WHEY_PROBIOTICA_31 = item(
  "whey_probiotica",
  "100% Pure Whey Protein (Probiótica)",
  "31 g",
  nutrition(120, 23, 3.01, 1.49, "product-estimate"),
  { trackerDefaultQuantity: 31, trackerReferenceQuantity: 31, estimatedRecipe: true }
);

const AVEIA_FLOCOS_30 = item(
  "aveia_floco_g",
  "Aveia em flocos crua",
  "30 g",
  nutrition(118.1, 4.18, 19.99, 2.55),
  { trackerDefaultQuantity: 30, trackerReferenceQuantity: 30 }
);

const BANANA_PRATA_100 = item(
  "banana_prata_g",
  "Banana-prata crua",
  "100 g",
  nutrition(98.25, 1.27, 25.96, 0.07),
  { trackerDefaultQuantity: 100, trackerReferenceQuantity: 100 }
);

const ALCATRA_GRELHADA_100 = item(
  "alcatra_grelhada",
  "Alcatra grelhada",
  "100 g",
  nutrition(241.36, 31.93, 0, 11.64),
  { trackerDefaultQuantity: 100, trackerReferenceQuantity: 100 }
);

const AIPIM_COZIDO_170 = item(
  "aipim_cozido",
  "Aipim (mandioca) cozido",
  "170 g",
  nutrition(213.11, 0.97, 51.15, 0.51),
  { trackerDefaultQuantity: 170, trackerReferenceQuantity: 170 }
);

const AZEITE_15_G = item(
  "azeite_g",
  "Azeite de oliva extravirgem",
  "15 g",
  nutrition(132.6, 0, 0, 15),
  { trackerDefaultQuantity: 15, trackerReferenceQuantity: 15 }
);

const MARIOLA_34_G = item(
  "mariola_g",
  "Mariola com açaí sem açúcar",
  "34 g",
  nutrition(90.7, 0, 22.68, 0, "product-estimate"),
  { trackerDefaultQuantity: 34, trackerReferenceQuantity: 34, estimatedRecipe: true }
);

const PASTA_AMENDOPOWER_15_G = item(
  "pasta_amendopower",
  "Pasta de amendoim · Amendopower Cookies & Cream",
  "15 g",
  nutrition(87, 3.2, 3.71, 6.6, "product-estimate"),
  { trackerDefaultQuantity: 15, trackerReferenceQuantity: 15, estimatedRecipe: true }
);

const MACA_FUJI_30_G = item(
  "maca_fuji",
  "Maçã Fuji crua",
  "30 g",
  nutrition(16.7, 0.09, 4.55, 0),
  { trackerDefaultQuantity: 30, trackerReferenceQuantity: 30 }
);

const MACA_FUJI_1 = item(
  "maca",
  "Maçã Fuji média",
  "1 unidade · aproximadamente 130 g",
  nutrition(73, 0.4, 19.8, 0.3),
  { trackerDefaultQuantity: 1, trackerReferenceQuantity: 1 }
);

const CASTANHA_CAJU_30_G = item(
  "castanha_caju",
  "Castanha-de-caju crua",
  "30 g",
  nutrition(165.9, 5.46, 9.06, 13.17),
  { trackerDefaultQuantity: 30, trackerReferenceQuantity: 30 }
);

const VIVI_TRACKER_ONLY_MEALS = Object.freeze([
  Object.freeze({
    id: "ceia",
    icon: "🍎",
    label: "Ceia",
    required: false,
    contextual: true,
    options: Object.freeze([]),
  }),
  Object.freeze({
    id: "suplemento",
    icon: "🥤",
    label: "Suplemento",
    required: false,
    contextual: true,
    options: Object.freeze([]),
  }),
]);

const VIVI_TRACKER_EXTRA_FOODS = Object.freeze({
  desjejum: Object.freeze([
    FOODS.banana1,
    FOODS.oats30,
    OVO_COZIDO_1,
    WHEY_PROBIOTICA_31,
    AVEIA_FLOCOS_30,
    BANANA_PRATA_100,
  ]),
  almoco: Object.freeze([ALCATRA_GRELHADA_100, AIPIM_COZIDO_170, AZEITE_15_G]),
  lanche_tarde: Object.freeze([
    WHEY_PROBIOTICA_31,
    BANANA_PRATA_100,
    MACA_FUJI_1,
    CASTANHA_CAJU_30_G,
  ]),
  pre_treino: Object.freeze([MARIOLA_34_G, PASTA_AMENDOPOWER_15_G]),
  jantar: Object.freeze([ALCATRA_GRELHADA_100, AIPIM_COZIDO_170, AZEITE_15_G]),
  ceia: Object.freeze([MACA_FUJI_30_G, CASTANHA_CAJU_30_G]),
  suplemento: Object.freeze([WHEY_PROBIOTICA_31]),
});

function parseLocaleNumber(value) {
  return Number(String(value || "").replace(",", "."));
}

function quantityFromEntry(entry, unit) {
  const patterns = {
    un: /(\d+(?:[.,]\d+)?)\s*unidade/i,
    fatia: /(\d+(?:[.,]\d+)?)\s*fatia/i,
    porcao: /(\d+(?:[.,]\d+)?)\s*por[cç][aã]o/i,
    g: /(\d+(?:[.,]\d+)?)\s*g\b/i,
    ml: /(\d+(?:[.,]\d+)?)\s*ml\b/i,
  };
  const match = String(entry?.portion || "").match(patterns[unit]);
  const value = parseLocaleNumber(match?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function formatQuantityValue(value) {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function formatViviFoodQuantity(food, quantity) {
  const value = formatQuantityValue(quantity);
  if (food?.quantityUnit === "un") return `${value} un`;
  if (food?.quantityUnit === "fatia") return `${value} ${Number(quantity) === 1 ? "fatia" : "fatias"}`;
  if (food?.quantityUnit === "porcao") return `${value} ${Number(quantity) === 1 ? "porção" : "porções"}`;
  return `${value}${food?.quantityUnit || ""}`;
}

function buildFoodGroups() {
  return [...VIVI_MEALS, ...VIVI_TRACKER_ONLY_MEALS].map((meal) => {
    const byId = new Map();
    for (const option_ of meal.options) {
      for (const entry of option_.items) {
        if (!byId.has(entry.id)) {
          byId.set(entry.id, { ...entry, variants: [], sourceOptions: new Set() });
        }
        const food = byId.get(entry.id);
        food.sourceOptions.add(option_.id);
        if (!food.variants.some((variant) => variant.portion === entry.portion)) food.variants.push(entry);
      }
    }
    for (const entry of VIVI_TRACKER_EXTRA_FOODS[meal.id] || []) {
      if (!byId.has(entry.id)) {
        byId.set(entry.id, { ...entry, variants: [], sourceOptions: new Set() });
      }
      const food = byId.get(entry.id);
      food.sourceOptions.add("tracker_extra");
      if (!food.variants.some((variant) => variant.portion === entry.portion)) food.variants.push(entry);
    }
    const foods = [...byId.values()].map((entry) => {
      if (entry.unquantified) {
        return Object.freeze({
          ...entry,
          variants: Object.freeze(entry.variants),
          sourceOptions: Object.freeze([...entry.sourceOptions]),
          quantityUnit: null,
          quantityChoices: Object.freeze([]),
          defaultQuantity: 1,
          referenceQuantity: 1,
          prescribedQuantities: Object.freeze([]),
        });
      }
      const rule = QUANTITY_RULES[entry.id] || { unit: "g", values: [50, 100, 150, 200] };
      const prescribed = [...new Set(entry.variants.map((variant) => (
        finiteNumber(variant.trackerDefaultQuantity) || quantityFromEntry(variant, rule.unit)
      )))];
      const defaultQuantity = finiteNumber(entry.trackerDefaultQuantity) || prescribed[0] || rule.values[0];
      return Object.freeze({
        ...entry,
        variants: Object.freeze(entry.variants),
        sourceOptions: Object.freeze([...entry.sourceOptions]),
        quantityUnit: rule.unit,
        quantityChoices: Object.freeze([...new Set([...rule.values, ...prescribed])].sort((a, b) => a - b)),
        defaultQuantity,
        referenceQuantity: finiteNumber(entry.trackerReferenceQuantity) || quantityFromEntry(entry, rule.unit),
        prescribedQuantities: Object.freeze(prescribed),
      });
    });
    return Object.freeze({
      id: meal.id,
      icon: meal.icon,
      label: meal.label,
      time: meal.time || "",
      required: meal.required,
      contextual: meal.contextual,
      foods: Object.freeze(foods),
    });
  });
}

export const VIVI_FOOD_GROUPS = Object.freeze(buildFoodGroups());

export function viviFoodGroupForId(groupId) {
  return VIVI_FOOD_GROUPS.find((group) => group.id === groupId) || null;
}

export function viviFoodForGroup(group, foodId) {
  return group?.foods.find((food) => food.id === foodId) || null;
}

function beverageForId(beverageId) {
  return VIVI_BEVERAGES.find((beverage) => beverage.id === beverageId) || null;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundedNutrition(value) {
  return {
    kcal: Math.round(value.kcal),
    p: Math.round(value.p * 10) / 10,
    c: Math.round(value.c * 10) / 10,
    f: Math.round(value.f * 10) / 10,
  };
}

function cleanNutrition(value) {
  return {
    kcal: Math.max(0, finiteNumber(value?.kcal)),
    p: Math.max(0, finiteNumber(value?.p)),
    c: Math.max(0, finiteNumber(value?.c)),
    f: Math.max(0, finiteNumber(value?.f)),
  };
}

function cleanAdditionalNutrition(value, legacyKcal = 0) {
  const source = value && typeof value === "object" ? value : {};
  return {
    kcal: Math.max(0, Math.min(10000, Math.round(finiteNumber(source.kcal, legacyKcal)))),
    p: Math.max(0, Math.min(1000, Math.round(finiteNumber(source.p) * 10) / 10)),
    c: Math.max(0, Math.min(1000, Math.round(finiteNumber(source.c) * 10) / 10)),
    f: Math.max(0, Math.min(1000, Math.round(finiteNumber(source.f) * 10) / 10)),
  };
}

function cleanSummary(summary) {
  const planVersion = String(summary?.planVersion || "").trim();
  if (!planVersion) return null;
  const consumed = cleanNutrition(summary.consumed);
  const exerciseKcal = Math.max(0, finiteNumber(summary.exerciseKcal));
  return {
    planVersion,
    consumed,
    planned: cleanNutrition(summary.planned),
    exerciseKcal,
    netKcal: finiteNumber(summary.netKcal, consumed.kcal - exerciseKcal),
    exerciseWeightKg: Math.max(0, finiteNumber(summary.exerciseWeightKg)),
    adherencePct: Math.max(0, Math.min(100, finiteNumber(summary.adherencePct))),
    completedMeals: Math.max(0, finiteNumber(summary.completedMeals)),
    requiredMeals: Math.max(0, finiteNumber(summary.requiredMeals, VIVI_REQUIRED_MEALS.length)),
    itemsChecked: Math.max(0, finiteNumber(summary.itemsChecked)),
    beverageCount: Math.max(0, finiteNumber(summary.beverageCount)),
    additionalMeal: String(summary.additionalMeal || "").trim().slice(0, 300),
    additionalNutrition: cleanAdditionalNutrition(summary.additionalNutrition, summary.additionalKcal),
    mainMealsLogged: Math.max(0, finiteNumber(summary.mainMealsLogged, summary.completedMeals)),
    mealCoveragePct: Math.max(0, Math.min(100, finiteNumber(summary.mealCoveragePct, summary.adherencePct))),
    hydrationMl: Math.max(0, finiteNumber(summary.hydrationMl)),
    hydrationTargetMl: Math.max(0, finiteNumber(summary.hydrationTargetMl)),
    hydrationPct: Math.max(0, finiteNumber(summary.hydrationPct)),
  };
}

export function normalizeViviFoodQuantity(food, value) {
  if (!food || food.unquantified) return 1;
  const amount = finiteNumber(value, food.defaultQuantity);
  return food.quantityChoices.some((choice) => Math.abs(choice - amount) < 0.001)
    ? amount
    : food.defaultQuantity;
}

export function nutritionForViviFoodQuantity(food, value) {
  if (!food?.nutrition) return null;
  const quantity = normalizeViviFoodQuantity(food, value);
  const reference = Math.max(0.001, finiteNumber(food.referenceQuantity, 1));
  const ratio = quantity / reference;
  return roundedNutrition({
    kcal: finiteNumber(food.nutrition.kcal) * ratio,
    p: finiteNumber(food.nutrition.p) * ratio,
    c: finiteNumber(food.nutrition.c) * ratio,
    f: finiteNumber(food.nutrition.f) * ratio,
  });
}

export function nutritionForViviBeverageCount(beverage, value) {
  if (!beverage?.nutrition) return null;
  const count = Math.max(0, Math.min(99, Math.round(finiteNumber(value))));
  return roundedNutrition({
    kcal: finiteNumber(beverage.nutrition.kcal) * count,
    p: finiteNumber(beverage.nutrition.p) * count,
    c: finiteNumber(beverage.nutrition.c) * count,
    f: finiteNumber(beverage.nutrition.f) * count,
  });
}

export function emptyViviDietDay() {
  return {
    version: VIVI_PLAN_VERSION,
    meals: {},
    foods: {},
    amounts: {},
    beverages: {},
    additionalMeal: "",
    additionalNutrition: { ...ZERO },
    hydrationMl: 0,
    trainingDay: false,
    exercises: {},
    exerciseWeightKg: 0,
    summary: null,
  };
}

export function normalizeViviDietDay(raw) {
  const out = emptyViviDietDay();
  out.version = String(raw?.version || VIVI_PLAN_VERSION);
  out.additionalMeal = String(raw?.additionalMeal ?? raw?.summary?.additionalMeal ?? "").trim().slice(0, 300);
  out.additionalNutrition = cleanAdditionalNutrition(
    raw?.additionalNutrition,
    raw?.additionalKcal ?? raw?.summary?.additionalKcal
  );
  out.hydrationMl = Math.max(0, Math.min(10000, Math.round(finiteNumber(raw?.hydrationMl))));
  out.exercises = normalizeViniExercises(raw?.exercises);
  out.exerciseWeightKg = Math.max(0, Math.round(finiteNumber(raw?.exerciseWeightKg) * 10) / 10);
  out.trainingDay = raw?.trainingDay === true || hasViniExercise(out.exercises);
  out.summary = cleanSummary(raw?.summary);

  for (const beverage of VIVI_BEVERAGES) {
    const count = Math.max(0, Math.min(99, Math.round(finiteNumber(raw?.beverages?.[beverage.id]))));
    if (count > 0) out.beverages[beverage.id] = count;
  }

  for (const group of VIVI_FOOD_GROUPS) {
    const valid = new Set(group.foods.map((food) => food.id));
    const selected = [...new Set(Array.isArray(raw?.foods?.[group.id]) ? raw.foods[group.id] : [])]
      .filter((foodId) => valid.has(foodId));
    if (!selected.length) continue;
    out.foods[group.id] = group.foods.map((food) => food.id).filter((foodId) => selected.includes(foodId));
    out.amounts[group.id] = {};
    for (const foodId of out.foods[group.id]) {
      const food = viviFoodForGroup(group, foodId);
      out.amounts[group.id][foodId] = normalizeViviFoodQuantity(
        food,
        raw?.amounts?.[group.id]?.[foodId] ?? food.defaultQuantity
      );
    }
  }
  return out;
}

export function setViviBeverageCount(rawDay, beverageId, value) {
  const day = normalizeViviDietDay(rawDay);
  const beverage = beverageForId(beverageId);
  if (!beverage) return day;
  const count = Math.max(0, Math.min(99, Math.round(finiteNumber(value))));
  if (count) day.beverages[beverage.id] = count;
  else delete day.beverages[beverage.id];
  return day;
}

function addNutrition(total, value) {
  if (!value) return;
  total.kcal += finiteNumber(value.kcal);
  total.p += finiteNumber(value.p);
  total.c += finiteNumber(value.c);
  total.f += finiteNumber(value.f);
}

export function calculateViviDietDay(raw, { useSnapshot = false } = {}) {
  const day = normalizeViviDietDay(raw);
  const consumed = { ...ZERO };
  const foodGroups = {};
  let itemsChecked = 0;
  let quantifiedItemsChecked = 0;
  let unquantifiedItemsChecked = 0;
  let beverageCount = 0;

  for (const group of VIVI_FOOD_GROUPS) {
    const selectedIds = day.foods[group.id] || [];
    const selectedFoods = selectedIds.map((foodId) => viviFoodForGroup(group, foodId)).filter(Boolean);
    const selectedAmounts = {};
    for (const food of selectedFoods) {
      const amount = normalizeViviFoodQuantity(food, day.amounts[group.id]?.[food.id]);
      selectedAmounts[food.id] = amount;
      itemsChecked += 1;
      if (food.nutrition) quantifiedItemsChecked += 1;
      else unquantifiedItemsChecked += 1;
      addNutrition(consumed, nutritionForViviFoodQuantity(food, amount));
    }
    foodGroups[group.id] = {
      group,
      selectedIds,
      selectedFoods,
      selectedAmounts,
      hasFood: selectedFoods.length > 0,
    };
  }

  for (const beverage of VIVI_BEVERAGES) {
    const count = day.beverages[beverage.id] || 0;
    if (!count) continue;
    beverageCount += count;
    addNutrition(consumed, nutritionForViviBeverageCount(beverage, count));
  }
  addNutrition(consumed, day.additionalNutrition);

  const mainMealsLogged = VIVI_REQUIRED_MEALS.filter((groupId) => foodGroups[groupId]?.hasFood).length;
  const mealCoveragePct = VIVI_REQUIRED_MEALS.length
    ? Math.round((mainMealsLogged / VIVI_REQUIRED_MEALS.length) * 100)
    : 0;
  const hydrationTargetMl = day.trainingDay ? VIVI_HYDRATION.trainingMinMl : VIVI_HYDRATION.baseMl;
  const hydrationPct = hydrationTargetMl > 0 ? Math.round((day.hydrationMl / hydrationTargetMl) * 100) : 0;
  const exercise = estimateViniExercises(day.exercises, day.exerciseWeightKg);
  const roundedConsumed = roundedNutrition(consumed);
  const result = {
    day,
    consumed: roundedConsumed,
    planned: { ...ZERO },
    exercises: exercise.items,
    exerciseKcal: exercise.totalKcal,
    netKcal: roundedConsumed.kcal - exercise.totalKcal,
    exerciseWeightKg: day.exerciseWeightKg,
    foodGroups,
    adherencePct: mealCoveragePct,
    completedMeals: mainMealsLogged,
    requiredMeals: VIVI_REQUIRED_MEALS.length,
    mainMealsLogged,
    mealCoveragePct,
    itemsChecked,
    beverageCount,
    additionalMeal: day.additionalMeal,
    additionalNutrition: { ...day.additionalNutrition },
    quantifiedItemsChecked,
    unquantifiedItemsChecked,
    hydrationMl: day.hydrationMl,
    hydrationTargetMl,
    hydrationPct,
    hasData: day.hydrationMl > 0
      || day.trainingDay
      || exercise.items.length > 0
      || itemsChecked > 0
      || beverageCount > 0
      || day.additionalMeal.length > 0
      || Object.values(day.additionalNutrition).some((value) => value > 0),
  };

  if (useSnapshot && day.summary) {
    result.consumed = cleanNutrition(day.summary.consumed);
    result.planned = cleanNutrition(day.summary.planned);
    result.exerciseKcal = day.summary.exerciseKcal;
    result.netKcal = day.summary.netKcal;
    result.exerciseWeightKg = day.summary.exerciseWeightKg;
    result.adherencePct = day.summary.adherencePct;
    result.completedMeals = day.summary.completedMeals;
    result.requiredMeals = day.summary.requiredMeals;
    result.itemsChecked = day.summary.itemsChecked;
    result.beverageCount = day.summary.beverageCount || beverageCount;
    result.additionalMeal = day.summary.additionalMeal || day.additionalMeal;
    result.additionalNutrition = { ...day.summary.additionalNutrition };
    result.mainMealsLogged = day.summary.mainMealsLogged;
    result.mealCoveragePct = day.summary.mealCoveragePct;
    result.hydrationMl = day.summary.hydrationMl;
    result.hydrationTargetMl = day.summary.hydrationTargetMl;
    result.hydrationPct = day.summary.hydrationPct;
    result.hasData = true;
  }
  return result;
}

export function withViviDietSummary(raw) {
  const day = normalizeViviDietDay(raw);
  const calculated = calculateViviDietDay(day);
  day.summary = {
    planVersion: day.version,
    consumed: calculated.consumed,
    planned: calculated.planned,
    exerciseKcal: calculated.exerciseKcal,
    netKcal: calculated.netKcal,
    exerciseWeightKg: calculated.exerciseWeightKg,
    adherencePct: calculated.adherencePct,
    completedMeals: calculated.completedMeals,
    requiredMeals: calculated.requiredMeals,
    itemsChecked: calculated.itemsChecked,
    beverageCount: calculated.beverageCount,
    additionalMeal: calculated.additionalMeal,
    additionalNutrition: calculated.additionalNutrition,
    mainMealsLogged: calculated.mainMealsLogged,
    mealCoveragePct: calculated.mealCoveragePct,
    hydrationMl: calculated.hydrationMl,
    hydrationTargetMl: calculated.hydrationTargetMl,
    hydrationPct: calculated.hydrationPct,
  };
  return day;
}

// Conserva nos gráficos os registros antigos da página genérica da Vivi.
export function legacyViviPlanFromFoods(foods) {
  const values = foods && typeof foods === "object" ? foods : {};
  const oldCatalog = {
    "cafe.ovo": nutrition(72, 6.3, 0.4, 4.8),
    "cafe.pao": nutrition(65, 2.5, 12, 1),
    "cafe.fruta": nutrition(75, 0.6, 18.8, 0.3),
    "almoco.proteina": nutrition(180, 29, 0, 6),
    "almoco.arroz": nutrition(130, 3, 28, 1),
    "almoco.saladas": nutrition(30, 1.5, 6, 0.2),
    "lanche.fruta": nutrition(75, 0.6, 18.8, 0.3),
    "lanche.iogurte": nutrition(110, 6, 9, 5),
    "jantar.proteina": nutrition(180, 29, 0, 6),
    "jantar.arroz": nutrition(130, 3, 28, 1),
  };
  const consumed = { ...ZERO };
  let itemsChecked = 0;
  for (const [key, countValue] of Object.entries(values)) {
    const count = Math.max(0, finiteNumber(countValue));
    if (!count || !oldCatalog[key]) continue;
    itemsChecked += count;
    addNutrition(consumed, {
      kcal: oldCatalog[key].kcal * count,
      p: oldCatalog[key].p * count,
      c: oldCatalog[key].c * count,
      f: oldCatalog[key].f * count,
    });
  }
  const day = emptyViviDietDay();
  if (!itemsChecked) return day;
  day.version = "vivi-legacy-foods-v1";
  day.summary = {
    planVersion: day.version,
    consumed: roundedNutrition(consumed),
    planned: { ...ZERO },
    exerciseKcal: 0,
    netKcal: Math.round(consumed.kcal),
    exerciseWeightKg: 0,
    adherencePct: 0,
    completedMeals: 0,
    requiredMeals: VIVI_REQUIRED_MEALS.length,
    itemsChecked,
    beverageCount: 0,
    additionalMeal: "",
    additionalNutrition: { ...ZERO },
    mainMealsLogged: 0,
    mealCoveragePct: 0,
    hydrationMl: 0,
    hydrationTargetMl: VIVI_HYDRATION.baseMl,
    hydrationPct: 0,
  };
  return day;
}
