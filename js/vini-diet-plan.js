// Plano alimentar estruturado do Vini.
// Fonte das porções: DIETA_VINI.md e screenshots em dieta_vini/.
//
// Os valores nutricionais são estimativas de acompanhamento, não uma nova
// prescrição. Alimentos simples usam referências compatíveis com TACO/TBCA;
// produtos e receitas sem rótulo/ficha técnica usam aproximações explícitas.

export const VINI_PLAN_VERSION = "vini-nutri-2026-07-v1";

const ZERO = Object.freeze({ kcal: 0, p: 0, c: 0, f: 0 });

function nutrition(kcal, p, c, f, quality = "reference") {
  return Object.freeze({ kcal, p, c, f, quality });
}

function item(id, label, portion, nutri, extra = {}) {
  return Object.freeze({ id, label, portion, nutrition: nutri, ...extra });
}

const COMMON = Object.freeze({
  vegetables50: item("vegetais", "Verdura ou legumes", "50 g", nutrition(15, 0.7, 3, 0.1)),
  oliveOil5: item("azeite", "Azeite de oliva extravirgem", "5 ml", nutrition(41, 0, 0, 4.6)),
  rice150: item("arroz", "Arroz branco cozido", "150 g", nutrition(192, 3.8, 42.2, 0.3)),
  rice100: item("arroz", "Arroz branco cozido", "100 g", nutrition(128, 2.5, 28.1, 0.2)),
  chicken150: item("frango", "Frango grelhado", "150 g", nutrition(239, 48, 0, 3.8)),
  chicken130: item("frango", "Frango grelhado", "130 g", nutrition(207, 41.6, 0, 3.3)),
  chicken120: item("frango", "Frango grelhado", "120 g", nutrition(191, 38.4, 0, 3)),
  puree105: item(
    "pure_batata",
    "Purê de batata inglesa com sal",
    "105 g",
    nutrition(116, 2, 17.6, 4.2, "recipe-estimate"),
    { estimatedRecipe: true }
  ),
  pancake240: item(
    "panqueca_carne",
    "Panqueca com carne moída, molho de tomate e sal",
    "3 unidades · 240 g",
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
        item("cafe", "Café coado suave", "200 ml", nutrition(2, 0.2, 0, 0)),
      ], "Antes da corrida e/ou da musculação."),
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
        item("chia", "Semente de chia", "15 g", nutrition(73, 2.5, 6.3, 4.6)),
        item("pao", "Pão de forma", "2 fatias · 50 g", nutrition(127, 4.7, 22, 1.9)),
        item("requeijao", "Requeijão light", "15 g", nutrition(25, 1.6, 1, 1.6, "label-estimate")),
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
      ], "Arroz e purê aparecem juntos nesta opção."),
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
        item("pro_force", "Pro Force Piracanjuba", "1 unidade · 250 g", nutrition(160, 23, 13, 1.8, "label-estimate")),
        item("maca", "Maçã", "1 unidade média · 130 g", nutrition(73, 0.4, 19.8, 0.3)),
      ]),
      option("lanche_verde_campo_maca", "Natural Whey + maçã", "IMG_3071.PNG", [
        item("natural_whey", "Natural Whey Verde Campo", "1 unidade · 250 g", nutrition(170, 21, 16, 2.5, "label-estimate")),
        item("maca", "Maçã", "1 unidade média · 130 g", nutrition(73, 0.4, 19.8, 0.3)),
      ]),
      option("lanche_vitamina_whey", "Vitamina com whey", "IMG_3072.PNG", [
        item("leite", "Leite semidesnatado", "200 ml", nutrition(92, 6.4, 9.6, 3.2)),
        item("whey", "100% Pure Whey Protein", "1,5 medida · 23,3 g", nutrition(90, 17.3, 2.3, 1.1, "label-estimate")),
        item("banana", "Banana", "1 unidade média · 40 g", nutrition(39, 0.5, 10.4, 0.1)),
        item("morango", "Morango congelado", "3 unidades · 36 g", nutrition(11, 0.3, 2.5, 0.1), { optional: true }),
        item("farelo_aveia", "Farelo de aveia", "10 g", nutrition(25, 1.7, 6.6, 0.7)),
      ]),
      option("lanche_crepioca_frango", "Crepioca com frango", "IMG_3073.PNG", [
        item("crepioca", "Crepioca", "1 porção · 80 g", nutrition(160, 6, 25, 4, "recipe-estimate"), { estimatedRecipe: true }),
        item("requeijao", "Requeijão light", "30 g", nutrition(50, 3.2, 2, 3.2, "label-estimate")),
        item("frango", "Frango desfiado", "60 g", nutrition(96, 19.2, 0, 1.5)),
      ]),
      option("lanche_ovos_pao", "Ovos com pão", "IMG_3074.PNG", [
        item("ovos", "Ovos mexidos", "3 unidades · 150 g", nutrition(216, 18.9, 1.2, 14.4)),
        item("pao", "Pão de forma", "2 fatias · 50 g", nutrition(127, 4.7, 22, 1.9)),
        item("requeijao", "Requeijão light", "15 g", nutrition(25, 1.6, 1, 1.6, "label-estimate")),
      ], "Também pode ser preparado como pastinha de ovo."),
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
        item("whey", "100% Pure Whey Protein", "2 medidas · 31 g", nutrition(120, 23, 3, 1.5, "label-estimate")),
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
      ], "Arroz e purê aparecem juntos nesta opção."),
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

