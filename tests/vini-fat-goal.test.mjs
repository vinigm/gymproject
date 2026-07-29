import assert from "node:assert/strict";
import {
  VINI_FAT_GOAL,
  activityLevelFor,
  averageDietNutrition,
  calculateViniFatGoal,
  estimateSkeletalMuscleKg,
  mifflinStJeorMale,
} from "../js/vini-fat-goal.js";

const records = [
  { date: "2026-07-14", summary: { consumed: { kcal: 2500, p: 130, c: 220, f: 80 }, netKcal: 2300 } },
  { date: "2026-07-15", summary: { consumed: { kcal: 2200, p: 150, c: 200, f: 70 }, netKcal: 2000 } },
  { date: "2026-07-16", summary: { consumed: { kcal: 2350, p: 160, c: 210, f: 72 }, netKcal: 2000 } },
];
const weights = [
  { date: "2026-07-15", weight: 100 },
  { date: "2026-07-16", weight: 98 },
];

assert.equal(mifflinStJeorMale({ weightKg: 98 }), 1967.5);
assert.equal(Math.round(estimateSkeletalMuscleKg({ weightKg: 100 }) * 10) / 10, 38.7);
assert.equal(activityLevelFor("medium").factor, 1.3);
assert.equal(activityLevelFor("invalid").id, VINI_FAT_GOAL.defaultActivityLevel);

const averages = averageDietNutrition(records);
assert.equal(averages.days, 3);
assert.equal(Math.round(averages.averages.kcal), 2100);
assert.equal(Math.round(averages.averages.p * 10) / 10, 146.7);

const progress = calculateViniFatGoal({
  records,
  weightEntries: weights,
  activityLevel: "medium",
  today: "2026-07-17",
});
assert.equal(progress.available, true);
assert.equal(progress.records, 2);
assert.equal(progress.startWeightKg, 100);
assert.equal(progress.currentWeightKg, 98);
assert.equal(Math.round(progress.leanMassKg), 72);
assert.equal(Math.round(progress.targetWeightKg * 10) / 10, 87.8);
assert.equal(Math.round(progress.fatToLoseKg * 10) / 10, 12.2);
assert.equal(Math.round(progress.maintenanceKcal), 2558);
assert.equal(Math.round(progress.averageDeficitKcal), 558);
assert.ok(progress.remainingKcal < progress.totalGoalKcal);
assert.equal(progress.estimatedFatLostKg, progress.achievedDeficitKcal / 7700);
assert.ok(progress.estimatedFatLostKg > 0);
assert.ok(progress.progressPct > 1);
assert.match(progress.projectionDate, /^2026-\d{2}-\d{2}$/);
assert.equal(Math.round((
  progress.composition.today.fatKg
  + progress.composition.today.muscleKg
  + progress.composition.today.otherKg
) * 10) / 10, Math.round(progress.composition.today.totalWeightKg * 10) / 10);
assert.equal(progress.composition.today.muscleKg, progress.composition.target.muscleKg);
assert.equal(progress.composition.today.otherKg, progress.composition.target.otherKg);
assert.equal(Math.round(progress.composition.target.bodyFatPct), 18);

const customTarget = calculateViniFatGoal({
  records,
  weightEntries: weights,
  activityLevel: "medium",
  today: "2026-07-17",
  goal: { ...VINI_FAT_GOAL, targetBodyFatPct: 20 },
});
assert.equal(customTarget.targetBodyFatPct, 20);
assert.ok(customTarget.totalGoalKcal < progress.totalGoalKcal);
assert.ok(customTarget.composition.target.fatKg > progress.composition.target.fatKg);

const lowActivity = calculateViniFatGoal({
  records,
  weightEntries: weights,
  activityLevel: "low",
  today: "2026-07-17",
});
const highActivity = calculateViniFatGoal({
  records,
  weightEntries: weights,
  activityLevel: "high",
  today: "2026-07-17",
});
assert.ok(highActivity.maintenanceKcal > lowActivity.maintenanceKcal);
assert.ok(highActivity.remainingKcal < lowActivity.remainingKcal);
assert.ok(highActivity.projectedDays < lowActivity.projectedDays);

const missingWeight = calculateViniFatGoal({ records, weightEntries: [] });
assert.equal(missingWeight.available, false);
assert.equal(missingWeight.reason, "weight");

const surplus = calculateViniFatGoal({
  records: [{ date: "2026-07-15", summary: { consumed: { kcal: 4000 }, netKcal: 4000 } }],
  weightEntries: weights,
  today: "2026-07-17",
});
assert.equal(surplus.projectedDays, null);
assert.equal(surplus.projectionDate, null);

console.log("vini-fat-goal: ok");
