// Regras puras do formulário diário. Mantidas fora do DOM para que mudanças
// de seleção e compatibilidade de dados possam ser testadas diretamente.

export const RUN_KM_OPTIONS = Object.freeze([2.5, 3, 4, 5, 6, 7, 8, 9, 10]);
const RUN_PLAN_SESSIONS = new Set(["easy", "interval", "long"]);

const MULTI_GROUPS = new Set(["exercises", "extras", "gym_groups"]);
const NUMERIC_GROUPS = new Set(["jiu_spar_min", "stretch_min", "run_km"]);

export function isTrackerMultiGroup(group) {
  return MULTI_GROUPS.has(group);
}

function nullableNumber(value) {
  return value === "" || value == null ? null : Number(value);
}

export function normalizeRunKm(value) {
  const amount = nullableNumber(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 100
    ? Math.round(amount * 100) / 100
    : null;
}

function normalizePositiveMinutes(value) {
  const amount = nullableNumber(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 1440
    ? Math.round(amount * 10) / 10
    : null;
}

function normalizePlanWeek(value) {
  const week = nullableNumber(value);
  return Number.isInteger(week) && week >= 1 && week <= 6 ? week : null;
}

function normalizePlanSession(value) {
  const session = String(value || "");
  return RUN_PLAN_SESSIONS.has(session) ? session : null;
}

export function normalizeTrackerDay(day = {}) {
  return {
    exercises: [...(day.exercises || [])].sort(),
    extras: [...(day.extras || [])].sort(),
    gym_groups: [...(day.gym_groups || [])].sort(),
    water: day.water ?? null,
    lunch: day.lunch ?? null,
    dinner: day.dinner ?? null,
    cigarettes: (day.cigarettes ?? null) === "" ? null : (day.cigarettes ?? null),
    nicotine_gum: (day.nicotine_gum ?? null) === "" ? null : (day.nicotine_gum ?? null),
    dessert: day.dessert ?? null,
    soda: day.soda ?? null,
    jiu_session: day.jiu_session ?? null,
    jiu_spar_min: nullableNumber(day.jiu_spar_min),
    stretch_min: nullableNumber(day.stretch_min),
    run_km: normalizeRunKm(day.run_km),
    run_duration_min: normalizePositiveMinutes(day.run_duration_min),
    run_plan_week: normalizePlanWeek(day.run_plan_week),
    run_plan_session: normalizePlanSession(day.run_plan_session),
    run_notes: String(day.run_notes || "").trim().slice(0, 240),
  };
}

export function toggleTrackerValue(day, group, rawValue) {
  const value = String(rawValue);

  if (isTrackerMultiGroup(group)) {
    if (!Array.isArray(day[group])) day[group] = [];
    const index = day[group].indexOf(value);
    if (index >= 0) {
      day[group].splice(index, 1);
      if (group === "exercises" && value === "corrida") {
        day.run_km = null;
        day.run_duration_min = null;
        day.run_plan_week = null;
        day.run_plan_session = null;
        day.run_notes = "";
      }
    } else {
      day[group].push(value);
    }
    return day;
  }

  const next = NUMERIC_GROUPS.has(group) ? Number(value) : value;
  if (group === "run_km" && normalizeRunKm(next) == null) return day;
  const current = day[group];
  day[group] = current != null && String(current) === value ? null : next;
  return day;
}
