import assert from "node:assert/strict";
import {
  RUN_SESSION_TYPES,
  RUNNING_PLAN,
  RUNNING_PLAN_BASELINE,
  currentRunPlanWeek,
  runPlanCompletions,
  validRunPlanSession,
  validRunPlanWeek,
} from "../js/running-plan.js";

assert.equal(RUNNING_PLAN.length, 8);
assert.deepEqual(RUN_SESSION_TYPES.map((session) => session.id), ["easy", "interval", "long"]);
assert.match(RUNNING_PLAN[0].sessions.easy, /3 min/);
assert.match(RUNNING_PLAN.at(-1).sessions.long, /5 km/);
assert.equal(RUNNING_PLAN_BASELINE.runningMinutes, 24.2);
assert.equal(RUNNING_PLAN_BASELINE.averageHeartRate, 137);
assert.equal(validRunPlanWeek(1), 1);
assert.equal(validRunPlanWeek(9), null);
assert.equal(validRunPlanSession("interval"), "interval");
assert.equal(validRunPlanSession("free"), null);

const weekOne = [
  { date: "2026-09-15", run_km: 2.1, run_plan_week: 1, run_plan_session: "easy" },
  { date: "2026-09-17", run_km: 2.4, run_plan_week: 1, run_plan_session: "interval" },
  { date: "2026-09-19", run_km: 3, run_plan_week: 1, run_plan_session: "long" },
  { date: "2026-09-20", run_km: 4, run_plan_week: null, run_plan_session: null },
];
assert.equal(runPlanCompletions(weekOne).size, 3);
assert.equal(currentRunPlanWeek(weekOne), 2);
assert.equal(currentRunPlanWeek(weekOne.slice(0, 2)), 1);

console.log("running-plan: ok");
