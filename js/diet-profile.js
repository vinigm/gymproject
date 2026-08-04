// Adaptador do tracker compartilhado. Mantém a API histórica com nomes "Vini"
// para evitar duplicar toda a camada de UI, escolhendo os dados pelo usuário
// declarado na página.

import * as vini from "./vini-diet-plan.js";
import * as vivi from "./vivi-diet-plan.js";
import { energyProfileFor } from "./energy-balance.js";

export const IS_VIVI_DIET_PROFILE = typeof document !== "undefined"
  && document.body?.dataset?.kgUser === "victoria";

const active = IS_VIVI_DIET_PROFILE ? vivi : vini;

export const DIET_PROFILE = Object.freeze(IS_VIVI_DIET_PROFILE ? {
  userId: "victoria",
  personName: "Vivi",
  reportTitle: "Relatório nutricional - Kg Vivi",
  reportSlug: "vivi",
  sourceDescription: "plano alimentar em PDF",
  officialIntro: "As refeições abaixo organizam fielmente as composições, porções e alternativas do PDF da nutricionista. Esta área é somente para consulta e não altera seus registros.",
  officialFootnote: "Alternativas apresentadas com “ou” foram mantidas separadas; nenhuma composição foi removida.",
  hydrationDescription: "Meta indicada no plano: 35 ml/kg, aproximadamente 1,6 L por dia, começando com pelo menos 300 ml ao acordar.",
  hydrationSource: "Plano alimentar · páginas 3 e 5",
  energyBalance: energyProfileFor("victoria"),
} : {
  userId: "vinicius",
  personName: "Vini",
  reportTitle: "Relatório nutricional - Kg Vini",
  reportSlug: "vini",
  sourceDescription: "prints da nutricionista",
  officialIntro: "As refeições abaixo reproduzem as composições completas dos prints. Esta área é somente para consulta e não altera seus registros.",
  officialFootnote: "Os screenshots repetidos foram consolidados; nenhuma composição foi removida.",
  hydrationDescription: "Consumo médio de 2,5 litros de água + 500 ml - 1 litro durante o treino",
  hydrationSource: "IMG_3083.PNG",
  energyBalance: energyProfileFor("vinicius"),
});

export const VINI_BEVERAGES = active.VIVI_BEVERAGES || active.VINI_BEVERAGES;
export const VINI_DAILY_GOALS = active.VIVI_DAILY_GOALS || active.VINI_DAILY_GOALS;
export const VINI_FOOD_GROUPS = active.VIVI_FOOD_GROUPS || active.VINI_FOOD_GROUPS;
export const VINI_HYDRATION = active.VIVI_HYDRATION || active.VINI_HYDRATION;
export const VINI_OFFICIAL_MEALS = active.VIVI_OFFICIAL_MEALS || active.VINI_OFFICIAL_MEALS;
export const VINI_PLAN_VERSION = active.VIVI_PLAN_VERSION || active.VINI_PLAN_VERSION;
export const VINI_REQUIRED_MEALS = active.VIVI_REQUIRED_MEALS || active.VINI_REQUIRED_MEALS;

export const calculateViniDietDay = active.calculateViviDietDay || active.calculateViniDietDay;
export const emptyViniDietDay = active.emptyViviDietDay || active.emptyViniDietDay;
export const foodForGroup = active.viviFoodForGroup || active.foodForGroup;
export const formatFoodQuantity = active.formatViviFoodQuantity || active.formatFoodQuantity;
export const normalizeViniDietDay = active.normalizeViviDietDay || active.normalizeViniDietDay;
export const nutritionForBeverageCount = active.nutritionForViviBeverageCount || active.nutritionForBeverageCount;
export const nutritionForFoodQuantity = active.nutritionForViviFoodQuantity || active.nutritionForFoodQuantity;
export const setViniBeverageCount = active.setViviBeverageCount || active.setViniBeverageCount;
export const withViniDietSummary = active.withViviDietSummary || active.withViniDietSummary;
