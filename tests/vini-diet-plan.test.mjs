import assert from "node:assert/strict";
import {
  VINI_FOOD_GROUPS,
  VINI_MEALS,
  VINI_PLAN_VERSION,
  VINI_REQUIRED_MEALS,
  calculateViniDietDay,
  emptyViniDietDay,
  normalizeViniDietDay,
  withViniDietSummary,
} from "../js/vini-diet-plan.js";

const group = (id) => VINI_FOOD_GROUPS.find((entry) => entry.id === id);
const food = (groupId, baseId) => group(groupId).foods.find((entry) => entry.baseId === baseId);

const empty = calculateViniDietDay(emptyViniDietDay());
assert.equal(empty.hasData, false);
assert.equal(empty.itemsChecked, 0);
assert.equal(empty.mainMealsLogged, 0);
assert.equal(empty.consumed.kcal, 0);
assert.equal(VINI_PLAN_VERSION, "vini-nutri-2026-07-v3");
assert.equal(VINI_FOOD_GROUPS.length, 7);

for (const foodGroup of VINI_FOOD_GROUPS) {
  const ids = foodGroup.foods.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, `IDs repetidos em ${foodGroup.id}`);
}

// Auditoria de cobertura: todas as 19 composições transcritas e cada alimento
// original precisam estar representados no catálogo selecionável.
assert.equal(VINI_MEALS.flatMap((meal) => meal.options).length, 19);
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
