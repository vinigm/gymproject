import {
  normalizeViviDietDay,
  normalizeViviFoodQuantity,
  viviFoodForGroup,
  viviFoodGroupForId,
} from "./vivi-diet-plan.js";

function sameQuantity(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.001;
}

function preset(id, icon, label, description, groupId, items) {
  return Object.freeze({
    id,
    icon,
    label,
    description,
    groupId,
    items: Object.freeze(items.map((entry) => Object.freeze(entry))),
  });
}

export const VIVI_MEAL_PRESETS = Object.freeze([
  preset(
    "desjejum_oficial",
    "🌅",
    "Desjejum",
    "Fruta · ovo · pão · quark/cottage · sementes · leite",
    "desjejum",
    [
      { foodId: "fruta", amount: 125 },
      { foodId: "ovo", amount: 1 },
      { foodId: "pao_integral", amount: 1 },
      { foodId: "quark_cottage", amount: 20 },
      { foodId: "sementes", amount: 10 },
      { foodId: "leite_semidesnatado", amount: 100 },
    ]
  ),
  preset(
    "desjejum_mingau_aveia",
    "🥣",
    "Café · mingau de aveia",
    "30g aveia · 100ml leite · 1 banana · 1 ovo cozido",
    "desjejum",
    [
      { foodId: "aveia", amount: 30 },
      { foodId: "leite_semidesnatado", amount: 100 },
      { foodId: "banana", amount: 1 },
      { foodId: "ovo_cozido", amount: 1 },
    ]
  ),
  preset(
    "lanche_manha_oficial",
    "🥛",
    "Lanche da manhã",
    "300ml leite · 15g Panalose · 15g Body Balance",
    "lanche_manha",
    [
      { foodId: "leite_semidesnatado", amount: 300 },
      { foodId: "panalose", amount: 15 },
      { foodId: "body_balance", amount: 15 },
    ]
  ),
  preset(
    "almoco_cereal",
    "☀️",
    "Almoço · cereal",
    "100g proteína · 100g cereal · 60g leguminosa · vegetais · azeite",
    "almoco",
    [
      { foodId: "proteina_magra", amount: 100 },
      { foodId: "carbo_cozido", amount: 100 },
      { foodId: "leguminosa", amount: 60 },
      { foodId: "vegetais_folhas", amount: 1 },
      { foodId: "azeite", amount: 5 },
    ]
  ),
  preset(
    "almoco_batata",
    "🥔",
    "Almoço · batata",
    "100g proteína · 130g batata · 60g leguminosa · vegetais · azeite",
    "almoco",
    [
      { foodId: "proteina_magra", amount: 100 },
      { foodId: "batata", amount: 130 },
      { foodId: "leguminosa", amount: 60 },
      { foodId: "vegetais_folhas", amount: 1 },
      { foodId: "azeite", amount: 5 },
    ]
  ),
  preset(
    "almoco_mandioca",
    "🌿",
    "Almoço · mandioca",
    "100g proteína · 100g mandioca · 60g leguminosa · vegetais · azeite",
    "almoco",
    [
      { foodId: "proteina_magra", amount: 100 },
      { foodId: "mandioca", amount: 100 },
      { foodId: "leguminosa", amount: 60 },
      { foodId: "vegetais_folhas", amount: 1 },
      { foodId: "azeite", amount: 5 },
    ]
  ),
  preset(
    "almoco_pronto",
    "🥡",
    "Almoço · refeição pronta",
    "Opção pronta de aproximadamente 350 kcal",
    "almoco",
    [{ foodId: "refeicao_pronta", amount: 1 }]
  ),
  preset(
    "lanche_tigela_granola",
    "🥣",
    "Lanche · granola",
    "Fruta · iogurte/kefir · 30g granola",
    "lanche_tarde",
    [
      { foodId: "fruta", amount: 125 },
      { foodId: "iogurte_kefir", amount: 150 },
      { foodId: "granola", amount: 30 },
    ]
  ),
  preset(
    "lanche_tigela_castanhas",
    "🥜",
    "Lanche · castanhas",
    "Fruta · iogurte/kefir · 15g castanhas",
    "lanche_tarde",
    [
      { foodId: "fruta", amount: 125 },
      { foodId: "iogurte_kefir", amount: 150 },
      { foodId: "oleaginosas", amount: 15 },
    ]
  ),
  preset(
    "lanche_tigela_cereal",
    "🥣",
    "Lanche · cereal",
    "Fruta · iogurte/kefir · 20g aveia/cereal",
    "lanche_tarde",
    [
      { foodId: "fruta", amount: 125 },
      { foodId: "iogurte_kefir", amount: 150 },
      { foodId: "aveia_cereal", amount: 20 },
    ]
  ),
  preset(
    "lanche_barra",
    "🍫",
    "Lanche · barra",
    "Fruta + 1 barra de proteína",
    "lanche_tarde",
    [
      { foodId: "fruta", amount: 125 },
      { foodId: "barra_proteina", amount: 1 },
    ]
  ),
  preset(
    "lanche_salgado",
    "🥟",
    "Lanche · salgado",
    "Fruta + salgado assado de aproximadamente 220 kcal",
    "lanche_tarde",
    [
      { foodId: "fruta", amount: 125 },
      { foodId: "salgado_assado", amount: 1 },
    ]
  ),
  preset(
    "lanche_panqueca",
    "🥞",
    "Lanche · panqueca",
    "Banana · 30g aveia · ovo · 10g sementes",
    "lanche_tarde",
    [
      { foodId: "banana", amount: 1 },
      { foodId: "aveia", amount: 30 },
      { foodId: "ovo", amount: 1 },
      { foodId: "sementes", amount: 10 },
    ]
  ),
  preset(
    "pre_treino_oficial",
    "🏃",
    "Pré-treino",
    "2 mariolas + 20g de castanhas",
    "pre_treino",
    [
      { foodId: "mariola", amount: 2 },
      { foodId: "castanhas", amount: 20 },
    ]
  ),
  preset(
    "aula_iogurte",
    "🎓",
    "Aula · iogurte",
    "1 iogurte com pelo menos 15g de proteína",
    "lanche_aula",
    [{ foodId: "iogurte_proteico", amount: 1 }]
  ),
  preset(
    "aula_nude",
    "🥤",
    "Aula · NUDE",
    "1 bebida proteica NUDE",
    "lanche_aula",
    [{ foodId: "nude_proteico", amount: 1 }]
  ),
  preset(
    "aula_sanduiche",
    "🥪",
    "Aula · sanduíche",
    "2 fatias · quark/cottage · 30g queijo · fruta",
    "lanche_aula",
    [
      { foodId: "pao_integral", amount: 2 },
      { foodId: "quark_cottage", amount: 20 },
      { foodId: "queijo_minas_bufala", amount: 30 },
      { foodId: "fruta", amount: 100 },
    ]
  ),
  preset(
    "jantar_cereal",
    "🌙",
    "Jantar · cereal",
    "100g proteína · 100g cereal · vegetais · azeite",
    "jantar",
    [
      { foodId: "proteina_magra", amount: 100 },
      { foodId: "carbo_cozido", amount: 100 },
      { foodId: "vegetais_folhas", amount: 1 },
      { foodId: "azeite", amount: 5 },
    ]
  ),
  preset(
    "jantar_batata",
    "🥔",
    "Jantar · batata",
    "100g proteína · 130g batata · vegetais · azeite",
    "jantar",
    [
      { foodId: "proteina_magra", amount: 100 },
      { foodId: "batata", amount: 130 },
      { foodId: "vegetais_folhas", amount: 1 },
      { foodId: "azeite", amount: 5 },
    ]
  ),
  preset(
    "jantar_mandioca",
    "🌿",
    "Jantar · mandioca",
    "100g proteína · 100g mandioca · vegetais · azeite",
    "jantar",
    [
      { foodId: "proteina_magra", amount: 100 },
      { foodId: "mandioca", amount: 100 },
      { foodId: "vegetais_folhas", amount: 1 },
      { foodId: "azeite", amount: 5 },
    ]
  ),
]);

