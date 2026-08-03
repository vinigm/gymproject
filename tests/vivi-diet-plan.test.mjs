import assert from "node:assert/strict";
import {
  VIVI_DAILY_GOALS,
  VIVI_FOOD_GROUPS,
  VIVI_HYDRATION,
  VIVI_MEALS,
  VIVI_OFFICIAL_MEALS,
  VIVI_PLAN_VERSION,
  VIVI_REQUIRED_MEALS,
  calculateViviDietDay,
  emptyViviDietDay,
  legacyViviPlanFromFoods,
  normalizeViviDietDay,
  withViviDietSummary,
} from "../js/vivi-diet-plan.js";
import {
  VIVI_MEAL_PRESETS,
  isViviMealPresetApplied,
  toggleViviFoodQuantity,
  toggleViviMealPreset,
} from "../js/vivi-diet-selection.js";

const group = (id) => VIVI_FOOD_GROUPS.find((entry) => entry.id === id);
const food = (groupId, foodId) => group(groupId).foods.find((entry) => entry.id === foodId);

assert.equal(VIVI_PLAN_VERSION, "vivi-nutri-2026-02-v2");
assert.deepEqual(VIVI_DAILY_GOALS, { kcal: 2000, p: 90, c: 250, f: 65 });
assert.deepEqual(VIVI_HYDRATION, { baseMl: 1600, trainingMinMl: 1600, trainingMaxMl: 1600 });
assert.deepEqual(VIVI_REQUIRED_MEALS, ["desjejum", "almoco", "lanche_tarde", "jantar"]);
assert.equal(VIVI_MEALS.length, 7);
assert.equal(VIVI_OFFICIAL_MEALS.flatMap((meal) => meal.options).length, 19);
assert.equal(VIVI_MEAL_PRESETS.length, 20);
assert.deepEqual(food("desjejum", "ovo_cozido").quantityChoices, [1, 2, 3, 4, 5, 6]);
assert.ok(food("desjejum", "aveia").quantityChoices.includes(30));
assert.ok(food("desjejum", "banana").quantityChoices.includes(1));

for (const meal of VIVI_MEALS) {
  const foodGroup = group(meal.id);
  assert.ok(foodGroup, `Grupo ausente: ${meal.id}`);
  assert.equal(new Set(foodGroup.foods.map((entry) => entry.id)).size, foodGroup.foods.length);
  for (const option of meal.options) {
    assert.match(option.source, /^página(?:s)? \d/);
    for (const item of option.items) {
      const selectable = food(foodGroup.id, item.id);
      assert.ok(selectable, `Alimento ausente: ${meal.id}.${item.id}`);
      assert.ok(selectable.sourceOptions.includes(option.id));
      if (!selectable.unquantified) {
        assert.ok(selectable.quantityChoices.length > 0);
        assert.ok(selectable.prescribedQuantities.every((amount) => selectable.quantityChoices.includes(amount)));
      }
    }
  }
}

const empty = calculateViviDietDay(emptyViviDietDay());
assert.equal(empty.hasData, false);
assert.equal(empty.consumed.kcal, 0);
assert.equal(empty.mainMealsLogged, 0);

let breakfast = toggleViviMealPreset(emptyViviDietDay(), "desjejum_oficial");
assert.equal(isViviMealPresetApplied(breakfast, "desjejum_oficial"), true);
assert.deepEqual(breakfast.foods.desjejum, [
  "fruta",
  "ovo",
  "pao_integral",
  "quark_cottage",
  "sementes",
  "leite_semidesnatado",
]);
assert.equal(calculateViviDietDay(breakfast).itemsChecked, 6);

let porridge = toggleViviMealPreset(emptyViviDietDay(), "desjejum_mingau_aveia");
assert.equal(isViviMealPresetApplied(porridge, "desjejum_mingau_aveia"), true);
assert.deepEqual(porridge.foods.desjejum, [
  "leite_semidesnatado",
  "banana",
  "aveia",
  "ovo_cozido",
]);
assert.deepEqual(calculateViviDietDay(porridge).consumed, {
  kcal: 312,
  p: 14.5,
  c: 45.2,
  f: 9,
});

