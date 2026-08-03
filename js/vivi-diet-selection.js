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
    "base_desjejum",
    "🌅",
    "Desjejum",
    "18g whey · 30g aveia · 100ml leite · 70g banana",
    "desjejum",
    [
      { foodId: "whey_probiotica", amount: 18 },
      { foodId: "aveia_floco_g", amount: 30 },
      { foodId: "leite_semidesnatado", amount: 100 },
      { foodId: "banana_prata_g", amount: 70 },
    ]
  ),
  preset(
    "base_almoco",
    "☀️",
    "Almoço",
    "100g alcatra · 170g aipim · 15g azeite",
    "almoco",
    [
      { foodId: "alcatra_grelhada", amount: 100 },
      { foodId: "aipim_cozido", amount: 170 },
      { foodId: "azeite_g", amount: 15 },
    ]
  ),
  preset(
    "base_lanche_tarde",
    "🥤",
    "Lanche da tarde",
    "120g banana · 31g whey",
    "lanche_tarde",
    [
      { foodId: "banana_prata_g", amount: 120 },
      { foodId: "whey_probiotica", amount: 31 },
    ]
  ),
  preset(
    "whey_agua",
    "🥤",
    "Whey com água",
    "1 dose · 31g",
    "suplemento",
    [
      { foodId: "whey_probiotica", amount: 31 },
    ]
  ),
  preset(
    "base_pre_treino",
    "🏃",
    "Pré-treino",
    "34g mariola · 15g pasta de amendoim",
    "pre_treino",
    [
      { foodId: "mariola_g", amount: 34 },
      { foodId: "pasta_amendopower", amount: 15 },
    ]
  ),
  preset(
    "base_jantar",
    "🌙",
    "Jantar",
    "100g alcatra · 170g aipim · 15g azeite",
    "jantar",
    [
      { foodId: "alcatra_grelhada", amount: 100 },
      { foodId: "aipim_cozido", amount: 170 },
      { foodId: "azeite_g", amount: 15 },
    ]
  ),
  preset(
    "base_ceia",
    "🍎",
    "Ceia",
    "30g maçã Fuji · 30g castanha-de-caju",
    "ceia",
    [
      { foodId: "maca_fuji", amount: 30 },
      { foodId: "castanha_caju", amount: 30 },
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
