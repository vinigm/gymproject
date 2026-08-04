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
  additionalMeal: "1 pedaço de torta",
  additionalNutrition: { kcal: 90, p: 4, c: 18, f: 7 },
  hydrationMl: 3000,
  trainingDay: true,
  exerciseWeightKg: 80,
  exercises: { strength: { intensity: "moderate", minutes: 60 } },
});
const detailedSummary = calculateViniDietDay(detailedDay);
detailedSummary.energyBalance = {
  available: true,
  balanceKcal: -650,
  consumedKcal: detailedSummary.consumed.kcal,
  expenditureKcal: detailedSummary.consumed.kcal + 650,
  routineSafetyFactor: 0.9,
  exerciseSafetyFactor: 0.7,
};

const records = [
  { date: "2026-07-15", day: detailedDay, summary: detailedSummary },
  { date: "2026-07-16", summary: { consumed: { kcal: 2050, p: 164, c: 203, f: 63 }, energyBalance: { available: true, balanceKcal: 100, consumedKcal: 2050, expenditureKcal: 1950, routineSafetyFactor: 0.9, exerciseSafetyFactor: 0.7 } } },
  { date: "2026-07-18", summary: { consumed: { kcal: 1940, p: 158, c: 196, f: 59 }, energyBalance: { available: true, balanceKcal: -200, consumedKcal: 1940, expenditureKcal: 2140, routineSafetyFactor: 0.9, exerciseSafetyFactor: 0.7 } } },
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
assert.match(html, /equilíbrio 0 kcal/);
assert.match(html, /Saldo energético/);
assert.match(html, /15\/07 · -650 kcal/);
assert.match(html, /ingestão menos gasto total conservador/);
assert.match(html, /meta estimada 150 g/);
assert.match(html, /meta estimada 200 g/);
assert.match(html, /meta estimada 68 g/);
assert.match(html, /15\/07/);
assert.match(html, /18\/07/);
assert.equal((html.match(/width="100%"/g) || []).length, 4);
assert.match(html, /viewBox="0 0 500 210"/);
assert.doesNotMatch(html, /style="width:\d+px"/);
assert.match(html, /data-export-diet-pdf/);
assert.doesNotMatch(html, /NaN|Infinity/);

const manyRecords = Array.from({ length: 24 }, (_, index) => ({
  date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  summary: { consumed: { kcal: 1700 + index, p: 140, c: 190, f: 60 }, netKcal: 1500 + index },
}));
const compact = viniDietTrendsHTML(manyRecords, { viewportWidth: 360 });
assert.equal((compact.match(/viewBox="0 0 360 210"/g) || []).length, 4);
assert.ok((compact.match(/class="vini-trend-xlabel"/g) || []).length <= 16);
assert.doesNotMatch(compact, /style="width:\d+px"/);

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
assert.match(details, /Refeições adicionais: 1 pedaço de torta/);
assert.match(details, /\+90 kcal/);
assert.match(details, /P \+4 g/);
assert.match(details, /C \+18 g/);
assert.match(details, /G \+7 g/);
assert.match(details, /Água registrada/);
assert.match(details, /Musculação · Média · 60 min/);
assert.match(details, /Ver registro do dia/);

const kcalDetails = viniTrendDetailHTML(records[0], "kcal");
assert.match(kcalDetails, /Saldo energético · -650 kcal/);
assert.match(kcalDetails, /<small>Saldo energético<\/small><b>-650 kcal<\/b>/);
assert.match(kcalDetails, /déficit: −650 kcal/);
assert.doesNotMatch(kcalDetails, /Saldo energético · 1\.131 kcal/);

// Registros anteriores ao campo netKcal usam as calorias ingeridas como
// fallback para não desaparecerem do histórico.
const legacyDetails = viniTrendDetailHTML({
  date: "2026-07-17",
  summary: { consumed: { kcal: 2050, p: 164, c: 203, f: 63 } },
}, "kcal");
assert.match(legacyDetails, /2\.050 kcal/);
assert.match(legacyDetails, /Detalhes dos alimentos indisponíveis/);

console.log("vini-diet-trends: ok");