// O ovo cozido começa em uma unidade no preset, mas continua sendo um item
// individual e pode ser aumentado ou diminuído pelo seletor de quantidades.
porridge = toggleViviFoodQuantity(porridge, {
  groupId: "desjejum",
  foodId: "ovo_cozido",
  amount: 2,
});
assert.equal(porridge.amounts.desjejum.ovo_cozido, 2);
assert.equal(isViviMealPresetApplied(porridge, "desjejum_mingau_aveia"), false);

// Um segundo toque remove a refeição predefinida.
breakfast = toggleViviMealPreset(breakfast, "desjejum_oficial");
assert.equal(breakfast.foods.desjejum, undefined);
assert.equal(isViviMealPresetApplied(breakfast, "desjejum_oficial"), false);

// As quantidades personalizadas podem ser escolhidas e retiradas no mesmo botão.
let fruit = toggleViviFoodQuantity(emptyViviDietDay(), {
  groupId: "desjejum",
  foodId: "fruta",
  amount: 150,
});
assert.equal(fruit.amounts.desjejum.fruta, 150);
fruit = toggleViviFoodQuantity(fruit, {
  groupId: "desjejum",
  foodId: "fruta",
  amount: 150,
});
assert.equal(fruit.foods.desjejum, undefined);

// Presets principais representam as alternativas prescritas no PDF.
for (const presetId of [
  "almoco_cereal",
  "almoco_batata",
  "almoco_mandioca",
  "almoco_pronto",
  "lanche_tigela_granola",
  "lanche_barra",
  "lanche_panqueca",
  "pre_treino_oficial",
  "aula_sanduiche",
  "jantar_cereal",
]) {
  const day = toggleViviMealPreset(emptyViviDietDay(), presetId);
  assert.equal(isViviMealPresetApplied(day, presetId), true, presetId);
  assert.equal(calculateViviDietDay(day).hasData, true, presetId);
}

const complete = [
  "desjejum_oficial",
  "almoco_cereal",
  "lanche_tigela_granola",
  "jantar_cereal",
].reduce((day, presetId) => toggleViviMealPreset(day, presetId), emptyViviDietDay());
const completeSummary = calculateViviDietDay(complete);
assert.equal(completeSummary.mainMealsLogged, 4);
assert.equal(completeSummary.mealCoveragePct, 100);
assert.ok(completeSummary.consumed.kcal > 1000);
assert.ok(completeSummary.consumed.p > 50);

const stored = withViviDietSummary({
  ...complete,
  hydrationMl: 1600,
  additionalMeal: "sobremesa",
  additionalNutrition: { kcal: 120, p: 2, c: 20, f: 4 },
});
assert.equal(stored.summary.hydrationTargetMl, 1600);
assert.equal(stored.summary.hydrationPct, 100);
assert.equal(stored.summary.additionalMeal, "sobremesa");
assert.deepEqual(stored.summary.additionalNutrition, { kcal: 120, p: 2, c: 20, f: 4 });
assert.deepEqual(normalizeViviDietDay(JSON.parse(JSON.stringify(stored))).summary.consumed, stored.summary.consumed);

// Registros antigos da tela genérica continuam contribuindo para o histórico.
const legacy = legacyViviPlanFromFoods({
  "cafe.ovo": 1,
  "cafe.pao": 2,
  "almoco.proteina": 1,
  "almoco.arroz": 1,
});
assert.equal(legacy.version, "vivi-legacy-foods-v1");
assert.equal(legacy.summary.itemsChecked, 5);
assert.ok(legacy.summary.consumed.kcal > 0);
assert.equal(calculateViviDietDay(legacy, { useSnapshot: true }).hasData, true);

console.log("vivi-diet-plan: ok");
