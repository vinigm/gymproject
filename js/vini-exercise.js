// Estimativa de gasto ativo para o diário alimentar do Kg Vini.
//
// METs: 2024 Adult Compendium of Physical Activities.
// https://pacompendium.com/adult-compendium/
//
// O Compêndio define 1 MET como aproximadamente 1 kcal/kg/h. Como a meta
// alimentar diária já pressupõe o gasto de repouso, descontamos 1 MET antes
// de calcular: (MET - 1) × peso (kg) × duração (h). O resultado é uma
// estimativa de calorias ativas, não uma medição clínica ou de relógio.

export const VINI_EXERCISE_DURATIONS = Object.freeze([20, 30, 45, 60, 75, 90]);

export const VINI_EXERCISE_TYPES = Object.freeze({
  strength: Object.freeze({
    id: "strength",
    icon: "🏋️",
    label: "Musculação",
    intensities: Object.freeze({
      light: Object.freeze({ label: "Leve", met: 3.5, hint: "carga leve e pausas longas" }),
      moderate: Object.freeze({ label: "Média", met: 5, hint: "séries regulares, esforço moderado" }),
      intense: Object.freeze({ label: "Intensa", met: 6, hint: "esforço vigoroso" }),
    }),
  }),
  run: Object.freeze({
    id: "run",
    icon: "🏃",
    label: "Corrida",
    intensities: Object.freeze({
      light: Object.freeze({ label: "Leve", met: 7.5, hint: "trote confortável" }),
      moderate: Object.freeze({ label: "Média", met: 9.3, hint: "ritmo perto de 9,7 km/h" }),
      intense: Object.freeze({ label: "Intensa", met: 10.5, hint: "ritmo perto de 10,8 km/h" }),
    }),
  }),
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeViniExercises(raw) {
  const normalized = {};
  for (const [typeId, type] of Object.entries(VINI_EXERCISE_TYPES)) {
    const source = raw?.[typeId];
    if (!source || !type.intensities[source.intensity]) continue;
    const requestedMinutes = Math.round(finiteNumber(source.minutes, 60));
    const minutes = VINI_EXERCISE_DURATIONS.includes(requestedMinutes) ? requestedMinutes : 60;
    normalized[typeId] = { intensity: source.intensity, minutes };
  }
  return normalized;
}

export function hasViniExercise(exercises) {
  return Object.keys(normalizeViniExercises(exercises)).length > 0;
}

export function toggleViniExerciseIntensity(raw, typeId, intensity) {
  const exercises = normalizeViniExercises(raw);
  const type = VINI_EXERCISE_TYPES[typeId];
  if (!type?.intensities[intensity]) return exercises;
  if (exercises[typeId]?.intensity === intensity) {
    delete exercises[typeId];
    return exercises;
  }
  exercises[typeId] = {
    intensity,
    minutes: exercises[typeId]?.minutes || 60,
  };
  return exercises;
}

export function setViniExerciseDuration(raw, typeId, minutes) {
  const exercises = normalizeViniExercises(raw);
  if (!exercises[typeId]) return exercises;
  const normalizedMinutes = Math.round(finiteNumber(minutes));
  if (!VINI_EXERCISE_DURATIONS.includes(normalizedMinutes)) return exercises;
  exercises[typeId].minutes = normalizedMinutes;
  return exercises;
}

export function estimateViniExerciseKcal({ typeId, intensity, minutes, weightKg }) {
  const definition = VINI_EXERCISE_TYPES[typeId]?.intensities[intensity];
  const weight = finiteNumber(weightKg);
  const duration = finiteNumber(minutes);
  if (!definition || weight <= 0 || duration <= 0) return 0;
  return Math.round(Math.max(0, definition.met - 1) * weight * (duration / 60));
}

export function estimateViniExercises(raw, weightKg) {
  const exercises = normalizeViniExercises(raw);
  const items = Object.entries(exercises).map(([typeId, exercise]) => ({
    typeId,
    ...exercise,
    kcal: estimateViniExerciseKcal({ typeId, ...exercise, weightKg }),
  }));
  return {
    items,
    totalKcal: items.reduce((total, item) => total + item.kcal, 0),
  };
}
