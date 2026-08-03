import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

globalThis.document = { body: { dataset: { kgUser: "victoria" } } };
const profile = await import("../js/diet-profile.js");
const selection = await import("../js/diet-selection-profile.js");
const officialRenderer = await import("../js/vini-official-diet.js");
const pdf = await import("../js/vini-diet-pdf.js");

assert.equal(profile.IS_VIVI_DIET_PROFILE, true);
assert.equal(profile.DIET_PROFILE.userId, "victoria");
assert.equal(profile.DIET_PROFILE.personName, "Vivi");
assert.equal(profile.DIET_PROFILE.reportSlug, "vivi");
assert.equal(profile.VINI_PLAN_VERSION, "vivi-nutri-2026-02-v2");
assert.equal(profile.VINI_HYDRATION.baseMl, 1600);
assert.equal(selection.VINI_MEAL_PRESETS[0].id, "desjejum_oficial");
const officialHTML = officialRenderer.viniOfficialDietHTML();
assert.equal((officialHTML.match(/class="vini-official-option"/g) || []).length, 19);
assert.match(officialHTML, /35 ml\/kg/);
assert.match(officialHTML, /Body Balance/);
const pdfText = new TextDecoder().decode(pdf.createViniDietPdf([{
  date: "2026-07-27",
  summary: { consumed: { kcal: 1200, p: 80, c: 140, f: 40 } },
}], {
  reportTitle: profile.DIET_PROFILE.reportTitle,
  calendarMonth: "2026-07",
  weightEntries: [{ date: "2026-07-27", weight: 63.2 }],
  trainingDays: [{ date: "2026-07-27", gymGroups: ["perna"] }],
}));
assert.match(pdfText, /Relatorio nutricional - Kg Vivi/);
assert.match(pdfText, /Evolucao do peso/);
assert.match(pdfText, /Calendario de musculacao/);

const page = await readFile(new URL("../js/kg-vivi-page.js", import.meta.url), "utf8");
const storage = await readFile(new URL("../js/diet-storage.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../js/vini-diet-ui.js", import.meta.url), "utf8");
const official = await readFile(new URL("../js/vini-official-diet.js", import.meta.url), "utf8");
const documentation = await readFile(new URL("../DIETA_VIVI.md", import.meta.url), "utf8");

assert.match(page, /includeOfficialDiet: true/);
assert.match(page, /await loadViniDietTracker\(\)/);
assert.match(page, /renderViniOfficialDiet\(el\)/);
assert.match(page, /renderViniDietTracker\(el/);
assert.match(page, /data-section="stats"/);
assert.match(page, /data-section="graphs"/);
assert.match(page, /view: section/);
assert.match(page, /onOpenDate: \(\) => selectSection\("dieta"\)/);
assert.match(storage, /userId === "victoria" \? normalizeViviDietDay/);
assert.match(storage, /legacyViviPlanFromFoods/);
assert.match(ui, /DIET_PROFILE\.userId/);
assert.match(ui, /DIET_PROFILE\.reportTitle/);
assert.match(official, /DIET_PROFILE\.hydrationDescription/);
assert.match(documentation, /fevereiro de 2026/i);
assert.match(documentation, /35 ml\/kg/);
assert.match(documentation, /Body Balance/);
assert.match(documentation, /Mariola/);
assert.match(documentation, /Mesma estrutura e mesmas quantidades do almoço/);

delete globalThis.document;
console.log("vivi-diet-integration: ok");
