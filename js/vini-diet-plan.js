// Plano alimentar estruturado do Vini.
// Fonte das porções: DIETA_VINI.md e screenshots em dieta_vini/.
//
// Os valores nutricionais são estimativas de acompanhamento, não uma nova
// prescrição. Alimentos simples usam referências compatíveis com TACO/TBCA;
// produtos e receitas sem rótulo/ficha técnica usam aproximações explícitas.

import {
  estimateViniExercises,
  hasViniExercise,
  normalizeViniExercises,
} from "./vini-exercise.js";

export const VINI_PLAN_VERSION = "vini-nutri-2026-07-v8";

// Metas/limites diários usados nos cards, gráficos e relatório PDF. Os macros
// foram atualizados pelo usuário em 18/07/2026; calorias permanecem como
// referência provisória enquanto não houver uma meta clínica específica.
export const VINI_DAILY_GOALS = Object.freeze({
  kcal: 2000,
  p: 150,
  c: 200,
  f: 68,
});

const ZERO = Object.freeze({ kcal: 0, p: 0, c: 0, f: 0 });

function nutrition(kcal, p, c, f, quality = "reference") {
  return Object.freeze({ kcal, p, c, f, quality });
}

function item(id, label, portion, nutri, extra = {}) {
  return Object.freeze({ id, label, portion, nutrition: nutri, ...extra });
}

