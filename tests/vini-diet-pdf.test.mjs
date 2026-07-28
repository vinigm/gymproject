import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createViniDietPdf } from "../js/vini-diet-pdf.js";

const records = [
  { date: "2026-07-13", summary: { consumed: { kcal: 1810, p: 142, c: 190, f: 54 }, netKcal: 1510 } },
  { date: "2026-07-14", summary: { consumed: { kcal: 1960, p: 157, c: 202, f: 58 }, netKcal: 1660 } },
  { date: "2026-07-16", summary: { consumed: { kcal: 2050, p: 165, c: 210, f: 63 }, netKcal: 1750 } },
];

const bytes = createViniDietPdf(records, {
  scopeLabel: "Ciclo atual",
  generatedAt: new Date("2026-07-17T12:00:00-03:00"),
  calendarMonth: "2026-07",
  weightEntries: [
    { date: "2026-07-13", weight: 91.4 },
    { date: "2026-07-16", weight: 90.8 },
  ],
  trainingDays: [
    { date: "2026-07-13", gymGroups: ["peito", "triceps"] },
    { date: "2026-07-16", gymGroups: ["perna"] },
  ],
});
const pdf = new TextDecoder().decode(bytes);

assert.ok(bytes.length > 5000);
assert.ok(pdf.startsWith("%PDF-1.4"));
assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 1);
assert.match(pdf, /Relatorio nutricional - Kg Vini/);
assert.match(pdf, /Evolucao do peso/);
assert.match(pdf, /Ultimo: 90,8 kg/);
assert.match(pdf, /Medias do ciclo/);
assert.match(pdf, /Kcal liquidas/);
assert.match(pdf, /\(1\.640 kcal\)/);
assert.match(pdf, /Calorias/);
assert.match(pdf, /Ultimo: 1\.750 kcal/);
assert.doesNotMatch(pdf, /Ultimo: 2\.050 kcal/);
assert.match(pdf, /Proteina/);
assert.match(pdf, /Carboidrato/);
assert.match(pdf, /Gordura/);
assert.match(pdf, /Calendario de musculacao - Julho de 2026/);
assert.match(pdf, /2 treinos/);
assert.match(pdf, /\(Pe\)/);
assert.match(pdf, /\(Tr\)/);
assert.match(pdf, /\(Pn\)/);

const pdfSource = await readFile(new URL("../js/vini-diet-pdf.js", import.meta.url), "utf8");
assert.match(pdfSource, /kcal: "#ef4444"/);
assert.match(pdf, /startxref/);
assert.ok(pdf.endsWith("%%EOF\n"));
assert.doesNotMatch(pdf, /NaN|Infinity|undefined/);

console.log("vini-diet-pdf: ok");
