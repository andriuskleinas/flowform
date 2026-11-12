import type { jsPDF } from "jspdf";

import type { Question } from "@/components/question-render";
import { downloadBlob, fetchAllResponses, fileSlug, type ExportRow } from "@/lib/export-csv";
import {
  getChoiceConfig,
  getRatingMax,
  isAnswered,
  parseFollowUps,
  type FollowUps,
} from "@/lib/form-utils";

/* Palette — sRGB approximations of the app's oklch tokens (light theme). */
type RGB = [number, number, number];
const INK: RGB = [28, 29, 34];
const MUTED: RGB = [112, 114, 122];
const FAINT: RGB = [168, 170, 176];
const HAIRLINE: RGB = [228, 228, 224];
const TRACK: RGB = [240, 240, 237];
const BRAND: RGB = [29, 63, 200];
const MINT: RGB = [24, 120, 92];
const SUN: RGB = [196, 138, 20];
const DANGER: RGB = [196, 58, 52];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 14;
const MAX_TEXT_ANSWERS = 40;

/** Characters the built-in PDF fonts (WinAnsi) can draw beyond Latin-1. */
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/**
 * The standard PDF fonts only cover WinAnsi. Fold anything else to its closest
 * base letter (č → c, ą → a) and drop what has none (emoji, CJK) rather than
 * letting jsPDF print garbage.
 */
function pdfSafe(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff || WIN_ANSI_EXTRA.has(ch)) {
      out += ch;
      continue;
    }
    const folded = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (folded && [...folded].every((c) => c.codePointAt(0)! <= 0xff)) out += folded;
    else if (ch === "ł") out += "l";
    else if (ch === "Ł") out += "L";
  }
  return out.replace(/[ \t]+/g, " ");
}

const nf = new Intl.NumberFormat("en");
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");
const dateFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const TYPE_LABEL: Record<Question["type"], string> = {
  text: "Short text",
  long_text: "Long text",
  multiple_choice: "Multiple choice",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  nps: "Net Promoter Score",
  rating: "Rating",
};

/* --------------------------------------------------------------------------
 * Layout cursor: tracks y, breaks pages, and wraps the jsPDF drawing calls we
 * use so the report code below reads top-to-bottom.
 * ------------------------------------------------------------------------ */
class Cursor {
  y = MARGIN;
  constructor(readonly doc: jsPDF) {}

