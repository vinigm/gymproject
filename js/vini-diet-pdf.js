import { VINI_DAILY_GOALS } from "./vini-diet-plan.js";
import { VINI_TREND_METRICS } from "./vini-diet-trends.js";

const PAGE = Object.freeze({ width: 842, height: 595 });
const COLORS = Object.freeze({
  ink: "#172033",
  muted: "#667085",
  border: "#dbe3ef",
  soft: "#f5f7fb",
  white: "#ffffff",
  header: "#0f172a",
  kcal: "#ec4899",
  p: "#10b981",
  c: "#3b82f6",
  f: "#eab308",
  goal: "#64748b",
});

const METRIC_COLORS = Object.freeze({ kcal: COLORS.kcal, p: COLORS.p, c: COLORS.c, f: COLORS.f });

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
        kcal: Math.max(0, Number(entry.summary?.consumed?.kcal) || 0),
        p: Math.max(0, Number(entry.summary?.consumed?.p) || 0),
        c: Math.max(0, Number(entry.summary?.consumed?.c) || 0),
        f: Math.max(0, Number(entry.summary?.consumed?.f) || 0),
      },
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
  const latest = records.at(-1)?.consumed?.[metric.key] || 0;
  const goal = Math.max(0, Number(goals?.[metric.key]) || 0);
  drawText(commands, metric.label, x + 14, y + height - 22, 13, { bold: true, color });
  drawText(commands, `Ultimo: ${number(latest, Number.isInteger(latest) ? 0 : 1)} ${metric.unit}`, x + width - 14, y + height - 21, 8.5, { color: COLORS.muted, align: "right" });
  drawText(commands, `Meta estimada: ${number(goal)} ${metric.unit}`, x + width - 14, y + height - 34, 7.5, { color: COLORS.goal, align: "right" });

  if (!records.length) {
    drawText(commands, "Sem registros neste periodo.", x + width / 2, y + height / 2, 10, { color: COLORS.muted, align: "center" });
    return;
  }

  const plot = { x: x + 46, y: y + 27, width: width - 62, height: height - 72 };
  const values = records.map((entry) => entry.consumed[metric.key]);
  const maxY = niceCeiling(Math.max(goal, ...values, 1) * 1.1);
  const firstEpoch = dateEpoch(records[0].date);
  const lastEpoch = dateEpoch(records.at(-1).date);
  const span = Math.max(1, lastEpoch - firstEpoch);
  const px = (entry, index) => plot.x + (records.length === 1
    ? plot.width / 2
    : ((dateEpoch(entry.date) - firstEpoch) / span) * plot.width);
  const py = (value) => plot.y + (Math.max(0, Number(value) || 0) / maxY) * plot.height;

  for (let index = 0; index <= 4; index += 1) {
    const tick = (maxY * index) / 4;
    const tickY = py(tick);
    line(commands, plot.x, tickY, plot.x + plot.width, tickY, COLORS.border, 0.45);
    drawText(commands, number(tick), plot.x - 6, tickY - 2.5, 6.8, { color: COLORS.muted, align: "right" });
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
    drawText(commands, shortDate(point.entry.date).slice(0, 5), point.x, plot.y - 13, 6.8, { color: COLORS.muted, align: "center" });
  });
}

function drawHeader(commands, subtitle) {
  fillRect(commands, 0, PAGE.height - 54, PAGE.width, 54, COLORS.header);
  drawText(commands, "Relatorio nutricional - Kg Vini", 36, PAGE.height - 31, 19, { bold: true, color: COLORS.white });
  drawText(commands, subtitle, PAGE.width - 36, PAGE.height - 29, 8.5, { color: "#cbd5e1", align: "right" });
}

function drawWeeklyAverages(commands, weekly, goals) {
  const start = weekly?.start ? shortDate(weekly.start) : "--";
  const end = weekly?.end ? shortDate(weekly.end) : "--";
  drawText(commands, `Media diaria da semana ${start} - ${end}`, 36, 521, 10.5, { bold: true });
  drawText(commands, `${Number(weekly?.days) || 0} dias registrados`, PAGE.width - 36, 521, 8, { color: COLORS.muted, align: "right" });
  const cards = [
    { label: "Calorias", value: `${number(weekly?.averages?.kcal)} kcal`, goal: `${number(goals.kcal)} kcal`, key: "kcal" },
    { label: "Proteina", value: `${number(weekly?.averages?.p, 1)} g`, goal: `${number(goals.p)} g`, key: "p" },
    { label: "Carboidrato", value: `${number(weekly?.averages?.c, 1)} g`, goal: `${number(goals.c)} g`, key: "c" },
    { label: "Gordura", value: `${number(weekly?.averages?.f, 1)} g`, goal: `${number(goals.f)} g`, key: "f" },
  ];
  const gap = 10;
  const cardWidth = (PAGE.width - 72 - gap * 3) / 4;
  cards.forEach((card, index) => {
    const x = 36 + index * (cardWidth + gap);
    fillRect(commands, x, 468, cardWidth, 39, COLORS.soft);
    strokeRect(commands, x, 468, cardWidth, 39, COLORS.border, 0.7);
    fillRect(commands, x, 468, 4, 39, METRIC_COLORS[card.key]);
    drawText(commands, card.label, x + 12, 492, 7.5, { color: COLORS.muted });
    drawText(commands, card.value, x + 12, 477, 12, { bold: true, color: METRIC_COLORS[card.key] });
    drawText(commands, `ref. ${card.goal}`, x + cardWidth - 8, 478, 6.5, { color: COLORS.muted, align: "right" });
  });
}

function pageContents(records, options) {
  const goals = options.goals || VINI_DAILY_GOALS;
  const subtitle = `${ascii(options.scopeLabel || "Ciclo atual")} | ${records.length} dias | gerado em ${generatedDate(options.generatedAt)}`;
  const first = [];
  drawHeader(first, subtitle);
  drawWeeklyAverages(first, options.weekly, goals);
  drawChart(first, records, VINI_TREND_METRICS[0], goals, 36, 249, 770, 195);
  drawChart(first, records, VINI_TREND_METRICS[1], goals, 36, 34, 770, 195);
  drawText(first, "Graficos baseados somente nos alimentos registrados no tracker.", 36, 16, 7, { color: COLORS.muted });
  drawText(first, "1/2", PAGE.width - 36, 16, 7, { color: COLORS.muted, align: "right" });

  const second = [];
  drawHeader(second, subtitle);
  drawChart(second, records, VINI_TREND_METRICS[2], goals, 36, 298, 770, 220);
  drawChart(second, records, VINI_TREND_METRICS[3], goals, 36, 54, 770, 220);
  drawText(second, "A linha tracejada representa a meta estimada configurada no tracker.", 36, 23, 7, { color: COLORS.muted });
  drawText(second, "2/2", PAGE.width - 36, 23, 7, { color: COLORS.muted, align: "right" });
  return [first.join("\n"), second.join("\n")];
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
  const filename = `relatorio-nutricional-vini-${date}.pdf`;
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
