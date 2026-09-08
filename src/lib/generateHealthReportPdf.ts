import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { HealthReportDetail } from "@/types";
import { SLEEP_QUALITY_LABELS } from "@/types";

// Brand tokens pulled straight from tailwind.config.ts / index.css so the
// PDF reads as the same product, not a generic export. jsPDF's color
// setters are overloaded (string | number | 3-tuple | 4-tuple), which
// TypeScript can't resolve against a spread argument — so these are called
// with three explicit numbers everywhere below rather than `...COLOR`.
type Rgb = [number, number, number];
const MAROON: Rgb = [107, 29, 48]; // #6B1D30
const INK: Rgb = [23, 19, 16]; // #171310
const MUTED: Rgb = [102, 90, 78]; // #665A4E
const BORDER: Rgb = [226, 217, 207]; // #E2D9CF

function setText(doc: jsPDF, color: Rgb) {
  doc.setTextColor(color[0], color[1], color[2]);
}
function setDraw(doc: jsPDF, color: Rgb) {
  doc.setDrawColor(color[0], color[1], color[2]);
}
function setFill(doc: jsPDF, color: Rgb) {
  doc.setFillColor(color[0], color[1], color[2]);
}

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/**
 * Builds a real, print-quality PDF from a report's data snapshot — the
 * same numbers the Nutrition/Sleep/Cycle/Goals pages themselves show, not
 * a screenshot of a page and not a second, independently-computed set of
 * figures. Returns the finished document; callers decide whether to save,
 * open in a new tab, or hand it to the print dialog.
 */