export function setViviFoodChecked(rawDay, { groupId, foodId, checked, amount }) {
  const day = normalizeViviDietDay(rawDay);
  const group = viviFoodGroupForId(groupId);
  const food = viviFoodForGroup(group, foodId);
  if (!group || !food) return day;

  const selected = new Set(day.foods[groupId] || []);
  if (checked) {
    selected.add(foodId);
    day.amounts[groupId] = day.amounts[groupId] || {};
    day.amounts[groupId][foodId] = normalizeViviFoodQuantity(
      food,
      amount ?? day.amounts[groupId][foodId] ?? food.defaultQuantity
    );
  } else {
    selected.delete(foodId);
    if (day.amounts[groupId]) {
      delete day.amounts[groupId][foodId];
      if (!Object.keys(day.amounts[groupId]).length) delete day.amounts[groupId];
    }
  }
  const ordered = group.foods.map((entry) => entry.id).filter((id) => selected.has(id));
  if (ordered.length) day.foods[groupId] = ordered;
  else delete day.foods[groupId];
  return day;
}

export function toggleViviFoodQuantity(rawDay, { groupId, foodId, amount }) {
  const day = normalizeViviDietDay(rawDay);
  const group = viviFoodGroupForId(groupId);
  const food = viviFoodForGroup(group, foodId);
  if (!group || !food || !food.quantityChoices.includes(Number(amount))) return day;
  const normalizedAmount = normalizeViviFoodQuantity(food, amount);
  const selected = (day.foods[groupId] || []).includes(foodId);
  const currentAmount = day.amounts[groupId]?.[foodId] ?? food.defaultQuantity;
  return setViviFoodChecked(day, {
    groupId,
    foodId,
    checked: !(selected && sameQuantity(currentAmount, normalizedAmount)),
    amount: normalizedAmount,
  });
}

