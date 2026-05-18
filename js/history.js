import { getRange } from "./storage.js";
import { todayISO, USERS } from "./app.js";

const NAMES = { vinicius: "Vinicius", victoria: "Victoria" };
const AVATAR_CLASS = { vinicius: "avatar--vini", victoria: "avatar--vic" };

const pad = (n) => String(n).padStart(2, "0");

function monthStartISO() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-01`;
}

function cigClass(n) {
  if (n === 0) return "hg-on--clean";
  if (n >= 5)  return "hg-on--dirty";
  if (n >= 3)  return "hg-on--warn";
  return "hg-on--neutral";
}

function cellFor(habit, day) {
  if (!day) return `<div class="hg-cell hg-x">×</div>`;

  switch (habit) {
    case "exercise": {
      const did = day.exercises && day.exercises.length > 0;
      return did
        ? `<div class="hg-cell hg-on hg-on--ex"></div>`
        : `<div class="hg-cell hg-x">×</div>`;
    }
    case "water": {
      return day.water
        ? `<div class="hg-cell hg-on hg-on--water"></div>`
        : `<div class="hg-cell hg-x">×</div>`;
    }
    case "lunch": {
      if (day.lunch === "limpo") return `<div class="hg-cell hg-on hg-on--clean"></div>`;
      if (day.lunch === "sujo")  return `<div class="hg-cell hg-on hg-on--dirty"></div>`;
      return `<div class="hg-cell hg-x">×</div>`;
    }
    case "dinner": {
      if (day.dinner === "limpo") return `<div class="hg-cell hg-on hg-on--clean"></div>`;
      if (day.dinner === "sujo")  return `<div class="hg-cell hg-on hg-on--dirty"></div>`;
      return `<div class="hg-cell hg-x">×</div>`;
    }
    case "cigarettes": {
      if (day.cigarettes == null || day.cigarettes === "") {
        return `<div class="hg-cell hg-x">×</div>`;
      }
      const n = Number(day.cigarettes);
      return `<div class="hg-cell hg-on ${cigClass(n)}">${n}</div>`;
    }
  }
  return `<div class="hg-cell hg-x">×</div>`;
}

function renderUserGrid(userId, data) {
  const byDate = new Map(data.map(d => [d.date, d]));
  const t = new Date();
  const today = todayISO();
  const y = t.getFullYear();
  const m = t.getMonth() + 1;
  const rows = [];

  for (let dayNum = t.getDate(); dayNum >= 1; dayNum--) {
    const dateStr = `${y}-${pad(m)}-${pad(dayNum)}`;
    const day = byDate.get(dateStr);
    const isToday = dateStr === today;
    rows.push(`
      <div class="hg-row${isToday ? " is-today" : ""}">
        <div class="hg-day">${dayNum}</div>
        ${cellFor("exercise", day)}
        ${cellFor("water", day)}
        ${cellFor("lunch", day)}
        ${cellFor("dinner", day)}
        ${cellFor("cigarettes", day)}
      </div>
    `);
  }

  return `
    <div class="hg-card" data-user="${userId}">
      <div class="hg-card-head">
        <span class="avatar ${AVATAR_CLASS[userId]} avatar--md">V</span>
        <span class="hg-card-name">${NAMES[userId]}</span>
      </div>
      <div class="hg-header">
        <div class="hg-day-hdr"></div>
        <div class="hg-hdr">ex</div>
        <div class="hg-hdr">água</div>
        <div class="hg-hdr">alm</div>
        <div class="hg-hdr">jan</div>
        <div class="hg-hdr">cig</div>
      </div>
      <div class="hg-body">
        ${rows.join("")}
      </div>
    </div>
  `;
}

export async function renderHistory() {
  const mStart = monthStartISO();
  const end = todayISO();

  USERS.forEach(u => {
    const el = document.getElementById(`history-${u}`);
    el.innerHTML = `<p class="muted" style="padding:8px;font-size:12px">carregando…</p>`;
  });

  const results = await Promise.all(
    USERS.map(u => getRange(u, mStart, end).catch(() => []))
  );

  USERS.forEach((u, i) => {
    document.getElementById(`history-${u}`).innerHTML = renderUserGrid(u, results[i]);
  });
}
