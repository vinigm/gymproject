import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_POINTS } from "../js/points-config.js";
import { pointsForDay } from "../js/points-engine.js";
import {
  DEFAULT_WATER_POINTS,
  WATER_LITRES_OPTIONS,
  formatWaterLitres,
  waterKey,
  waterLitres,
} from "../js/water-options.js";

const expected = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
assert.deepEqual(WATER_LITRES_OPTIONS, expected);
assert.equal(waterLitres("2.5L"), 2.5);
assert.equal(waterLitres("4,5L"), 4.5);
assert.equal(waterLitres("6L"), 0);
assert.equal(formatWaterLitres(3.5), "3,5");

for (const litres of expected) {
  const key = waterKey(litres);
  assert.equal(DEFAULT_WATER_POINTS[key], litres * 10);
  assert.equal(DEFAULT_POINTS.water[key], litres * 10);
  assert.equal(pointsForDay({ water: key }), litres * 10);
}

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const groups = [...html.matchAll(/<div class="chip-grid chip-grid--2" data-group="water">([\s\S]*?)<\/div>/g)];
assert.equal(groups.length, 2);
for (const [, contents] of groups) {
  const values = [...contents.matchAll(/data-value="([^"]+)"/g)].map((match) => waterLitres(match[1]));
  assert.deepEqual(values, expected);
}

console.log("water-options: ok");