export function applyViviMealPreset(rawDay, presetId) {
  const selectedPreset = VIVI_MEAL_PRESETS.find((entry) => entry.id === presetId);
  let day = normalizeViviDietDay(rawDay);
  if (!selectedPreset) return day;
  for (const entry of selectedPreset.items) {
    day = setViviFoodChecked(day, {
      groupId: selectedPreset.groupId,
      foodId: entry.foodId,
      checked: true,
      amount: entry.amount,
    });
  }
  return day;
}

export function removeViviMealPreset(rawDay, presetId) {
  const selectedPreset = VIVI_MEAL_PRESETS.find((entry) => entry.id === presetId);
  let day = normalizeViviDietDay(rawDay);
  if (!selectedPreset) return day;
  for (const entry of selectedPreset.items) {
    day = setViviFoodChecked(day, {
      groupId: selectedPreset.groupId,
      foodId: entry.foodId,
      checked: false,
    });
  }
  return day;
}

export function isViviMealPresetApplied(rawDay, presetId) {
  const selectedPreset = VIVI_MEAL_PRESETS.find((entry) => entry.id === presetId);
  if (!selectedPreset) return false;
  const day = normalizeViviDietDay(rawDay);
  const selected = new Set(day.foods[selectedPreset.groupId] || []);
  return selectedPreset.items.every((entry) => (
    selected.has(entry.foodId)
      && sameQuantity(day.amounts[selectedPreset.groupId]?.[entry.foodId], entry.amount)
  ));
}

export function toggleViviMealPreset(rawDay, presetId) {
  return isViviMealPresetApplied(rawDay, presetId)
    ? removeViviMealPreset(rawDay, presetId)
    : applyViviMealPreset(rawDay, presetId);
}
