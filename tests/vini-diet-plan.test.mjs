import assert from "node:assert/strict";
import {
  VINI_BEVERAGES,
  VINI_FOOD_GROUPS,
  VINI_DAILY_GOALS,
  VINI_MEALS,
  VINI_OFFICIAL_MEALS,
  VINI_PLAN_VERSION,
  VINI_REQUIRED_MEALS,
  calculateViniDietDay,
  emptyViniDietDay,
  normalizeViniDietDay,
  nutritionForBeverageCount,
  optionNutrition,
  setViniBeverageCount,
  withViniDietSummary,
} from "../js/vini-diet-plan.js";
import { TRACKING_SCOPE, trackingScopeCopy } from "../js/tracking-cycle.js";
import { viniOfficialDietHTML } from "../js/vini-official-diet.js";

const group = (id) => VINI_FOOD_GROUPS.find((entry) => entry.id === id);
const food = (groupId, baseId) => group(groupId).foods.find((entry) => entry.baseId === baseId);

const empty = calculateViniDietDay(emptyViniDietDay());
assert.equal(empty.hasData, false);
assert.equal(empty.itemsChecked, 0);
assert.equal(empty.beverageCount, 0);
assert.equal(empty.mainMealsLogged, 0);
assert.equal(empty.consumed.kcal, 0);
assert.equal(VINI_PLAN_VERSION, "vini-nutri-2026-07-v8");
assert.deepEqual(VINI_DAILY_GOALS, { kcal: 2000, p: 150, c: 200, f: 68 });
assert.equal(VINI_FOOD_GROUPS.length, 7);
assert.deepEqual(VINI_BEVERAGES.map((entry) => entry.id), ["cerveja", "destilado", "energetico_normal"]);
assert.equal(trackingScopeCopy(TRACKING_SCOPE.OFFICIAL_DIET).title, "Dieta Oficial");
assert.ok(food("almoco", "guisado").quantityChoices.includes(120));
assert.ok(food("jantar", "guisado").quantityChoices.includes(120));
assert.ok(food("almoco", "vegetais").quantityChoices.includes(70));
assert.ok(food("jantar", "pao_alho_santa_massa").quantityChoices.includes(1));
assert.ok(food("jantar", "carne_churrasco").quantityChoices.includes(300));
assert.deepEqual(
  food("lanche_tarde", "pasta_amendoim_amendopower").quantityChoices,
  [15, 20, 25, 30, 35, 40, 45, 50, 60],
);

for (const foodGroup of VINI_FOOD_GROUPS) {
  const ids = foodGroup.foods.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, `IDs repetidos em ${foodGroup.id}`);
}

// Auditoria de cobertura: todas as 19 composições transcritas e cada alimento
// original precisam estar representados no catálogo selecionável.
assert.equal(VINI_MEALS.flatMap((meal) => meal.options).length, 19);

// A linha de referência dos gráficos arredonda a média das opções oficiais
// do dia (pré, café, almoço, lanche, pós e jantar), sem o belisco eventual.
const referenceMeals = VINI_MEALS.filter((meal) => meal.id !== "belisco");
const referenceAverage = referenceMeals.reduce((total, meal) => {
  const options = meal.options.map(optionNutrition);
  for (const key of ["kcal", "p", "c", "f"]) {
    total[key] += options.reduce((sum, value) => sum + value[key], 0) / options.length;
  }
  return total;
}, { kcal: 0, p: 0, c: 0, f: 0 });
assert.deepEqual(
  Object.fromEntries(Object.entries(referenceAverage).map(([key, value]) => [key, Math.round(value)])),
  { kcal: 1967, p: 160, c: 199, f: 58 },
);
for (const meal of VINI_MEALS) {
  const foodGroup = group(meal.id);
  assert.ok(foodGroup, `Grupo ausente: ${meal.id}`);
  for (const option of meal.options) {
    for (const original of option.items) {
      const selectable = foodGroup.foods.find((entry) => entry.baseId === original.id);
      assert.ok(selectable, `Alimento ausente: ${meal.id}.${option.id}.${original.id}`);
      assert.ok(selectable.sourceOptions.includes(option.id), `Origem ausente: ${option.id}.${original.id}`);
      assert.ok(selectable.variants.some((entry) => entry.portion === original.portion), `Porção ausente: ${option.id}.${original.id}`);
      if (!selectable.unquantified) {
        assert.ok(selectable.prescribedQuantities.length > 0, `Quantidade prescrita ausente: ${option.id}.${original.id}`);
        assert.ok(selectable.prescribedQuantities.every((amount) => selectable.quantityChoices.includes(amount)), `Quantidade não selecionável: ${option.id}.${original.id}`);
      }
    }
  }
}

