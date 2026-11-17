/**
 * The demo "backend": answers the Supabase client's REST, RPC and auth calls
 * from an in-memory copy of the demo workspace. It speaks just enough
 * PostgREST (select, eq/in/is/gte/lte filters, order, limit, offset, counts,
 * insert, update, delete) for the queries this app makes.
 *
 * Changes are kept in sessionStorage, so they survive a reload and vanish
 * with the tab. Loaded lazily: nothing here ships until the demo starts.
 */
import {
  computeScore,
  maxScore,
  parseFormSettings,
  parsePoints,
  pickOutcome,
} from "@/lib/form-settings";
import type { Answers } from "@/lib/form-utils";
import { DEMO_STATE_KEY } from "./mode";
import {
  buildSeed,
  DEMO_EMAIL,
  DEMO_USER_ID,
  makeRng,
  randomAnswersFor,
  type DemoDb,
  type Row,
} from "./seed";

const DAY = 86_400_000;
const STATE_VERSION = 3;

/* --------------------------------- Session --------------------------------- */

const b64 = (o: unknown) =>
  btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function demoUser() {
  return {
    id: DEMO_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: DEMO_EMAIL,
    email_confirmed_at: new Date(Date.now() - 240 * DAY).toISOString(),
    created_at: new Date(Date.now() - 240 * DAY).toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { first_name: "Alex", last_name: "Morgan" },
    identities: [],
  };
}