export function generateHealthReportPdf(report: HealthReportDetail): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const snap = report.dataSnapshot;
  let y = MARGIN;

  function ensureSpace(height: number) {
    if (y + height > PAGE_HEIGHT - 70) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function sectionTitle(text: string) {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setText(doc, MAROON);
    doc.text(text, MARGIN, y);
    y += 6;
    setDraw(doc, BORDER);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 18;
  }

  function paragraph(text: string, opts: { muted?: boolean; size?: number } = {}) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(opts.size ?? 10.5);
    setText(doc, opts.muted ? MUTED : INK);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
    ensureSpace(lines.length * 14 + 4);
    doc.text(lines, MARGIN, y);
    y += lines.length * 14 + 8;
  }

  function keyValueTable(rows: [string, string][]) {
    ensureSpace(rows.length * 20 + 20);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      body: rows,
      theme: "plain",
      styles: { fontSize: 10.5, textColor: INK, cellPadding: { top: 4, bottom: 4, left: 0, right: 8 } },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 200, textColor: MUTED },
        1: { cellWidth: CONTENT_WIDTH - 200 },
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  function progressBar(label: string, pct: number, detail: string) {
    ensureSpace(34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setText(doc, INK);
    doc.text(label, MARGIN, y);
    setText(doc, MUTED);
    doc.text(detail, PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 6;
    const barWidth = CONTENT_WIDTH;
    const barHeight = 6;
    setFill(doc, BORDER);
    doc.roundedRect(MARGIN, y, barWidth, barHeight, 3, 3, "F");
    const filled = Math.max(0, Math.min(100, pct)) / 100 * barWidth;
    if (filled > 0) {
      setFill(doc, MAROON);
      doc.roundedRect(MARGIN, y, Math.max(filled, 6), barHeight, 3, 3, "F");
    }
    y += barHeight + 16;
  }

  function noData(text: string) {
    paragraph(text, { muted: true });
  }

  // --- Cover / header ------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setText(doc, MAROON);
  doc.text("Women360", MARGIN, y);
  y += 30;

  doc.setFontSize(22);
  setText(doc, INK);
  doc.text(report.title || "Health Report", MARGIN, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setText(doc, MUTED);
  doc.text(`${report.rangeLabel} · Generated ${formatDate(report.generatedOn)}`, MARGIN, y);
  y += 15;
  if (snap.profile.name) {
    doc.text(`Prepared for ${snap.profile.name}`, MARGIN, y);
    y += 15;
  }
  y += 14;

  // --- Nutrition -------------------------------------------------------
  sectionTitle("Nutrition");
  if (snap.nutrition.daysLogged === 0) {
    noData("No meals were logged in this period.");
  } else {
    keyValueTable([
      ["Days with meals logged", `${snap.nutrition.daysLogged} of ${snap.rangeDays} days`],
      ["Total meals logged", `${snap.nutrition.totalMealsLogged}`],
      ["Average calories per logged day", snap.nutrition.avgCaloriesPerLoggedDay != null ? `${snap.nutrition.avgCaloriesPerLoggedDay} kcal` : "—"],
      ["Average protein per logged day", snap.nutrition.avgProteinGPerLoggedDay != null ? `${snap.nutrition.avgProteinGPerLoggedDay} g` : "—"],
      ["Average carbohydrates per logged day", snap.nutrition.avgCarbsGPerLoggedDay != null ? `${snap.nutrition.avgCarbsGPerLoggedDay} g` : "—"],
      ["Average fat per logged day", snap.nutrition.avgFatGPerLoggedDay != null ? `${snap.nutrition.avgFatGPerLoggedDay} g` : "—"],
      ["Average fibre per logged day", snap.nutrition.avgFibreGPerLoggedDay != null ? `${snap.nutrition.avgFibreGPerLoggedDay} g` : "—"],
      ["Average hydration per logged day", snap.nutrition.avgHydrationMlPerLoggedDay != null ? `${snap.nutrition.avgHydrationMlPerLoggedDay} ml` : "—"],
      ["Fruit & veg servings logged", `${snap.nutrition.totalFruitVegServings}`],
    ]);
  }

  // --- Sleep -------------------------------------------------------------
  sectionTitle("Sleep");
  if (snap.sleep.entryCount === 0) {
    noData("No sleep was logged in this period.");
  } else {
    keyValueTable([
      ["Nights logged", `${snap.sleep.entryCount}`],
      ["Average duration", snap.sleep.avgDurationHours != null ? `${snap.sleep.avgDurationHours} hours` : "—"],
      [
        "Average quality",
        snap.sleep.avgQuality != null
          ? `${snap.sleep.avgQuality} / 5 (${SLEEP_QUALITY_LABELS[Math.round(snap.sleep.avgQuality)] ?? "—"})`
          : "—",
      ],
    ]);
  }

  // --- Cycle ---------------------------------------------------------
  sectionTitle("Cycle");
  if (!snap.cycle.hasData) {
    noData("No cycle data has been logged yet.");
  } else {
    keyValueTable([
      ["Current cycle day", snap.cycle.currentDay != null ? `Day ${snap.cycle.currentDay}` : "—"],
      ["Current phase", snap.cycle.phase ? titleCase(snap.cycle.phase) : "—"],
      ["Average cycle length", `${snap.cycle.averageCycleLengthDays} days`],
      ["Average period length", `${snap.cycle.averagePeriodLengthDays} days`],
      [
        "Estimated next period",
        snap.cycle.estimatedNextPeriodDate ? `${formatDate(snap.cycle.estimatedNextPeriodDate)} (estimate, not a diagnosis)` : "—",
      ],
    ]);
  }

  // --- Activity & wellbeing -----------------------------------------
  sectionTitle("Activity & wellbeing");
  if (snap.activity.entryCount === 0 && snap.wellbeing.entryCount === 0) {
    noData("No activity or mood check-ins were logged in this period.");
  } else {
    keyValueTable([
      ["Activity sessions logged", `${snap.activity.entryCount}`],
      ["Total active minutes", `${snap.activity.totalMinutes} minutes`],
      ["Mood check-ins logged", `${snap.wellbeing.entryCount}`],
      ["Average mood (0-4)", snap.wellbeing.avgMood != null ? `${snap.wellbeing.avgMood}` : "—"],
      ["Average stress (0-4)", snap.wellbeing.avgStress != null ? `${snap.wellbeing.avgStress}` : "—"],
      ["Average energy (0-4)", snap.wellbeing.avgEnergy != null ? `${snap.wellbeing.avgEnergy}` : "—"],
    ]);
  }

  // --- Goals -----------------------------------------------------------
  sectionTitle("Goals");
  if (snap.goals.active.length === 0 && snap.goals.completed.length === 0) {
    noData("No goals have been set yet.");
  } else {
    if (snap.goals.active.length === 0) {
      paragraph("No active goals.", { muted: true });
    }
    for (const g of snap.goals.active) {
      progressBar(`${g.title} (${titleCase(g.category)})`, g.progressPct, `${g.currentValue} / ${g.targetValue} ${g.unit} · ${g.progressPct}%`);
    }
    if (snap.goals.completed.length > 0) {
      paragraph(`Completed: ${snap.goals.completed.map((g) => g.title).join(", ")}`, { muted: true });
    }
  }

  // --- Vitals (only if any were logged) -------------------------------
  if (snap.vitals.length > 0) {
    sectionTitle("Recent measurements");
    keyValueTable(snap.vitals.slice(0, 12).map((v) => [`${titleCase(v.type.replace(/_/g, " "))} · ${formatDate(v.date)}`, v.value]));
  }

  // --- Notes on this report -------------------------------------------
  sectionTitle("About this report");
  paragraph(
    "This report summarizes data you logged in Women360 during the selected period. Averages and totals are calculated " +
      "directly from your own records. Cycle predictions are estimates based on your recent logged cycles, not a " +
      "diagnosis. This report is not medical advice — please share it with a healthcare provider if you'd like their input.",
    { muted: true, size: 9.5 }
  );

  // --- Header/footer on every page -------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setDraw(doc, BORDER);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_HEIGHT - 46, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(doc, MUTED);
    doc.text("Women360 · Personal health, not a diagnosis.", MARGIN, PAGE_HEIGHT - 32);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 32, { align: "right" });
  }

  return doc;
}
