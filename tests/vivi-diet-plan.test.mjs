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

assert.equal(VIVI_PLAN_VERSION, "vivi-nutri-2026-02-v3");
assert.deepEqual(VIVI_DAILY_GOALS, { kcal: 2000, p: 90, c: 250, f: 65 });
assert.deepEqual(VIVI_HYDRATION, { baseMl: 1600, trainingMinMl: 1600, trainingMaxMl: 1600 });
assert.deepEqual(VIVI_REQUIRED_MEALS, ["desjejum", "almoco", "lanche_tarde", "jantar"]);
assert.equal(VIVI_MEALS.length, 7);
assert.equal(VIVI_OFFICIAL_MEALS.flatMap((meal) => meal.options).length, 19);
assert.equal(VIVI_MEAL_PRESETS.length, 6);
assert.deepEqual(VIVI_MEAL_PRESETS.map((preset) => preset.id), [
  "base_desjejum",
  "base_almoco",
  "base_lanche_tarde",
  "base_pre_treino",
  "base_jantar",
  "base_ceia",
]);
assert.deepEqual(food("desjejum", "ovo_cozido").quantityChoices, [1, 2, 3, 4, 5, 6]);
assert.ok(food("desjejum", "aveia").quantityChoices.includes(30));
assert.ok(food("desjejum", "banana").quantityChoices.includes(1));
assert.ok(food("desjejum", "whey_probiotica").quantityChoices.includes(18));
assert.ok(food("desjejum", "banana_prata_g").quantityChoices.includes(70));
assert.ok(food("almoco", "aipim_cozido").quantityChoices.includes(170));
assert.ok(food("ceia", "maca_fuji").quantityChoices.includes(30));

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

let breakfast = toggleViviMealPreset(emptyViviDietDay(), "base_desjejum");
assert.equal(isViviMealPresetApplied(breakfast, "base_desjejum"), true);
assert.deepEqual(breakfast.foods.desjejum, [
  "leite_semidesnatado",
  "whey_probiotica",
  "aveia_floco_g",
  "banana_prata_g",
]);
assert.deepEqual(calculateViviDietDay(breakfast).consumed, {
  kcal: 303,
  p: 21.7,
  c: 44.7,
  f: 5.1,
});

// Os alimentos que não fazem mais parte dos atalhos continuam disponíveis
// individualmente no menu personalizado.
let boiledEgg = toggleViviFoodQuantity(emptyViviDietDay(), {
  groupId: "desjejum",
  foodId: "ovo_cozido",
  amount: 2,
});
assert.equal(boiledEgg.amounts.desjejum.ovo_cozido, 2);

// Um segundo toque remove a refeição predefinida.
breakfast = toggleViviMealPreset(breakfast, "base_desjejum");
assert.equal(breakfast.foods.desjejum, undefined);
assert.equal(isViviMealPresetApplied(breakfast, "base_desjejum"), false);

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

// Os seis atalhos representam exatamente a nova dieta base da Vivi.
for (const presetId of VIVI_MEAL_PRESETS.map((preset) => preset.id)) {
  const day = toggleViviMealPreset(emptyViviDietDay(), presetId);
  assert.equal(isViviMealPresetApplied(day, presetId), true, presetId);
  assert.equal(calculateViviDietDay(day).hasData, true, presetId);
}

assert.deepEqual(calculateViviDietDay(toggleViviMealPreset(emptyViviDietDay(), "base_almoco")).consumed, {
  kcal: 587,
  p: 32.9,
  c: 51.2,
  f: 27.1,
});
assert.deepEqual(calculateViviDietDay(toggleViviMealPreset(emptyViviDietDay(), "base_lanche_tarde")).consumed, {
  kcal: 238,
  p: 24.5,
  c: 34.2,
  f: 1.6,
});
assert.deepEqual(calculateViviDietDay(toggleViviMealPreset(emptyViviDietDay(), "base_pre_treino")).consumed, {
  kcal: 178,
  p: 3.2,
  c: 26.4,
  f: 6.6,
});
assert.deepEqual(calculateViviDietDay(toggleViviMealPreset(emptyViviDietDay(), "base_ceia")).consumed, {
  kcal: 183,
  p: 5.6,
  c: 13.7,
  f: 13.2,
});

const complete = [
  "base_desjejum",
  "base_almoco",
  "base_lanche_tarde",
  "base_jantar",
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
