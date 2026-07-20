import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ui = await readFile(new URL("../js/vini-diet-ui.js", import.meta.url), "utf8");
const storage = await readFile(new URL("../js/diet-storage.js", import.meta.url), "utf8");
const css = await readFile(new URL("../css/style.css", import.meta.url), "utf8");

// O usuário sempre tem uma ação explícita de salvar e feedback da nuvem.
assert.match(ui, /data-save-diet>Salvar marcações<\/button>/);
assert.match(ui, /sincronizado com a nuvem/);
assert.match(ui, /salvo neste aparelho; nuvem pendente/);
assert.match(css, /\.vini-diet-save-btn\.is-saved/);
assert.ok(ui.indexOf("${mealPresetsHTML(day)}") < ui.indexOf("${dailySummaryHTML(summary)}"));
assert.ok(ui.indexOf("${mealPresetsHTML(day)}") < ui.indexOf("${exerciseTrackerHTML(day, summary)}"));
assert.ok(ui.indexOf("${exerciseTrackerHTML(day, summary)}") < ui.indexOf("${dailySummaryHTML(summary)}"));
assert.match(ui, /data-meal-preset/);
assert.match(ui, /toggleViniMealPreset/);
assert.match(ui, /data-exercise-intensity/);
assert.match(ui, /data-exercise-duration/);
assert.match(ui, /kcal líquidas/);
assert.match(ui, /getWeightEntries\(USER\)/);
assert.match(css, /\.vini-exercise-card/);
assert.match(ui, /Toque novamente para remover a refeição/);
assert.match(ui, /customFoodsOpen: false/);
assert.match(ui, /beveragesOpen: false/);
assert.match(ui, /data-toggle-custom-foods/);
assert.match(ui, /aria-expanded="\$\{isOpen\}"/);
assert.match(ui, /data-close-custom-foods/);
assert.match(ui, /tracker\.customFoodsOpen = !tracker\.customFoodsOpen/);
assert.match(ui, /data-toggle-beverages/);
assert.match(ui, /data-beverage-step="-1"/);
assert.match(ui, /data-beverage-step="1"/);
assert.match(ui, /setViniBeverageCount/);
assert.match(css, /\.vini-beverage-stepper/);
assert.match(ui, /data-export-diet-pdf/);
assert.match(ui, /vini-week-average-grid/);
assert.match(ui, /downloadViniDietPdf\(records/);
assert.ok(ui.indexOf("${dailySummaryHTML(summary)}") < ui.indexOf("${customFoodsHTML(day, summary)}"));
assert.ok(ui.indexOf("${customFoodsHTML(day, summary)}") < ui.indexOf("${hydrationHTML(day, summary)}"));
assert.ok(ui.indexOf("${customFoodsHTML(day, summary)}") < ui.indexOf("${beveragesHTML(day, summary)}"));
assert.ok(ui.indexOf("${beveragesHTML(day, summary)}") < ui.indexOf("${hydrationHTML(day, summary)}"));
assert.ok(ui.indexOf("${hydrationHTML(day, summary)}") < ui.indexOf("${weeklyHTML()}"));
assert.ok(ui.indexOf("${weeklyHTML()}") < ui.indexOf("${saveControlsHTML()}"));
assert.ok(ui.indexOf("${cycleStatsHTML()}") < ui.indexOf("${saveControlsHTML()}"));
assert.ok(ui.indexOf("${historyHTML()}") < ui.indexOf("${saveControlsHTML()}"));
assert.ok(ui.indexOf("${viniDietTrendsHTML(recordsInScope(), { viewportWidth: Math.max(320, tracker.root.clientWidth - 48) })}") < ui.indexOf("${saveControlsHTML()}"));
assert.ok(ui.indexOf("${historyHTML()}") < ui.indexOf("${viniDietTrendsHTML("));
assert.match(ui, /bindViniTrendTooltips\(tracker\.root/);
assert.match(ui, /onOpenDate:\s*\(date\)/);

// A mutação precisa chegar ao cache síncrono antes de entrar na fila remota.
const mutation = ui.match(/function mutateCurrentDay\(mutator\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.ok(mutation.indexOf("cacheViniDietPlanDay") >= 0);
assert.ok(mutation.indexOf("cacheViniDietPlanDay") < mutation.indexOf("queuePersist"));

// A cópia pendente não pode ser substituída por uma resposta antiga da nuvem.
assert.match(storage, /planPendingSync: pendingSync/);
assert.match(storage, /cached\.plan && cached\.planPendingSync/);
assert.match(storage, /markLocalPlanSynced\(userId, date, clean\)/);
assert.match(storage, /tentando leitura direta/);

console.log("vini-diet-persistence: ok");
