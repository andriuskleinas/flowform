import type { CSSProperties } from "react";

import {
  getChoiceConfig,
  type AnswerValue,
  type Answers,
  type QuestionOptions,
  type QuestionType,
} from "@/lib/form-utils";

/* ------------------------------------------------------------------------- */
/* Shapes stored in forms.settings (jsonb). The DB trims anything invalid    */
/* (private.clean_form_settings), so parsing here is defensive, not strict.   */
/* ------------------------------------------------------------------------- */

export type FormFont = "roboto" | "serif" | "grotesk" | "mono";

export type FormTheme = {
  accent?: string;
  font?: FormFont;
  cover_url?: string;
};

export type QuizOutcome = {
  id: string;
  title: string;
  message?: string;
  min_score: number;
};

export type QuizSettings = {
  enabled: boolean;
  show_score?: boolean;
  outcomes: QuizOutcome[];
};

export type FormSettings = {
  theme?: FormTheme;
  redirect_url?: string;
  hidden_fields?: string[];
  quiz?: QuizSettings;
};

export const FONT_CHOICES: { value: FormFont; label: string; family: string; href?: string }[] = [
  // "roboto" is the stored key for the app's default font (the DB whitelists
  // it); the default itself is now Figtree.
  {
    value: "roboto",
    label: "Figtree (default)",
    family: '"Figtree", ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: "serif",
    label: "Lora (serif)",
    family: '"Lora", ui-serif, Georgia, serif',
    href: "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&display=swap",
  },
  {
    value: "grotesk",
    label: "Space Grotesk",
    family: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap",
  },
  {
    value: "mono",
    label: "DM Mono",
    family: '"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
];

export const ACCENT_PRESETS = [
  "#2f3fd1", // Klein blue (the product default)
  "#0f766e",
  "#b45309",
  "#be123c",
  "#7c3aed",
  "#111827",
];

const KEY_RE = /^[a-z][a-z0-9_]{0,23}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Normalizes user input into a variable name: "First name" → "first_name". */
export function toKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/, "")
    .slice(0, 24);
}

export function isSafeUrl(url: string | undefined | null, httpsOnly = false): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return httpsOnly ? u.protocol === "https:" : u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseFormSettings(raw: unknown): FormSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: FormSettings = {};

  if (r.theme && typeof r.theme === "object") {
    const t = r.theme as Record<string, unknown>;
    const theme: FormTheme = {};
    if (typeof t.accent === "string" && HEX_RE.test(t.accent)) theme.accent = t.accent;
    if (typeof t.font === "string" && FONT_CHOICES.some((f) => f.value === t.font))
      theme.font = t.font as FormFont;
    if (typeof t.cover_url === "string" && isSafeUrl(t.cover_url, true))
      theme.cover_url = t.cover_url;
    if (Object.keys(theme).length > 0) out.theme = theme;
  }
  if (typeof r.redirect_url === "string" && isSafeUrl(r.redirect_url))
    out.redirect_url = r.redirect_url;
  if (Array.isArray(r.hidden_fields)) {
    const fields = r.hidden_fields.filter(
      (f): f is string => typeof f === "string" && isValidKey(f),
    );
    if (fields.length > 0) out.hidden_fields = fields;
  }
  if (r.quiz && typeof r.quiz === "object") {
    const q = r.quiz as Record<string, unknown>;
    const outcomes = (Array.isArray(q.outcomes) ? q.outcomes : [])
      .filter(
        (o): o is QuizOutcome =>
          !!o &&
          typeof o === "object" &&
          typeof (o as QuizOutcome).id === "string" &&
          typeof (o as QuizOutcome).title === "string" &&
          typeof (o as QuizOutcome).min_score === "number",
      )
      .map((o) => ({
        id: o.id,
        title: o.title,
        message: typeof o.message === "string" ? o.message : undefined,
        min_score: o.min_score,
      }));
    out.quiz = { enabled: q.enabled === true, show_score: q.show_score !== false, outcomes };
  }
  return out;
}

