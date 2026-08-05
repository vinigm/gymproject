import { VINI_DAILY_GOALS } from "./diet-profile.js";
import { balanceKcalForRecord } from "./energy-balance.js";
import { VINI_TREND_METRICS } from "./vini-diet-trends.js";

const PAGE = Object.freeze({ width: 842, height: 595 });
const COLORS = Object.freeze({
  ink: "#172033",
  muted: "#667085",
  border: "#dbe3ef",
  soft: "#f5f7fb",
  white: "#ffffff",
  header: "#0f172a",
  kcal: "#ef4444",
  p: "#10b981",
  c: "#3b82f6",
  f: "#eab308",
  goal: "#64748b",
});

const METRIC_COLORS = Object.freeze({ kcal: COLORS.kcal, p: COLORS.p, c: COLORS.c, f: COLORS.f });
const MONTHS_PT = Object.freeze([
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]);
const WEEKDAYS_PT = Object.freeze(["dom", "seg", "ter", "qua", "qui", "sex", "sab"]);
const GYM_GROUPS = Object.freeze({
  costa: { abbr: "Co", color: "#60a5fa" },
  triceps: { abbr: "Tr", color: "#a78bfa" },
  peito: { abbr: "Pe", color: "#f472b6" },
  biceps: { abbr: "Bi", color: "#f87171" },
  perna: { abbr: "Pn", color: "#fb923c" },
  ombro: { abbr: "Om", color: "#fbbf24" },
  lombar: { abbr: "Lb", color: "#34d399" },
  abdominal: { abbr: "Ab", color: "#22d3ee" },
});

