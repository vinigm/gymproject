import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  TRACKING_CYCLES,
  filterRecordsForTrackingScope,
} from "../js/tracking-cycle.js";

assert.equal(TRACKING_CYCLES.vinicius.startDate, "2026-09-15");
assert.equal(TRACKING_CYCLES.victoria.startDate, "2026-07-15");

const records = [
  { date: "2026-09-14", value: "histórico" },
  { date: "2026-09-15", value: "novo ciclo" },
  { date: "2026-09-16", value: "novo ciclo" },
];
assert.deepEqual(
  filterRecordsForTrackingScope(records, "vinicius").map((record) => record.date),
  ["2026-09-15", "2026-09-16"],
);

const kgPage = await readFile(new URL("../js/kg-vivi-page.js", import.meta.url), "utf8");
const activityUi = await readFile(new URL("../js/kg-activity-ui.js", import.meta.url), "utf8");
assert.match(kgPage, /data-section="academia"/);
assert.match(kgPage, /data-section="corrida"/);
assert.match(kgPage, /histórico completo/);
assert.match(activityUi, /Costa/);
assert.match(activityUi, /Abdominal/);
assert.match(activityUi, /WATER_LITRES_OPTIONS/);
assert.match(activityUi, /RUN_KM_OPTIONS/);
assert.match(activityUi, /saveDay\(state\.userId, state\.selectedDate, payload\)/);
assert.deepEqual(
  filterRecordsForTrackingScope(records, "vinicius", "all").map((record) => record.date),
  records.map((record) => record.date),
);

console.log("tracking-cycle: ok");
