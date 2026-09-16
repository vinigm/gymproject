export const RUN_SESSION_TYPES = Object.freeze([
  Object.freeze({ id: "easy", label: "Leve", icon: "🌿" }),
  Object.freeze({ id: "interval", label: "Intervalado", icon: "⏱️" }),
  Object.freeze({ id: "long", label: "Longo", icon: "🛣️" }),
]);

export const RUNNING_PLAN_BASELINE = Object.freeze({
  totalMinutes: 33.25,
  runningMinutes: 24.2,
  walkingMinutes: 9.05,
  estimatedKm: 4.74,
  averagePace: "7:01/km",
  averageHeartRate: 137,
  maxHeartRate: 153,
  aerobicEffect: 2.6,
});

function week(number, easy, interval, long) {
  return Object.freeze({
    number,
    sessions: Object.freeze({ easy, interval, long }),
  });
}

// Plano-base deliberadamente orientado por sessões, não por dias da semana.
// Toda sessão inclui 5 min de caminhada antes e depois do bloco descrito.
export const RUNNING_PLAN = Object.freeze([
  week(1, "7× 3 min corrida / 1min30 caminhada", "6× 4 min corrida / 1min30 caminhada", "8× 3 min corrida / 1min30 caminhada"),
  week(2, "6× 4 min corrida / 1min30 caminhada", "5× 5 min corrida / 1min30 caminhada", "7× 4 min corrida / 1min30 caminhada"),
  week(3, "5× 5 min corrida / 1min30 caminhada", "4× 6 min corrida / 1min30 caminhada", "4× 7 min corrida / 2 min caminhada"),
  week(4, "4× 6 min corrida / 1min30 caminhada", "3× 8 min corrida / 2 min caminhada", "12 + 12 + 5 min, com 2 min caminhando"),
  week(5, "20 min de corrida contínua leve", "2× 12 min corrida / 2 min caminhada", "25 min de corrida contínua leve"),
  week(6, "22 min de corrida contínua leve", "3× 8 min corrida / 1min30 caminhada", "30 min de corrida contínua leve"),
  week(7, "25 min de corrida contínua leve", "2× 15 min corrida / 2 min caminhada", "35 min de corrida contínua leve"),
  week(8, "20 min bem leves", "3× 5 min controlados / 1min30 caminhada", "5 km em ritmo confortável"),
]);

export function validRunPlanWeek(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= RUNNING_PLAN.length ? number : null;
}

export function validRunPlanSession(value) {
  const id = String(value || "");
  return RUN_SESSION_TYPES.some((session) => session.id === id) ? id : null;
}

export function runPlanCompletions(days = []) {
  const completions = new Map();
  [...(Array.isArray(days) ? days : [])]
    .filter((day) => day?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach((day) => {
      const weekNumber = validRunPlanWeek(day.run_plan_week);
      const sessionId = validRunPlanSession(day.run_plan_session);
      if (!weekNumber || !sessionId || !(Number(day.run_km) > 0)) return;
      completions.set(`${weekNumber}:${sessionId}`, day);
    });
  return completions;
}

export function currentRunPlanWeek(days = []) {
  const completions = runPlanCompletions(days);
  return RUNNING_PLAN.find((item) => (
    RUN_SESSION_TYPES.some((session) => !completions.has(`${item.number}:${session.id}`))
  ))?.number || RUNNING_PLAN.length;
}