/** Settings → the jsonb we save. Drops empty pieces so unchanged forms stay `{}`. */
export function serializeFormSettings(s: FormSettings): FormSettings {
  const out: FormSettings = {};
  const theme: FormTheme = {};
  if (s.theme?.accent && HEX_RE.test(s.theme.accent)) theme.accent = s.theme.accent.toLowerCase();
  if (s.theme?.font && s.theme.font !== "roboto") theme.font = s.theme.font;
  if (s.theme?.cover_url?.trim()) theme.cover_url = s.theme.cover_url.trim();
  if (Object.keys(theme).length > 0) out.theme = theme;
  if (s.redirect_url?.trim()) out.redirect_url = s.redirect_url.trim();
  const hidden = [...new Set((s.hidden_fields ?? []).filter(isValidKey))];
  if (hidden.length > 0) out.hidden_fields = hidden;
  if (s.quiz && (s.quiz.enabled || s.quiz.outcomes.length > 0)) {
    out.quiz = {
      enabled: s.quiz.enabled,
      show_score: s.quiz.show_score !== false,
      outcomes: [...s.quiz.outcomes]
        .map((o) => ({ ...o, title: o.title.trim(), message: o.message?.trim() || undefined }))
        .filter((o) => o.title)
        .sort((a, b) => a.min_score - b.min_score),
    };
  }
  return out;
}

export function settingsEqual(a: FormSettings, b: FormSettings): boolean {
  return JSON.stringify(serializeFormSettings(a)) === JSON.stringify(serializeFormSettings(b));
}

/* ----------------------------- Answer recall ------------------------------ */

type RecallQuestion = {
  id: string;
  type: QuestionType;
  recall_key?: string | null;
};

/** Human text for an answer, as it reads inside a sentence. */
export function answerToText(value: AnswerValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    if (value.length <= 1) return value.join("");
    return `${value.slice(0, -1).join(", ")} and ${value[value.length - 1]}`;
  }
  return String(value).trim();
}

/**
 * Variables available for recall: answered questions with a recall key, plus
 * hidden fields from the link (`?name=Ana`). Answers win over hidden fields.
 */
export function buildRecallVars(
  questions: RecallQuestion[],
  answers: Answers,
  hidden: Record<string, string> = {},
): Record<string, string> {
  const vars: Record<string, string> = { ...hidden };
  for (const q of questions) {
    if (!q.recall_key) continue;
    const text = answerToText(answers[q.id]);
    if (text) vars[q.recall_key] = text.length > 80 ? `${text.slice(0, 77)}…` : text;
  }
  return vars;
}

const PLACEHOLDER_RE = /\{([a-z][a-z0-9_]{0,23})(?:\|([^{}]{0,60}))?\}/g;

/**
 * Fills `{key}` / `{key|fallback}` placeholders. A missing value uses the
 * fallback, or drops the placeholder and tidies the spacing around it
 * ("Thanks, {name}!" → "Thanks!").
 */
export function recallText(text: string, vars: Record<string, string>): string {
  if (!text.includes("{")) return text;
  return text
    .replace(
      PLACEHOLDER_RE,
      (_, key: string, fallback?: string) => vars[key] ?? fallback ?? "\uE000",
    )
    .replace(/[ \t]*,?[ \t]*\uE000[ \t]*(?=[!?.,:;]|$)/g, "")
    .replace(/\uE000[ \t]*/g, "")
    .replace(/[ \t]{2,}/g, " ");
}

/** Placeholder keys a text references. */
export function placeholderKeys(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]);
}

/* ------------------------------ Quiz scoring ------------------------------ */

type ScoredQuestion = {
  id: string;
  type: QuestionType;
  options: QuestionOptions;
  points?: Record<string, number> | null;
};

export const SCORABLE_TYPES: QuestionType[] = ["multiple_choice", "dropdown", "yes_no"];

export function scoringChoices(q: { type: QuestionType; options: QuestionOptions }): string[] {
  if (q.type === "yes_no") return ["Yes", "No"];
  if (q.type === "multiple_choice" || q.type === "dropdown")
    return getChoiceConfig(q.options).choices;
  return [];
}

