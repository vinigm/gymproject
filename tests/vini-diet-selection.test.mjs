import assert from "node:assert/strict";
import {
  VINI_MEAL_PRESETS,
  applyViniMealPreset,
  isViniMealPresetApplied,
  setViniFoodChecked,
  toggleViniMealPreset,
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

const expectedPresets = {
  pre_treino_padrao: { groupId: "pre_treino", foods: ["banana"], amounts: { banana: 2 } },
  cafe_padrao: { groupId: "cafe_manha", foods: ["ovos", "pao", "requeijao"], amounts: { ovos: 3, pao: 2, requeijao: 15 } },
  almoco_padrao: { groupId: "almoco", foods: ["vegetais", "azeite", "arroz", "frango"], amounts: { vegetais: 50, azeite: 15, arroz: 150, frango: 120 } },
  almoco_guisado: { groupId: "almoco", foods: ["vegetais", "arroz", "guisado"], amounts: { vegetais: 70, arroz: 150, guisado: 120 } },
  lanche_whey: { groupId: "lanche_tarde", foods: ["whey", "requeijao", "ovos", "pao"], amounts: { whey: 2, requeijao: 15, ovos: 3, pao: 2 } },
  lanche_piracanjuba: { groupId: "lanche_tarde", foods: ["pro_force", "requeijao", "ovos", "pao"], amounts: { pro_force: 1, requeijao: 15, ovos: 3, pao: 2 } },
  lanche_pasta_amendoim_whey: {
    groupId: "lanche_tarde",
    foods: ["whey", "pao", "pasta_amendoim_amendopower"],
    amounts: { whey: 3, pao: 2, pasta_amendoim_amendopower: 30 },
  },
  pos_treino_padrao: { groupId: "pos_treino", foods: ["whey"], amounts: { whey: 2 } },
  jantar_padrao: { groupId: "jantar", foods: ["vegetais", "azeite", "arroz", "frango"], amounts: { vegetais: 50, azeite: 15, arroz: 150, frango: 120 } },
  jantar_guisado: { groupId: "jantar", foods: ["vegetais", "arroz", "guisado"], amounts: { vegetais: 70, arroz: 150, guisado: 120 } },
  churrasco: {
    groupId: "jantar",
    foods: ["pao_alho_santa_massa", "carne_churrasco", "salsichao", "coracao_galinha"],
    amounts: { pao_alho_santa_massa: 1, carne_churrasco: 300, salsichao: 70, coracao_galinha: 50 },
  },
};

assert.deepEqual(VINI_MEAL_PRESETS.map((preset) => preset.id), Object.keys(expectedPresets));
for (const [presetId, expected] of Object.entries(expectedPresets)) {
  const presetDay = applyViniMealPreset(emptyViniDietDay(), presetId);
  assert.deepEqual(presetDay.foods[expected.groupId], expected.foods);
  assert.deepEqual(presetDay.amounts[expected.groupId], expected.amounts);
  assert.equal(isViniMealPresetApplied(presetDay, presetId), true);
}

const churrasco = applyViniMealPreset(emptyViniDietDay(), "churrasco");
assert.deepEqual(churrasco.amounts.jantar, {
  pao_alho_santa_massa: 1,
  carne_churrasco: 300,
  salsichao: 70,
  coracao_galinha: 50,
});

// O atalho preserva alimentos extras e volta a aparecer como pendente se uma
// das quantidades padrão for alterada manualmente.
day = setViniFoodChecked(emptyViniDietDay(), {
  groupId: "almoco",
  foodId: "ovo_frito",
  checked: true,
  amount: 1,
});
day = applyViniMealPreset(day, "almoco_padrao");
assert.equal(day.foods.almoco.includes("ovo_frito"), true);
day = toggleViniFoodQuantity(day, { groupId: "almoco", foodId: "arroz", amount: 180 });
assert.equal(isViniMealPresetApplied(day, "almoco_padrao"), false);

// Um segundo toque no mesmo card remove somente os itens do preset e preserva
// qualquer alimento extra que já estivesse marcado no momento da refeição.
day = setViniFoodChecked(emptyViniDietDay(), {
  groupId: "almoco",
  foodId: "ovo_frito",
  checked: true,
  amount: 1,
});
day = toggleViniMealPreset(day, "almoco_guisado");
assert.equal(isViniMealPresetApplied(day, "almoco_guisado"), true);
day = toggleViniMealPreset(day, "almoco_guisado");
assert.deepEqual(day.foods.almoco, ["ovo_frito"]);
assert.deepEqual(day.amounts.almoco, { ovo_frito: 1 });
assert.equal(isViniMealPresetApplied(day, "almoco_guisado"), false);

console.log("vini-diet-selection: ok");