  /** Start a new page if the next block of height `h` mm wouldn't fit. */
  need(h: number) {
    if (this.y + h > PAGE_H - MARGIN - FOOTER_H) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  font(size: number, style: "normal" | "bold" = "normal", color: RGB = INK, family = "helvetica") {
    this.doc.setFont(family, style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  lines(text: string, width: number): string[] {
    return this.doc.splitTextToSize(pdfSafe(text), width) as string[];
  }

  /** Line height in mm for the current font size. */
  get lh() {
    return (this.doc.getFontSize() * 1.35) / 2.835;
  }

  fill(color: RGB) {
    this.doc.setFillColor(...color);
  }

  rule(y = this.y) {
    this.doc.setDrawColor(...HAIRLINE);
    this.doc.setLineWidth(0.2);
    this.doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  }
}

/* ------------------------------- Sections -------------------------------- */

function drawHeader(c: Cursor, title: string, rows: ExportRow[], version: number | null) {
  const { doc } = c;
  c.font(7.5, "bold", BRAND, "courier");
  doc.text("FLOWFORM  ·  RESPONSE REPORT", MARGIN, c.y + 3);
  c.y += 9;

  c.font(20, "bold");
  const titleLines = c.lines(title || "Untitled form", CONTENT_W);
  doc.text(titleLines, MARGIN, c.y + 5);
  c.y += titleLines.length * c.lh + 3;

  const meta = [
    version != null ? `Version ${version}` : null,
    rows.length > 0
      ? `${dateFmt.format(new Date(rows[0].submitted_at))} – ${dateFmt.format(
          new Date(rows[rows.length - 1].submitted_at),
        )}`
      : null,
    `Generated ${dateFmt.format(new Date())}`,
  ].filter(Boolean);
  c.font(9, "normal", MUTED);
  doc.text(meta.join("   ·   "), MARGIN, c.y + 2);
  c.y += 9;

  // Stat tiles
  const fills = rows
    .filter((r) => r.started_at)
    .map((r) => (new Date(r.submitted_at).getTime() - new Date(r.started_at!).getTime()) / 1000)
    .filter((s) => s >= 0 && s < 60 * 60 * 6);
  const med = median(fills);
  const last7 = rows.filter(
    (r) => Date.now() - new Date(r.submitted_at).getTime() < 7 * 24 * 3600 * 1000,
  ).length;
  const tiles: [string, string][] = [
    ["Responses", nf.format(rows.length)],
    ["Last 7 days", nf.format(last7)],
    ["Median fill time", med != null ? formatDuration(med) : "—"],
  ];
  const gap = 4;
  const w = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  const h = 19;
  tiles.forEach(([label, value], i) => {
    const x = MARGIN + i * (w + gap);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, c.y, w, h, 2, 2, "S");
    c.font(8, "normal", MUTED);
    doc.text(label, x + 4, c.y + 6);
    c.font(15, "bold");
    doc.text(value, x + 4, c.y + 14.5);
  });
  c.y += h + 10;
}

function drawQuestionTitle(c: Cursor, index: number, q: Question, subtitle: string) {
  c.font(12, "bold");
  const titleLines = c.lines(q.label || "Untitled question", CONTENT_W - 12);
  const h = titleLines.length * c.lh + 10;
  c.need(h + 14); // keep the heading with at least the first line of its body
  if (c.y > MARGIN) c.rule(); // no divider at the very top of a page
  c.y += 7;
  c.font(8, "bold", BRAND, "courier");
  c.doc.text(`Q${index + 1}`, MARGIN, c.y);
  c.font(12, "bold");
  c.doc.text(titleLines, MARGIN + 12, c.y);
  c.y += (titleLines.length - 1) * c.lh + 5.5;
  c.font(8.5, "normal", MUTED);
  c.doc.text(pdfSafe(subtitle), MARGIN + 12, c.y);
  c.y += 7;
}

/** One labelled horizontal bar: label | bar | count · share. */
function drawBars(
  c: Cursor,
  bars: { label: string; count: number; color?: RGB }[],
  denominator: number,
  labelW = 52,
) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  const x0 = MARGIN + 12;
  const barX = x0 + labelW + 3;
  const barW = CONTENT_W - 12 - labelW - 3 - 26;
  for (const b of bars) {
    c.font(9);
    const label = c.lines(b.label, labelW);
    const rowH = Math.max(6.5, label.length * c.lh + 2);
    c.need(rowH);
    c.doc.text(label, x0, c.y + 3.6);
    c.fill(TRACK);
    c.doc.roundedRect(barX, c.y + 1.2, barW, 3.4, 1.2, 1.2, "F");
    if (b.count > 0) {
      c.fill(b.color ?? BRAND);
      c.doc.roundedRect(barX, c.y + 1.2, Math.max(1.6, (b.count / max) * barW), 3.4, 1.2, 1.2, "F");
    }
    c.font(9, "bold");
    c.doc.text(nf.format(b.count), PAGE_W - MARGIN - 12, c.y + 3.6, { align: "right" });
    c.font(8, "normal", MUTED);
    c.doc.text(pct(b.count, denominator), PAGE_W - MARGIN, c.y + 3.6, { align: "right" });
    c.y += rowH;
  }
}

/** A large figure with a caption, e.g. the NPS score or rating average. */
function drawHeadline(c: Cursor, value: string, caption: string, color: RGB = INK) {
  c.need(14);
  c.font(22, "bold", color);
  c.doc.text(value, MARGIN + 12, c.y + 7);
  const w = c.doc.getTextWidth(value);
  c.font(9, "normal", MUTED);
  c.doc.text(pdfSafe(caption), MARGIN + 12 + w + 3, c.y + 7);
  c.y += 13;
}

function drawChoice(c: Cursor, q: Question, rows: ExportRow[], answered: number) {
  const configured = q.type === "yes_no" ? ["Yes", "No"] : getChoiceConfig(q.options).choices;
  const counts = new Map<string, number>(configured.map((o) => [o, 0]));
  for (const r of rows) {
    const v = r.answers?.[q.id];
    const values = Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
    for (const val of values) counts.set(String(val), (counts.get(String(val)) ?? 0) + 1);
  }
  drawBars(
    c,
    [...counts].map(([label, count]) => ({
      label,
      count,
      color: q.type === "yes_no" ? (label === "Yes" ? MINT : DANGER) : BRAND,
    })),
    answered,
  );
}

function drawNps(c: Cursor, q: Question, rows: ExportRow[]) {
  const dist = Array.from({ length: 11 }, () => 0);
  for (const r of rows) {
    const v = r.answers?.[q.id];
    if (typeof v === "number" && v >= 0 && v <= 10) dist[v]++;
  }
  const answered = dist.reduce((a, b) => a + b, 0);
  const promoters = dist.slice(9).reduce((a, b) => a + b, 0);
  const detractors = dist.slice(0, 7).reduce((a, b) => a + b, 0);
  const passives = answered - promoters - detractors;
  if (answered === 0) return drawEmpty(c);
  const score = Math.round(((promoters - detractors) / answered) * 100);
  drawHeadline(
    c,
    `${score > 0 ? "+" : ""}${score}`,
    "NPS (promoters minus detractors)",
    score >= 30 ? MINT : score < 0 ? DANGER : INK,
  );

  // Segment strip
  c.need(12);
  const x0 = MARGIN + 12;
  const w = CONTENT_W - 12;
  let x = x0;
  for (const [n, color] of [
    [detractors, DANGER],
    [passives, SUN],
    [promoters, MINT],
  ] as [number, RGB][]) {
    if (n === 0) continue;
    const segW = (n / answered) * w;
    c.fill(color);
    c.doc.rect(x, c.y, segW, 3.4, "F");
    x += segW;
  }
  c.y += 7.5;
  c.font(8.5, "normal", MUTED);
  c.doc.text(
    `Detractors 0–6: ${detractors} (${pct(detractors, answered)})     Passives 7–8: ${passives} (${pct(
      passives,
      answered,
    )})     Promoters 9–10: ${promoters} (${pct(promoters, answered)})`,
    x0,
    c.y,
  );
  c.y += 7;

  // 0–10 column chart
  const chartH = 22;
  c.need(chartH + 8);
  const colGap = 1.6;
  const colW = (w - colGap * 10) / 11;
  const max = Math.max(1, ...dist);
  dist.forEach((n, i) => {
    const cx = x0 + i * (colW + colGap);
    const h = (n / max) * chartH;
    c.fill(TRACK);
    c.doc.rect(cx, c.y, colW, chartH, "F");
    if (n > 0) {
      c.fill(i >= 9 ? MINT : i <= 6 ? DANGER : SUN);
      c.doc.rect(cx, c.y + chartH - h, colW, h, "F");
    }
    c.font(7.5, "normal", MUTED);
    c.doc.text(String(i), cx + colW / 2, c.y + chartH + 4, { align: "center" });
  });
  c.y += chartH + 8;
}

function drawRating(c: Cursor, q: Question, rows: ExportRow[], answered: number) {
  const max = getRatingMax(q.options);
  const dist = Array.from({ length: max }, () => 0);
  let sum = 0;
  for (const r of rows) {
    const v = r.answers?.[q.id];
    if (typeof v === "number" && v >= 1 && v <= max) {
      dist[v - 1]++;
      sum += v;
    }
  }
  if (answered === 0) return drawEmpty(c);
  drawHeadline(c, (sum / answered).toFixed(1), `average out of ${max}`);
  drawBars(
    c,
    dist.map((count, i) => ({ label: `${i + 1} ${i === 0 ? "star" : "stars"}`, count })).reverse(),
    answered,
    22,
  );
}

function drawText(c: Cursor, q: Question, rows: ExportRow[], followUps: FollowUps[]) {
  const answered = rows
    .map((r, i) => ({ r, fu: followUps[i][q.id] }))
    .filter(({ r }) => isAnswered(q, r.answers?.[q.id]))
    .reverse(); // newest first
  if (answered.length === 0) return drawEmpty(c);
  const shown = answered.slice(0, MAX_TEXT_ANSWERS);
  const x0 = MARGIN + 12;
  const w = CONTENT_W - 12 - 6;
  for (const { r, fu } of shown) {
    c.font(9.5);
    const body = c.lines(String(r.answers[q.id]).trim(), w);
    const bodyH = body.length * c.lh;
    c.font(8.5);
    const fuQ = fu ? c.lines(`Follow-up: ${fu.question}`, w - 4) : [];
    const fuA = fu ? c.lines(fu.answer, w - 4) : [];
    const fuH = fu ? (fuQ.length + fuA.length) * c.lh + 3 : 0;
    const h = bodyH + fuH + 8;
    // Short blocks move to the next page whole; very long ones flow across.
    c.need(Math.min(h, 60));

    let top = c.y;
    c.y += 4;
    const line = (text: string, x: number) => {
      if (c.y + c.lh > PAGE_H - MARGIN - FOOTER_H) {
        accent(top, c.y);
        c.doc.addPage();
        c.y = MARGIN + 4;
        top = MARGIN;
      }
      c.doc.text(text, x, c.y);
      c.y += c.lh;
    };
    const accent = (from: number, to: number) => {
      c.fill(HAIRLINE);
      c.doc.rect(x0, from + 1, 0.8, Math.max(2, to - from - 3), "F");
    };

    c.font(9.5);
    for (const l of body) line(l, x0 + 4);
    if (fu) {
      c.y += 1.5;
      c.font(8.5, "normal", MUTED);
      for (const l of fuQ) line(l, x0 + 8);
      c.font(8.5, "normal", INK);
      for (const l of fuA) line(l, x0 + 8);
    }
    c.font(7.5, "normal", FAINT, "courier");
    line(dateFmt.format(new Date(r.submitted_at)), x0 + 4);
    accent(top, c.y);
    c.y += 3;
  }
  if (answered.length > shown.length) {
    c.need(7);
    c.font(8.5, "normal", MUTED);
    c.doc.text(
      `+ ${nf.format(answered.length - shown.length)} more answers — export CSV for the full list.`,
      x0,
      c.y + 2,
    );
    c.y += 7;
  }
}

function drawEmpty(c: Cursor) {
  c.need(8);
  c.font(9, "normal", FAINT);
  c.doc.text("No answers yet.", MARGIN + 12, c.y + 3);
  c.y += 8;
}

function drawFooters(doc: jsPDF, title: string) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - MARGIN + 2, PAGE_W - MARGIN, PAGE_H - MARGIN + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...FAINT);
    const t = pdfSafe(title);
    doc.text(t.length > 80 ? `${t.slice(0, 79)}…` : t, MARGIN, PAGE_H - MARGIN + 7);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN + 7, { align: "right" });
  }
}

