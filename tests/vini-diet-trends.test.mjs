import assert from "node:assert/strict";
import { calculateViniDietDay, normalizeViniDietDay } from "../js/vini-diet-plan.js";
import {
  viniDietTrendsHTML,
  viniTrendDetailHTML,
  VINI_TREND_METRICS,
} from "../js/vini-diet-trends.js";

const detailedDay = normalizeViniDietDay({
  foods: {
    cafe_manha: ["ovos", "pao"],
    almoco: ["arroz", "frango", "vegetais"],
  },
  amounts: {
    cafe_manha: { ovos: 3, pao: 2 },
    almoco: { arroz: 150, frango: 120, vegetais: 50 },
  },
  beverages: { cerveja: 2 },
  additionalKcal: 90,
  hydrationMl: 3000,
  trainingDay: true,
  exerciseWeightKg: 80,
  exercises: { strength: { intensity: "moderate", minutes: 60 } },
});
const detailedSummary = calculateViniDietDay(detailedDay);

const records = [
  { date: "2026-07-15", day: detailedDay, summary: detailedSummary },
  { date: "2026-07-16", summary: { consumed: { kcal: 2050, p: 164, c: 203, f: 63 } } },
  { date: "2026-07-18", summary: { consumed: { kcal: 1940, p: 158, c: 196, f: 59 } } },
];

const html = viniDietTrendsHTML(records, { viewportWidth: 500 });
assert.equal(VINI_TREND_METRICS.length, 4);
assert.equal((html.match(/class="vini-trend-card/g) || []).length, 4);
assert.equal((html.match(/class="vini-trend-chart"/g) || []).length, 4);
assert.equal((html.match(/class="vini-trend-goal"/g) || []).length, 4);
assert.equal((html.match(/class="vini-trend-line"/g) || []).length, 4);
assert.equal((html.match(/data-trend-tooltip/g) || []).length, 4);
assert.equal((html.match(/data-trend-point/g) || []).length, 12);
assert.equal((html.match(/aria-expanded="false"/g) || []).length, 12);
assert.match(html, /meta estimada 2\.000 kcal/);
assert.match(html, /meta estimada 150 g/);
assert.match(html, /meta estimada 200 g/);
assert.match(html, /meta estimada 68 g/);
assert.match(html, /15\/07/);
assert.match(html, /18\/07/);
assert.match(html, /width="500"/);
assert.match(html, /data-export-diet-pdf/);
assert.doesNotMatch(html, /NaN|Infinity/);

const oneDay = viniDietTrendsHTML(records.slice(0, 1));
assert.equal((oneDay.match(/class="vini-trend-dot"/g) || []).length, 4);
assert.doesNotMatch(oneDay, /NaN|Infinity/);

const empty = viniDietTrendsHTML([]);
assert.match(empty, /Registre alimentos/);
assert.doesNotMatch(empty, /data-export-diet-pdf/);
assert.doesNotMatch(empty, /<svg/);

const details = viniTrendDetailHTML(records[0], "p");
assert.match(details, /Proteína/);
assert.match(details, /quarta-feira, 15 de julho de 2026/i);
assert.match(details, /Café da manhã/);
assert.match(details, /Ovos mexidos/);
assert.match(details, /3 un/);
assert.match(details, /Almoço/);
assert.match(details, /Arroz branco cozido/);
assert.match(details, /150g/);
assert.match(details, /2 × 1 lata · 350 ml/);
assert.match(details, /Kcal adicionais:.*\+90 kcal/);
assert.match(details, /Água registrada/);
assert.match(details, /Musculação · Média · 60 min/);
assert.match(details, /Ver registro do dia/);

const legacyDetails = viniTrendDetailHTML(records[1], "kcal");
assert.match(legacyDetails, /2\.050 kcal/);
assert.match(legacyDetails, /Detalhes dos alimentos indisponíveis/);

console.log("vini-diet-trends: ok");
