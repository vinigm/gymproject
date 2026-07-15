// Opções compartilhadas de hidratação da tela principal, pontuação e stats.

export const WATER_LITRES_OPTIONS = Object.freeze([
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
]);

export function waterKey(litres) {
  return `${litres}L`;
}

export function formatWaterLitres(litres) {
  return Number(litres).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function waterLitres(value) {
  const parsed = Number(String(value || "").replace(",", ".").replace(/L$/i, ""));
  return WATER_LITRES_OPTIONS.includes(parsed) ? parsed : 0;
}

export const DEFAULT_WATER_POINTS = Object.freeze(Object.fromEntries(
  WATER_LITRES_OPTIONS.map((litres) => [waterKey(litres), Math.round(litres * 10)]),
));
