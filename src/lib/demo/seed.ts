/**
 * The demo workspace: a small coffee roaster with a handful of forms and a
 * few hundred responses. Everything is generated from a fixed seed relative
 * to "now", so the data always looks recent and is the same on every visit.
 * All names, companies and answers are made up.
 */
import { computeScore, pickOutcome, type FormSettings } from "@/lib/form-settings";
import type { Answers, QuestionType } from "@/lib/form-utils";

export const DEMO_USER_ID = "0de0de00-0000-4000-8000-000000000001";
export const DEMO_EMAIL = "alex@example.com";
const PRIYA_ID = "0de0de00-0000-4000-8000-000000000002";
const SAM_ID = "0de0de00-0000-4000-8000-000000000003";
const LIN_ID = "0de0de00-0000-4000-8000-000000000004";

export type Row = Record<string, unknown>;
export type DemoDb = Record<string, Row[]>;

/* ---------------------------------- Random --------------------------------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number) {
  const r = mulberry32(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const weighted = <T>(xs: [T, number][]) => {
    const total = xs.reduce((s, [, w]) => s + w, 0);
    let x = r() * total;
    for (const [v, w] of xs) if ((x -= w) <= 0) return v;
    return xs[xs.length - 1][0];
  };
  const uuid = () => {
    const h = () =>
      Math.floor(r() * 0x10000)
        .toString(16)
        .padStart(4, "0");
    return `${h()}${h()}-${h()}-4${h().slice(1)}-${"89ab"[Math.floor(r() * 4)]}${h().slice(1)}-${h()}${h()}${h()}`;
  };
  return { r, pick, weighted, uuid };
}

/* --------------------------------- Content --------------------------------- */

type Q = {
  key: string;
  type: QuestionType;
  label: string;
  options?: unknown;
  required?: boolean;
  recall?: string;
  ai?: boolean;
  points?: Record<string, number>;
  /** Weighted answer pool; omitted questions get a sensible default. */
  answers?: [unknown, number][];
  /** Share of respondents who skip an optional question. */
  skip?: number;
  /** Logic jumps by choice → question key (or "end"). */
  jumps?: Record<string, string>;
};

type FormSpec = {
  key: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "closed";
  display: "conversational" | "classic";
  category: string | null;
  createdDaysAgo: number;
  updatedDaysAgo: number;
  /** Responses spread over [oldestDay, newestDay] days ago, recent-heavy. */
  responses: number;
  oldestDay: number;
  newestDay: number;
  /** Answers arrive right after `oldestDay` (an event) instead of steadily. */
  afterEvent?: boolean;
  /** Views per response; starts sit between. */
  viewRatio: number;
  thankYou?: string;
  settings?: FormSettings;
  questions: Q[];
  owner?: string;
  version?: number;
  /** Responses that belong to version 1 when version > 1. */
  v1Share?: number;
  v1Questions?: Q[];
};

const NPS: [unknown, number][] = [
  [10, 26],
  [9, 22],
  [8, 16],
  [7, 11],
  [6, 7],
  [5, 6],
  [4, 4],
  [3, 3],
  [2, 2],
  [1, 1],
  [0, 2],
];

const FIX_FIRST = [
  "Faster delivery, please. Five days for beans is a long time.",
  "Let me pause the subscription without emailing support.",
  "More decaf options. The one you have is excellent.",
  "The grind size guide on the bag is hard to read.",
  "Checkout asked for my address twice.",
  "Nothing, honestly. Keep doing what you’re doing.",
  "Smaller bags so I can try more roasts.",
  "Recyclable packaging. The valve bags go in the bin.",
  "Tracking emails would help. I never know when it arrives.",
  "The espresso blend was too dark this month.",
  "Gift cards that don’t expire.",
  "Brewing tips for a cafetière, not just pour-over.",
  "Price went up again. Still worth it, just about.",
  "A loyalty discount for long-time subscribers.",
  "Let me choose the delivery day.",
];

const SESSION_NOTES = [
  "The live demo of the roast profile was the highlight.",
  "Too much theory, not enough tasting.",
  "Great speaker. The slides were hard to read from the back.",
  "I’d come again for the water chemistry session alone.",
  "Run it in a bigger room next time.",
  "Loved the cupping table. Wanted more time there.",
  "Q&A ran short. Plenty of questions left.",
];

