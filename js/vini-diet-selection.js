import {
  foodForGroup,
  foodGroupForId,
  normalizeFoodQuantity,
  normalizeViniDietDay,
} from "./vini-diet-plan.js";

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
    items: Object.freeze(items.map((item) => Object.freeze(item))),
  });
}

export const VINI_MEAL_PRESETS = Object.freeze([
  preset(
    "cafe_padrao",
    "🌅",
    "Café da manhã",
    "3 ovos · 2 fatias · 15g requeijão",
    "cafe_manha",
    [
      { foodId: "ovos", amount: 3 },
      { foodId: "pao", amount: 2 },
      { foodId: "requeijao", amount: 15 },
    ]
  ),
  preset(
    "almoco_padrao",
    "☀️",
    "Almoço",
    "150g arroz · 120g frango · 50g salada · 15ml azeite",
    "almoco",
    [
      { foodId: "arroz", amount: 150 },
      { foodId: "frango", amount: 120 },
      { foodId: "vegetais", amount: 50 },
      { foodId: "azeite", amount: 15 },
    ]
  ),
  preset(
    "lanche_padrao",
    "🥪",
    "Lanche da tarde",
    "3 ovos · 2 fatias · 15g requeijão · 2 medidas whey",
    "lanche_tarde",
    [
      { foodId: "ovos", amount: 3 },
      { foodId: "pao", amount: 2 },
      { foodId: "requeijao", amount: 15 },
      { foodId: "whey", amount: 2 },
    ]
  ),
  preset(
    "jantar_padrao",
    "🌙",
    "Jantar",
    "150g arroz · 120g frango · 50g salada · 15ml azeite",
    "jantar",
    [
      { foodId: "arroz", amount: 150 },
      { foodId: "frango", amount: 120 },
      { foodId: "vegetais", amount: 50 },
      { foodId: "azeite", amount: 15 },
    ]
  ),
]);

export function setViniFoodChecked(rawDay, { groupId, foodId, checked, amount }) {
  const day = normalizeViniDietDay(rawDay);
  const group = foodGroupForId(groupId);
  const food = foodForGroup(group, foodId);
  if (!group || !food) return day;

  const selected = new Set(day.foods[groupId] || []);
  if (checked) {
    selected.add(foodId);
    day.amounts[groupId] = day.amounts[groupId] || {};
    day.amounts[groupId][foodId] = normalizeFoodQuantity(
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

export function toggleViniFoodQuantity(rawDay, { groupId, foodId, amount }) {
  const day = normalizeViniDietDay(rawDay);
  const group = foodGroupForId(groupId);
  const food = foodForGroup(group, foodId);
  if (!group || !food || !food.quantityChoices.includes(Number(amount))) return day;

  const normalizedAmount = normalizeFoodQuantity(food, amount);
  const isSelected = (day.foods[groupId] || []).includes(foodId);
  const selectedAmount = day.amounts[groupId]?.[foodId] ?? food.defaultQuantity;
  const shouldRemove = isSelected && sameQuantity(selectedAmount, normalizedAmount);

  return setViniFoodChecked(day, {
    groupId,
    foodId,
    checked: !shouldRemove,
    amount: normalizedAmount,
  });
}

export function applyViniMealPreset(rawDay, presetId) {
  const selectedPreset = VINI_MEAL_PRESETS.find((entry) => entry.id === presetId);
  let day = normalizeViniDietDay(rawDay);
  if (!selectedPreset) return day;

  for (const item of selectedPreset.items) {
    day = setViniFoodChecked(day, {
      groupId: selectedPreset.groupId,
      foodId: item.foodId,
      checked: true,
      amount: item.amount,
    });
  }
  return day;
}

export function isViniMealPresetApplied(rawDay, presetId) {
  const selectedPreset = VINI_MEAL_PRESETS.find((entry) => entry.id === presetId);
  if (!selectedPreset) return false;
  const day = normalizeViniDietDay(rawDay);
  const selectedFoods = new Set(day.foods[selectedPreset.groupId] || []);

  return selectedPreset.items.every((item) => (
    selectedFoods.has(item.foodId)
      && sameQuantity(day.amounts[selectedPreset.groupId]?.[item.foodId], item.amount)
  ));
}
