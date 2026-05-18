import { getRange } from "./storage.js";
import { todayISO, jumpToDate, APP_START_DATE } from "./app.js";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const DOW_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const EX_LABELS = {
  academia: "Academia", corrida: "Corrida", yoga: "Yoga",
  jiujitsu: "Jiu Jitsu", bicicleta: "Bicicleta"
};

const calState = {
  year: null, month: null,
  user: "vinicius",
  selectedDate: null
};

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function initIfNeeded() {
  if (calState.year === null) {
    const t = new Date();
    calState.year = t.getFullYear();
    calState.month = t.getMonth();
  }
}

function renderDetail(day) {
  const el = document.getElementById("cal-detail");
  if (!day) { el.hidden = true; return; }
  const ex = (day.exercises && day.exercises.length)
    ? day.exercises.map(e => EX_LABELS[e] || e).join(", ")
    : "—";
  el.hidden = false;
  el.innerHTML = `
    <div class="cal-detail-head">
      <h4>${day.date}</h4>
      <button class="ghost-btn" id="cal-edit-btn" data-date="${day.date}">editar este dia</button>
    </div>
    <div class="line"><span class="lbl">Exercícios:</span>${ex}</div>
    <div class="line"><span class="lbl">Água:</span>${day.water || "—"}</div>
    <div class="line"><span class="lbl">Almoço:</span>${day.lunch || "—"}</div>
    <div class="line"><span class="lbl">Janta:</span>${day.dinner || "—"}</div>
    <div class="line"><span class="lbl">Cigarros:</span>${day.cigarettes ?? "—"}</div>
  `;
  document.getElementById("cal-edit-btn").addEventListener("click", (e) => {
    jumpToDate(e.currentTarget.dataset.date);
  });
}

function bindControls() {
  if (bindControls._bound) return;
  bindControls._bound = true;

  document.getElementById("cal-prev").onclick = () => {
    calState.month -= 1;
    if (calState.month < 0) { calState.month = 11; calState.year -= 1; }
    calState.selectedDate = null;
    renderCalendar();
  };
  document.getElementById("cal-next").onclick = () => {
    calState.month += 1;
    if (calState.month > 11) { calState.month = 0; calState.year += 1; }
    calState.selectedDate = null;
    renderCalendar();
  };
  document.querySelectorAll("#cal-user-seg .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      calState.user = btn.dataset.user;
      calState.selectedDate = null;
      document.querySelectorAll("#cal-user-seg .seg-btn")
        .forEach(b => b.classList.toggle("is-on", b.dataset.user === calState.user));
      renderCalendar();
    });
  });
}

export async function renderCalendar() {
  initIfNeeded();
  bindControls();

  const { year, month, user } = calState;
  document.getElementById("cal-title").textContent = `${MONTHS_PT[month]} ${year}`;

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const start = iso(year, month, 1);
  const end = iso(year, month, daysInMonth);

  let data = [];
  try { data = await getRange(user, start, end); }
  catch (err) { console.error(err); }
  const byDate = new Map(data.map(d => [d.date, d]));

  const grid = document.getElementById("calendar");
  grid.innerHTML = "";

  for (const d of DOW_PT) {
    const h = document.createElement("div");
    h.className = "cal-head";
    h.textContent = d;
    grid.appendChild(h);
  }
  for (let i = 0; i < firstDow; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-cell is-empty";
    grid.appendChild(empty);
  }

  const today = todayISO();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = iso(year, month, d);
    const day = byDate.get(dateStr);
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    const beforeStart = dateStr < APP_START_DATE;
    if (beforeStart) cell.classList.add("is-disabled");
    if (dateStr === today) cell.classList.add("is-today");
    if (dateStr === calState.selectedDate) cell.classList.add("is-selected");

    const dots = [];
    if (day) {
      if (day.exercises && day.exercises.length) dots.push("ex");
      if (day.water) dots.push("water");
      if (day.lunch === "limpo" || day.dinner === "limpo") dots.push("clean");
      if (day.lunch === "sujo" || day.dinner === "sujo") dots.push("dirty");
    }
    cell.innerHTML = `
      <span class="day-num">${d}</span>
      <span class="dots">${dots.map(t => `<i class="dot dot--${t}"></i>`).join("")}</span>
    `;
    if (!beforeStart) {
      cell.addEventListener("click", () => {
        calState.selectedDate = dateStr;
        grid.querySelectorAll(".cal-cell").forEach(c => c.classList.remove("is-selected"));
        cell.classList.add("is-selected");
        renderDetail(day || { date: dateStr, exercises: [], water: null, lunch: null, dinner: null });
      });
    }
    grid.appendChild(cell);
  }

  renderDetail(calState.selectedDate ? (byDate.get(calState.selectedDate) || null) : null);
}