const NAMES = [
  "Ada",
  "Sam",
  "Lin",
  "Noor",
  "Tomás",
  "Priya",
  "Jonas",
  "Mei",
  "Kofi",
  "Elena",
  "Rafa",
  "Ines",
  "Owen",
  "Yuki",
];

const FORMS: FormSpec[] = [
  {
    key: "feedback",
    title: "Customer feedback, autumn",
    description: "How was your last order? Three minutes, tops.",
    status: "published",
    display: "conversational",
    category: "Customers",
    createdDaysAgo: 120,
    updatedDaysAgo: 6,
    responses: 520,
    oldestDay: 110,
    newestDay: 0,
    viewRatio: 1.7,
    thankYou: "Thanks, {name}. We read every answer, usually with coffee.",
    version: 2,
    v1Share: 0.32,
    questions: [
      {
        key: "nps",
        type: "nps",
        label: "How likely are you to recommend us to a friend?",
        answers: NPS,
      },
      {
        key: "order",
        type: "multiple_choice",
        label: "What did you order last?",
        options: { choices: ["Beans", "Subscription", "Equipment", "Gift card"], multi: false },
        recall: "order",
        answers: [
          ["Beans", 46],
          ["Subscription", 31],
          ["Equipment", 15],
          ["Gift card", 8],
        ],
      },
      {
        key: "delivery",
        type: "rating",
        label: "How was delivery for your {order}?",
        options: { max: 5 },
        answers: [
          [5, 34],
          [4, 30],
          [3, 18],
          [2, 11],
          [1, 7],
        ],
      },
      {
        key: "name",
        type: "text",
        label: "And what should we call you?",
        recall: "name",
        answers: NAMES.map((n) => [n, 1]),
      },
      {
        key: "fix",
        type: "long_text",
        label: "What should we fix first, {name}?",
        required: false,
        ai: true,
        skip: 0.18,
        answers: FIX_FIRST.map((t) => [t, 1]),
      },
      {
        key: "again",
        type: "yes_no",
        label: "Would you order again?",
        answers: [
          ["Yes", 84],
          ["No", 16],
        ],
      },
    ],
    v1Questions: [
      { key: "nps", type: "nps", label: "How likely are you to recommend us?" },
      {
        key: "order",
        type: "multiple_choice",
        label: "What did you order?",
        options: { choices: ["Beans", "Subscription", "Equipment"], multi: false },
      },
      { key: "fix", type: "long_text", label: "Anything we could do better?", required: false },
    ],
  },
  {
    key: "conference",
    title: "Brew Lab 2026: session feedback",
    description: "Tell us which sessions were worth the early start.",
    status: "published",
    display: "classic",
    category: "Events",
    createdDaysAgo: 40,
    updatedDaysAgo: 22,
    responses: 214,
    oldestDay: 21,
    newestDay: 1,
    afterEvent: true,
    viewRatio: 1.45,
    questions: [
      {
        key: "sessions",
        type: "multiple_choice",
        label: "Which sessions did you attend?",
        options: {
          choices: [
            "Roasting live",
            "Water chemistry",
            "Cupping table",
            "Latte art",
            "Running a café",
          ],
          multi: true,
        },
        answers: [
          ["Roasting live", 30],
          ["Water chemistry", 22],
          ["Cupping table", 26],
          ["Latte art", 14],
          ["Running a café", 9],
        ],
      },
      {
        key: "overall",
        type: "rating",
        label: "How was the day overall?",
        options: { max: 5 },
        answers: [
          [5, 40],
          [4, 36],
          [3, 15],
          [2, 6],
          [1, 3],
        ],
      },
      {
        key: "notes",
        type: "long_text",
        label: "What should we change for next year?",
        required: false,
        skip: 0.3,
        answers: SESSION_NOTES.map((t) => [t, 1]),
      },
      {
        key: "nps",
        type: "nps",
        label: "Would you recommend Brew Lab to a colleague?",
        answers: NPS,
      },
    ],
  },
  {
    key: "quiz",
    title: "Workshop quiz: know your coffee",
    description: "Five questions. No pressure, just beans.",
    status: "published",
    display: "conversational",
    category: "Events",
    createdDaysAgo: 30,
    updatedDaysAgo: 12,
    responses: 86,
    oldestDay: 18,
    newestDay: 0,
    viewRatio: 1.3,
    settings: {
      theme: { accent: "#b45309", font: "serif" },
      quiz: {
        enabled: true,
        show_score: true,
        outcomes: [
          {
            id: "starter",
            title: "Curious beginner",
            message: "A good start. The workshop notes will take you further.",
            min_score: 0,
          },
          {
            id: "home",
            title: "Home barista",
            message: "You know your way around a grinder.",
            min_score: 6,
          },
          {
            id: "pro",
            title: "Coffee connoisseur",
            message: "Have you considered roasting your own?",
            min_score: 11,
          },
        ],
      },
    },
    questions: [
      {
        key: "q1",
        type: "multiple_choice",
        label: "Which country grows the most coffee?",
        options: { choices: ["Brazil", "Colombia", "Ethiopia", "Vietnam"], multi: false },
        points: { Brazil: 3 },
        answers: [
          ["Brazil", 60],
          ["Colombia", 18],
          ["Ethiopia", 14],
          ["Vietnam", 8],
        ],
      },
      {
        key: "q2",
        type: "multiple_choice",
        label: "What does a lighter roast usually taste more of?",
        options: {
          choices: ["Fruit and acidity", "Chocolate", "Smoke", "Nothing at all"],
          multi: false,
        },
        points: { "Fruit and acidity": 3 },
        answers: [
          ["Fruit and acidity", 55],
          ["Chocolate", 30],
          ["Smoke", 12],
          ["Nothing at all", 3],
        ],
      },
      {
        key: "q3",
        type: "dropdown",
        label: "Ideal brewing water temperature?",
        options: ["70–75 °C", "80–85 °C", "90–96 °C", "100 °C, straight off the boil"],
        points: { "90–96 °C": 3 },
        answers: [
          ["90–96 °C", 50],
          ["80–85 °C", 25],
          ["100 °C, straight off the boil", 18],
          ["70–75 °C", 7],
        ],
      },
      {
        key: "q4",
        type: "yes_no",
        label: "Is espresso a type of bean?",
        points: { No: 3 },
        answers: [
          ["No", 78],
          ["Yes", 22],
        ],
      },
      {
        key: "q5",
        type: "multiple_choice",
        label: "Arabica or robusta: which has more caffeine?",
        options: { choices: ["Arabica", "Robusta", "Same"], multi: false },
        points: { Robusta: 3 },
        answers: [
          ["Robusta", 52],
          ["Arabica", 38],
          ["Same", 10],
        ],
      },
    ],
  },
  {
    key: "onboarding",
    title: "New subscriber onboarding",
    description: "Help us pick your first roast.",
    status: "published",
    display: "conversational",
    category: "Customers",
    createdDaysAgo: 160,
    updatedDaysAgo: 48,
    responses: 312,
    oldestDay: 150,
    newestDay: 2,
    viewRatio: 1.9,
    settings: { hidden_fields: ["plan"] },
    questions: [
      {
        key: "heard",
        type: "dropdown",
        label: "How did you hear about us?",
        options: ["A friend", "Instagram", "A café", "Search", "Newsletter"],
        answers: [
          ["A friend", 30],
          ["Instagram", 24],
          ["A café", 18],
          ["Search", 16],
          ["Newsletter", 12],
        ],
        jumps: { "A café": "cafe" },
      },
      {
        key: "brew",
        type: "multiple_choice",
        label: "How do you brew at home?",
        options: {
          choices: ["Espresso", "Pour-over", "Cafetière", "AeroPress", "Moka pot"],
          multi: false,
        },
        answers: [
          ["Espresso", 28],
          ["Pour-over", 26],
          ["Cafetière", 24],
          ["AeroPress", 14],
          ["Moka pot", 8],
        ],
        // The café question is only for people who heard about us in one.
        jumps: {
          Espresso: "taste",
          "Pour-over": "taste",
          Cafetière: "taste",
          AeroPress: "taste",
          "Moka pot": "taste",
        },
      },
      {
        key: "cafe",
        type: "text",
        label: "Which café, so we can thank them?",
        required: false,
        skip: 0.55,
        answers: [
          ["Kiln, Bristol", 3],
          ["Second Shot", 2],
          ["Bean There", 2],
          ["The Roastery", 1],
        ],
      },
      {
        key: "taste",
        type: "multiple_choice",
        label: "Pick the flavours you like",
        options: { choices: ["Chocolate", "Nutty", "Fruity", "Floral", "Caramel"], multi: true },
        answers: [
          ["Chocolate", 34],
          ["Nutty", 24],
          ["Fruity", 20],
          ["Caramel", 16],
          ["Floral", 6],
        ],
      },
    ],
  },
  {
    key: "pricing",
    title: "Pricing page poll",
    description: null,
    status: "published",
    display: "classic",
    category: "Customers",
    createdDaysAgo: 75,
    updatedDaysAgo: 70,
    responses: 64,
    oldestDay: 70,
    newestDay: 9,
    viewRatio: 6.5,
    settings: { hidden_fields: ["plan"] },
    questions: [
      {
        key: "clear",
        type: "yes_no",
        label: "Was our pricing clear?",
        answers: [
          ["Yes", 58],
          ["No", 42],
        ],
      },
      {
        key: "missing",
        type: "multiple_choice",
        label: "What was missing?",
        required: false,
        skip: 0.4,
        options: {
          choices: ["Annual plan", "Smaller bags", "Business pricing", "Nothing"],
          multi: false,
        },
        answers: [
          ["Annual plan", 40],
          ["Business pricing", 25],
          ["Smaller bags", 22],
          ["Nothing", 13],
        ],
      },
    ],
  },
  {
    key: "pulse",
    title: "Team pulse, November",
    description: "Anonymous. Five questions, two minutes.",
    status: "draft",
    display: "conversational",
    category: "Team",
    createdDaysAgo: 2,
    updatedDaysAgo: 0.2,
    responses: 0,
    oldestDay: 0,
    newestDay: 0,
    viewRatio: 0,
    questions: [
      { key: "week", type: "rating", label: "How was your week?", options: { max: 5 } },
      {
        key: "workload",
        type: "multiple_choice",
        label: "Your workload right now",
        options: { choices: ["Too light", "About right", "Heavy", "Unsustainable"], multi: false },
      },
      { key: "blocked", type: "long_text", label: "Anything blocking you?", required: false },
      { key: "recommend", type: "nps", label: "Would you recommend working here?" },
      { key: "else", type: "long_text", label: "Anything else on your mind?", required: false },
    ],
  },
  {
    key: "waitlist",
    title: "Decaf club waitlist",
    description: "Be first to try our new decaf subscription.",
    status: "closed",
    display: "conversational",
    category: null,
    createdDaysAgo: 210,
    updatedDaysAgo: 95,
    responses: 288,
    oldestDay: 200,
    newestDay: 96,
    viewRatio: 2.2,
    questions: [
      {
        key: "name",
        type: "text",
        label: "Your first name",
        recall: "name",
        answers: NAMES.map((n) => [n, 1]),
      },
      {
        key: "why",
        type: "multiple_choice",
        label: "Why decaf, {name}?",
        options: { choices: ["Evenings", "Pregnancy", "Sleep", "Taste, honestly"], multi: false },
        answers: [
          ["Evenings", 40],
          ["Sleep", 30],
          ["Taste, honestly", 18],
          ["Pregnancy", 12],
        ],
      },
      {
        key: "tell",
        type: "yes_no",
        label: "Can we tell you when it launches?",
        answers: [
          ["Yes", 92],
          ["No", 8],
        ],
      },
    ],
  },
  {
    key: "exit",
    title: "Leaving us? One question",
    description: "Sorry to see you go.",
    status: "published",
    display: "conversational",
    category: "Customers",
    createdDaysAgo: 14,
    updatedDaysAgo: 14,
    responses: 0,
    oldestDay: 0,
    newestDay: 0,
    viewRatio: 0,
    questions: [
      {
        key: "why",
        type: "multiple_choice",
        label: "What made you cancel?",
        options: {
          choices: ["Price", "Too much coffee", "Taste", "Moving", "Something else"],
          multi: false,
        },
      },
    ],
  },
  // Priya's workspace, where the demo user is a viewer.
  {
    key: "wholesale",
    owner: PRIYA_ID,
    title: "Wholesale partner check-in",
    description: "Quarterly check-in with our café partners.",
    status: "published",
    display: "classic",
    category: null,
    createdDaysAgo: 90,
    updatedDaysAgo: 30,
    responses: 41,
    oldestDay: 80,
    newestDay: 3,
    viewRatio: 1.4,
    questions: [
      {
        key: "volume",
        type: "multiple_choice",
        label: "Weekly volume",
        options: { choices: ["Under 10 kg", "10–30 kg", "30 kg+"], multi: false },
        answers: [
          ["10–30 kg", 50],
          ["Under 10 kg", 30],
          ["30 kg+", 20],
        ],
      },
      {
        key: "service",
        type: "rating",
        label: "How is our service?",
        options: { max: 5 },
        answers: [
          [5, 40],
          [4, 40],
          [3, 15],
          [2, 5],
        ],
      },
    ],
  },
  {
    key: "roastery",
    owner: PRIYA_ID,
    title: "Roastery tour sign-up",
    description: null,
    status: "draft",
    display: "conversational",
    category: null,
    createdDaysAgo: 5,
    updatedDaysAgo: 1,
    responses: 0,
    oldestDay: 0,
    newestDay: 0,
    viewRatio: 0,
    questions: [
      {
        key: "date",
        type: "dropdown",
        label: "Which Saturday suits you?",
        options: ["First", "Second", "Third"],
      },
    ],
  },
];

