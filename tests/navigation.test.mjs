import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HOME_NAV_ITEM, NAV_GROUPS, currentFile } from "../js/nav-menu.js";

assert.equal(HOME_NAV_ITEM.label, "Início");
assert.deepEqual(NAV_GROUPS.map((group) => group.label), ["Game", "Tracking", "Outros"]);

const expected = {
  Game: ["Pontos", "Prêmios", "Recordes", "Placares", "Vivi"],
  Tracking: ["Hábitos", "Stats", "Kg Vini", "Kg Vivi"],
  Outros: ["Alongar", "Pomodoro", "Status", "Config"],
};

for (const group of NAV_GROUPS) {
  assert.deepEqual(group.items.map((item) => item.label), expected[group.label]);
}

const allItems = NAV_GROUPS.flatMap((group) => group.items);
assert.equal(new Set(allItems.map((item) => item.href)).size, allItems.length);
assert.equal(currentFile("/gymproject/"), "");
assert.equal(currentFile("/gymproject/index.html"), "index.html");
assert.equal(currentFile("/gymproject/habitos.html"), "habitos.html");

const homeHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const habitsHtml = await readFile(new URL("../habitos.html", import.meta.url), "utf8");
assert.match(homeHtml, /class="home-destination-card home-destination-card--game"/);
assert.match(homeHtml, /class="home-destination-card home-destination-card--tracking"/);
assert.match(homeHtml, /class="home-destination-card home-destination-card--other"/);
for (const item of allItems) assert.match(homeHtml, new RegExp(`href="${item.href.replace(".", "\\.")}"`));
assert.doesNotMatch(homeHtml, /id="date-input"/);
assert.match(habitsHtml, /id="date-input"/);
assert.match(habitsHtml, /src="\.\/js\/app\.js"/);

console.log("navigation: ok");
