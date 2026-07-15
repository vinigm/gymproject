import assert from "node:assert/strict";
import {
  VINI_MEALS,
  calculateViniDietDay,
  emptyViniDietDay,
  normalizeViniDietDay,
  withViniDietSummary,
} from "../js/vini-diet-plan.js";

const empty = calculateViniDietDay(emptyViniDietDay());
assert.equal(empty.hasData, false);
assert.equal(empty.adherencePct, 0);
assert.equal(empty.consumed.kcal, 0);

for (const meal of VINI_MEALS) {
  for (const option of meal.options) {
    const ids = option.items.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length, `IDs repetidos em ${option.id}`);
  }
}
assert.equal(VINI_MEALS.flatMap((meal) => meal.options).length, 19);

const completeRequiredMeals = {};
for (const meal of VINI_MEALS.filter((entry) => entry.required)) {
  const option = meal.options.find((entry) => entry.id.includes("arroz_pure")) || meal.options[0];
  completeRequiredMeals[meal.id] = {
    optionId: option.id,
    checked: option.items.filter((entry) => !entry.optional).map((entry) => entry.id),
  };
}

const complete = calculateViniDietDay({ meals: completeRequiredMeals, hydrationMl: 3200, trainingDay: true });
assert.equal(complete.adherencePct, 100);
assert.equal(complete.completedMeals, 4);
assert.equal(complete.hydrationTargetMl, 3000);
assert.equal(complete.hydrationPct, 107);
assert.equal(complete.meals.almoco.option.id, "almoco_arroz_pure");
assert.equal(complete.meals.jantar.option.id, "jantar_arroz_pure");
assert.deepEqual(
  complete.meals.almoco.option.items.filter((entry) => ["arroz", "pure_batata"].includes(entry.id)).map((entry) => entry.id),
  ["arroz", "pure_batata"]
);

const smoothieMeal = VINI_MEALS.find((meal) => meal.id === "lanche_tarde");
const smoothie = smoothieMeal.options.find((option) => option.id === "lanche_vitamina_whey");
const withoutOptional = calculateViniDietDay({
  meals: {
    lanche_tarde: {
      optionId: smoothie.id,
      checked: smoothie.items.filter((entry) => !entry.optional).map((entry) => entry.id),
    },
  },
});
const withOptional = calculateViniDietDay({
  meals: {
    lanche_tarde: {
      optionId: smoothie.id,
      checked: smoothie.items.map((entry) => entry.id),
    },
  },
});
assert.equal(withoutOptional.meals.lanche_tarde.complete, true);
assert.equal(withOptional.consumed.kcal - withoutOptional.consumed.kcal, 11);
assert.equal(withOptional.planned.kcal, withoutOptional.planned.kcal);

const bologneseMeal = VINI_MEALS.find((meal) => meal.id === "almoco");
const bolognese = bologneseMeal.options.find((option) => option.id === "almoco_bolonhesa");
const unquantified = calculateViniDietDay({
  meals: { almoco: { optionId: bolognese.id, checked: bolognese.items.map((entry) => entry.id) } },
});
assert.equal(unquantified.unquantifiedItemsChecked, 1);
assert.equal(unquantified.meals.almoco.complete, true);

const stored = withViniDietSummary({ meals: completeRequiredMeals, hydrationMl: 2500 });
const originalKcal = stored.summary.consumed.kcal;
stored.summary.consumed.kcal = 1234;
assert.equal(calculateViniDietDay(stored).consumed.kcal, originalKcal);
assert.equal(calculateViniDietDay(stored, { useSnapshot: true }).consumed.kcal, 1234);

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
assert.equal(oldVersion.adherencePct, 75);
assert.equal(oldVersion.hasData, true);

const invalid = normalizeViniDietDay({
  hydrationMl: 99999,
  meals: { almoco: { optionId: "nao-existe", checked: ["arroz"] } },
});
assert.equal(invalid.hydrationMl, 10000);
assert.equal(invalid.meals.almoco, undefined);

console.log("vini-diet-plan: ok");