// A consulta oficial consolida a alternativa de produto proteico do mesmo
// screenshot e, por isso, representa 18 refeições completas dos prints.
assert.equal(VINI_OFFICIAL_MEALS.flatMap((meal) => meal.options).length, 18);
assert.deepEqual(
  VINI_OFFICIAL_MEALS.flatMap((meal) => meal.options.map((option) => option.source)),
  [
    "IMG_3063.PNG", "IMG_3064.PNG",
    "IMG_3065.PNG", "IMG_3066.PNG", "IMG_3068.PNG", "IMG_3069.PNG", "IMG_3070.PNG",
    "IMG_3071.PNG", "IMG_3072.PNG", "IMG_3073.PNG", "IMG_3074.PNG", "IMG_3075.PNG",
    "IMG_3076.PNG", "IMG_3077.PNG", "IMG_3079.PNG", "IMG_3080.PNG", "IMG_3081.PNG",
    "IMG_3082.PNG",
  ],
);
const officialSnack = VINI_OFFICIAL_MEALS.find((meal) => meal.id === "lanche_tarde");
assert.equal(officialSnack.options.length, 4);
assert.equal(officialSnack.options[0].source, "IMG_3071.PNG");
assert.match(officialSnack.options[0].items[0].label, /Pro Force Piracanjuba/);
assert.match(officialSnack.options[0].items[0].label, /Natural Whey Verde Campo/);
assert.equal(officialSnack.options[0].items[0].portion, "1 unidade(s) ou 250g");
for (const meal of VINI_OFFICIAL_MEALS) {
  for (const option of meal.options) {
    assert.match(option.source, /^IMG_\d{4}\.PNG$/);
    assert.ok(option.items.every((entry) => entry.label && entry.portion), `Consulta incompleta: ${option.id}`);
  }
}
const officialHTML = viniOfficialDietHTML();
assert.equal((officialHTML.match(/class="vini-official-option"/g) || []).length, 18);
assert.equal((officialHTML.match(/class="vini-official-meal"/g) || []).length, 7);
assert.match(officialHTML, /Consumo médio de 2,5 litros de água/);
assert.match(officialHTML, /IMG_3083\.PNG/);
assert.match(officialHTML, /6 colher\(es\) de sopa cheia\(s\) ou 150g/);
assert.match(officialHTML, /Ovo de galinha `frito`/);
assert.match(officialHTML, /Morango congelado \(opcional\)/);
assert.doesNotMatch(officialHTML, /Morango congelado \(opcional\).*<em>opcional<\/em>/s);
assert.doesNotMatch(officialHTML, /<(?:button|input|select|textarea)\b/i);

// Cada alimento pode ser marcado sozinho, inclusive misturando itens que antes
// pertenciam a opções diferentes da mesma refeição.
const rice = food("almoco", "arroz");
const puree = food("almoco", "pure_batata");
const egg = food("almoco", "ovo_frito");
const independent = calculateViniDietDay({
  foods: { almoco: [rice.id, puree.id, egg.id] },
  amounts: { almoco: { arroz: 100, pure_batata: 105, ovo_frito: 1 } },
});
assert.equal(independent.itemsChecked, 3);
assert.equal(independent.mainMealsLogged, 1);
assert.equal(independent.consumed.kcal, 128 + 116 + 120);

// Cada alimento tem um único card e opções de quantidade adequadas à unidade.
assert.deepEqual(food("pre_treino", "banana").quantityChoices, [1, 2, 3, 4, 5]);
assert.ok([100, 130, 150, 180, 200].every((amount) => rice.quantityChoices.includes(amount)));

