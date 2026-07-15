import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RUN_KM_OPTIONS,
  isTrackerMultiGroup,
  normalizeRunKm,
  normalizeTrackerDay,
  toggleTrackerValue,
} from "../js/tracker-model.js";

const expected = [2.5, 3, 4, 5, 6, 7, 8, 9, 10];
assert.deepEqual(RUN_KM_OPTIONS, expected);
assert.equal(isTrackerMultiGroup("exercises"), true);
assert.equal(isTrackerMultiGroup("run_km"), false);
assert.equal(normalizeRunKm(undefined), null);
assert.equal(normalizeRunKm("2.5"), 2.5);
assert.equal(normalizeRunKm(2), null);
assert.equal(normalizeTrackerDay({ exercises: ["corrida"] }).run_km, null);

const day = { exercises: [] };
toggleTrackerValue(day, "exercises", "corrida");
assert.deepEqual(day.exercises, ["corrida"]);
toggleTrackerValue(day, "run_km", "2.5");
assert.equal(day.run_km, 2.5);
toggleTrackerValue(day, "run_km", "3");
assert.equal(day.run_km, 3);
toggleTrackerValue(day, "exercises", "corrida");
assert.deepEqual(day.exercises, []);
assert.equal(day.run_km, null);

const sameDistance = { exercises: ["corrida"], run_km: 5 };
toggleTrackerValue(sameDistance, "run_km", "5");
assert.equal(sameDistance.run_km, null);

const invalidDistance = { exercises: ["corrida"], run_km: null };
toggleTrackerValue(invalidDistance, "run_km", "2");
assert.equal(invalidDistance.run_km, null);

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const groups = [...html.matchAll(/<div class="chip-grid chip-grid--3" data-group="run_km">([\s\S]*?)<\/div>/g)];
assert.equal(groups.length, 2);
for (const [, contents] of groups) {
  const values = [...contents.matchAll(/data-value="([^"]+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(values, expected);
}

// Regressão: paintCard precisa consultar a regra exportada; uma referência
// local inexistente impede Academia, Corrida, Jiu e Alongamento de abrirem.
const trackerSource = await readFile(new URL("../js/tracker.js", import.meta.url), "utf8");
assert.match(trackerSource, /isTrackerMultiGroup\(group\)/);
assert.doesNotMatch(trackerSource, /\bMULTI_GROUPS\b/);

console.log("tracker-run-distance: ok");