// Porções médias para registrar bebidas sem exigir marca ou receita exata.
// As kcal do destilado vêm principalmente do álcool e, por isso, não aparecem
// como proteína, carboidrato ou gordura.
export const VINI_BEVERAGES = Object.freeze([
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

const COMMON = Object.freeze({
  vegetables50: item("vegetais", "Verdura ou legumes", "50 g", nutrition(15, 0.7, 3, 0.1)),
  oliveOil5: item("azeite", "Azeite de oliva extravirgem", "1 colher de sobremesa rasa · 5 ml", nutrition(41, 0, 0, 4.6)),
  rice150: item("arroz", "Arroz branco cozido", "6 colheres de sopa cheias · 150 g", nutrition(192, 3.8, 42.2, 0.3)),
  rice100: item("arroz", "Arroz branco cozido", "4 colheres de sopa cheias · 100 g", nutrition(128, 2.5, 28.1, 0.2)),
  chicken150: item("frango", "Frango grelhado", "150 g", nutrition(239, 48, 0, 3.8)),
  chicken130: item("frango", "Frango grelhado", "130 g", nutrition(207, 41.6, 0, 3.3)),
  chicken120: item("frango", "Frango grelhado", "120 g", nutrition(191, 38.4, 0, 3)),
  puree105: item(
    "pure_batata",
    "Purê de batata inglesa com sal",
    "3 colheres de sopa cheias · 105 g",
    nutrition(116, 2, 17.6, 4.2, "recipe-estimate"),
    { estimatedRecipe: true }
  ),
  pancake240: item(
    "panqueca_carne",
    "Panqueca com carne moída, molho de tomate e sal",
    "3 unidades médias · 240 g",
    nutrition(432, 28, 45, 16, "recipe-estimate"),
    { estimatedRecipe: true }
  ),
  pineappleJuice250: item("suco_abacaxi", "Suco natural de abacaxi", "250 ml", nutrition(132, 0.9, 32.5, 0.3)),
  bolognese350: item(
    "macarrao_bolonhesa",
    "Macarrão à bolonhesa",
    "350 g",
    nutrition(490, 24, 64, 15, "recipe-estimate"),
    { estimatedRecipe: true }
  ),
  freeSalad: item(
    "tomate_repolho",
    "Tomate-cereja e repolho",
    "À vontade",
    null,
    { unquantified: true }
  ),
});

function option(id, label, source, items, description = "") {
  return Object.freeze({ id, label, source, description, items: Object.freeze(items) });
}

export const VINI_MEALS = Object.freeze([
  Object.freeze({
    id: "pre_treino",
    icon: "🏃",
    label: "Pré-treino",
    time: "30 min antes",
    required: false,
    contextual: true,
    options: Object.freeze([
      option("pre_treino", "Banana + café", "IMG_3063.PNG", [
        item("banana", "Banana", "2 unidades médias · 80 g", nutrition(78, 1, 20.8, 0.1)),
        item("cafe", "Café coado (suave)", "1 xícara de chá · 200 ml", nutrition(2, 0.2, 0, 0)),
      ], "Antes da corrida (manhã) e/ou antes da musculação (tarde)."),
    ]),
  }),
  Object.freeze({
    id: "cafe_manha",
    icon: "🌅",
    label: "Café da manhã",
    required: true,
    options: Object.freeze([
      option("cafe_manha", "Composição prescrita", "IMG_3064.PNG", [
        item("ovos", "Ovos mexidos", "3 unidades · 150 g", nutrition(216, 18.9, 1.2, 14.4)),
        item("chia", "Semente de chia", "1 colher de sopa cheia · 15 g", nutrition(73, 2.5, 6.3, 4.6)),
        item("pao", "Pão de forma", "2 fatias · 50 g", nutrition(127, 4.7, 22, 1.9)),
        item("requeijao", "Requeijão light", "½ colher de sopa cheia · 15 g", nutrition(25, 1.6, 1, 1.6, "label-estimate")),
      ]),
    ]),
  }),
  Object.freeze({
    id: "almoco",
    icon: "☀️",
    label: "Almoço",
    required: true,
    options: Object.freeze([
      option("almoco_base", "Arroz + frango", "IMG_3065.PNG", [
        COMMON.vegetables50, COMMON.oliveOil5, COMMON.rice150, COMMON.chicken150,
      ]),
      option("almoco_frango_ovo", "Arroz + frango + ovo", "IMG_3066.PNG", [
        COMMON.vegetables50,
        COMMON.oliveOil5,
        COMMON.rice150,
        COMMON.chicken120,
        item("ovo_frito", "Ovo de galinha “frito”", "1 unidade · 50 g", nutrition(120, 6.3, 0.4, 10.1, "preparation-estimate")),
      ]),
      option("almoco_arroz_pure", "Arroz + purê + frango", "IMG_3068.PNG", [
        COMMON.vegetables50, COMMON.oliveOil5, COMMON.rice100, COMMON.puree105, COMMON.chicken150,
      ]),
      option("almoco_panqueca", "Panqueca + suco", "IMG_3069.PNG", [
        COMMON.pancake240, COMMON.pineappleJuice250,
      ]),
      option("almoco_bolonhesa", "Macarrão à bolonhesa", "IMG_3070.PNG", [
        COMMON.bolognese350, COMMON.freeSalad,
      ]),
    ]),
  }),
  Object.freeze({
    id: "lanche_tarde",
    icon: "🥪",
    label: "Lanche da tarde",
    time: "16:00",
    required: true,
    options: Object.freeze([
      option("lanche_proforce_maca", "Pro Force + maçã", "IMG_3071.PNG", [
        item("pro_force", "Pro Force Piracanjuba (23 g proteína)", "1 unidade · 250 g", nutrition(160, 23, 13, 1.8, "label-estimate")),
        item("maca", "Maçã", "1 unidade média · 130 g", nutrition(73, 0.4, 19.8, 0.3)),
      ]),
      option("lanche_verde_campo_maca", "Natural Whey + maçã", "IMG_3071.PNG", [
        item("natural_whey", "Iogurte proteico (21 g proteína) Natural Whey Verde Campo", "1 unidade · 250 g", nutrition(170, 21, 16, 2.5, "label-estimate")),
        item("maca", "Maçã", "1 unidade média · 130 g", nutrition(73, 0.4, 19.8, 0.3)),
      ]),
      option("lanche_vitamina_whey", "Vitamina com whey", "IMG_3072.PNG", [
        item("leite", "Leite semidesnatado", "1 copo médio · 200 ml", nutrition(92, 6.4, 9.6, 3.2)),
        item("whey", "100% Pure Whey Protein (Probiótica)", "1,5 medida · 23,3 g", nutrition(90, 17.3, 2.3, 1.1, "label-estimate")),
        item("banana", "Banana", "1 unidade média · 40 g", nutrition(39, 0.5, 10.4, 0.1)),
        item("morango", "Morango congelado", "3 unidades · 36 g", nutrition(11, 0.3, 2.5, 0.1), { optional: true }),
        item("farelo_aveia", "Farelo de aveia", "1 colher de sopa · 10 g", nutrition(25, 1.7, 6.6, 0.7)),
      ]),
      option("lanche_crepioca_frango", "Crepioca com frango", "IMG_3073.PNG", [
        item("crepioca", "Crepioca", "1 porção · 80 g", nutrition(160, 6, 25, 4, "recipe-estimate"), { estimatedRecipe: true }),
        item("requeijao", "Requeijão light", "1 colher de sopa cheia · 30 g", nutrition(50, 3.2, 2, 3.2, "label-estimate")),
        item("frango", "Frango desfiado", "3 colheres de sopa cheias · 60 g", nutrition(96, 19.2, 0, 1.5)),
      ]),
      option("lanche_ovos_pao", "Ovos com pão", "IMG_3074.PNG", [
        item("ovos", "Ovos mexidos", "3 unidades · 150 g", nutrition(216, 18.9, 1.2, 14.4)),
        item("pao", "Pão de forma", "2 fatias · 50 g", nutrition(127, 4.7, 22, 1.9)),
        item("requeijao", "Requeijão light", "½ colher de sopa cheia · 15 g", nutrition(25, 1.6, 1, 1.6, "label-estimate")),
      ], "Ovos mexidos ou pastinha de ovo (amassar e misturar bem com o requeijão, sal, temperinhos)."),
    ]),
  }),
  Object.freeze({
    id: "pos_treino",
    icon: "💪",
    label: "Após treino",
    required: false,
    contextual: true,
    options: Object.freeze([
      option("pos_treino_whey", "Whey", "IMG_3075.PNG", [
        item("whey", "100% Pure Whey Protein (Probiótica)", "2 medidas · 31 g", nutrition(120, 23, 3, 1.5, "label-estimate")),
      ]),
    ]),
  }),
  Object.freeze({
    id: "jantar",
    icon: "🌙",
    label: "Jantar",
    required: true,
    options: Object.freeze([
      option("jantar_base", "Arroz + frango", "IMG_3076.PNG", [
        COMMON.vegetables50, COMMON.oliveOil5, COMMON.rice150, COMMON.chicken150,
      ]),
      option("jantar_feijao_lentilha", "Arroz + frango + feijão/lentilha", "IMG_3077.PNG", [
        COMMON.vegetables50,
        COMMON.oliveOil5,
        COMMON.rice150,
        COMMON.chicken130,
        item("feijao_lentilha", "Feijão ou lentilha", "1 concha rasa · 80 g", nutrition(61, 3.8, 10.9, 0.4)),
      ]),
      option("jantar_arroz_pure", "Arroz + purê + frango", "IMG_3079.PNG", [
        COMMON.vegetables50, COMMON.oliveOil5, COMMON.rice100, COMMON.puree105, COMMON.chicken150,
      ]),
      option("jantar_panqueca", "Panqueca + suco", "IMG_3080.PNG", [
        COMMON.pancake240, COMMON.pineappleJuice250,
      ]),
      option("jantar_bolonhesa", "Macarrão à bolonhesa", "IMG_3081.PNG", [
        COMMON.bolognese350, COMMON.freeSalad,
      ]),
    ]),
  }),
  Object.freeze({
    id: "belisco",
    icon: "🍫",
    label: "“Belisco” eventual",
    required: false,
    contextual: true,
    options: Object.freeze([
      option("belisco_chocolate", "Chocolate meio amargo", "IMG_3082.PNG", [
        item("chocolate", "Chocolate meio amargo", "15 g", nutrition(80, 1.2, 6.9, 5.4, "label-estimate")),
      ]),
    ]),
  }),
]);

export const VINI_REQUIRED_MEALS = Object.freeze(
  VINI_MEALS.filter((meal) => meal.required).map((meal) => meal.id)
);

// Redação literal exibida no aplicativo da nutricionista. O tracker usa
// unidades normalizadas para calcular, enquanto a consulta preserva inclusive
// os plurais e o "ou" apresentados nos screenshots.
const OFFICIAL_PORTIONS = Object.freeze({
  "IMG_3063.PNG": Object.freeze({ banana: "2 unidade(s) média(s) ou 80g", cafe: "1 xícara(s) chá ou 200ml" }),
  "IMG_3064.PNG": Object.freeze({ ovos: "3 unidade(s) média(s) ou 150g", chia: "1 colher(es) de sopa cheia(s) ou 15g", pao: "2 fatia(s) ou 50g", requeijao: "½ colher(es) de sopa cheia(s) ou 15g" }),
  "IMG_3065.PNG": Object.freeze({ vegetais: "50 grama(s)", azeite: "1 colher(es) de sobremesa rasa(s) ou 5ml", arroz: "6 colher(es) de sopa cheia(s) ou 150g", frango: "150 grama(s)" }),
  "IMG_3066.PNG": Object.freeze({ vegetais: "50 grama(s)", azeite: "1 colher(es) de sobremesa rasa(s) ou 5ml", arroz: "6 colher(es) de sopa cheia(s) ou 150g", frango: "120 grama(s)", ovo_frito: "1 unidade(s) média(s) ou 50g" }),
  "IMG_3068.PNG": Object.freeze({ vegetais: "50 grama(s)", azeite: "1 colher(es) de sobremesa rasa(s) ou 5ml", arroz: "4 colher(es) de sopa cheia(s) ou 100g", pure_batata: "3 colher(es) de sopa cheia(s) ou 105g", frango: "150 grama(s)" }),
  "IMG_3069.PNG": Object.freeze({ panqueca_carne: "3 unidade(s) média(s) ou 240g", suco_abacaxi: "250 mililitro(s)" }),
  "IMG_3070.PNG": Object.freeze({ macarrao_bolonhesa: "350 grama(s)", salada_vontade: "À vontade" }),
  "IMG_3072.PNG": Object.freeze({ leite: "1 copo(s) médio(s) ou 200ml", whey: "1.5 medida(s) ou 23.3g", banana: "1 unidade(s) média(s) ou 40g", morango: "3 unidade(s) média(s) ou 36g", farelo_aveia: "1 colher(es) de sopa ou 10g" }),
  "IMG_3073.PNG": Object.freeze({ crepioca: "1 porção ou 80g", requeijao: "1 colher(es) de sopa cheia(s) ou 30g", frango: "3 colher(es) de sopa cheia(s) ou 60g" }),
  "IMG_3074.PNG": Object.freeze({ ovos: "3 unidade(s) média(s) ou 150g", pao: "2 fatia(s) ou 50g", requeijao: "½ colher(es) de sopa cheia(s) ou 15g" }),
  "IMG_3075.PNG": Object.freeze({ whey: "2 medida(s) ou 31g" }),
  "IMG_3076.PNG": Object.freeze({ vegetais: "50 grama(s)", azeite: "1 colher(es) de sobremesa rasa(s) ou 5ml", arroz: "6 colher(es) de sopa cheia(s) ou 150g", frango: "150 grama(s)" }),
  "IMG_3077.PNG": Object.freeze({ vegetais: "50 grama(s)", azeite: "1 colher(es) de sobremesa rasa(s) ou 5ml", arroz: "6 colher(es) de sopa cheia(s) ou 150g", frango: "130 grama(s)", feijao_lentilha: "1 concha(s) rasa(s) ou 80g" }),
  "IMG_3079.PNG": Object.freeze({ vegetais: "50 grama(s)", azeite: "1 colher(es) de sobremesa rasa(s) ou 5ml", arroz: "4 colher(es) de sopa cheia(s) ou 100g", pure_batata: "3 colher(es) de sopa cheia(s) ou 105g", frango: "150 grama(s)" }),
  "IMG_3080.PNG": Object.freeze({ panqueca_carne: "3 unidade(s) média(s) ou 240g", suco_abacaxi: "250 mililitro(s)" }),
  "IMG_3081.PNG": Object.freeze({ macarrao_bolonhesa: "350 grama(s)", salada_vontade: "À vontade" }),
  "IMG_3082.PNG": Object.freeze({ chocolate: "15 grama(s)" }),
});

const OFFICIAL_LABELS = Object.freeze({
  ovo_frito: "Ovo de galinha `frito`",
  salada_vontade: "Tomate cereja e repolho",
  morango: "Morango congelado (opcional)",
});

const OFFICIAL_DESCRIPTIONS = Object.freeze({
  "IMG_3063.PNG": "Antes da corrida (manhã) e/ou antes da musculação (tarde)",
  "IMG_3074.PNG": "Ovos mexidos ou pastinha de ovo (amassar e misturar bem com o requeijão, sal, temperinhos)",
});

const OFFICIAL_MEAL_LABELS = Object.freeze({
  pre_treino: "Pré-treino (30 min antes)",
  lanche_tarde: "16:00 - Lanche da tarde",
  belisco: '"Beliscos" eventuais',
});

function officialOption(option_) {
  const portions = OFFICIAL_PORTIONS[option_.source] || {};
  return Object.freeze({
    ...option_,
    description: OFFICIAL_DESCRIPTIONS[option_.source] ?? option_.description,
    items: Object.freeze(option_.items.map((entry) => Object.freeze({
      ...entry,
      label: OFFICIAL_LABELS[entry.id] || entry.label,
      portion: portions[entry.id] || entry.portion,
    }))),
  });
}

// Visualização fiel ao aplicativo da nutricionista. No lanche das 16h o
// Pro Force e o Natural Whey aparecem como alternativas dentro da mesma
// refeição, embora o tracker os exponha separadamente para registro.
export const VINI_OFFICIAL_MEALS = Object.freeze(VINI_MEALS.map((meal) => {
  if (meal.id !== "lanche_tarde") {
    return Object.freeze({
      ...meal,
      label: OFFICIAL_MEAL_LABELS[meal.id] || meal.label,
      options: Object.freeze(meal.options.map(officialOption)),
    });
  }
  const remainingOptions = meal.options.filter((entry) => (
    !["lanche_proforce_maca", "lanche_verde_campo_maca"].includes(entry.id)
  ));
  const officialProteinSnack = Object.freeze({
    id: "lanche_produto_proteico_maca",
    label: "Produto proteico + maçã",
    source: "IMG_3071.PNG",
    description: "",
    items: Object.freeze([
      Object.freeze({
        id: "produto_proteico",
        label: "Pro Force Piracanjuba (23g proteína) ou Iogurte proteico (21g proteína) Natural Whey Verde Campo",
        portion: "1 unidade(s) ou 250g",
      }),
      Object.freeze({
        id: "maca",
        label: "Maçã",
        portion: "1 unidade(s) média(s) ou 130g",
      }),
    ]),
  });
  return Object.freeze({
    ...meal,
    label: OFFICIAL_MEAL_LABELS[meal.id] || meal.label,
    options: Object.freeze([officialProteinSnack, ...remainingOptions.map(officialOption)]),
  });
}));

export const VINI_HYDRATION = Object.freeze({
  baseMl: 2500,
  trainingMinMl: 3000,
  trainingMaxMl: 3500,
});

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function foodEntryId(entry) {
  return `${entry.id}__${slug(entry.portion)}`;
}

const QUANTITY_RULES = Object.freeze({
  banana: { unit: "un", values: [1, 2, 3, 4, 5] },
  cafe: { unit: "ml", values: [100, 150, 200, 250, 300, 400, 500] },
  ovos: { unit: "un", values: [1, 2, 3, 4, 5, 6] },
  chia: { unit: "g", values: [5, 10, 15, 20, 25, 30] },
  pao: { unit: "fatia", values: [1, 2, 3, 4, 5, 6] },
  requeijao: { unit: "g", values: [10, 15, 20, 30, 40, 50, 60] },
  pasta_amendoim_amendopower: { unit: "g", values: [15, 20, 25, 30, 35, 40, 45, 50, 60] },
  vegetais: { unit: "g", values: [50, 70, 100, 150, 200, 250] },
  azeite: { unit: "ml", values: [5, 10, 15, 20, 25] },
  arroz: { unit: "g", values: [50, 80, 100, 130, 150, 180, 200, 250, 300] },
  frango: { unit: "g", values: [50, 80, 100, 120, 130, 150, 180, 200, 250, 300] },
  guisado: { unit: "g", values: [50, 80, 100, 120, 130, 150, 180, 200, 250, 300] },
  ovo_frito: { unit: "un", values: [1, 2, 3, 4, 5, 6] },
  pure_batata: { unit: "g", values: [50, 80, 100, 105, 130, 150, 180, 200, 250] },
  panqueca_carne: { unit: "un", values: [1, 2, 3, 4, 5] },
  suco_abacaxi: { unit: "ml", values: [100, 150, 200, 250, 300, 400, 500] },
  macarrao_bolonhesa: { unit: "g", values: [150, 200, 250, 300, 350, 400, 450, 500] },
  pro_force: { unit: "un", values: [1, 2, 3] },
  natural_whey: { unit: "un", values: [1, 2, 3] },
  maca: { unit: "un", values: [1, 2, 3, 4, 5] },
  leite: { unit: "ml", values: [100, 150, 200, 250, 300, 400, 500] },
  whey: { unit: "medida", values: [0.5, 1, 1.5, 2, 2.5, 3] },
  morango: { unit: "un", values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  farelo_aveia: { unit: "g", values: [5, 10, 15, 20, 25, 30] },
  crepioca: { unit: "porcao", values: [1, 2, 3] },
  feijao_lentilha: { unit: "g", values: [40, 80, 120, 160, 200] },
  chocolate: { unit: "g", values: [5, 10, 15, 20, 25, 30, 40] },
  pao_alho_santa_massa: { unit: "un", values: [1, 2, 3, 4] },
  carne_churrasco: { unit: "g", values: [100, 150, 200, 250, 300, 350, 400, 500] },
  salsichao: { unit: "g", values: [35, 50, 70, 100, 140, 200] },
  coracao_galinha: { unit: "g", values: [25, 50, 70, 100, 150, 200] },
});

// Itens adicionados ao tracker para refeições usuais do Vini, sem alterar a
// visualização "Dieta Oficial", que continua fiel apenas aos screenshots da
// nutricionista. O guisado usa a mesma referência estimada de carne do
// cardápio genérico: 220 kcal, 26 g P e 12 g G por 100 g.
const GUISADO_120 = item(
  "guisado",
  "Guisado (carne moída)",
  "120 g",
  nutrition(264, 31.2, 0, 14.4, "recipe-estimate"),
  { estimatedRecipe: true }
);

// Referência do rótulo da Amendopower Cookies & Cream 450 g: porção de 15 g
// com 87 kcal, 3,2 g P, 3,7 g C e 6,6 g G. O preset usa 15 g.
const PASTA_AMENDOIM_AMENDOPOWER = item(
  "pasta_amendoim_amendopower",
  "Amendopower Cookies & Cream",
  "1 colher de sopa · 15 g",
  nutrition(87, 3.2, 3.7, 6.6, "label-estimate")
);

// Pão Santa Massa: o rótulo oficial informa 122 kcal, 2,9 g P, 17 g C e
// 4,8 g G por meia unidade (40 g); uma unidade de 80 g usa o dobro.
// Os demais itens são médias de churrasco e variam conforme corte e preparo.
const CHURRASCO_FOODS = Object.freeze([
  item(
    "pao_alho_santa_massa",
    "Pão de alho Santa Massa",
    "1 unidade · 80 g",
    nutrition(244, 5.8, 34, 9.6, "manufacturer-label")
  ),
  item(
    "carne_churrasco",
    "Carne de churrasco",
    "300 g",
    nutrition(750, 78, 0, 51, "generic-estimate"),
    { estimatedRecipe: true }
  ),
  item(
    "salsichao",
    "Salsichão",
    "70 g",
    nutrition(210, 9.8, 0.7, 18.2, "generic-estimate"),
    { estimatedRecipe: true }
  ),
  item(
    "coracao_galinha",
    "Coração de galinha",
    "50 g",
    nutrition(93, 13, 0, 4, "generic-estimate"),
    { estimatedRecipe: true }
  ),
]);

const VINI_TRACKER_EXTRA_FOODS = Object.freeze({
  almoco: Object.freeze([GUISADO_120]),
  lanche_tarde: Object.freeze([PASTA_AMENDOIM_AMENDOPOWER]),
  jantar: Object.freeze([GUISADO_120, ...CHURRASCO_FOODS]),
});

function parseLocaleNumber(value) {
  return Number(String(value || "").replace(",", "."));
}

function quantityFromEntry(entry, unit) {
  const patterns = {
    un: /(\d+(?:[.,]\d+)?)\s*unidade/i,
    fatia: /(\d+(?:[.,]\d+)?)\s*fatia/i,
    medida: /(\d+(?:[.,]\d+)?)\s*medida/i,
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

export function formatFoodQuantity(food, quantity) {
  const value = formatQuantityValue(quantity);
  if (food?.quantityUnit === "un") return `${value} un`;
  if (food?.quantityUnit === "fatia") return `${value} ${Number(quantity) === 1 ? "fatia" : "fatias"}`;
  if (food?.quantityUnit === "medida") return `${value} ${Number(quantity) === 1 ? "medida" : "medidas"}`;
  if (food?.quantityUnit === "porcao") return `${value} ${Number(quantity) === 1 ? "porção" : "porções"}`;
  return `${value}${food?.quantityUnit || ""}`;
}

// Catálogo achatado para a UX. Cada alimento aparece uma única vez por
// momento do dia; as porções prescritas viram valores iniciais dentro do
// seletor de quantidade.
function buildFoodGroups() {
  return VINI_MEALS.map((meal) => {
    const foodsByBaseId = new Map();
    const addEntry = (entry, sourceOption) => {
      if (!foodsByBaseId.has(entry.id)) {
        foodsByBaseId.set(entry.id, {
          ...entry,
          id: entry.id,
          baseId: entry.id,
          sourceOptions: new Set(),
          variants: [],
        });
      }
      const food = foodsByBaseId.get(entry.id);
      food.sourceOptions.add(sourceOption);
      if (!food.variants.some((variant) => variant.portion === entry.portion)) food.variants.push(entry);
    };

    for (const option_ of meal.options) {
      for (const entry of option_.items) {
        addEntry(entry, option_.id);
      }
    }
    for (const entry of VINI_TRACKER_EXTRA_FOODS[meal.id] || []) {
      addEntry(entry, "tracker_extra");
    }

    const foods = [...foodsByBaseId.values()].map((entry) => {
      if (entry.unquantified) {
        return Object.freeze({
          ...entry,
          sourceOptions: Object.freeze([...entry.sourceOptions]),
          variants: Object.freeze(entry.variants),
          quantityUnit: null,
          quantityChoices: Object.freeze([]),
          defaultQuantity: 1,
          referenceQuantity: 1,
          prescribedQuantities: Object.freeze([]),
        });
      }
      const rule = QUANTITY_RULES[entry.baseId] || { unit: "g", values: [50, 100, 150, 200, 250] };
      const prescribedQuantities = [...new Set(entry.variants.map((variant) => quantityFromEntry(variant, rule.unit)))];
      const defaultQuantity = prescribedQuantities[0] || rule.values[0];
      const quantityChoices = [...new Set([...rule.values, ...prescribedQuantities])].sort((a, b) => a - b);
      return Object.freeze({
        ...entry,
        sourceOptions: Object.freeze([...entry.sourceOptions]),
        variants: Object.freeze(entry.variants),
        quantityUnit: rule.unit,
        quantityChoices: Object.freeze(quantityChoices),
        defaultQuantity,
        referenceQuantity: quantityFromEntry(entry, rule.unit),
        prescribedQuantities: Object.freeze(prescribedQuantities),
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

export const VINI_FOOD_GROUPS = Object.freeze(buildFoodGroups());

export function mealForId(mealId) {
  return VINI_MEALS.find((meal) => meal.id === mealId) || null;
}

export function optionForMeal(meal, optionId) {
  return meal?.options.find((option_) => option_.id === optionId) || null;
}

export function foodGroupForId(groupId) {
  return VINI_FOOD_GROUPS.find((group) => group.id === groupId) || null;
}

export function foodForGroup(group, foodId) {
  return group?.foods.find((food) => food.id === foodId) || null;
}

export function beverageForId(beverageId) {
  return VINI_BEVERAGES.find((beverage) => beverage.id === beverageId) || null;
}

export function nutritionForBeverageCount(beverage, value) {
  if (!beverage?.nutrition) return null;
  const count = Math.max(0, Math.min(99, Math.round(finiteNumber(value))));
  return roundedNutrition({
    kcal: finiteNumber(beverage.nutrition.kcal) * count,
    p: finiteNumber(beverage.nutrition.p) * count,
    c: finiteNumber(beverage.nutrition.c) * count,
    f: finiteNumber(beverage.nutrition.f) * count,
  });
}

export function normalizeFoodQuantity(food, value) {
  if (!food || food.unquantified) return 1;
  const amount = finiteNumber(value, food.defaultQuantity);
  return food.quantityChoices.some((choice) => Math.abs(choice - amount) < 0.001)
    ? amount
    : food.defaultQuantity;
}

export function nutritionForFoodQuantity(food, value) {
  if (!food?.nutrition) return null;
  const quantity = normalizeFoodQuantity(food, value);
  const reference = Math.max(0.001, finiteNumber(food.referenceQuantity, 1));
  const ratio = quantity / reference;
  return roundedNutrition({
    kcal: finiteNumber(food.nutrition.kcal) * ratio,
    p: finiteNumber(food.nutrition.p) * ratio,
    c: finiteNumber(food.nutrition.c) * ratio,
    f: finiteNumber(food.nutrition.f) * ratio,
  });
}

export function emptyViniDietDay() {
  return {
    version: VINI_PLAN_VERSION,
    meals: {},
    foods: {},
    amounts: {},
    beverages: {},
    hydrationMl: 0,
    trainingDay: false,
    exercises: {},
    exerciseWeightKg: 0,
    summary: null,
  };
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanNutrition(value) {
  return {
    kcal: Math.max(0, finiteNumber(value?.kcal)),
    p: Math.max(0, finiteNumber(value?.p)),
    c: Math.max(0, finiteNumber(value?.c)),
    f: Math.max(0, finiteNumber(value?.f)),
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
    requiredMeals: Math.max(0, finiteNumber(summary.requiredMeals, VINI_REQUIRED_MEALS.length)),
    itemsChecked: Math.max(0, finiteNumber(summary.itemsChecked)),
    beverageCount: Math.max(0, finiteNumber(summary.beverageCount)),
    mainMealsLogged: Math.max(0, finiteNumber(summary.mainMealsLogged, summary.completedMeals)),
    mealCoveragePct: Math.max(0, Math.min(100, finiteNumber(summary.mealCoveragePct, summary.adherencePct))),
    hydrationMl: Math.max(0, finiteNumber(summary.hydrationMl)),
    hydrationTargetMl: Math.max(0, finiteNumber(summary.hydrationTargetMl)),
    hydrationPct: Math.max(0, finiteNumber(summary.hydrationPct)),
  };
}

function quantityFromLegacyFoodId(legacyFoodId, unit) {
  const suffix = String(legacyFoodId || "").split("__")[1] || "";
  const patterns = {
    un: /^(\d+)(?:_(\d+))?_unidade/,
    fatia: /^(\d+)(?:_(\d+))?_fatia/,
    medida: /^(\d+)(?:_(\d+))?_medida/,
    porcao: /^(\d+)(?:_(\d+))?_porcao/,
    g: /(\d+)(?:_(\d+))?_g$/,
    ml: /(\d+)(?:_(\d+))?_ml$/,
  };
  const match = suffix.match(patterns[unit]);
  if (!match) return null;
  const value = Number(`${match[1]}${match[2] ? `.${match[2]}` : ""}`);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function legacyFoodDescriptor(groupId, legacyFoodId) {
  const meal = mealForId(groupId);
  const baseId = String(legacyFoodId || "").split("__")[0];
  const rule = QUANTITY_RULES[baseId];
  const inferredAmount = rule ? quantityFromLegacyFoodId(legacyFoodId, rule.unit) : null;
  const candidates = [];
  for (const option_ of meal?.options || []) {
    for (const entry of option_.items) {
      if (entry.id === baseId && !candidates.some((candidate) => candidate.portion === entry.portion)) candidates.push(entry);
      if (foodEntryId(entry) === legacyFoodId) {
        return { id: entry.id, amount: quantityFromEntry(entry, rule?.unit || "g"), entry };
      }
    }
  }
  const entry = candidates.find((candidate) => (
    inferredAmount !== null && quantityFromEntry(candidate, rule?.unit || "g") === inferredAmount
  )) || candidates[0];
  if (entry) return { id: entry.id, amount: inferredAmount, entry };
  return null;
}

export function normalizeViniDietDay(raw) {
  const out = emptyViniDietDay();
  out.version = String(raw?.version || VINI_PLAN_VERSION);
  out.hydrationMl = Math.max(0, Math.min(10000, Math.round(finiteNumber(raw?.hydrationMl))));
  out.exercises = normalizeViniExercises(raw?.exercises);
  out.exerciseWeightKg = Math.max(0, Math.round(finiteNumber(raw?.exerciseWeightKg) * 10) / 10);
  out.trainingDay = raw?.trainingDay === true || hasViniExercise(out.exercises);
  out.summary = cleanSummary(raw?.summary);

  for (const beverage of VINI_BEVERAGES) {
    const count = Math.max(0, Math.min(99, Math.round(finiteNumber(raw?.beverages?.[beverage.id]))));
    if (count > 0) out.beverages[beverage.id] = count;
  }

  for (const meal of VINI_MEALS) {
    const source = raw?.meals?.[meal.id];
    if (!source) continue;
    const selectedOption = optionForMeal(meal, source.optionId);
    if (!selectedOption) continue;
    const validItems = new Set(selectedOption.items.map((entry) => entry.id));
    const checked = [...new Set(Array.isArray(source.checked) ? source.checked : [])]
      .filter((itemId) => validItems.has(itemId));
    out.meals[meal.id] = { optionId: selectedOption.id, checked };
  }

  const hasIndividualFoods = raw?.foods && typeof raw.foods === "object";
  for (const group of VINI_FOOD_GROUPS) {
    const valid = new Set(group.foods.map((food) => food.id));
    let selected = [];

    if (hasIndividualFoods && Array.isArray(raw.foods[group.id])) {
      selected = raw.foods[group.id].map((rawFoodId) => {
        if (valid.has(rawFoodId)) return { id: rawFoodId, rawId: rawFoodId, amount: null };
        const legacy = legacyFoodDescriptor(group.id, rawFoodId);
        if (!legacy) return null;
        const rule = QUANTITY_RULES[legacy.id];
        return {
          id: legacy.id,
          rawId: rawFoodId,
          amount: legacy.amount ?? (rule ? quantityFromEntry(legacy.entry, rule.unit) : null),
        };
      }).filter(Boolean);
    }

    // Migração transparente da v1 (opções) para alimentos com quantidade.
    if (!hasIndividualFoods) {
      const legacy = out.meals[group.id];
      const meal = mealForId(group.id);
      const option_ = optionForMeal(meal, legacy?.optionId);
      if (option_) {
        selected = option_.items
          .filter((entry) => legacy.checked.includes(entry.id))
          .map((entry) => {
            const rule = QUANTITY_RULES[entry.id];
            return {
              id: entry.id,
              rawId: foodEntryId(entry),
              amount: rule ? quantityFromEntry(entry, rule.unit) : null,
            };
          });
      }
    }

    const cleanedById = new Map();
    for (const descriptor of selected) {
      if (!valid.has(descriptor.id)) continue;
      cleanedById.set(descriptor.id, descriptor);
    }
    if (cleanedById.size) {
      const order = new Map(group.foods.map((food, index) => [food.id, index]));
      const cleaned = [...cleanedById.values()].sort((a, b) => order.get(a.id) - order.get(b.id));
      out.foods[group.id] = cleaned.map((descriptor) => descriptor.id);
      out.amounts[group.id] = {};
      for (const descriptor of cleaned) {
        const food = foodForGroup(group, descriptor.id);
        const rawAmounts = raw?.amounts?.[group.id];
        const savedAmount = rawAmounts?.[descriptor.id] ?? rawAmounts?.[descriptor.rawId];
        out.amounts[group.id][descriptor.id] = normalizeFoodQuantity(
          food,
          savedAmount ?? descriptor.amount ?? food.defaultQuantity
        );
      }
    }
  }
  return out;
}

export function setViniBeverageCount(rawDay, beverageId, value) {
  const day = normalizeViniDietDay(rawDay);
  const beverage = beverageForId(beverageId);
  if (!beverage) return day;
  const count = Math.max(0, Math.min(99, Math.round(finiteNumber(value))));
  if (count > 0) day.beverages[beverage.id] = count;
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

function roundedNutrition(value) {
  return {
    kcal: Math.round(value.kcal),
    p: Math.round(value.p * 10) / 10,
    c: Math.round(value.c * 10) / 10,
    f: Math.round(value.f * 10) / 10,
  };
}

export function calculateViniDietDay(raw, { useSnapshot = false } = {}) {
  const day = normalizeViniDietDay(raw);
  const consumed = { ...ZERO };
  const foodGroups = {};
  let itemsChecked = 0;
  let quantifiedItemsChecked = 0;
  let unquantifiedItemsChecked = 0;
  let beverageCount = 0;

  for (const group of VINI_FOOD_GROUPS) {
    const selectedIds = day.foods[group.id] || [];
    const selectedFoods = selectedIds.map((foodId) => foodForGroup(group, foodId)).filter(Boolean);
    const selectedAmounts = {};
    for (const food of selectedFoods) {
      const amount = normalizeFoodQuantity(food, day.amounts[group.id]?.[food.id]);
      selectedAmounts[food.id] = amount;
      itemsChecked += 1;
      if (food.nutrition) quantifiedItemsChecked += 1;
      else unquantifiedItemsChecked += 1;
      addNutrition(consumed, nutritionForFoodQuantity(food, amount));
    }
    foodGroups[group.id] = {
      group,
      selectedIds,
      selectedFoods,
      selectedAmounts,
      hasFood: selectedFoods.length > 0,
    };
  }

  for (const beverage of VINI_BEVERAGES) {
    const count = day.beverages[beverage.id] || 0;
    if (!count) continue;
    beverageCount += count;
    addNutrition(consumed, nutritionForBeverageCount(beverage, count));
  }

  const mainMealsLogged = VINI_REQUIRED_MEALS.filter((groupId) => foodGroups[groupId]?.hasFood).length;
  const mealCoveragePct = VINI_REQUIRED_MEALS.length
    ? Math.round((mainMealsLogged / VINI_REQUIRED_MEALS.length) * 100)
    : 0;
  const hydrationTargetMl = day.trainingDay ? VINI_HYDRATION.trainingMinMl : VINI_HYDRATION.baseMl;
  const hydrationPct = hydrationTargetMl > 0 ? Math.round((day.hydrationMl / hydrationTargetMl) * 100) : 0;
  const exercise = estimateViniExercises(day.exercises, day.exerciseWeightKg);
  const roundedConsumed = roundedNutrition(consumed);
  const netKcal = roundedConsumed.kcal - exercise.totalKcal;
  const hasData = day.hydrationMl > 0
    || day.trainingDay
    || exercise.items.length > 0
    || itemsChecked > 0
    || beverageCount > 0;

  const result = {
    day,
    consumed: roundedConsumed,
    planned: { ...ZERO },
    exercises: exercise.items,
    exerciseKcal: exercise.totalKcal,
    netKcal,
    exerciseWeightKg: day.exerciseWeightKg,
    foodGroups,
    adherencePct: mealCoveragePct,
    completedMeals: mainMealsLogged,
    requiredMeals: VINI_REQUIRED_MEALS.length,
    mainMealsLogged,
    mealCoveragePct,
    itemsChecked,
    beverageCount,
    quantifiedItemsChecked,
    unquantifiedItemsChecked,
    hydrationMl: day.hydrationMl,
    hydrationTargetMl,
    hydrationPct,
    hasData,
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
    result.mainMealsLogged = day.summary.mainMealsLogged;
    result.mealCoveragePct = day.summary.mealCoveragePct;
    result.hydrationMl = day.summary.hydrationMl;
    result.hydrationTargetMl = day.summary.hydrationTargetMl;
    result.hydrationPct = day.summary.hydrationPct;
    result.hasData = true;
  }
  return result;
}

export function withViniDietSummary(raw) {
  const day = normalizeViniDietDay(raw);
  const calculated = calculateViniDietDay(day);
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
    mainMealsLogged: calculated.mainMealsLogged,
    mealCoveragePct: calculated.mealCoveragePct,
    hydrationMl: calculated.hydrationMl,
    hydrationTargetMl: calculated.hydrationTargetMl,
    hydrationPct: calculated.hydrationPct,
  };
  return day;
}

export function optionNutrition(option_) {
  const total = { ...ZERO };
  for (const entry of option_?.items || []) {
    if (!entry.optional) addNutrition(total, entry.nutrition);
  }
  return roundedNutrition(total);
}