function ascii(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function pdfEscape(value) {
  return ascii(value).replace(/([\\()])/g, "\\$1");
}

function number(value, digits = 0) {
  const numeric = Number(value) || 0;
  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function shortDate(iso) {
  const [year, month, day] = String(iso || "").split("-");
  return day && month && year ? `${day}/${month}/${year}` : ascii(iso);
}

function generatedDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function rgb(hex) {
  const value = String(hex).replace("#", "");
  return [0, 2, 4].map((offset) => (parseInt(value.slice(offset, offset + 2), 16) / 255).toFixed(3)).join(" ");
}

function fixed(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function textWidth(value, size, bold = false) {
  return ascii(value).length * size * (bold ? 0.56 : 0.51);
}

function drawText(commands, value, x, y, size, { bold = false, color = COLORS.ink, align = "left" } = {}) {
  let startX = x;
  const width = textWidth(value, size, bold);
  if (align === "right") startX -= width;
  if (align === "center") startX -= width / 2;
  commands.push(`${rgb(color)} rg BT /${bold ? "F2" : "F1"} ${fixed(size)} Tf ${fixed(startX)} ${fixed(y)} Td (${pdfEscape(value)}) Tj ET`);
}

function fillRect(commands, x, y, width, height, color) {
  commands.push(`${rgb(color)} rg ${fixed(x)} ${fixed(y)} ${fixed(width)} ${fixed(height)} re f`);
}

function strokeRect(commands, x, y, width, height, color, lineWidth = 1) {
  commands.push(`${rgb(color)} RG ${fixed(lineWidth)} w ${fixed(x)} ${fixed(y)} ${fixed(width)} ${fixed(height)} re S`);
}

function line(commands, x1, y1, x2, y2, color, lineWidth = 1, dashed = false) {
  commands.push(`q ${rgb(color)} RG ${fixed(lineWidth)} w ${dashed ? "[5 4] 0 d" : "[] 0 d"} ${fixed(x1)} ${fixed(y1)} m ${fixed(x2)} ${fixed(y2)} l S Q`);
}

function circle(commands, x, y, radius, fill, stroke = fill) {
  const k = radius * 0.5522848;
  commands.push([
    `q ${rgb(fill)} rg ${rgb(stroke)} RG 1 w`,
    `${fixed(x + radius)} ${fixed(y)} m`,
    `${fixed(x + radius)} ${fixed(y + k)} ${fixed(x + k)} ${fixed(y + radius)} ${fixed(x)} ${fixed(y + radius)} c`,
    `${fixed(x - k)} ${fixed(y + radius)} ${fixed(x - radius)} ${fixed(y + k)} ${fixed(x - radius)} ${fixed(y)} c`,
    `${fixed(x - radius)} ${fixed(y - k)} ${fixed(x - k)} ${fixed(y - radius)} ${fixed(x)} ${fixed(y - radius)} c`,
    `${fixed(x + k)} ${fixed(y - radius)} ${fixed(x + radius)} ${fixed(y - k)} ${fixed(x + radius)} ${fixed(y)} c B Q`,
  ].join(" "));
}

function normalizeRecords(records) {
  return (Array.isArray(records) ? records : [])
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || "")))
    .map((entry) => ({
      date: entry.date,
      consumed: {
        kcal: balanceKcalForRecord(entry),
        p: Math.max(0, Number(entry.summary?.consumed?.p) || 0),
        c: Math.max(0, Number(entry.summary?.consumed?.c) || 0),
        f: Math.max(0, Number(entry.summary?.consumed?.f) || 0),
      },
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeWeightEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || ""))
      && Number.isFinite(Number(entry?.weight))
      && Number(entry.weight) > 0)
    .map((entry) => ({ date: entry.date, weight: Number(entry.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeTrainingDays(days) {
  return (Array.isArray(days) ? days : [])
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || "")))
    .map((entry) => ({
      date: entry.date,
      gymGroups: [...new Set(Array.isArray(entry.gymGroups)
        ? entry.gymGroups
        : Array.isArray(entry.gym_groups) ? entry.gym_groups : [])],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function averageNutrition(records) {
  const totals = records.reduce((sum, entry) => ({
    kcal: sum.kcal + entry.consumed.kcal,
    p: sum.p + entry.consumed.p,
    c: sum.c + entry.consumed.c,
    f: sum.f + entry.consumed.f,
  }), { kcal: 0, p: 0, c: 0, f: 0 });
  const count = Math.max(1, records.length);
  return {
    kcal: totals.kcal / count,
    p: totals.p / count,
    c: totals.c / count,
    f: totals.f / count,
  };
}

function dateEpoch(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function niceCeiling(value) {
  const safe = Math.max(1, Number(value) || 0);
  const magnitude = 10 ** Math.floor(Math.log10(safe));
  const scaled = safe / magnitude;
  const step = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .find((candidate) => candidate >= scaled) || 10;
  return step * magnitude;
}

function labelIndexes(length, maximum = 6) {
  if (length <= maximum) return new Set(Array.from({ length }, (_, index) => index));
  return new Set(Array.from({ length: maximum }, (_, index) => Math.round((index * (length - 1)) / (maximum - 1))));
}

function drawChart(commands, records, metric, goals, x, y, width, height) {
  fillRect(commands, x, y, width, height, COLORS.white);
  strokeRect(commands, x, y, width, height, COLORS.border, 0.9);
  const color = METRIC_COLORS[metric.key];
  const isBalance = metric.key === "kcal";
  const latest = records.at(-1)?.consumed?.[metric.key] || 0;
  const goal = isBalance ? 0 : Math.max(0, Number(goals?.[metric.key]) || 0);
  drawText(commands, metric.label, x + 12, y + height - 19, 11, { bold: true, color });
  drawText(commands, `Ultimo: ${number(latest, Number.isInteger(latest) ? 0 : 1)} ${metric.unit}`, x + width - 12, y + height - 18, 7.2, { color: COLORS.muted, align: "right" });
  drawText(commands, `${isBalance ? "Equilibrio" : "Meta"}: ${number(goal)} ${metric.unit}`, x + width - 12, y + height - 29, 6.5, { color: COLORS.goal, align: "right" });

  if (!records.length) {
    drawText(commands, "Sem registros neste periodo.", x + width / 2, y + height / 2, 10, { color: COLORS.muted, align: "center" });
    return;
  }

  const plot = { x: x + 38, y: y + 23, width: width - 50, height: height - 60 };
  const values = records.map((entry) => entry.consumed[metric.key]);
  const maximum = isBalance
    ? niceCeiling(Math.max(1, ...values.map((value) => Math.abs(value))) * 1.1)
    : niceCeiling(Math.max(goal, ...values, 1) * 1.1);
  const minY = isBalance ? -maximum : 0;
  const maxY = maximum;
  const firstEpoch = dateEpoch(records[0].date);
  const lastEpoch = dateEpoch(records.at(-1).date);
  const span = Math.max(1, lastEpoch - firstEpoch);
  const px = (entry, index) => plot.x + (records.length === 1
    ? plot.width / 2
    : ((dateEpoch(entry.date) - firstEpoch) / span) * plot.width);
  const py = (value) => plot.y + (((Number(value) || 0) - minY) / (maxY - minY)) * plot.height;

  for (let index = 0; index <= 3; index += 1) {
    const tick = minY + ((maxY - minY) * index) / 3;
    const tickY = py(tick);
    line(commands, plot.x, tickY, plot.x + plot.width, tickY, COLORS.border, 0.45);
    drawText(commands, number(tick), plot.x - 5, tickY - 2.2, 5.8, { color: COLORS.muted, align: "right" });
  }

  line(commands, plot.x, py(goal), plot.x + plot.width, py(goal), COLORS.goal, 1.1, true);
  const points = records.map((entry, index) => ({ x: px(entry, index), y: py(entry.consumed[metric.key]), entry }));
  if (points.length > 1) {
    const path = points.map((point, index) => `${fixed(point.x)} ${fixed(point.y)} ${index ? "l" : "m"}`).join(" ");
    commands.push(`q ${rgb(color)} RG 1.8 w 1 J 1 j ${path} S Q`);
  }
  points.forEach((point) => circle(commands, point.x, point.y, 2.2, COLORS.white, color));

  const indexes = labelIndexes(points.length);
  points.forEach((point, index) => {
    if (!indexes.has(index)) return;
    drawText(commands, shortDate(point.entry.date).slice(0, 5), point.x, plot.y - 11, 5.8, { color: COLORS.muted, align: "center" });
  });
}

function drawHeader(commands, subtitle, reportTitle) {
  fillRect(commands, 0, PAGE.height - 54, PAGE.width, 54, COLORS.header);
  drawText(commands, reportTitle, 36, PAGE.height - 31, 19, { bold: true, color: COLORS.white });
  drawText(commands, subtitle, PAGE.width - 36, PAGE.height - 29, 8.5, { color: "#cbd5e1", align: "right" });
}

function drawCycleAverages(commands, records, goals, x, y, width, height) {
  const averages = averageNutrition(records);
  drawText(commands, "Medias do ciclo", x, y + height - 13, 9.5, { bold: true });
  drawText(commands, `${records.length} dias`, x + width, y + height - 13, 6.8, { color: COLORS.muted, align: "right" });
  const cards = [
    { label: "Saldo energetico", value: `${number(averages.kcal)} kcal`, goal: "0", key: "kcal" },
    { label: "Carboidrato", value: `${number(averages.c, 1)} g`, goal: `${number(goals.c)}`, key: "c" },
    { label: "Proteina", value: `${number(averages.p, 1)} g`, goal: `${number(goals.p)}`, key: "p" },
    { label: "Gordura", value: `${number(averages.f, 1)} g`, goal: `${number(goals.f)}`, key: "f" },
  ];
  const gap = 5;
  const cardWidth = (width - gap) / 2;
  const cardHeight = 31;
  cards.forEach((card, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const cardX = x + column * (cardWidth + gap);
    const cardY = y + (1 - row) * (cardHeight + gap);
    fillRect(commands, cardX, cardY, cardWidth, cardHeight, COLORS.soft);
    strokeRect(commands, cardX, cardY, cardWidth, cardHeight, COLORS.border, 0.6);
    fillRect(commands, cardX, cardY, 3, cardHeight, METRIC_COLORS[card.key]);
    drawText(commands, card.label, cardX + 9, cardY + 19, 6.4, { color: COLORS.muted });
    drawText(commands, card.value, cardX + 9, cardY + 7, 9.3, { bold: true, color: METRIC_COLORS[card.key] });
    drawText(commands, `meta ${card.goal}`, cardX + cardWidth - 6, cardY + 8, 5.5, { color: COLORS.muted, align: "right" });
  });
}

function drawWeightChart(commands, entries, x, y, width, height) {
  fillRect(commands, x, y, width, height, COLORS.white);
  strokeRect(commands, x, y, width, height, COLORS.border, 0.9);
  drawText(commands, "Evolucao do peso", x + 12, y + height - 18, 10.5, { bold: true, color: COLORS.ink });
  const latest = entries.at(-1);
  drawText(commands, latest ? `Ultimo: ${number(latest.weight, 1)} kg` : "Sem pesagens", x + width - 12, y + height - 18, 7.2, { color: COLORS.muted, align: "right" });
  if (!entries.length) {
    drawText(commands, "Nenhum peso registrado neste ciclo.", x + width / 2, y + 37, 8, { color: COLORS.muted, align: "center" });
    return;
  }

  const values = entries.map((entry) => entry.weight);
  let minY = Math.min(...values);
  let maxY = Math.max(...values);
  const padding = Math.max(0.5, (maxY - minY) * 0.2);
  minY -= padding;
  maxY += padding;
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const plot = { x: x + 40, y: y + 22, width: width - 54, height: height - 52 };
  const firstEpoch = dateEpoch(entries[0].date);
  const lastEpoch = dateEpoch(entries.at(-1).date);
  const span = Math.max(1, lastEpoch - firstEpoch);
  const px = (entry) => plot.x + (entries.length === 1
    ? plot.width / 2
    : ((dateEpoch(entry.date) - firstEpoch) / span) * plot.width);
  const py = (value) => plot.y + ((value - minY) / (maxY - minY)) * plot.height;
  for (let index = 0; index <= 2; index += 1) {
    const value = minY + ((maxY - minY) * index) / 2;
    const tickY = py(value);
    line(commands, plot.x, tickY, plot.x + plot.width, tickY, COLORS.border, 0.45);
    drawText(commands, number(value, 1), plot.x - 5, tickY - 2, 5.7, { color: COLORS.muted, align: "right" });
  }
  const points = entries.map((entry) => ({ x: px(entry), y: py(entry.weight), entry }));
  if (points.length > 1) {
    const path = points.map((point, index) => `${fixed(point.x)} ${fixed(point.y)} ${index ? "l" : "m"}`).join(" ");
    commands.push(`q ${rgb(COLORS.ink)} RG 1.8 w 1 J 1 j ${path} S Q`);
  }
  points.forEach((point) => circle(commands, point.x, point.y, 2.1, COLORS.white, COLORS.ink));
  drawText(commands, shortDate(entries[0].date).slice(0, 5), plot.x, plot.y - 10, 5.8, { color: COLORS.muted, align: "center" });
  if (entries.length > 1) {
    drawText(commands, shortDate(entries.at(-1).date).slice(0, 5), plot.x + plot.width, plot.y - 10, 5.8, { color: COLORS.muted, align: "center" });
  }
}

function calendarMonth(value, generatedAt) {
  if (/^\d{4}-\d{2}$/.test(String(value || ""))) return String(value);
  const date = generatedAt instanceof Date ? generatedAt : new Date(generatedAt || Date.now());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function drawGymCalendar(commands, trainingDays, monthISO, x, y, width, height) {
  const [year, month] = monthISO.split("-").map(Number);
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysByDate = new Map(trainingDays
    .filter((entry) => entry.date.startsWith(monthISO))
    .map((entry) => [entry.date, entry]));
  const monthLabel = `${MONTHS_PT[month - 1] || monthISO} de ${year}`;
  fillRect(commands, x, y, width, height, COLORS.white);
  strokeRect(commands, x, y, width, height, COLORS.border, 0.9);
  drawText(commands, `Calendario de musculacao - ${monthLabel}`, x + 12, y + height - 16, 9.5, { bold: true });
  drawText(commands, `${daysByDate.size} treinos`, x + width - 12, y + height - 16, 6.8, { color: COLORS.muted, align: "right" });

  const gridX = x + 10;
  const gridWidth = width - 20;
  const cellWidth = gridWidth / 7;
  const gridTop = y + height - 35;
  const gridBottom = y + 7;
  const cellHeight = (gridTop - gridBottom) / 6;
  WEEKDAYS_PT.forEach((weekday, index) => {
    drawText(commands, weekday, gridX + index * cellWidth + cellWidth / 2, gridTop + 6, 5.8, { bold: true, color: COLORS.muted, align: "center" });
  });
  for (let cell = 0; cell < 42; cell += 1) {
    const row = Math.floor(cell / 7);
    const column = cell % 7;
    const cellX = gridX + column * cellWidth;
    const cellY = gridTop - (row + 1) * cellHeight;
    const day = cell - firstDow + 1;
    const validDay = day >= 1 && day <= daysInMonth;
    const date = validDay ? `${monthISO}-${String(day).padStart(2, "0")}` : "";
    const training = daysByDate.get(date);
    if (training) fillRect(commands, cellX, cellY, cellWidth, cellHeight, "#eff6ff");
    strokeRect(commands, cellX, cellY, cellWidth, cellHeight, training ? "#93c5fd" : COLORS.border, training ? 0.8 : 0.35);
    if (!validDay) continue;
    drawText(commands, day, cellX + 4, cellY + cellHeight / 2 - 2, 5.8, { bold: Boolean(training), color: training ? COLORS.ink : COLORS.muted });
    if (!training) continue;
    const groups = training.gymGroups.map((group) => GYM_GROUPS[group]).filter(Boolean);
    if (!groups.length) {
      drawText(commands, "Treino", cellX + 18, cellY + cellHeight / 2 - 2, 5.3, { bold: true, color: COLORS.kcal });
      continue;
    }
    let badgeX = cellX + 18;
    groups.slice(0, 7).forEach((group) => {
      drawText(commands, group.abbr, badgeX, cellY + cellHeight / 2 - 2, 5.2, { bold: true, color: group.color });
      badgeX += 12;
    });
  }
}

function pageContents(records, options) {
  const goals = options.goals || VINI_DAILY_GOALS;
  const reportTitle = ascii(options.reportTitle || "Relatório nutricional - Dieta Vini");
  const subtitle = `${ascii(options.scopeLabel || "Ciclo atual")} | ${records.length} dias | gerado em ${generatedDate(options.generatedAt)}`;
  const commands = [];
  const weights = normalizeWeightEntries(options.weightEntries);
  const trainingDays = normalizeTrainingDays(options.trainingDays);
  const monthISO = calendarMonth(options.calendarMonth, options.generatedAt);
  const margin = 30;
  const gap = 10;
  const columnWidth = (PAGE.width - margin * 2 - gap) / 2;

  drawHeader(commands, subtitle, reportTitle);
  drawWeightChart(commands, weights, margin, 433, 484, 98);
  drawCycleAverages(commands, records, goals, 526, 433, 286, 98);
  drawChart(commands, records, VINI_TREND_METRICS[0], goals, margin, 287, columnWidth, 136);
  drawChart(commands, records, VINI_TREND_METRICS[1], goals, margin + columnWidth + gap, 287, columnWidth, 136);
  drawChart(commands, records, VINI_TREND_METRICS[2], goals, margin, 141, columnWidth, 136);
  drawChart(commands, records, VINI_TREND_METRICS[3], goals, margin + columnWidth + gap, 141, columnWidth, 136);
  drawGymCalendar(commands, trainingDays, monthISO, margin, 14, PAGE.width - margin * 2, 117);
  return [commands.join("\n")];
}

function assemblePdf(contents) {
  const pageIds = contents.map((_, index) => 5 + index * 2);
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${contents.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  contents.forEach((content, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n%GYMPROJECT\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

export function createViniDietPdf(records, options = {}) {
  const cleanRecords = normalizeRecords(records);
  return assemblePdf(pageContents(cleanRecords, options));
}

export function downloadViniDietPdf(records, options = {}) {
  const bytes = createViniDietPdf(records, options);
  const date = options.fileDate || new Date().toISOString().slice(0, 10);
  const slug = String(options.reportSlug || "vini").replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "vini";
  const filename = `relatorio-nutricional-${slug}-${date}.pdf`;
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { filename, size: bytes.length };
}
