// Estimativa compartilhada de saldo energético. Os coeficientes são
// deliberadamente conservadores: evitam superestimar o déficit do Vini e
// evitam superestimar o superávit da Vivi.

export const ENERGY_BALANCE_PROFILES = Object.freeze({
  vinicius: Object.freeze({
    userId: "vinicius",
    ageYears: 36,
    heightCm: 186,
    sex: "male",
    defaultActivityFactor: 1.3,
    routineSafetyFactor: 0.9,
    exerciseSafetyFactor: 0.7,
    goal: "deficit",
  }),
  victoria: Object.freeze({
    userId: "victoria",
    ageYears: 28,
    heightCm: 163,
    sex: "female",
    defaultActivityFactor: 1.3,
    routineSafetyFactor: 1.1,
    exerciseSafetyFactor: 1,
    goal: "surplus",
  }),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function energyProfileFor(userId) {
  return ENERGY_BALANCE_PROFILES[userId] || ENERGY_BALANCE_PROFILES.vinicius;
}

export function mifflinStJeor({ weightKg, heightCm, ageYears, sex } = {}) {
  const weight = finite(weightKg);
  const height = finite(heightCm);
  const age = finite(ageYears);
  if (!(weight > 0) || !(height > 0) || !(age > 0)) return 0;
  return 10 * weight + 6.25 * height - 5 * age + (sex === "female" ? -161 : 5);
}

export function weightForEnergyDate(entries, date) {
  const weights = (Array.isArray(entries) ? entries : [])
    .filter((entry) => validDate(entry?.date) && finite(entry?.weight) > 0)
    .map((entry) => ({ date: entry.date, weight: finite(entry.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!weights.length) return null;
  const onOrBefore = weights.filter((entry) => entry.date <= date);
  return onOrBefore.at(-1) || weights[0];
}

export function calculateEnergyBalance({
  consumedKcal = 0,
  exerciseKcal = 0,
  weightKg,
  profile = ENERGY_BALANCE_PROFILES.vinicius,
  activityFactor = profile.defaultActivityFactor,
} = {}) {
  const restingKcal = mifflinStJeor({
    weightKg,
    heightCm: profile.heightCm,
    ageYears: profile.ageYears,
    sex: profile.sex,
  });
  if (!(restingKcal > 0)) return { available: false, reason: "weight" };

  const intakeKcal = Math.max(0, finite(consumedKcal));
  const trainingKcal = Math.max(0, finite(exerciseKcal));
  const routineFactor = Math.max(1, finite(activityFactor, profile.defaultActivityFactor));
  const routineGrossKcal = restingKcal * routineFactor;
  const routineKcal = routineGrossKcal * profile.routineSafetyFactor;
  const adjustedExerciseKcal = trainingKcal * profile.exerciseSafetyFactor;
  const expenditureKcal = routineKcal + adjustedExerciseKcal;
  const balanceKcal = intakeKcal - expenditureKcal;

  return {
    available: true,
    userId: profile.userId,
    goal: profile.goal,
    weightKg: finite(weightKg),
    consumedKcal: intakeKcal,
    exerciseKcal: trainingKcal,
    restingKcal,
    activityFactor: routineFactor,
    routineGrossKcal,
    routineSafetyFactor: profile.routineSafetyFactor,
    routineKcal,
    exerciseSafetyFactor: profile.exerciseSafetyFactor,
    adjustedExerciseKcal,
    expenditureKcal,
    balanceKcal,
    deficitKcal: -balanceKcal,
  };
}

export function energyBalanceForRecord(record, {
  weightEntries = [],
  userId = "vinicius",
  activityFactor,
} = {}) {
  const profile = energyProfileFor(userId);
  const weightEntry = weightForEnergyDate(weightEntries, record?.date);
  const consumedKcal = Number(record?.summary?.consumed?.kcal) || 0;
  const legacyNetKcal = Number(record?.summary?.netKcal);
  const exerciseKcal = Number.isFinite(Number(record?.summary?.exerciseKcal))
    ? Number(record.summary.exerciseKcal)
    : Number.isFinite(legacyNetKcal)
      ? Math.max(0, consumedKcal - legacyNetKcal)
      : 0;
  return calculateEnergyBalance({
    consumedKcal,
    exerciseKcal,
    weightKg: weightEntry?.weight,
    profile,
    activityFactor: activityFactor ?? profile.defaultActivityFactor,
  });
}

export function enrichEnergyBalanceRecords(records, options = {}) {
  return (Array.isArray(records) ? records : []).map((record) => ({
    ...record,
    summary: {
      ...record.summary,
      energyBalance: energyBalanceForRecord(record, options),
    },
  }));
}

export function balanceKcalForRecord(record) {
  const balance = record?.summary?.energyBalance;
  if (balance?.available && Number.isFinite(Number(balance.balanceKcal))) {
    return Number(balance.balanceKcal);
  }
  const netKcal = record?.summary?.netKcal;
  if (netKcal !== undefined && netKcal !== null && Number.isFinite(Number(netKcal))) {
    return Number(netKcal);
  }
  return Number(record?.summary?.consumed?.kcal) || 0;
}