export const VINI_HYDRATION = Object.freeze({
  baseMl: 2500,
  trainingMinMl: 3000,
  trainingMaxMl: 3500,
});

export function mealForId(mealId) {
  return VINI_MEALS.find((meal) => meal.id === mealId) || null;
}

export function optionForMeal(meal, optionId) {
  return meal?.options.find((option_) => option_.id === optionId) || null;
}

export function emptyViniDietDay() {
  return {
    version: VINI_PLAN_VERSION,
    meals: {},
    hydrationMl: 0,
    trainingDay: false,
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
  return {
    planVersion,
    consumed: cleanNutrition(summary.consumed),
    planned: cleanNutrition(summary.planned),
    adherencePct: Math.max(0, Math.min(100, finiteNumber(summary.adherencePct))),
    completedMeals: Math.max(0, finiteNumber(summary.completedMeals)),
    requiredMeals: Math.max(0, finiteNumber(summary.requiredMeals, VINI_REQUIRED_MEALS.length)),
    itemsChecked: Math.max(0, finiteNumber(summary.itemsChecked)),
    hydrationMl: Math.max(0, finiteNumber(summary.hydrationMl)),
    hydrationTargetMl: Math.max(0, finiteNumber(summary.hydrationTargetMl)),
    hydrationPct: Math.max(0, finiteNumber(summary.hydrationPct)),
  };
}

export function normalizeViniDietDay(raw) {
  const out = emptyViniDietDay();
  out.version = String(raw?.version || VINI_PLAN_VERSION);
  out.hydrationMl = Math.max(0, Math.min(10000, Math.round(finiteNumber(raw?.hydrationMl))));
  out.trainingDay = raw?.trainingDay === true;
  out.summary = cleanSummary(raw?.summary);

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
  return out;
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
  const planned = { ...ZERO };
  const meals = {};
  let itemsChecked = 0;
  let quantifiedItemsChecked = 0;
  let unquantifiedItemsChecked = 0;

  for (const meal of VINI_MEALS) {
    const selection = day.meals[meal.id] || null;
    const selectedOption = optionForMeal(meal, selection?.optionId);
    const checked = new Set(selection?.checked || []);
    const requiredItems = selectedOption?.items.filter((entry) => !entry.optional) || [];
    const checkedRequired = requiredItems.filter((entry) => checked.has(entry.id)).length;

    if (selectedOption) {
      for (const entry of selectedOption.items) {
        if (!entry.optional) addNutrition(planned, entry.nutrition);
        if (!checked.has(entry.id)) continue;
        itemsChecked += 1;
        if (entry.nutrition) quantifiedItemsChecked += 1;
        else unquantifiedItemsChecked += 1;
        addNutrition(consumed, entry.nutrition);
      }
    }

    const completion = selectedOption && requiredItems.length
      ? checkedRequired / requiredItems.length
      : 0;
    meals[meal.id] = {
      meal,
      option: selectedOption,
      checked: [...checked],
      completion,
      complete: completion >= 1,
    };
  }

  const requiredResults = VINI_REQUIRED_MEALS.map((mealId) => meals[mealId]);
  const adherencePct = requiredResults.length
    ? Math.round((requiredResults.reduce((sum, entry) => sum + entry.completion, 0) / requiredResults.length) * 100)
    : 0;
  const completedMeals = requiredResults.filter((entry) => entry.complete).length;
  const hydrationTargetMl = day.trainingDay ? VINI_HYDRATION.trainingMinMl : VINI_HYDRATION.baseMl;
  const hydrationPct = hydrationTargetMl > 0 ? Math.round((day.hydrationMl / hydrationTargetMl) * 100) : 0;
  const hasData = day.hydrationMl > 0
    || day.trainingDay
    || Object.values(day.meals).some((selection) => selection.optionId || selection.checked.length);

  const result = {
    day,
    consumed: roundedNutrition(consumed),
    planned: roundedNutrition(planned),
    meals,
    adherencePct,
    completedMeals,
    requiredMeals: VINI_REQUIRED_MEALS.length,
    itemsChecked,
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
    result.adherencePct = day.summary.adherencePct;
    result.completedMeals = day.summary.completedMeals;
    result.requiredMeals = day.summary.requiredMeals;
    result.itemsChecked = day.summary.itemsChecked;
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
    adherencePct: calculated.adherencePct,
    completedMeals: calculated.completedMeals,
    requiredMeals: calculated.requiredMeals,
    itemsChecked: calculated.itemsChecked,
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
