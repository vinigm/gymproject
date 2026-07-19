import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/stats-page.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../css/style.css", import.meta.url), "utf8");

assert.match(source, /function mealSplitBar\(clean, dirty\)/);
assert.equal((source.match(/\$\{mealSplitBar\(cAll, sAll\)\}/g) || []).length, 1);
assert.match(source, /\$\{mealDowChart\(_days\)\}/);
assert.match(source, /Refeições por dia da semana/);

assert.doesNotMatch(source, /semiDonut|monthStartClamped|Mês atual/);
assert.doesNotMatch(styles, /\.donut(?:-|\s|\{)/);
assert.match(styles, /\.meal-split-track/);
assert.match(styles, /\.meal-split-segment--clean/);
assert.match(styles, /\.meal-split-segment--dirty/);

console.log("stats-food-chart: ok");