// Os macros escalam conforme a quantidade escolhida.
const rice100 = calculateViniDietDay({ foods: { almoco: [rice.id] }, amounts: { almoco: { arroz: 100 } } });
const rice200 = calculateViniDietDay({ foods: { almoco: [rice.id] }, amounts: { almoco: { arroz: 200 } } });
assert.equal(rice100.consumed.kcal, 128);
assert.equal(rice200.consumed.kcal, 256);
const oneBanana = calculateViniDietDay({ foods: { pre_treino: ["banana"] }, amounts: { pre_treino: { banana: 1 } } });
const twoBananas = calculateViniDietDay({ foods: { pre_treino: ["banana"] }, amounts: { pre_treino: { banana: 2 } } });
assert.equal(oneBanana.consumed.kcal, 39);
assert.equal(twoBananas.consumed.kcal, 78);

const churrascoFoods = ["pao_alho_santa_massa", "carne_churrasco", "salsichao", "coracao_galinha"];
const churrascoSummary = calculateViniDietDay({
  foods: { jantar: churrascoFoods },
  amounts: {
    jantar: { pao_alho_santa_massa: 1, carne_churrasco: 300, salsichao: 70, coracao_galinha: 50 },
  },
});
assert.deepEqual(churrascoSummary.consumed, { kcal: 1297, p: 106.6, c: 34.7, f: 82.8 });

const pastaSnackSummary = calculateViniDietDay({
  foods: { lanche_tarde: ["whey", "pao", "pasta_amendoim_amendopower"] },
  amounts: { lanche_tarde: { whey: 3, pao: 2, pasta_amendoim_amendopower: 15 } },
});
assert.deepEqual(pastaSnackSummary.consumed, { kcal: 394, p: 42.5, c: 30.3, f: 10.7 });

// Bebidas são contadas por porção, persistidas separadamente dos alimentos e
// entram automaticamente nas kcal e nos macros do dia.
let drinks = setViniBeverageCount(emptyViniDietDay(), "cerveja", 2);
drinks = setViniBeverageCount(drinks, "destilado", 1);
drinks = setViniBeverageCount(drinks, "energetico_normal", 1);
const drinksSummary = calculateViniDietDay(drinks);
assert.deepEqual(drinks.beverages, { cerveja: 2, destilado: 1, energetico_normal: 1 });
assert.equal(drinksSummary.beverageCount, 4);
assert.equal(drinksSummary.itemsChecked, 0);
assert.equal(drinksSummary.hasData, true);
assert.deepEqual(drinksSummary.consumed, { kcal: 520, p: 2.6, c: 53, f: 0 });
assert.deepEqual(nutritionForBeverageCount(VINI_BEVERAGES[0], 2), { kcal: 300, p: 2.6, c: 26, f: 0 });
const storedDrinks = withViniDietSummary(drinks);
assert.equal(storedDrinks.summary.beverageCount, 4);
assert.deepEqual(normalizeViniDietDay(JSON.parse(JSON.stringify(storedDrinks))).beverages, drinks.beverages);
drinks = setViniBeverageCount(drinks, "cerveja", 0);
assert.equal(drinks.beverages.cerveja, undefined);
assert.deepEqual(normalizeViniDietDay({ beverages: { desconhecida: 3, destilado: 200 } }).beverages, { destilado: 99 });

// Um alimento em cada momento principal é suficiente para registrar cobertura,
// sem o conceito antigo de "refeição completa".
const onePerMainMoment = Object.fromEntries(VINI_REQUIRED_MEALS.map((groupId) => (
  [groupId, [group(groupId).foods[0].id]]
)));
const covered = calculateViniDietDay({ foods: onePerMainMoment });
assert.equal(covered.itemsChecked, 4);
assert.equal(covered.mainMealsLogged, 4);
assert.equal(covered.mealCoveragePct, 100);

// Registros v1 são convertidos transparentemente para os checkboxes equivalentes.
const migrated = normalizeViniDietDay({
  version: "vini-nutri-2026-07-v1",
  meals: {
    almoco: {
      optionId: "almoco_arroz_pure",
      checked: ["arroz", "pure_batata"],
    },
  },
});
assert.deepEqual(migrated.foods.almoco, [rice.id, puree.id]);
assert.equal(migrated.amounts.almoco.arroz, 100);
assert.equal(migrated.amounts.almoco.pure_batata, 105);
assert.equal(calculateViniDietDay(migrated).itemsChecked, 2);