/* --------------------------------- Entry --------------------------------- */

/**
 * Builds a printable results report — summary tiles plus one section per
 * question (charts for choice/NPS/rating, quotes for text) — and downloads it.
 * jsPDF is loaded on demand so it never weighs on the results page itself.
 */
export async function exportResponsesPdf(
  formId: string,
  formTitle: string,
  questions: Question[],
  version: number | null = null,
) {
  const [rows, { jsPDF }] = await Promise.all([
    fetchAllResponses(formId, version),
    import("jspdf"),
  ]);
  const doc = buildReportPdf(jsPDF, formTitle, questions, rows, version);
  downloadBlob(doc.output("blob"), `${fileSlug(formTitle)}-report.pdf`);
  return rows.length;
}

/** Pure layout step, split out so it can run outside the browser. */
export function buildReportPdf(
  JsPDF: typeof jsPDF,
  formTitle: string,
  questions: Question[],
  rows: ExportRow[],
  version: number | null,
) {
  const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: `${formTitle} — responses`, creator: "Flowform" });
  const c = new Cursor(doc);
  const followUps = rows.map((r) => parseFollowUps(r.follow_ups));

  drawHeader(c, formTitle, rows, version);

  questions.forEach((q, i) => {
    const answered = rows.filter((r) => isAnswered(q, r.answers?.[q.id])).length;
    const multi =
      q.type === "multiple_choice" && getChoiceConfig(q.options).multi ? " · multi-select" : "";
    drawQuestionTitle(
      c,
      i,
      q,
      `${TYPE_LABEL[q.type]}${multi}   ·   ${nf.format(answered)} answered · ${nf.format(
        rows.length - answered,
      )} skipped`,
    );
    switch (q.type) {
      case "multiple_choice":
      case "dropdown":
      case "yes_no":
        if (answered === 0) drawEmpty(c);
        else drawChoice(c, q, rows, answered);
        break;
      case "nps":
        drawNps(c, q, rows);
        break;
      case "rating":
        drawRating(c, q, rows, answered);
        break;
      default:
        drawText(c, q, rows, followUps);
    }
    c.y += 4;
  });

  drawFooters(doc, formTitle);
  return doc;
}
