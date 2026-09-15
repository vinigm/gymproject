export const RUN_SESSION_TYPES = Object.freeze([
  Object.freeze({ id: "easy", label: "Leve", icon: "🌿" }),
  Object.freeze({ id: "interval", label: "Intervalado", icon: "⏱️" }),
  Object.freeze({ id: "long", label: "Longo", icon: "🛣️" }),
]);

function week(number, easy, interval, long) {
  return Object.freeze({
    number,
    sessions: Object.freeze({ easy, interval, long }),
  });
}

// Plano-base deliberadamente orientado por sessões, não por dias da semana.
// Toda sessão inclui 5 min de caminhada antes e depois do bloco descrito.
export const RUNNING_PLAN = Object.freeze([
  week(1, "8× 1 min corrida / 1min30 caminhada", "8× 1 min corrida / 1min30 caminhada", "10× 1 min corrida / 1min30 caminhada"),
  week(2, "6× 1min30 corrida / 2 min caminhada", "7× 1min30 corrida / 1min30 caminhada", "8× 1min30 corrida / 2 min caminhada"),
  week(3, "6× 2 min corrida / 2 min caminhada", "5× 3 min corrida / 2 min caminhada", "6× 3 min corrida / 2 min caminhada"),
  week(4, "5× 4 min corrida / 2 min caminhada", "4× 5 min corrida / 2 min caminhada", "3× 6 min corrida / 2 min caminhada"),
  week(5, "3× 6 min corrida / 2 min caminhada", "3× 8 min corrida / 3 min caminhada", "20 min de corrida contínua leve"),
  week(6, "20 min de corrida contínua leve", "5 + 8 + 5 min, com 3 min caminhando", "25 min de corrida contínua leve"),
  week(7, "22 min de corrida contínua leve", "4× 5 min corrida / 2 min caminhada", "28 min de corrida contínua leve"),
  week(8, "25 min de corrida contínua leve", "3× 8 min corrida / 2 min caminhada", "30 min de corrida contínua leve"),
  week(9, "25 min de corrida contínua leve", "4× 6 min corrida / 1min30 caminhada", "32 min de corrida contínua leve"),
  week(10, "28 min de corrida contínua leve", "3× 8 min corrida / 2 min caminhada", "35 min de corrida contínua leve"),
  week(11, "30 min de corrida contínua leve", "5× 5 min corrida / 1min30 caminhada", "4,5 km em ritmo confortável"),
  week(12, "25 min bem leves", "3× 5 min corrida / 2 min caminhada", "5 km em ritmo confortável"),
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
