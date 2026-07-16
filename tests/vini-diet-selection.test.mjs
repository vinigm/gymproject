import assert from "node:assert/strict";
import {
  setViniFoodChecked,
  toggleViniFoodQuantity,
} from "../js/vini-diet-selection.js";
import { emptyViniDietDay } from "../js/vini-diet-plan.js";

const banana = { groupId: "pre_treino", foodId: "banana" };

let day = toggleViniFoodQuantity(emptyViniDietDay(), { ...banana, amount: 2 });
assert.deepEqual(day.foods.pre_treino, ["banana"]);
assert.equal(day.amounts.pre_treino.banana, 2);

// Repetir a quantidade que já está ativa remove o alimento e a quantidade.
day = toggleViniFoodQuantity(day, { ...banana, amount: 2 });
assert.equal(day.foods.pre_treino, undefined);
assert.equal(day.amounts.pre_treino, undefined);

// Escolher outra quantidade corrige a porção sem desmarcar o alimento.
day = toggleViniFoodQuantity(emptyViniDietDay(), { ...banana, amount: 2 });
day = toggleViniFoodQuantity(day, { ...banana, amount: 3 });
assert.deepEqual(day.foods.pre_treino, ["banana"]);
assert.equal(day.amounts.pre_treino.banana, 3);

// O checkbox continua podendo adicionar pelo padrão e retirar o mesmo item.
day = setViniFoodChecked(emptyViniDietDay(), { ...banana, checked: true });
assert.deepEqual(day.foods.pre_treino, ["banana"]);
assert.equal(day.amounts.pre_treino.banana, 2);
day = setViniFoodChecked(day, { ...banana, checked: false });
assert.equal(day.foods.pre_treino, undefined);
assert.equal(day.amounts.pre_treino, undefined);

console.log("vini-diet-selection: ok");
