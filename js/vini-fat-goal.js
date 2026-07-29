// Projeção motivacional do objetivo de composição corporal do Vini.
// Não substitui avaliação clínica: bioimpedância, gasto e conversão kcal/kg
// são estimativas e devem ser recalibrados com as avaliações da nutricionista.

export const VINI_FAT_GOAL = Object.freeze({
  startDate: "2026-07-15",
  startBodyFatPct: 28,
  targetBodyFatPct: 18,
  ageYears: 36,
  heightCm: 186,
  kcalPerKgFat: 7700,
  defaultActivityLevel: "medium",
});

export const VINI_ACTIVITY_LEVELS = Object.freeze([
  Object.freeze({
    id: "low",
    label: "Baixa",
    detail: "rotina mais sentada",
    factor: 1.2,
  }),
  Object.freeze({
    id: "medium",
    label: "Média",
    detail: "algum movimento diário",
    factor: 1.3,
  }),
  Object.freeze({
    id: "high",
    label: "Alta",
    detail: "rotina bem movimentada",
    factor: 1.4,
  }),
]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dateEpoch(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function netKcalForDietRecord(record) {
  const netKcal = record?.summary?.netKcal;
  if (netKcal !== undefined && netKcal !== null && Number.isFinite(Number(netKcal))) {
    return Number(netKcal);
  }
  return Math.max(0, finite(record?.summary?.consumed?.kcal));
}

export function averageDietNutrition(records) {
  const valid = (Array.isArray(records) ? records : [])
    .filter((record) => validDate(record?.date));
  const totals = valid.reduce((sum, record) => ({
    kcal: sum.kcal + netKcalForDietRecord(record),
    p: sum.p + Math.max(0, finite(record?.summary?.consumed?.p)),
    c: sum.c + Math.max(0, finite(record?.summary?.consumed?.c)),
    f: sum.f + Math.max(0, finite(record?.summary?.consumed?.f)),
  }), { kcal: 0, p: 0, c: 0, f: 0 });
  const divisor = Math.max(1, valid.length);
  return {
    days: valid.length,
    averages: {
      kcal: totals.kcal / divisor,
      p: totals.p / divisor,
      c: totals.c / divisor,
      f: totals.f / divisor,
    },
  };
}

export function mifflinStJeorMale({
  weightKg,
  heightCm = VINI_FAT_GOAL.heightCm,
  ageYears = VINI_FAT_GOAL.ageYears,
} = {}) {
  const weight = finite(weightKg);
  if (!(weight > 0)) return 0;
  return 10 * weight + 6.25 * finite(heightCm) - 5 * finite(ageYears) + 5;
}

export function activityLevelFor(id) {
  return VINI_ACTIVITY_LEVELS.find((level) => level.id === id)
    || VINI_ACTIVITY_LEVELS.find((level) => level.id === VINI_FAT_GOAL.defaultActivityLevel);
}

function normalizedWeights(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => validDate(entry?.date) && finite(entry?.weight) > 0)
    .map((entry) => ({ date: entry.date, weight: finite(entry.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function closestWeight(entries, referenceDate) {
  const reference = dateEpoch(referenceDate);
  return [...entries].sort((a, b) => (
    Math.abs(dateEpoch(a.date) - reference) - Math.abs(dateEpoch(b.date) - reference)
  ))[0] || null;
}

function addDaysISO(iso, amount) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calculateViniFatGoal({
  records,
  weightEntries,
  activityLevel = VINI_FAT_GOAL.defaultActivityLevel,
  today,
  goal = VINI_FAT_GOAL,
} = {}) {
  const weights = normalizedWeights(weightEntries);
  const startWeightEntry = closestWeight(weights, goal.startDate);
  const currentWeightEntry = weights.at(-1) || null;
  const level = activityLevelFor(activityLevel);
  const goalRecords = (Array.isArray(records) ? records : [])
    .filter((record) => validDate(record?.date) && record.date >= goal.startDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nutrition = averageDietNutrition(goalRecords);

  if (!startWeightEntry || !currentWeightEntry) {
    return {
      available: false,
      activityLevel: level,
      records: nutrition.days,
      reason: "weight",
    };
  }

  const startBodyFat = clamp(finite(goal.startBodyFatPct) / 100, 0.01, 0.8);
  const targetBodyFat = clamp(finite(goal.targetBodyFatPct) / 100, 0.01, startBodyFat - 0.001);
  const startWeightKg = startWeightEntry.weight;
  const leanMassKg = startWeightKg * (1 - startBodyFat);
  const targetWeightKg = leanMassKg / (1 - targetBodyFat);
  const fatToLoseKg = Math.max(0, startWeightKg - targetWeightKg);
  const totalGoalKcal = fatToLoseKg * finite(goal.kcalPerKgFat, 7700);
  const restingKcal = mifflinStJeorMale({
    weightKg: currentWeightEntry.weight,
    heightCm: goal.heightCm,
    ageYears: goal.ageYears,
  });
  const maintenanceKcal = restingKcal * level.factor;
  const cumulativeDeficitKcal = goalRecords.reduce(
    (sum, record) => sum + maintenanceKcal - netKcalForDietRecord(record),
    0,
  );
  const achievedDeficitKcal = clamp(cumulativeDeficitKcal, 0, totalGoalKcal);
  const remainingKcal = Math.max(0, totalGoalKcal - achievedDeficitKcal);
  const averageDeficitKcal = nutrition.days
    ? cumulativeDeficitKcal / nutrition.days
    : 0;
  const remainingFatKg = remainingKcal / finite(goal.kcalPerKgFat, 7700);
  const progressPct = totalGoalKcal > 0 ? (achievedDeficitKcal / totalGoalKcal) * 100 : 100;
  const projectedDays = averageDeficitKcal > 0 && remainingKcal > 0
    ? Math.ceil(remainingKcal / averageDeficitKcal)
    : remainingKcal === 0 ? 0 : null;
  const projectionDate = projectedDays === null
    ? null
    : addDaysISO(validDate(today) ? today : goalRecords.at(-1)?.date || goal.startDate, projectedDays);

  return {
    available: true,
    activityLevel: level,
    records: nutrition.days,
    averages: nutrition.averages,
    startWeightDate: startWeightEntry.date,
    startWeightKg,
    currentWeightKg: currentWeightEntry.weight,
    leanMassKg,
    targetWeightKg,
    fatToLoseKg,
    totalGoalKcal,
    restingKcal,
    maintenanceKcal,
    cumulativeDeficitKcal,
    achievedDeficitKcal,
    remainingKcal,
    remainingFatKg,
    averageDeficitKcal,
    progressPct,
    projectedDays,
    projectionDate,
  };
}
