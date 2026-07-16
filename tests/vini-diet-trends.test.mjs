import assert from "node:assert/strict";
import { viniDietTrendsHTML, VINI_TREND_METRICS } from "../js/vini-diet-trends.js";

const records = [
  { date: "2026-07-15", summary: { consumed: { kcal: 1800, p: 145, c: 188, f: 55 } } },
  { date: "2026-07-16", summary: { consumed: { kcal: 2050, p: 164, c: 203, f: 63 } } },
  { date: "2026-07-18", summary: { consumed: { kcal: 1940, p: 158, c: 196, f: 59 } } },
];

const html = viniDietTrendsHTML(records, { viewportWidth: 500 });
assert.equal(VINI_TREND_METRICS.length, 4);
assert.equal((html.match(/class="vini-trend-card/g) || []).length, 4);
assert.equal((html.match(/class="vini-trend-chart"/g) || []).length, 4);
assert.equal((html.match(/class="vini-trend-goal"/g) || []).length, 4);
assert.equal((html.match(/class="vini-trend-line"/g) || []).length, 4);
assert.match(html, /meta estimada 2\.000 kcal/);
assert.match(html, /meta estimada 160 g/);
assert.match(html, /15\/07/);
assert.match(html, /18\/07/);
assert.match(html, /width="500"/);
assert.doesNotMatch(html, /NaN|Infinity/);

const oneDay = viniDietTrendsHTML(records.slice(0, 1));
assert.equal((oneDay.match(/class="vini-trend-dot"/g) || []).length, 4);
assert.doesNotMatch(oneDay, /NaN|Infinity/);

const empty = viniDietTrendsHTML([]);
assert.match(empty, /Registre alimentos/);
assert.doesNotMatch(empty, /<svg/);

console.log("vini-diet-trends: ok");
