// Ciclos de acompanhamento usados somente para filtrar estatísticas.
// Os registros brutos continuam no Firestore/localStorage e nunca são apagados.

export const TRACKING_SCOPE = Object.freeze({
  CYCLE: "cycle",
  ALL: "all",
  OFFICIAL_DIET: "official-diet",
});

export const DEFAULT_TRACKING_SCOPE = TRACKING_SCOPE.CYCLE;

export const TRACKING_CYCLES = Object.freeze({
  vinicius: Object.freeze({
    id: "nutri-2026-07",
    label: "Acompanhamento Nutri",
    startDate: "2026-07-15",
    endDate: null,
  }),
  victoria: Object.freeze({
    id: "nutri-2026-07",
    label: "Acompanhamento Nutri",
    startDate: "2026-07-15",
    endDate: null,
  }),
});

export function trackingCycleFor(userId) {
  return TRACKING_CYCLES[userId] || null;
}

export function trackingScopeStart(userId, scope = DEFAULT_TRACKING_SCOPE, fallback = null) {
  if (scope === TRACKING_SCOPE.ALL) return fallback;
  return trackingCycleFor(userId)?.startDate || fallback;
}

export function recordDate(record) {
  if (!record) return "";
  if (typeof record === "string") return record.slice(0, 10);
  return String(record.date || record.completedAt || record.created_at || "").slice(0, 10);
}

export function isDateInTrackingScope(date, userId, scope = DEFAULT_TRACKING_SCOPE) {
  const iso = recordDate(date);
  if (!iso) return false;
  if (scope === TRACKING_SCOPE.ALL) return true;
  const cycle = trackingCycleFor(userId);
  if (!cycle) return true;
  if (iso < cycle.startDate) return false;
  return !cycle.endDate || iso <= cycle.endDate;
}

export function filterRecordsForTrackingScope(records, userId, scope = DEFAULT_TRACKING_SCOPE, dateOf = recordDate) {
  const list = Array.isArray(records) ? records : [];
  if (scope === TRACKING_SCOPE.ALL) return [...list];
  return list.filter((record) => isDateInTrackingScope(dateOf(record), userId, scope));
}

export function filterDateMapForTrackingScope(map, userId, scope = DEFAULT_TRACKING_SCOPE) {
  const source = map && typeof map === "object" ? map : {};
  if (scope === TRACKING_SCOPE.ALL) return { ...source };
  return Object.fromEntries(
    Object.entries(source).filter(([date]) => isDateInTrackingScope(date, userId, scope))
  );
}

export function filterDataByUserForTrackingScope(dataByUser, scope = DEFAULT_TRACKING_SCOPE) {
  return Object.fromEntries(
    Object.entries(dataByUser || {}).map(([userId, records]) => [
      userId,
      filterRecordsForTrackingScope(records, userId, scope),
    ])
  );
}

export function fmtTrackingDate(iso) {
  const [year, month, day] = String(iso || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

export function trackingScopeCopy(scope = DEFAULT_TRACKING_SCOPE) {
  if (scope === TRACKING_SCOPE.OFFICIAL_DIET) {
    return {
      title: "Dieta Oficial",
      note: "Consulta das opções completas enviadas pela nutricionista; nada pode ser marcado ou alterado aqui.",
    };
  }
  return scope === TRACKING_SCOPE.ALL
    ? {
        title: "Histórico completo",
        note: "Mostrando também os registros anteriores; nenhum dado foi apagado.",
      }
    : {
        title: "Ciclo atual",
        note: "As estatísticas consideram somente este acompanhamento; o histórico anterior segue preservado.",
      };
}

export function mountTrackingScopeControl(containerId, {
  scope = DEFAULT_TRACKING_SCOPE,
  userIds = ["vinicius", "victoria"],
  includeOfficialDiet = false,
  onChange = () => {},
} = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const validScopes = includeOfficialDiet
    ? [TRACKING_SCOPE.CYCLE, TRACKING_SCOPE.ALL, TRACKING_SCOPE.OFFICIAL_DIET]
    : [TRACKING_SCOPE.CYCLE, TRACKING_SCOPE.ALL];
  const activeScope = validScopes.includes(scope) ? scope : TRACKING_SCOPE.CYCLE;
  const copy = trackingScopeCopy(activeScope);
  const starts = [...new Set(userIds.map((userId) => trackingCycleFor(userId)?.startDate).filter(Boolean))];
  const startText = activeScope === TRACKING_SCOPE.OFFICIAL_DIET
    ? "somente consulta"
    : activeScope === TRACKING_SCOPE.ALL
      ? "desde o primeiro registro"
      : (starts.length === 1 ? `desde ${fmtTrackingDate(starts[0])}` : "por pessoa");
  const kicker = activeScope === TRACKING_SCOPE.OFFICIAL_DIET ? "Plano da nutricionista" : "Novo acompanhamento";

  el.innerHTML = `
    <section class="tracking-cycle-card" aria-label="Visualização do acompanhamento">
      <div class="tracking-cycle-copy">
        <span class="tracking-cycle-kicker">${kicker}</span>
        <strong>${copy.title} <small>${startText}</small></strong>
        <span>${copy.note}</span>
      </div>
      <div class="seg tracking-scope-seg" role="group" aria-label="Visualização do acompanhamento">
        <button type="button" class="seg-btn${activeScope === TRACKING_SCOPE.CYCLE ? " is-on" : ""}"
                data-tracking-scope="cycle" aria-pressed="${activeScope === TRACKING_SCOPE.CYCLE}">Ciclo atual</button>
        <button type="button" class="seg-btn${activeScope === TRACKING_SCOPE.ALL ? " is-on" : ""}"
                data-tracking-scope="all" aria-pressed="${activeScope === TRACKING_SCOPE.ALL}">Histórico completo</button>
        ${includeOfficialDiet ? `
          <button type="button" class="seg-btn${activeScope === TRACKING_SCOPE.OFFICIAL_DIET ? " is-on" : ""}"
                  data-tracking-scope="official-diet" aria-pressed="${activeScope === TRACKING_SCOPE.OFFICIAL_DIET}">Dieta Oficial</button>` : ""}
      </div>
    </section>`;

  el.querySelectorAll("[data-tracking-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextScope = button.dataset.trackingScope;
      if (nextScope === activeScope) return;
      onChange(nextScope);
    });
  });
}