const CATEGORIES: [string, string][] = [
  ["Customers", "blue"],
  ["Events", "green"],
  ["Team", "amber"],
];

/* -------------------------------- Generator -------------------------------- */

const DAY = 86_400_000;

export function buildSeed(now = Date.now()): DemoDb {
  const rng = makeRng(20261116);
  const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

  const db: DemoDb = {
    profiles: [
      {
        id: DEMO_USER_ID,
        first_name: "Alex",
        last_name: "Morgan",
        display_name: "Alex Morgan",
        theme: "light",
        created_at: iso(240),
        updated_at: iso(3),
      },
      {
        id: PRIYA_ID,
        first_name: "Priya",
        last_name: "Shah",
        display_name: "Priya Shah",
        theme: "light",
        created_at: iso(300),
        updated_at: iso(30),
      },
    ],
    form_categories: [],
    forms: [],
    questions: [],
    responses: [],
    form_versions: [],
    response_sessions: [],
    workspace_members: [
      {
        owner_id: DEMO_USER_ID,
        member_id: SAM_ID,
        role: "editor",
        invited_by: DEMO_USER_ID,
        created_at: iso(120),
      },
      {
        owner_id: DEMO_USER_ID,
        member_id: LIN_ID,
        role: "viewer",
        invited_by: DEMO_USER_ID,
        created_at: iso(60),
      },
      {
        owner_id: PRIYA_ID,
        member_id: DEMO_USER_ID,
        role: "viewer",
        invited_by: PRIYA_ID,
        created_at: iso(45),
      },
    ],
    workspace_invites: [
      {
        id: rng.uuid(),
        owner_id: DEMO_USER_ID,
        email: "jonas@example.com",
        role: "editor",
        invited_by: DEMO_USER_ID,
        created_at: iso(1),
      },
    ],
    // Directory for member lookups; not a real table in the app.
    _people: [
      { id: DEMO_USER_ID, email: DEMO_EMAIL, name: "Alex Morgan" },
      { id: PRIYA_ID, email: "priya@example.com", name: "Priya Shah" },
      { id: SAM_ID, email: "sam@example.com", name: "Sam Okafor" },
      { id: LIN_ID, email: "lin@example.com", name: "Lin Chen" },
    ],
    // Synthetic per-form traffic (views/starts per day) for the funnel.
    _traffic: [],
  };

  const catIds = new Map<string, string>();
  for (const [name, color] of CATEGORIES) {
    const id = rng.uuid();
    catIds.set(name, id);
    db.form_categories.push({ id, user_id: DEMO_USER_ID, name, color, created_at: iso(200) });
  }

  for (const spec of FORMS) {
    const formId = rng.uuid();
    const owner = spec.owner ?? DEMO_USER_ID;
    const version = spec.version ?? 1;
    const qIds = new Map(spec.questions.map((q) => [q.key, rng.uuid()]));
    const toRow = (q: Q, i: number, ids: Map<string, string>) => ({
      id: ids.get(q.key)!,
      form_id: formId,
      type: q.type,
      label: q.label,
      options: q.options ?? null,
      position: i,
      required: q.required ?? true,
      logic: q.jumps
        ? {
            jumps: Object.fromEntries(
              Object.entries(q.jumps).map(([c, k]) => [c, k === "end" ? "end" : ids.get(k)!]),
            ),
          }
        : null,
      ai_follow_up: !!q.ai,
      recall_key: q.recall ?? null,
      points: q.points ?? null,
      created_at: iso(spec.createdDaysAgo),
    });
    const questions = spec.questions.map((q, i) => toRow(q, i, qIds));

    db.forms.push({
      id: formId,
      user_id: owner,
      title: spec.title,
      description: spec.description,
      status: spec.status,
      display_mode: spec.display,
      thank_you_message: spec.thankYou ?? null,
      category_id: spec.category ? catIds.get(spec.category)! : null,
      settings: spec.settings ?? {},
      version,
      copied_from: null,
      created_at: iso(spec.createdDaysAgo),
      updated_at: iso(spec.updatedDaysAgo),
    });
    db.questions.push(...questions);

    // Version 1 snapshot for forms that were updated under the same link.
    let v1Rows: Row[] = [];
    if (version > 1 && spec.v1Questions) {
      const v1Ids = new Map(spec.v1Questions.map((q) => [q.key, qIds.get(q.key) ?? rng.uuid()]));
      v1Rows = spec.v1Questions.map((q, i) => toRow(q, i, v1Ids));
      db.form_versions.push({
        id: rng.uuid(),
        form_id: formId,
        version: 1,
        title: spec.title,
        description: spec.description,
        display_mode: spec.display,
        thank_you_message: null,
        settings: {},
        questions: v1Rows,
        retired_at: iso(spec.oldestDay * (1 - (spec.v1Share ?? 0.3)) + 2),
        retired_by: DEMO_USER_ID,
      });
    }

    // Responses, recent-heavy.
    const span = Math.max(0.5, spec.oldestDay - spec.newestDay);
    const v1Cutoff = version > 1 ? spec.newestDay + span * (1 - (spec.v1Share ?? 0.3)) : -1;
    for (let n = 0; n < spec.responses; n++) {
      // Most forms trickle in steadily with a slight lean to recent days; an
      // event form gets its answers in the days right after the event.
      const daysAgo = spec.afterEvent
        ? spec.oldestDay - span * Math.pow(rng.r(), 2.4)
        : spec.newestDay + span * Math.pow(rng.r(), 1.15);
      const isV1 = version > 1 && daysAgo > v1Cutoff;
      const qs = isV1 ? (spec.v1Questions ?? []) : spec.questions;
      const rows = isV1 ? v1Rows : questions;
      const answers: Answers = {};
      let jumpTo: string | null = null;
      qs.forEach((q, i) => {
        const id = rows[i].id as string;
        if (jumpTo && jumpTo !== q.key) return;
        jumpTo = null;
        if (q.skip && rng.r() < q.skip) return;
        const v = answerFor(q, rng);
        if (v === undefined) return;
        answers[id] = v as never;
        if (q.jumps && typeof v === "string" && q.jumps[v]) jumpTo = q.jumps[v];
      });
      const submitted = now - daysAgo * DAY;
      const meta = metaFor(spec, rng);
      const row: Row = {
        id: rng.uuid(),
        form_id: formId,
        form_version: isV1 ? 1 : version,
        answers,
        follow_ups: null,
        meta,
        score: null,
        outcome: null,
        session_id: null,
        started_at: new Date(submitted - (40 + rng.r() * 260) * 1000).toISOString(),
        submitted_at: new Date(submitted).toISOString(),
      };
      if (spec.settings?.quiz?.enabled) {
        const score = computeScore(questions as never, answers);
        row.score = score;
        row.outcome = pickOutcome(spec.settings.quiz, score)?.id ?? null;
      }
      const fix = qIds.get("fix");
      if (spec.key === "feedback" && !isV1 && fix && answers[fix] && rng.r() < 0.3) {
        row.follow_ups = {
          [fix]: {
            question: "What would “faster” look like for you?",
            answer: rng.pick([
              "Two days would be ideal.",
              "Anything under a week.",
              "Next day for subscribers, maybe?",
            ]),
          },
        };
      }
      db.responses.push(row);
    }

    // Unfinished sessions for the "Unfinished" view and drop-off.
    if (spec.status === "published" && spec.responses >= 50) {
      const partials = Math.round(spec.responses * 0.09);
      for (let n = 0; n < partials; n++) {
        const reachedCount = 1 + Math.floor(rng.r() * Math.max(1, questions.length - 1));
        const reached = questions.slice(0, reachedCount);
        const answers: Answers = {};
        for (const q of reached.slice(0, -1)) {
          const v = answerFor(spec.questions[q.position as number], rng);
          if (v !== undefined) answers[q.id as string] = v as never;
        }
        const startedAgo = Math.min(spec.oldestDay, 30) * Math.pow(rng.r(), 1.4);
        db.response_sessions.push({
          id: rng.uuid(),
          form_id: formId,
          form_version: version,
          answers,
          reached: reached.map((q) => q.id),
          current_question_id: reached[reached.length - 1].id,
          completed_at: null,
          response_id: null,
          ip_hash: "demo",
          started_at: iso(startedAgo + 0.01),
          updated_at: iso(startedAgo),
        });
      }
    }

    if (spec.responses > 0) {
      db._traffic.push({
        form_id: formId,
        view_ratio: spec.viewRatio,
        start_ratio: 1 + (spec.viewRatio - 1) * 0.45,
      });
    }
  }

  db.responses.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
  return db;
}

