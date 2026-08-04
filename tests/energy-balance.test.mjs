import assert from "node:assert/strict";
import {
  ENERGY_BALANCE_PROFILES,
  calculateEnergyBalance,
  energyBalanceForRecord,
  mifflinStJeor,
  weightForEnergyDate,
} from "../js/energy-balance.js";

assert.equal(mifflinStJeor({
  weightKg: 80,
  heightCm: 163,
  ageYears: 28,
  sex: "female",
}), 1517.75);

const weights = [
  { date: "2026-07-01", weight: 62 },
  { date: "2026-07-20", weight: 61 },
];
assert.equal(weightForEnergyDate(weights, "2026-07-15").weight, 62);
assert.equal(weightForEnergyDate(weights, "2026-06-15").weight, 62);

const vini = calculateEnergyBalance({
  consumedKcal: 2000,
  exerciseKcal: 400,
  weightKg: 90,
  profile: ENERGY_BALANCE_PROFILES.vinicius,
});
assert.equal(vini.available, true);
assert.equal(Math.round(vini.adjustedExerciseKcal), 280);
assert.equal(Math.round(vini.expenditureKcal), 2488);
assert.equal(Math.round(vini.balanceKcal), -488);

const vivi = calculateEnergyBalance({
  consumedKcal: 2100,
  exerciseKcal: 300,
  weightKg: 62,
  profile: ENERGY_BALANCE_PROFILES.victoria,
});
assert.equal(vivi.available, true);
assert.equal(Math.round(vivi.restingKcal), 1338);
assert.equal(Math.round(vivi.expenditureKcal), 2213);
assert.equal(Math.round(vivi.balanceKcal), -113);

const legacyExercise = energyBalanceForRecord({
  date: "2026-07-15",
  summary: { consumed: { kcal: 2200 }, netKcal: 1900 },
}, { weightEntries: weights, userId: "victoria" });
assert.equal(legacyExercise.exerciseKcal, 300);

assert.equal(calculateEnergyBalance({ consumedKcal: 1000 }).available, false);

console.log("energy-balance: ok");
