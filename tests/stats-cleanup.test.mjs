import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/stats-page.js", import.meta.url), "utf8");

for (const removed of [
  "scopeTotalTitle",
  "computeJiuStats",
  "jiuSectionHtml",
  "EXTRAS_META",
  "<h2>Outros hábitos</h2>",
  "Totais · ciclo atual",
  "Totais · histórico completo",
]) {
  assert.doesNotMatch(source, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const preserved of [
  "<h2>Exercícios por modalidade</h2>",
  "<h2>Alimentação</h2>",
  "<h2>🚬 Cigarros & Nicotina</h2>",
  "pilatesSectionHtml",
  "stretchSectionHtml",
  "gymSectionHtml",
  'jiujitsu: "Jiu Jitsu"',
]) {
  assert.match(source, new RegExp(preserved.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

console.log("stats-cleanup: ok");
