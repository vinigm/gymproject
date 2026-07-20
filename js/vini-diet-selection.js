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
    "almoco_guisado",
    "🥩",
    "Almoço · guisado",
    "120g guisado · 150g arroz · 70g legumes",
    "almoco",
    [
      { foodId: "guisado", amount: 120 },
      { foodId: "arroz", amount: 150 },
      { foodId: "vegetais", amount: 70 },
    ]
  ),
  preset(
    "lanche_whey",
    "🥪",
    "Lanche + whey",
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
    "lanche_piracanjuba",
    "🥤",
    "Lanche + Piracanjuba",
    "3 ovos · 2 fatias · 15g requeijão · 1 Pro Force 23g",
    "lanche_tarde",
    [
      { foodId: "ovos", amount: 3 },
      { foodId: "pao", amount: 2 },
      { foodId: "requeijao", amount: 15 },
      { foodId: "pro_force", amount: 1 },
    ]
  ),
  preset(
    "lanche_pasta_amendoim_whey",
    "🥜",
    "Lanche - Pasta de amendoim + whey",
    "2 fatias · 30g Amendopower · 3 medidas whey",
    "lanche_tarde",
    [
      { foodId: "pao", amount: 2 },
      { foodId: "pasta_amendoim_amendopower", amount: 30 },
      { foodId: "whey", amount: 3 },
    ]
  ),
  preset(
    "pre_treino_padrao",
    "🏃",
    "Pré-treino",
    "2 bananas",
    "pre_treino",
    [
      { foodId: "banana", amount: 2 },
    ]
  ),
  preset(
    "pos_treino_padrao",
    "💪",
    "Pós-treino",
    "2 medidas de whey",
    "pos_treino",
    [
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
  preset(
    "jantar_guisado",
    "🥩",
    "Janta · guisado",
    "120g guisado · 150g arroz · 70g legumes",
    "jantar",
    [
      { foodId: "guisado", amount: 120 },
      { foodId: "arroz", amount: 150 },
      { foodId: "vegetais", amount: 70 },
    ]
  ),
  preset(
    "churrasco",
    "🔥",
    "Churrasco",
    "1 pão de alho · 300g carne · 70g salsichão · 50g coração",
    "jantar",
    [
      { foodId: "pao_alho_santa_massa", amount: 1 },
      { foodId: "carne_churrasco", amount: 300 },
      { foodId: "salsichao", amount: 70 },
      { foodId: "coracao_galinha", amount: 50 },
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

export function removeViniMealPreset(rawDay, presetId) {
  const selectedPreset = VINI_MEAL_PRESETS.find((entry) => entry.id === presetId);
  let day = normalizeViniDietDay(rawDay);
  if (!selectedPreset) return day;

  for (const item of selectedPreset.items) {
    day = setViniFoodChecked(day, {
      groupId: selectedPreset.groupId,
      foodId: item.foodId,
      checked: false,
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

export function toggleViniMealPreset(rawDay, presetId) {
  return isViniMealPresetApplied(rawDay, presetId)
    ? removeViniMealPreset(rawDay, presetId)
    : applyViniMealPreset(rawDay, presetId);
}
