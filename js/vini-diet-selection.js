import {
  foodForGroup,
  foodGroupForId,
  normalizeFoodQuantity,
  normalizeViniDietDay,
} from "./vini-diet-plan.js";

function sameQuantity(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.001;
}

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
