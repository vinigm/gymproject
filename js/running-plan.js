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

function target(description, pace) {
  return Object.freeze({ description, pace });
}

function week(number, easy, interval, long) {
  return Object.freeze({
    number,
    sessions: Object.freeze({ easy, interval, long }),
  });
}

// Plano-base deliberadamente orientado por sessões, não por dias da semana.
// Toda sessão inclui 5 min de caminhada antes e depois do bloco descrito.
export const RUNNING_PLAN = Object.freeze([
  week(1,
    target("7× 3 min corrida / 1min30 caminhada", "6:40–7:00/km"),
    target("6× 4 min corrida / 1min30 caminhada", "6:15–6:30/km"),
    target("8× 3 min corrida / 1min30 caminhada", "6:35–6:55/km")),
  week(2,
    target("6× 4 min corrida / 1min30 caminhada", "6:35–6:55/km"),
    target("5× 5 min corrida / 1min30 caminhada", "6:10–6:25/km"),
    target("7× 4 min corrida / 1min30 caminhada", "6:30–6:50/km")),
  week(3,
    target("5× 5 min corrida / 1min30 caminhada", "6:30–6:50/km"),
    target("4× 6 min corrida / 1min30 caminhada", "6:05–6:20/km"),
    target("4× 7 min corrida / 2 min caminhada", "6:25–6:45/km")),
  week(4,
    target("4× 6 min corrida / 1min30 caminhada", "6:30–6:45/km"),
    target("3× 8 min corrida / 2 min caminhada", "6:00–6:15/km"),
    target("12 + 12 + 5 min, com 2 min caminhando", "6:20–6:40/km")),
  week(5,
    target("20 min de corrida contínua leve", "6:30–6:45/km"),
    target("2× 12 min corrida / 2 min caminhada", "5:55–6:10/km"),
    target("25 min de corrida contínua leve", "6:20–6:35/km")),
  week(6,
    target("22 min de corrida contínua leve", "6:25–6:40/km"),
    target("3× 8 min corrida / 1min30 caminhada", "5:50–6:05/km"),
    target("30 min de corrida contínua leve", "6:15–6:30/km")),
  week(7,
    target("25 min de corrida contínua leve", "6:20–6:35/km"),
    target("2× 15 min corrida / 2 min caminhada", "5:45–6:00/km"),
    target("35 min de corrida contínua leve", "6:05–6:20/km")),
  week(8,
    target("20 min bem leves", "6:25–6:40/km"),
    target("3× 5 min controlados / 1min30 caminhada", "5:35–5:50/km"),
    target("5 km sem parar", "5:50/km")),
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