function answerFor(q: Q, rng: ReturnType<typeof makeRng>): unknown {
  if (q.answers) {
    if (q.type === "multiple_choice" && (q.options as { multi?: boolean })?.multi) {
      const picked = q.answers.filter(([, w]) => rng.r() < Math.min(0.9, w / 40)).map(([v]) => v);
      return picked.length > 0 ? picked : [rng.weighted(q.answers)];
    }
    return rng.weighted(q.answers);
  }
  switch (q.type) {
    case "nps":
      return rng.weighted(NPS);
    case "rating":
      return rng.weighted([
        [5, 3],
        [4, 3],
        [3, 2],
        [2, 1],
        [1, 1],
      ]);
    case "yes_no":
      return rng.pick(["Yes", "No"]);
    default:
      return undefined;
  }
}

function metaFor(spec: FormSpec, rng: ReturnType<typeof makeRng>) {
  const source = rng.weighted<string | undefined>(
    spec.key === "conference" || spec.key === "quiz"
      ? [
          ["qr", 60],
          [undefined, 25],
          ["email", 15],
        ]
      : [
          [undefined, 38],
          ["newsletter", 26],
          ["instagram", 14],
          ["linkedin", 8],
          ["google", 9],
          ["qr", 5],
        ],
  );
  const meta: Record<string, unknown> = {};
  if (source) meta.source = source;
  if (source === "newsletter")
    meta.campaign = rng.weighted([
      ["autumn-roast", 3],
      ["subscriber-update", 2],
    ]);
  if (spec.settings?.hidden_fields?.includes("plan")) {
    meta.hidden = {
      plan: rng.weighted([
        ["monthly", 5],
        ["fortnightly", 3],
        ["trial", 2],
      ]),
    };
  }
  return Object.keys(meta).length > 0 ? meta : null;
}

/** A fresh, plausible response for the live view's simulator. */
export function randomAnswersFor(questions: Row[], seed: number): Answers {
  const rng = makeRng(seed);
  const answers: Answers = {};
  for (const q of questions) {
    const type = q.type as QuestionType;
    const opts = q.options as
      | { choices?: string[]; multi?: boolean; max?: number }
      | string[]
      | null;
    const choices = Array.isArray(opts) ? opts : (opts?.choices ?? []);
    let v: unknown;
    if (type === "nps") v = rng.weighted(NPS);
    else if (type === "rating")
      v = Math.max(1, (opts as { max?: number })?.max ?? 5) - Math.floor(rng.r() * 3);
    else if (type === "yes_no")
      v = rng.weighted([
        ["Yes", 4],
        ["No", 1],
      ]);
    else if (choices.length > 0)
      v = (opts as { multi?: boolean })?.multi ? [rng.pick(choices)] : rng.pick(choices);
    else if (type === "long_text") v = rng.pick(FIX_FIRST);
    else if (type === "text") v = rng.pick(NAMES);
    if (v !== undefined) answers[q.id as string] = v as never;
  }
  return answers;
}
