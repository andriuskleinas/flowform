/**
 * Pre-written Claude answers for the demo workspace. The real features call
 * Claude through server functions that need a signed-in account; the demo
 * answers from its own data instead, so it costs nothing and never fails.
 * Loaded lazily, only in demo mode.
 */
import type { AskResult } from "@/lib/ask-responses-core";
import type { Answers } from "@/lib/form-utils";
import type { ResponseSummary } from "@/lib/summarize-responses";
import type { SuggestedQuestion } from "@/lib/suggest-questions";
import { demoData } from "./server";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "Ask your responses": picks a filter from the question, then counts for real. */
export async function demoAsk(formId: string, question: string): Promise<AskResult> {
  await wait(900);
  const { questionsOf, responsesOf } = demoData();
  const qs = questionsOf(formId);
  const rows = responsesOf(formId);
  const nps = qs.find((q) => q.type === "nps");
  const text = qs.find((q) => q.type === "long_text");
  const choice = qs.find((q) => q.type === "multiple_choice" || q.type === "dropdown");
  const lower = question.toLowerCase();

  let matched = rows;
  let filter: AskResult["filter"] = { description: "All responses", match: "all", conditions: [] };
  if (nps && /detractor|unhappy|low score|complain/.test(lower)) {
    matched = rows.filter((r) => Number((r.answers as Answers)[nps.id as string]) <= 6);
    filter = {
      description: "Detractors (scored 0–6)",
      match: "all",
      conditions: [{ label: String(nps.label), op: "lte", value: "6" }],
    };
  } else if (nps && /promoter|happy|love/.test(lower)) {
    matched = rows.filter((r) => Number((r.answers as Answers)[nps.id as string]) >= 9);
    filter = {
      description: "Promoters (scored 9–10)",
      match: "all",
      conditions: [{ label: String(nps.label), op: "gte", value: "9" }],
    };
  } else if (/last 7 days|this week|recent/.test(lower)) {
    const from = Date.now() - 7 * 86_400_000;
    matched = rows.filter((r) => Date.parse(r.submitted_at as string) > from);
    filter = {
      description: "Submitted in the last 7 days",
      match: "all",
      conditions: [
        { label: "Submitted", op: "after", value: new Date(from).toISOString().slice(0, 10) },
      ],
    };
  }

  const quotes = text
    ? [
        ...new Set(
          matched
            .map((r) => (r.answers as Answers)[text.id as string])
            .filter((v): v is string => typeof v === "string" && v.length > 0),
        ),
      ].slice(0, 3)
    : [];
  const top = choice ? topChoice(matched, choice.id as string) : null;

  const parts = [
    `${matched.length} of ${rows.length} responses match.`,
    top ? `Most of them picked “${top}” for “${choice!.label}”.` : null,
    quotes.length
      ? `The open answers keep coming back to ${quotes.length > 1 ? "the same few things" : "one thing"}: see the quotes below.`
      : null,
    "This is a demo, so the answer is pre-written from the demo data. Sign up to ask Claude about your own responses.",
  ].filter(Boolean);

  return {
    answer: parts.join(" "),
    highlights: quotes,
    filter,
    matchedIds: matched.slice(0, 200).map((r) => r.id as string),
    matchedCount: matched.length,
    total: rows.length,
    capped: false,
  };
}

function topChoice(rows: Record<string, unknown>[], qid: string) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = (r.answers as Answers)[qid];
    for (const one of Array.isArray(v) ? v : v != null ? [v] : []) {
      counts.set(String(one), (counts.get(String(one)) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** "Summarise answers". */
export async function demoSummary(formId: string): Promise<ResponseSummary> {
  await wait(1400);
  const { questionsOf, responsesOf } = demoData();
  const text = questionsOf(formId).filter((q) => q.type === "long_text" || q.type === "text");
  const answers = responsesOf(formId).flatMap((r) =>
    text
      .map((q) => (r.answers as Answers)[q.id as string])
      .filter((v): v is string => typeof v === "string" && v.length > 12),
  );
  return {
    summary:
      "People like the coffee and mostly want the logistics to catch up: delivery speed, subscription control and packaging come up again and again. Complaints are specific and fixable rather than angry.",
    sentiment: "mixed",
    themes: [
      {
        name: "Delivery speed",
        detail: "The most common request. Several people would pay for faster delivery.",
      },
      {
        name: "Subscription control",
        detail: "Pausing or choosing the delivery day without emailing support.",
      },
      { name: "Packaging", detail: "Recyclable bags and smaller sizes to try more roasts." },
    ],
    quotes: [...new Set(answers)].slice(0, 3),
    analyzed_count: answers.length,
  };
}

/** "Suggest questions" in the editor. */
export async function demoSuggest(title: string): Promise<SuggestedQuestion[]> {
  await wait(1100);
  const topic = title.trim() || "your form";
  const id = () => Math.random().toString(36).slice(2, 10);
  return [
    {
      id: id(),
      label: `How did you first hear about ${topic.toLowerCase().includes("coffee") ? "us" : "this"}?`,
      type: "multiple_choice",
      options: { choices: ["A friend", "Social media", "Search", "Somewhere else"], multi: false },
    },
    {
      id: id(),
      label: "How likely are you to recommend us to a friend?",
      type: "nps",
      options: null,
    },
    {
      id: id(),
      label: "What almost stopped you from signing up?",
      type: "long_text",
      options: null,
    },
    {
      id: id(),
      label: "How would you rate your experience so far?",
      type: "rating",
      options: { max: 5 },
    },
  ];
}

/** The conversational form's AI follow-up. */
export async function demoFollowUp(answer: string): Promise<string | null> {
  await wait(700);
  if (answer.trim().split(/\s+/).length > 12) return null;
  return "Thanks. Could you say a little more about that?";
}
