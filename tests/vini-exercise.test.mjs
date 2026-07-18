import assert from "node:assert/strict";
import {
  VINI_EXERCISE_TYPES,
  estimateViniExerciseKcal,
  estimateViniExercises,
  normalizeViniExercises,
  setViniExerciseDuration,
  toggleViniExerciseIntensity,
} from "../js/vini-exercise.js";
import {
  calculateViniDietDay,
  emptyViniDietDay,
  normalizeViniDietDay,
  withViniDietSummary,
} from "../js/vini-diet-plan.js";

assert.deepEqual(
  Object.fromEntries(Object.entries(VINI_EXERCISE_TYPES.strength.intensities).map(([id, value]) => [id, value.met])),
  { light: 3.5, moderate: 5, intense: 6 }
);
assert.deepEqual(
  Object.fromEntries(Object.entries(VINI_EXERCISE_TYPES.run.intensities).map(([id, value]) => [id, value.met])),
  { light: 7.5, moderate: 9.3, intense: 10.5 }
);

// Gasto ativo: (MET - 1) × peso × duração. Para 80 kg e 60 min:
assert.equal(estimateViniExerciseKcal({ typeId: "strength", intensity: "light", minutes: 60, weightKg: 80 }), 200);
assert.equal(estimateViniExerciseKcal({ typeId: "strength", intensity: "moderate", minutes: 60, weightKg: 80 }), 320);
assert.equal(estimateViniExerciseKcal({ typeId: "strength", intensity: "intense", minutes: 60, weightKg: 80 }), 400);
assert.equal(estimateViniExerciseKcal({ typeId: "run", intensity: "light", minutes: 60, weightKg: 80 }), 520);
assert.equal(estimateViniExerciseKcal({ typeId: "run", intensity: "moderate", minutes: 60, weightKg: 80 }), 664);
assert.equal(estimateViniExerciseKcal({ typeId: "run", intensity: "intense", minutes: 60, weightKg: 80 }), 760);

let exercises = toggleViniExerciseIntensity({}, "strength", "moderate");
assert.deepEqual(exercises, { strength: { intensity: "moderate", minutes: 60 } });
exercises = setViniExerciseDuration(exercises, "strength", 45);
assert.equal(exercises.strength.minutes, 45);
exercises = toggleViniExerciseIntensity(exercises, "run", "light");
assert.equal(estimateViniExercises(exercises, 80).totalKcal, 760);

// Tocar novamente na intensidade ativa retira somente aquela atividade.
exercises = toggleViniExerciseIntensity(exercises, "strength", "moderate");
assert.deepEqual(exercises, { run: { intensity: "light", minutes: 60 } });
assert.deepEqual(normalizeViniExercises({ run: { intensity: "wrong", minutes: 42 } }), {});

const day = emptyViniDietDay();
day.exercises = { strength: { intensity: "moderate", minutes: 60 } };
day.exerciseWeightKg = 80;
const normalized = normalizeViniDietDay(day);
assert.equal(normalized.trainingDay, true);
const calculated = calculateViniDietDay(normalized);
assert.equal(calculated.exerciseKcal, 320);
assert.equal(calculated.netKcal, -320);
assert.equal(calculated.hydrationTargetMl, 3000);
assert.equal(calculated.hasData, true);

const snapshot = withViniDietSummary(normalized);
assert.equal(snapshot.summary.exerciseKcal, 320);
assert.equal(snapshot.summary.netKcal, -320);
assert.equal(snapshot.summary.exerciseWeightKg, 80);

console.log("vini-exercise: ok");