export function parsePoints(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Mirrors private.prepare_response(), which stores the authoritative score. */
export function computeScore(questions: ScoredQuestion[], answers: Answers): number {
  let total = 0;
  for (const q of questions) {
    if (!q.points) continue;
    const v = answers[q.id];
    if (Array.isArray(v)) for (const c of v) total += q.points[c] ?? 0;
    else if (typeof v === "string") total += q.points[v] ?? 0;
  }
  return Math.round(total);
}

/** Best possible score, for "7 / 10". */
export function maxScore(questions: ScoredQuestion[]): number {
  let total = 0;
  for (const q of questions) {
    if (!q.points) continue;
    const vals = scoringChoices(q).map((c) => q.points?.[c] ?? 0);
    if (vals.length === 0) continue;
    const multi = q.type === "multiple_choice" && getChoiceConfig(q.options).multi;
    total += multi ? vals.filter((v) => v > 0).reduce((a, b) => a + b, 0) : Math.max(0, ...vals);
  }
  return Math.round(total);
}

export function pickOutcome(quiz: QuizSettings | undefined, score: number): QuizOutcome | null {
  if (!quiz?.enabled) return null;
  let best: QuizOutcome | null = null;
  for (const o of quiz.outcomes) {
    if (o.min_score <= score && (!best || o.min_score > best.min_score)) best = o;
  }
  return best;
}

/* -------------------------------- Branding -------------------------------- */

function hexLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** CSS variables that re-skin the respondent page (brand colour + font). */
export function themeStyle(theme: FormTheme | undefined): CSSProperties {
  const style: Record<string, string> = {};
  if (theme?.accent && HEX_RE.test(theme.accent)) {
    style["--brand"] = theme.accent;
    style["--brand-foreground"] = hexLuminance(theme.accent) > 0.45 ? "#111111" : "#ffffff";
    // Tokens defined as var(--brand) resolve at :root, so re-point them here too.
    style["--primary"] = theme.accent;
    style["--primary-foreground"] = style["--brand-foreground"];
    style["--accent-foreground"] = theme.accent;
    style["--accent"] = `color-mix(in oklch, ${theme.accent} 14%, var(--card))`;
    style["--ring"] = theme.accent;
  }
  const font = FONT_CHOICES.find((f) => f.value === theme?.font);
  if (font && font.value !== "roboto") {
    style["--form-font"] = font.family;
  }
  return style as CSSProperties;
}

/** Adds the Google Fonts stylesheet a theme needs (once per family). */
export function ensureFontLoaded(font: FormFont | undefined) {
  const choice = FONT_CHOICES.find((f) => f.value === font);
  if (!choice?.href || typeof document === "undefined") return;
  const id = `ff-font-${choice.value}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = choice.href;
  document.head.appendChild(link);
}

/* ------------------------- Traffic source / hidden ------------------------ */

export type ResponseMeta = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  referrer?: string;
  hidden?: Record<string, string>;
};

/**
 * Reads UTM params, `?ref=` / `?source=`, the referring site, and any hidden
 * fields the form declares from the current URL. The DB trigger re-validates.
 */
export function captureTraffic(hiddenFields: string[] = []): ResponseMeta {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => params.get(k)?.trim().slice(0, 100) || undefined;
  const meta: ResponseMeta = {
    source: get("utm_source") ?? get("ref") ?? get("source"),
    medium: get("utm_medium"),
    campaign: get("utm_campaign"),
    term: get("utm_term"),
    content: get("utm_content"),
  };
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && host !== window.location.hostname) meta.referrer = host;
    }
  } catch {
    // Ignore malformed referrers.
  }
  const hidden: Record<string, string> = {};
  for (const f of hiddenFields) {
    const v = params.get(f)?.trim();
    if (v) hidden[f] = v.slice(0, 200);
  }
  if (Object.keys(hidden).length > 0) meta.hidden = hidden;
  for (const k of Object.keys(meta) as (keyof ResponseMeta)[]) {
    if (meta[k] === undefined) delete meta[k];
  }
  return meta;
}

/** The single label funnel views and responses are grouped by. */
export function trafficSource(meta: ResponseMeta): string | undefined {
  return meta.source?.toLowerCase() ?? meta.referrer;
}

export function sourceLabel(source: string): string {
  return source === "direct" ? "Direct / unknown" : source;
}
