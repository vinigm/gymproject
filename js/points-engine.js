// Engine de pontuação: calcula pontos de um dia a partir da config.
// Compartilhado entre a página principal (badge no topo) e a página de pontos.

import { POINTS } from "./points-config.js";

export function pointsForDay(day) {
  if (!day) return 0;
  let pts = 0;

  for (const ex of (day.exercises || [])) {
    pts += POINTS.exercises?.[ex] || 0;
  }
  // Alongamento: pontos vêm da duração (5/10/15 min). Só conta se o
  // chip "alongamento" estiver marcado nos exercícios.
  if ((day.exercises || []).includes("alongamento") && day.stretch_min != null) {
    pts += POINTS.stretch?.[String(day.stretch_min)] || 0;
  }
  if (day.water && POINTS.water?.[day.water] != null) {
    pts += POINTS.water[day.water];
  }
  if (day.lunch && POINTS.meals?.lunch?.[day.lunch] != null) {
    pts += POINTS.meals.lunch[day.lunch];
  }
  if (day.dinner && POINTS.meals?.dinner?.[day.dinner] != null) {
    pts += POINTS.meals.dinner[day.dinner];
  }
  if (day.cigarettes != null && day.cigarettes !== "") {
    pts += Number(day.cigarettes) * (POINTS.cigarettes || 0);
  }
  if (day.nicotine_gum != null && day.nicotine_gum !== "") {
    pts += Number(day.nicotine_gum) * (POINTS.nicotine_gum || 0);
  }
  if (day.dessert && POINTS.dessert?.[day.dessert] != null) {
    pts += POINTS.dessert[day.dessert];
  }
  if (day.soda && POINTS.soda?.[day.soda] != null) {
    pts += POINTS.soda[day.soda];
  }
  for (const e of (day.extras || [])) {
    pts += POINTS.extras?.[e] || 0;
  }

  return pts;
}