export function demoSession() {
  const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
  const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: DEMO_USER_ID, role: "authenticated", email: DEMO_EMAIL, exp })}.demo`;
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 7 * 86400,
    expires_at: exp,
    refresh_token: "demo",
    user: demoUser(),
  };
}

/* ---------------------------------- Store ---------------------------------- */

let db: DemoDb | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function load(): DemoDb {
  if (db) return db;
  try {
    const raw = sessionStorage.getItem(DEMO_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { v: number; db: DemoDb };
      if (parsed.v === STATE_VERSION) db = parsed.db;
    }
  } catch {
    // Corrupt or blocked storage: start fresh.
  }
  db ??= buildSeed();
  return db;
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      sessionStorage.setItem(DEMO_STATE_KEY, JSON.stringify({ v: STATE_VERSION, db }));
    } catch {
      // Over quota: changes last until reload instead.
    }
  }, 150);
}

const rng = makeRng(Date.now() % 100000);
const newId = () => rng.uuid();
const nowIso = () => new Date().toISOString();

/* ------------------------------- HTTP helpers ------------------------------ */

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function pgError(message: string, status = 400, code = "DEMO") {
  return json({ code, message, details: null, hint: null }, status);
}

/* -------------------------------- PostgREST -------------------------------- */

type Filter = (row: Row) => boolean;

function parseValue(raw: string): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function compare(a: unknown, b: unknown) {
  if (typeof a === "number" || typeof b === "number") return Number(a) - Number(b);
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function filtersFrom(params: URLSearchParams): Filter[] {
  const reserved = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
  const out: Filter[] = [];
  for (const [col, expr] of params) {
    if (reserved.has(col)) continue;
    const dot = expr.indexOf(".");
    let op = expr.slice(0, dot);
    let val = expr.slice(dot + 1);
    let negate = false;
    if (op === "not") {
      negate = true;
      const d2 = val.indexOf(".");
      op = val.slice(0, d2);
      val = val.slice(d2 + 1);
    }
    let f: Filter;
    switch (op) {
      case "eq":
        f = (r) => String(r[col]) === val;
        break;
      case "neq":
        f = (r) => String(r[col]) !== val;
        break;
      case "in": {
        const set = new Set(
          val
            .replace(/^\(|\)$/g, "")
            .split(",")
            .map((v) => v.replace(/^"|"$/g, "")),
        );
        f = (r) => set.has(String(r[col]));
        break;
      }
      case "is":
        f = (r) => (r[col] ?? null) === parseValue(val);
        break;
      case "gte":
        f = (r) => compare(r[col], val) >= 0;
        break;
      case "gt":
        f = (r) => compare(r[col], val) > 0;
        break;
      case "lte":
        f = (r) => compare(r[col], val) <= 0;
        break;
      case "lt":
        f = (r) => compare(r[col], val) < 0;
        break;
      case "ilike": {
        const re = new RegExp(
          "^" + val.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
          "i",
        );
        f = (r) => re.test(String(r[col] ?? ""));
        break;
      }
      default:
        f = () => true;
    }
    out.push(negate ? (r) => !f(r) : f);
  }
  return out;
}

function ordered(rows: Row[], order: string | null) {
  if (!order) return rows;
  const keys = order.split(",").map((k) => {
    const [col, dir] = k.split(".");
    return { col, desc: dir === "desc" };
  });
  return [...rows].sort((a, b) => {
    for (const { col, desc } of keys) {
      const c = compare(a[col], b[col]);
      if (c !== 0) return desc ? -c : c;
    }
    return 0;
  });
}

/** Tables the app may write to, with defaults for new rows. */
const DEFAULTS: Record<string, () => Row> = {
  forms: () => ({
    id: newId(),
    user_id: DEMO_USER_ID,
    title: "Untitled form",
    description: null,
    status: "draft",
    display_mode: "conversational",
    thank_you_message: null,
    category_id: null,
    settings: {},
    version: 1,
    copied_from: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  }),
  questions: () => ({
    id: newId(),
    required: true,
    logic: null,
    options: null,
    ai_follow_up: false,
    recall_key: null,
    points: null,
    created_at: nowIso(),
  }),
  responses: () => ({
    id: newId(),
    form_version: 1,
    follow_ups: null,
    meta: null,
    score: null,
    outcome: null,
    session_id: null,
    started_at: null,
    submitted_at: nowIso(),
  }),
  form_categories: () => ({ id: newId(), user_id: DEMO_USER_ID, created_at: nowIso() }),
  workspace_invites: () => ({ id: newId(), invited_by: DEMO_USER_ID, created_at: nowIso() }),
  workspace_members: () => ({ created_at: nowIso() }),
  profiles: () => ({ created_at: nowIso(), updated_at: nowIso() }),
  response_sessions: () => ({ id: newId(), started_at: nowIso(), updated_at: nowIso() }),
};

/** Rows visible to the demo user (a stand-in for RLS). */
function visible(table: string, rows: Row[]): Row[] {
  const d = load();
  if (
    table === "workspace_members" ||
    table === "workspace_invites" ||
    table === "form_categories"
  ) {
    return rows;
  }
  if (table === "profiles") return rows;
  if (table === "forms") return rows;
  if (
    table === "questions" ||
    table === "responses" ||
    table === "form_versions" ||
    table === "response_sessions"
  ) {
    const formIds = new Set(d.forms.map((f) => f.id));
    return rows.filter((r) => formIds.has(r.form_id));
  }
  return rows;
}

function rest(table: string, method: string, url: URL, headers: Headers, body: unknown): Response {
  const d = load();
  if (table.startsWith("_") || !(table in d)) return json([]);
  const params = url.searchParams;
  const filters = filtersFrom(params);
  const match = (r: Row) => filters.every((f) => f(r));
  const wantsObject = (headers.get("accept") ?? "").includes("vnd.pgrst.object");
  const prefer = headers.get("prefer") ?? "";

  if (method === "GET" || method === "HEAD") {
    let rows = ordered(visible(table, d[table]).filter(match), params.get("order"));
    const total = rows.length;
    const offset = Number(params.get("offset") ?? 0);
    const limit = params.get("limit");
    rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);
    const range = `${rows.length ? offset : "*"}-${rows.length ? offset + rows.length - 1 : ""}/${total}`;
    const h = { "content-range": rows.length ? range : `*/${total}` };
    if (method === "HEAD") return new Response(null, { status: 200, headers: h });
    if (wantsObject) {
      if (rows.length !== 1)
        return pgError("JSON object requested, multiple (or no) rows returned", 406, "PGRST116");
      return json(rows[0], 200, h);
    }
    return json(rows, 200, h);
  }

  if (method === "POST") {
    const items = (Array.isArray(body) ? body : [body]) as Row[];
    const upsert = prefer.includes("merge-duplicates");
    const conflict = (params.get("on_conflict") ?? "id").split(",");
    const created: Row[] = [];
    for (const item of items) {
      const existing = upsert
        ? d[table].find((r) => conflict.every((c) => r[c] === item[c]))
        : null;
      if (existing) {
        Object.assign(existing, item, table === "profiles" ? { updated_at: nowIso() } : {});
        created.push(existing);
        continue;
      }
      const row = { ...(DEFAULTS[table]?.() ?? {}), ...item };
      if (table === "responses") prepareResponse(row);
      if (table === "forms") touchForm(row.id as string);
      d[table].unshift(row);
      if (table === "questions") touchForm(row.form_id as string);
      created.push(row);
    }
    persist();
    if (!prefer.includes("return=representation")) return new Response(null, { status: 201 });
    return wantsObject ? json(created[0], 201) : json(created, 201);
  }

  if (method === "PATCH") {
    const rows = d[table].filter(match);
    for (const r of rows) {
      Object.assign(r, body as Row);
      if (table === "forms") r.updated_at = nowIso();
      if (table === "profiles") r.updated_at = nowIso();
    }
    persist();
    if (!prefer.includes("return=representation")) return new Response(null, { status: 204 });
    return wantsObject ? json(rows[0] ?? null) : json(rows);
  }

  if (method === "DELETE") {
    if (table === "responses") return pgError("Responses can’t be deleted.", 403, "42501");
    const removed = d[table].filter(match);
    d[table] = d[table].filter((r) => !match(r));
    if (table === "forms") {
      const ids = new Set(removed.map((f) => f.id));
      for (const t of ["questions", "responses", "form_versions", "response_sessions"]) {
        d[t] = d[t].filter((r) => !ids.has(r.form_id));
      }
    }
    persist();
    if (!prefer.includes("return=representation")) return new Response(null, { status: 204 });
    return json(removed);
  }

  return pgError("Not supported in the demo.");
}

function touchForm(formId: string) {
  const f = load().forms.find((x) => x.id === formId);
  if (f) f.updated_at = nowIso();
}

/** What the database trigger does on insert: score quizzes, stamp the version. */
function prepareResponse(row: Row) {
  const d = load();
  const form = d.forms.find((f) => f.id === row.form_id);
  if (!form) return;
  row.form_version = form.version;
  const settings = parseFormSettings(form.settings);
  if (settings.quiz?.enabled) {
    const qs = d.questions
      .filter((q) => q.form_id === form.id)
      .map((q) => ({ ...q, points: parsePoints(q.points) }));
    const score = computeScore(qs as never, (row.answers ?? {}) as Answers);
    row.score = score;
    row.outcome = pickOutcome(settings.quiz, score)?.id ?? null;
  }
}

/* ---------------------------------- RPCs ----------------------------------- */

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

function formResponses(formId: string, version?: number | null) {
  return load().responses.filter(
    (r) => r.form_id === formId && (version == null || r.form_version === version),
  );
}

function inWindow(rows: Row[], days: number, until = Date.now()) {
  const from = until - days * DAY;
  return rows.filter((r) => {
    const t = Date.parse(r.submitted_at as string);
    return t > from && t <= until;
  });
}

function traffic(formId: string) {
  const t = load()._traffic.find((x) => x.form_id === formId);
  return {
    view: Number(t?.view_ratio ?? 1.6),
    start: Number(t?.start_ratio ?? 1.25),
  };
}

function daily(rows: Row[], days: number) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(Date.parse(r.submitted_at as string));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(Date.now() - (days - 1 - i) * DAY);
    return { day, count: counts.get(day) ?? 0 };
  });
}

function questionsOf(formId: string) {
  return load()
    .questions.filter((q) => q.form_id === formId)
    .sort((a, b) => Number(a.position) - Number(b.position));
}

function rpc(name: string, args: Record<string, unknown>): Response {
  const d = load();
  const owner = (args.p_owner as string) || DEMO_USER_ID;
  const days = Number(args.p_days ?? 30);
  const formId = args.p_form_id as string;
  const version = (args.p_version as number | undefined) ?? null;

  switch (name) {
    case "get_dashboard_forms": {
      const cats = new Map(d.form_categories.map((c) => [c.id, c]));
      return json(
        d.forms
          .filter((f) => f.user_id === owner)
          .map((f) => {
            const rs = formResponses(f.id as string);
            const r7 = inWindow(rs, 7).length;
            const r90 = inWindow(rs, 90).length;
            const cat = f.category_id ? cats.get(f.category_id) : null;
            return {
              id: f.id,
              title: f.title,
              description: f.description,
              status: f.status,
              created_at: f.created_at,
              updated_at: f.updated_at,
              category_id: f.category_id,
              category: cat?.name ?? null,
              category_color: cat?.color ?? null,
              response_count: rs.length,
              question_count: questionsOf(f.id as string).length,
              last_response_at: rs[0]?.submitted_at ?? null,
              responses_7d: r7,
              responses_90d: r90,
              views_90d: Math.round(r90 * traffic(f.id as string).view),
            };
          }),
      );
    }

    case "get_dashboard_summary": {
      const forms = d.forms.filter((f) => f.user_id === owner);
      const all = forms.flatMap((f) => formResponses(f.id as string));
      const win = inWindow(all, days);
      const prev = inWindow(all, days, Date.now() - days * DAY);
      let views = 0;
      let starts = 0;
      for (const f of forms) {
        const n = inWindow(formResponses(f.id as string), days).length;
        const t = traffic(f.id as string);
        views += Math.round(n * t.view);
        starts += Math.round(n * t.start);
      }
      return json({
        days,
        total_responses: all.length,
        responses_window: win.length,
        responses_prev_window: prev.length,
        views_window: views,
        starts_window: starts,
        daily: daily(win, days),
      });
    }

    case "get_form_analytics": {
      const all = formResponses(formId, version);
      const win = inWindow(all, days);
      const t = traffic(formId);
      const timed = all.filter((r) => r.started_at);
      const secs = timed.map(
        (r) => (Date.parse(r.submitted_at as string) - Date.parse(r.started_at as string)) / 1000,
      );
      const counts = new Map<string, number>();
      for (const r of all) {
        for (const [qid, v] of Object.entries((r.answers ?? {}) as Answers)) {
          for (const one of Array.isArray(v) ? v : [v]) {
            const k = `${qid}\u0000${String(one)}`;
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
        }
      }
      const qs = questionsOf(formId);
      const drop = dropoff(formId, days, version);
      return json({
        totals: {
          responses: all.length,
          last7: inWindow(all, 7).length,
          avg_fill_seconds: secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : null,
          timed_count: secs.length,
        },
        funnel: {
          views: Math.round(win.length * t.view),
          starts: Math.round(win.length * t.start),
          submits: win.length,
        },
        trend: daily(win, days),
        reach: qs.map((q) => ({
          question_id: q.id,
          count: drop.by_question.find((b) => b.question_id === q.id)?.reached ?? 0,
        })),
        value_counts: [...counts].map(([k, count]) => {
          const [question_id, value] = k.split("\u0000");
          return { question_id, value, count };
        }),
      });
    }

    case "get_form_dropoff":
      return json(dropoff(formId, days, version));

    case "get_form_insights": {
      const win = inWindow(formResponses(formId, version), days);
      const t = traffic(formId);
      const bySource = new Map<string, number>();
      const byCampaign = new Map<string, number>();
      const hidden = new Map<string, number>();
      for (const r of win) {
        const m = (r.meta ?? {}) as {
          source?: string;
          campaign?: string;
          hidden?: Record<string, string>;
        };
        const s = m.source ?? "direct";
        bySource.set(s, (bySource.get(s) ?? 0) + 1);
        if (m.campaign) byCampaign.set(m.campaign, (byCampaign.get(m.campaign) ?? 0) + 1);
        for (const [f, v] of Object.entries(m.hidden ?? {})) {
          const k = `${f}\u0000${v}`;
          hidden.set(k, (hidden.get(k) ?? 0) + 1);
        }
      }
      const scored = win.filter((r) => r.score != null);
      const scores = scored.map((r) => Number(r.score));
      const dist = new Map<number, number>();
      const outs = new Map<string | null, number>();
      for (const r of scored) {
        dist.set(Number(r.score), (dist.get(Number(r.score)) ?? 0) + 1);
        outs.set((r.outcome as string) ?? null, (outs.get((r.outcome as string) ?? null) ?? 0) + 1);
      }
      // Direct traffic converts a little worse than tagged links.
      const weight = (s: string) => (s === "direct" ? 1.25 : s === "qr" ? 0.8 : 1);
      return json({
        sources: [...bySource]
          .sort((a, b) => b[1] - a[1])
          .map(([source, submits]) => ({
            source,
            submits,
            views: Math.round(submits * t.view * weight(source)),
          })),
        campaigns: [...byCampaign]
          .sort((a, b) => b[1] - a[1])
          .map(([campaign, submits]) => ({ campaign, submits })),
        hidden: [...hidden]
          .sort((a, b) => b[1] - a[1])
          .map(([k, count]) => {
            const [field, value] = k.split("\u0000");
            return { field, value, count };
          }),
        quiz: scored.length
          ? {
              scored: scored.length,
              avg: scores.reduce((a, b) => a + b, 0) / scores.length,
              min: Math.min(...scores),
              max: Math.max(...scores),
              outcomes: [...outs].map(([outcome, count]) => ({ outcome, count })),
              distribution: [...dist]
                .sort((a, b) => a[0] - b[0])
                .map(([score, count]) => ({ score, count })),
            }
          : null,
      });
    }

    case "get_form_versions": {
      const form = d.forms.find((f) => f.id === formId);
      if (!form) return json([]);
      const snaps = d.form_versions
        .filter((v) => v.form_id === formId)
        .sort((a, b) => Number(b.version) - Number(a.version));
      const entry = (
        v: number,
        title: unknown,
        questions: unknown,
        started: string,
        ended: string | null,
      ) => {
        const rs = formResponses(formId, v);
        const secs = rs
          .filter((r) => r.started_at)
          .map(
            (r) =>
              (Date.parse(r.submitted_at as string) - Date.parse(r.started_at as string)) / 1000,
          );
        return {
          version: v,
          is_current: v === form.version,
          title,
          questions,
          started_at: started,
          ended_at: ended,
          responses: rs.length,
          last_response_at: rs[0]?.submitted_at ?? null,
          avg_fill_seconds: secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : null,
          views: Math.round(rs.length * traffic(formId).view),
          starts: Math.round(rs.length * traffic(formId).start),
        };
      };
      const out = [
        entry(
          Number(form.version),
          form.title,
          questionsOf(formId),
          (snaps[0]?.retired_at as string) ?? (form.created_at as string),
          null,
        ),
      ];
      snaps.forEach((s, i) => {
        out.push(
          entry(
            Number(s.version),
            s.title,
            s.questions,
            (snaps[i + 1]?.retired_at as string) ?? (form.created_at as string),
            s.retired_at as string,
          ),
        );
      });
      return json(out);
    }

    case "get_my_workspaces": {
      const own = d.forms.filter((f) => f.user_id === DEMO_USER_ID).length;
      const people = new Map(d._people.map((p) => [p.id, p]));
      const memberships = d.workspace_members.filter((m) => m.member_id === DEMO_USER_ID);
      return json([
        {
          owner_id: DEMO_USER_ID,
          role: "owner",
          owner_name: "Alex Morgan",
          owner_email: DEMO_EMAIL,
          form_count: own,
          member_count: d.workspace_members.filter((m) => m.owner_id === DEMO_USER_ID).length,
        },
        ...memberships.map((m) => ({
          owner_id: m.owner_id,
          role: m.role,
          owner_name: people.get(m.owner_id)?.name ?? null,
          owner_email: people.get(m.owner_id)?.email ?? "",
          form_count: d.forms.filter((f) => f.user_id === m.owner_id).length,
          member_count: d.workspace_members.filter((x) => x.owner_id === m.owner_id).length + 3,
        })),
      ]);
    }

    case "get_workspace_members": {
      const people = new Map(d._people.map((p) => [p.id, p]));
      const ownerP = people.get(owner);
      return json([
        {
          user_id: owner,
          email: ownerP?.email ?? "",
          name: ownerP?.name ?? null,
          role: "owner",
          joined_at: "2026-01-01T00:00:00Z",
        },
        ...d.workspace_members
          .filter((m) => m.owner_id === owner)
          .map((m) => ({
            user_id: m.member_id,
            email: people.get(m.member_id)?.email ?? "",
            name: people.get(m.member_id)?.name ?? null,
            role: m.role,
            joined_at: m.created_at,
          })),
      ]);
    }

    case "get_my_invites":
      return json([]);

    case "resolve_short_form_link": {
      const code = String(args.p_code ?? "").toLowerCase();
      return json(d.forms.find((f) => String(f.id).startsWith(code))?.id ?? null);
    }

    case "copy_form": {
      const src = d.forms.find((f) => f.id === formId);
      if (!src) return pgError("Form not found.", 404);
      const id = newId();
      d.forms.unshift({
        ...src,
        id,
        title: `${src.title} (copy)`,
        status: "draft",
        version: 1,
        copied_from: src.id,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      const idMap = new Map<string, string>();
      for (const q of questionsOf(formId)) idMap.set(q.id as string, newId());
      for (const q of questionsOf(formId)) {
        const logic = q.logic as { jumps?: Record<string, string> } | null;
        d.questions.push({
          ...q,
          id: idMap.get(q.id as string),
          form_id: id,
          logic: logic?.jumps
            ? {
                jumps: Object.fromEntries(
                  Object.entries(logic.jumps).map(([c, t]) => [c, idMap.get(t) ?? t]),
                ),
              }
            : null,
        });
      }
      persist();
      return json(id);
    }

    case "save_form_editor": {
      const form = d.forms.find((f) => f.id === formId);
      if (!form) return pgError("Form not found.", 404);
      const p = (args.p_form ?? {}) as Row;
      for (const k of ["title", "description", "display_mode", "thank_you_message", "settings"]) {
        if (k in p) form[k] = p[k];
      }
      form.updated_at = nowIso();
      const incoming = (args.p_questions ?? []) as Row[];
      const kept = new Set<string>();
      const rows = incoming.map((q, i) => {
        const id = (q.id as string) || newId();
        kept.add(id);
        return {
          ...(DEFAULTS.questions() as Row),
          ...q,
          id,
          form_id: formId,
          position: i,
        };
      });
      d.questions = d.questions.filter((q) => q.form_id !== formId).concat(rows);
      persist();
      return json(null);
    }

    case "start_new_form_version": {
      const form = d.forms.find((f) => f.id === formId);
      if (!form) return pgError("Form not found.", 404);
      d.form_versions.push({
        id: newId(),
        form_id: formId,
        version: form.version,
        title: form.title,
        description: form.description,
        display_mode: form.display_mode,
        thank_you_message: form.thank_you_message,
        settings: form.settings,
        questions: questionsOf(formId),
        retired_at: nowIso(),
        retired_by: DEMO_USER_ID,
      });
      form.version = Number(form.version) + 1;
      form.status = "draft";
      form.updated_at = nowIso();
      persist();
      return json(form.version);
    }

    case "request_ai_follow_up":
      return json("demo-ticket");

    case "delete_my_account":
      return pgError("Accounts can’t be deleted in the demo workspace.", 403);

    // Analytics events, progress saves, invites and keep-alive: accepted, ignored.
    default:
      return json(null);
  }
}

function dropoff(formId: string, days: number, version: number | null) {
  const qs = questionsOf(formId);
  const completed = inWindow(formResponses(formId, version), days).length;
  const started = Math.round(completed * traffic(formId).start);
  const abandoned = Math.max(0, started - completed);
  // Long and open questions lose more people than a quick tap.
  const weights = qs.map(
    (q, i) => (q.type === "long_text" ? 3 : q.type === "text" ? 1.6 : 1) * (1 + i * 0.15),
  );
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let reached = started;
  let left = abandoned;
  const by_question = qs.map((q, i) => {
    const stopped =
      i === qs.length - 1 ? left : Math.min(left, Math.round((abandoned * weights[i]) / total));
    const row = { question_id: q.id as string, reached, stopped };
    reached -= stopped;
    left -= stopped;
    return row;
  });
  return { started, completed, abandoned, by_question };
}

/* ----------------------------------- Auth ----------------------------------- */

function auth(path: string, method: string): Response {
  if (path.endsWith("/user") && method === "GET") return json(demoUser());
  if (path.endsWith("/user") && method === "PUT") {
    return json(
      {
        code: 422,
        error_code: "demo",
        msg: "Account details can’t be changed in the demo workspace.",
      },
      422,
    );
  }
  if (path.endsWith("/logout")) return new Response(null, { status: 204 });
  if (path.endsWith("/token")) return json(demoSession());
  return json({ code: 400, error_code: "demo", msg: "Not available in the demo workspace." }, 400);
}

/* ---------------------------------- Entry ----------------------------------- */

/** Handle one request the Supabase client would have sent over the network. */
export async function handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input));
  const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers ?? req?.headers);
  let body: unknown = null;
  const rawBody =
    init?.body ?? (req && method !== "GET" && method !== "HEAD" ? await req.text() : null);
  if (typeof rawBody === "string" && rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }
  const path = url.pathname;

  if (path.startsWith("/auth/v1/")) return auth(path, method);
  if (path.startsWith("/storage/v1/")) {
    return json(
      { statusCode: "403", error: "demo", message: "Uploads are off in the demo workspace." },
      403,
    );
  }
  if (path.startsWith("/rest/v1/rpc/")) {
    return rpc(path.slice("/rest/v1/rpc/".length), (body ?? {}) as Record<string, unknown>);
  }
  if (path.startsWith("/rest/v1/")) {
    return rest(path.slice("/rest/v1/".length), method, url, headers, body);
  }
  return json(null, 404);
}

/* ----------------------------- Live view helper ----------------------------- */

/**
 * Stand-in for Realtime on the live view: a new response every few seconds,
 * so the presenter screen moves. Returns a stop function.
 */
export function simulateResponses(formId: string, onInsert: () => void): () => void {
  let seed = Date.now() % 1_000_000;
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    const qs = questionsOf(formId);
    const form = load().forms.find((f) => f.id === formId);
    if (form && form.status === "published" && qs.length > 0) {
      const row: Row = {
        ...DEFAULTS.responses(),
        form_id: formId,
        answers: randomAnswersFor(qs, seed++),
        started_at: new Date(Date.now() - 95_000).toISOString(),
        meta: { source: "qr" },
      };
      prepareResponse(row);
      load().responses.unshift(row);
      persist();
      onInsert();
    }
    timer = setTimeout(tick, 3500 + Math.random() * 4000);
  };
  timer = setTimeout(tick, 2500);
  return () => clearTimeout(timer);
}

/** Read-only access for the canned Claude answers. */
export function demoData() {
  return {
    forms: load().forms,
    questionsOf,
    responsesOf: (formId: string, version?: number | null) => formResponses(formId, version),
    maxScoreOf: (formId: string) =>
      maxScore(questionsOf(formId).map((q) => ({ ...q, points: parsePoints(q.points) })) as never),
  };
}