// Registros v2, que usavam um ID diferente para cada porção, também migram.
const migratedV2 = normalizeViniDietDay({
  version: "vini-nutri-2026-07-v2",
  foods: { almoco: ["arroz__100_g", "pure_batata__105_g"] },
});
assert.deepEqual(migratedV2.foods.almoco, [rice.id, puree.id]);
assert.equal(migratedV2.amounts.almoco.arroz, 100);
assert.equal(migratedV2.amounts.almoco.pure_batata, 105);

// A transcrição mais fiel das porções não pode alterar quantidades gravadas
// nos antigos IDs compostos por unidade, medida ou volume.
const migratedV2Compound = normalizeViniDietDay({
  version: "vini-nutri-2026-07-v2",
  foods: {
    pre_treino: ["cafe__200_ml"],
    cafe_manha: ["pao__2_fatias_50_g"],
    lanche_tarde: ["whey__1_5_medida_23_3_g"],
  },
});
assert.equal(migratedV2Compound.amounts.pre_treino.cafe, 200);
assert.equal(migratedV2Compound.amounts.cafe_manha.pao, 2);
assert.equal(migratedV2Compound.amounts.lanche_tarde.whey, 1.5);

const freeSalad = food("jantar", "tomate_repolho");
const bolognese = food("jantar", "macarrao_bolonhesa");
const unquantified = calculateViniDietDay({
  foods: { jantar: [bolognese.id, freeSalad.id] },
});
assert.equal(unquantified.unquantifiedItemsChecked, 1);
assert.equal(unquantified.itemsChecked, 2);

const hydrated = calculateViniDietDay({ foods: {}, hydrationMl: 3200, trainingDay: true });
assert.equal(hydrated.hydrationTargetMl, 3000);
assert.equal(hydrated.hydrationPct, 107);

// O snapshot continua protegendo o histórico contra alterações futuras no catálogo.
const stored = withViniDietSummary({
  foods: { almoco: [rice.id, puree.id] },
  amounts: { almoco: { arroz: 130, pure_batata: 150 } },
  hydrationMl: 2500,
});
assert.equal(stored.amounts.almoco.arroz, 130);
assert.equal(normalizeViniDietDay(JSON.parse(JSON.stringify(stored))).amounts.almoco.pure_batata, 150);
const originalKcal = stored.summary.consumed.kcal;
stored.summary.consumed.kcal = 1234;
assert.equal(calculateViniDietDay(stored).consumed.kcal, originalKcal);
assert.equal(calculateViniDietDay(stored, { useSnapshot: true }).consumed.kcal, 1234);

// Snapshots antigos permanecem legíveis e ganham os aliases do modelo atual.
const oldVersion = calculateViniDietDay({
  version: "vini-plano-antigo-v0",
  meals: { almoco: { optionId: "opcao-removida", checked: ["item-removido"] } },
  summary: {
    planVersion: "vini-plano-antigo-v0",
    consumed: { kcal: 987, p: 88, c: 77, f: 22 },
    planned: { kcal: 1100, p: 100, c: 90, f: 30 },
    adherencePct: 75,
    completedMeals: 3,
    requiredMeals: 4,
    itemsChecked: 9,
    hydrationMl: 2500,
    hydrationTargetMl: 2500,
    hydrationPct: 100,
  },
}, { useSnapshot: true });
assert.equal(oldVersion.consumed.kcal, 987);
assert.equal(oldVersion.mainMealsLogged, 3);
assert.equal(oldVersion.mealCoveragePct, 75);
assert.equal(oldVersion.hasData, true);

const invalid = normalizeViniDietDay({
  hydrationMl: 99999,
  foods: { almoco: ["nao-existe"] },
});
assert.equal(invalid.hydrationMl, 10000);
assert.equal(invalid.foods.almoco, undefined);

const invalidAmount = normalizeViniDietDay({
  foods: { almoco: ["arroz"] },
  amounts: { almoco: { arroz: 999 } },
});
assert.equal(invalidAmount.amounts.almoco.arroz, rice.defaultQuantity);

console.log("vini-diet-plan: ok");
