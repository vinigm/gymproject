import assert from "node:assert/strict";
import { createViniDietPdf } from "../js/vini-diet-pdf.js";

const records = [
  { date: "2026-07-13", summary: { consumed: { kcal: 1810, p: 142, c: 190, f: 54 } } },
  { date: "2026-07-14", summary: { consumed: { kcal: 1960, p: 157, c: 202, f: 58 } } },
  { date: "2026-07-16", summary: { consumed: { kcal: 2050, p: 165, c: 210, f: 63 } } },
];

const bytes = createViniDietPdf(records, {
  scopeLabel: "Ciclo atual",
  generatedAt: new Date("2026-07-17T12:00:00-03:00"),
  weekly: {
    start: "2026-07-13",
    end: "2026-07-19",
    days: 3,
    averages: { kcal: 1940, p: 154.7, c: 200.7, f: 58.3 },
  },
});
const pdf = new TextDecoder().decode(bytes);

assert.ok(bytes.length > 5000);
assert.ok(pdf.startsWith("%PDF-1.4"));
assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 2);
assert.match(pdf, /Relatorio nutricional - Kg Vini/);
assert.match(pdf, /Media diaria da semana/);
assert.match(pdf, /Calorias/);
assert.match(pdf, /Proteina/);
assert.match(pdf, /Carboidrato/);
assert.match(pdf, /Gordura/);
assert.match(pdf, /startxref/);
assert.ok(pdf.endsWith("%%EOF\n"));
assert.doesNotMatch(pdf, /NaN|Infinity|undefined/);

console.log("vini-diet-pdf: ok");
