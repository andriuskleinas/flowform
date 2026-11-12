import { useEffect, useState } from "react";
import { Check, Copy, Link2, Palette, Plus, Trophy, Variable, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCENT_PRESETS,
  FONT_CHOICES,
  ensureFontLoaded,
  isSafeUrl,
  isValidKey,
  themeStyle,
  toKey,
  type FormFont,
  type FormSettings,
  type QuizOutcome,
} from "@/lib/form-settings";

type Tab = "branding" | "after" | "tracking" | "quiz";

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: "branding", label: "Branding", icon: Palette },
  { id: "after", label: "After submit", icon: Check },
  { id: "tracking", label: "Hidden fields & UTM", icon: Variable },
  { id: "quiz", label: "Quiz mode", icon: Trophy },
];

/**
 * Form-level settings in the editor: per-form branding, the post-submit
 * redirect, hidden fields / tracked links, and quiz outcomes. Everything lands
 * in forms.settings through the editor's normal Save.
 */
export function FormSettingsPanel({
  value,
  onChange,
  formId,
  formTitle,
  maxQuizScore,
  scoredQuestionCount,
  disabled,
}: {
  value: FormSettings;
  onChange: (next: FormSettings) => void;
  formId: string;
  formTitle: string;
  maxQuizScore: number;
  scoredQuestionCount: number;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("branding");
  const set = (patch: Partial<FormSettings>) => onChange({ ...value, ...patch });
  const theme = value.theme ?? {};

  useEffect(() => {
    ensureFontLoaded(theme.font);
  }, [theme.font]);

  return (
    <section className="mt-6 rounded-lg border border-hairline bg-card">
      <div
        role="tablist"
        aria-label="Form settings"
        className="flex gap-1 overflow-x-auto border-b border-hairline px-2 pt-2"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          const on =
            (t.id === "branding" &&
              !!(theme.accent || theme.cover_url || (theme.font && theme.font !== "roboto"))) ||
            (t.id === "after" && !!value.redirect_url) ||
            (t.id === "tracking" && (value.hidden_fields?.length ?? 0) > 0) ||
            (t.id === "quiz" && !!value.quiz?.enabled);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={
                "inline-flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (active ? "border-brand text-ink" : "border-transparent text-ink/55 hover:text-ink")
              }
            >
              <Icon className="size-3.5" aria-hidden />
              {t.label}
              {on && <span className="size-1.5 rounded-full bg-brand" aria-label="(on)" />}
            </button>
          );
        })}
      </div>

      <fieldset disabled={disabled} className="p-4 disabled:opacity-70">
        {tab === "branding" && (
          <div className="grid gap-5 md:grid-cols-[1fr_240px]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Accent colour</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => set({ theme: { ...theme, accent: undefined } })}
                    className={
                      "rounded-md border px-2.5 py-1 text-xs font-medium " +
                      (!theme.accent ? "border-brand text-brand" : "border-ink/15 text-ink/60")
                    }
                  >
                    Default
                  </button>
                  {ACCENT_PRESETS.slice(1).map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Accent ${c}`}
                      onClick={() => set({ theme: { ...theme, accent: c } })}
                      className={
                        "size-7 rounded-full border-2 transition-transform hover:scale-110 " +
                        (theme.accent?.toLowerCase() === c ? "border-ink" : "border-transparent")
                      }
                      style={{ background: c }}
                    />
                  ))}
                  <label className="inline-flex items-center gap-1.5 text-xs text-ink/60">
                    <input
                      type="color"
                      value={theme.accent ?? "#2f3fd1"}
                      onChange={(e) => set({ theme: { ...theme, accent: e.target.value } })}
                      className="h-7 w-9 cursor-pointer rounded border border-ink/15 bg-card p-0.5"
                    />
                    Custom
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-font" className="text-xs">
                  Font
                </Label>
                <select
                  id="settings-font"
                  value={theme.font ?? "roboto"}
                  onChange={(e) => set({ theme: { ...theme, font: e.target.value as FormFont } })}
                  className="flex h-9 w-full max-w-xs rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm"
                >
                  {FONT_CHOICES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-cover" className="text-xs">
                  Cover image URL <span className="font-normal text-ink/40">(optional, https)</span>
                </Label>
                <Input
                  id="settings-cover"
                  value={theme.cover_url ?? ""}
                  onChange={(e) => set({ theme: { ...theme, cover_url: e.target.value } })}
                  placeholder="https://images.example.com/banner.jpg"
                  autoComplete="off"
                />
                {theme.cover_url && !isSafeUrl(theme.cover_url, true) && (
                  <p className="text-xs text-destructive">Use a full https:// image link.</p>
                )}
              </div>
            </div>

            {/* Live swatch of the respondent view with the chosen theme. */}
            <div
              className="overflow-hidden rounded-lg border border-hairline bg-surface"
              style={themeStyle(theme)}
              aria-label="Theme preview"
            >
              {theme.cover_url && isSafeUrl(theme.cover_url, true) ? (
                <img src={theme.cover_url} alt="" className="h-16 w-full object-cover" />
              ) : (
                <div className="h-2 bg-brand" />
              )}
              <div className="p-4">
                <p className="text-[11px] font-medium text-ink/55">{formTitle || "Your form"}</p>
                <p className="font-display mt-2 text-lg leading-tight text-ink">
                  How did you hear about us?
                </p>
                <div className="mt-3 space-y-1.5">
                  {["Friend", "Newsletter"].map((o, i) => (
                    <div
                      key={o}
                      className={
                        "rounded-md border px-2.5 py-1.5 text-xs " +
                        (i === 0
                          ? "border-brand bg-brand/10 text-ink"
                          : "border-hairline text-ink/70")
                      }
                    >
                      <span className="mr-1.5 font-mono text-brand">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {o}
                    </div>
                  ))}
                </div>
                <span className="mt-3 inline-flex h-7 items-center rounded-md bg-brand px-3 text-xs font-medium text-brand-foreground">
                  OK
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === "after" && (
          <div className="max-w-xl space-y-1.5">
            <Label htmlFor="settings-redirect" className="text-xs">
              Redirect after submit <span className="font-normal text-ink/40">(optional)</span>
            </Label>
            <Input
              id="settings-redirect"
              value={value.redirect_url ?? ""}
              onChange={(e) => set({ redirect_url: e.target.value })}
              placeholder="https://yoursite.com/thanks"
              autoComplete="off"
            />
            {value.redirect_url && !isSafeUrl(value.redirect_url) ? (
              <p className="text-xs text-destructive">Use a full http:// or https:// link.</p>
            ) : (
              <p className="text-xs text-ink/45">
                Respondents see your thank-you message (and quiz result), then continue to this page
                after 5 seconds.
              </p>
            )}
          </div>
        )}

        {tab === "tracking" && (
          <TrackingTab
            formId={formId}
            fields={value.hidden_fields ?? []}
            onFields={(hidden_fields) => set({ hidden_fields })}
          />
        )}

        {tab === "quiz" && (
          <QuizTab
            value={value.quiz ?? { enabled: false, show_score: true, outcomes: [] }}
            onChange={(quiz) => set({ quiz })}
            maxScore={maxQuizScore}
            scoredQuestionCount={scoredQuestionCount}
          />
        )}
      </fieldset>
    </section>
  );
}

function TrackingTab({
  formId,
  fields,
  onFields,
}: {
  formId: string;
  fields: string[];
  onFields: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [source, setSource] = useState("newsletter");
  const [campaign, setCampaign] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const add = () => {
    const key = toKey(draft);
    if (!isValidKey(key)) {
      toast.error("Use letters, numbers and underscores, starting with a letter.");
      return;
    }
    if (!fields.includes(key) && fields.length < 10) onFields([...fields, key]);
    setDraft("");
  };

  const params = new URLSearchParams();
  if (source.trim()) params.set("utm_source", source.trim());
  if (campaign.trim()) params.set("utm_campaign", campaign.trim());
  for (const f of fields) params.set(f, "");
  const link = `${origin}/forms/${formId}${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <Label className="text-xs">Hidden fields</Label>
        <p className="text-xs text-ink/50">
          Values you put in the link (<span className="font-mono">?name=Ana&amp;plan=pro</span>) are
          saved with each response. Use them in questions as{" "}
          <span className="font-mono">{"{name}"}</span>.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 font-mono text-xs"
            >
              {f}
              <button
                type="button"
                aria-label={`Remove ${f}`}
                onClick={() => onFields(fields.filter((x) => x !== f))}
                className="text-ink/40 hover:text-ink"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {fields.length === 0 && <span className="text-xs text-ink/40">None yet.</span>}
        </div>
        <div className="flex max-w-sm gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. name, plan, order_id"
            className="font-mono text-sm"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim() || fields.length >= 10}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink/15 px-3 text-sm font-medium hover:bg-ink/5 disabled:opacity-40"
          >
            <Plus className="size-4" /> Add
          </button>
        </div>
        <p className="text-xs text-ink/40">
          UTM tags (<span className="font-mono">utm_source</span>,{" "}
          <span className="font-mono">utm_medium</span>,{" "}
          <span className="font-mono">utm_campaign</span>…) and the referring site are always
          captured — no setup needed.
        </p>
      </div>

      <div className="space-y-2 rounded-lg bg-surface p-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/70">
          <Link2 className="size-3.5" /> Tracked link builder
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="utm-source" className="text-[11px] text-ink/50">
              Source
            </Label>
            <Input
              id="utm-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="utm-campaign" className="text-[11px] text-ink/50">
              Campaign
            </Label>
            <Input
              id="utm-campaign"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="spring-launch"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded border border-hairline bg-card px-2 py-1.5 font-mono text-[11px] text-ink/70">
            {link}
          </code>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                toast.error("Could not copy");
              }
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink/15 bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-ink/5"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-[11px] text-ink/45">
          Results show views and completion per source, so you can see which channel converts.
        </p>
      </div>
    </div>
  );
}

function QuizTab({
  value,
  onChange,
  maxScore,
  scoredQuestionCount,
}: {
  value: NonNullable<FormSettings["quiz"]>;
  onChange: (next: NonNullable<FormSettings["quiz"]>) => void;
  maxScore: number;
  scoredQuestionCount: number;
}) {
  const setOutcome = (id: string, patch: Partial<QuizOutcome>) =>
    onChange({
      ...value,
      outcomes: value.outcomes.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  const addOutcome = () => {
    const last = value.outcomes[value.outcomes.length - 1];
    const min = last
      ? Math.min(maxScore, last.min_score + Math.max(1, Math.round(maxScore / 3)))
      : 0;
    onChange({
      ...value,
      outcomes: [
        ...value.outcomes,
        { id: Math.random().toString(36).slice(2, 8), title: "", message: "", min_score: min },
      ],
    });
  };
  const sorted = [...value.outcomes].sort((a, b) => a.min_score - b.min_score);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <Switch
            id="quiz-enabled"
            checked={value.enabled}
            onCheckedChange={(enabled) =>
              onChange({
                ...value,
                enabled,
                outcomes:
                  enabled && value.outcomes.length === 0
                    ? [
                        { id: "low", title: "Keep practising", message: "", min_score: 0 },
                        {
                          id: "high",
                          title: "Nailed it!",
                          message: "",
                          min_score: Math.max(1, Math.ceil(maxScore * 0.7)),
                        },
                      ]
                    : value.outcomes,
              })
            }
          />
          <Label htmlFor="quiz-enabled" className="text-sm font-medium">
            Score answers and show an outcome
          </Label>
        </div>
        {value.enabled && (
          <div className="flex items-center gap-2">
            <Switch
              id="quiz-show-score"
              checked={value.show_score !== false}
              onCheckedChange={(show_score) => onChange({ ...value, show_score })}
            />
            <Label htmlFor="quiz-show-score" className="text-xs font-normal">
              Show the score to respondents
            </Label>
          </div>
        )}
      </div>

      {value.enabled && (
        <>
          <p className="text-xs text-ink/55">
            Give points to answers on each choice question (below, under{" "}
            <span className="font-semibold">Points</span>).{" "}
            {scoredQuestionCount > 0 ? (
              <>
                {scoredQuestionCount} {scoredQuestionCount === 1 ? "question is" : "questions are"}{" "}
                scored · best possible score <span className="font-semibold">{maxScore}</span>.
              </>
            ) : (
              <span className="text-amber-700">No question has points yet.</span>
            )}{" "}
            Respondents get the outcome with the highest minimum score they reach.
          </p>
          <ul className="space-y-3">
            {sorted.map((o) => (
              <li key={o.id} className="rounded-lg border border-hairline bg-surface/60 p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="w-28 space-y-1">
                    <Label className="text-[11px] text-ink/50">From score</Label>
                    <Input
                      type="number"
                      value={o.min_score}
                      onChange={(e) =>
                        setOutcome(o.id, { min_score: Math.round(Number(e.target.value) || 0) })
                      }
                      className="h-8 font-mono text-sm"
                    />
                  </div>
                  <div className="min-w-48 flex-1 space-y-1">
                    <Label className="text-[11px] text-ink/50">Outcome title</Label>
                    <Input
                      value={o.title}
                      onChange={(e) => setOutcome(o.id, { title: e.target.value })}
                      placeholder="e.g. Coffee connoisseur"
                      className="h-8 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove outcome"
                    onClick={() =>
                      onChange({ ...value, outcomes: value.outcomes.filter((x) => x.id !== o.id) })
                    }
                    className="mt-5 rounded p-1.5 text-ink/45 hover:bg-ink/5 hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <Textarea
                  value={o.message ?? ""}
                  onChange={(e) => setOutcome(o.id, { message: e.target.value })}
                  placeholder="Message shown with this outcome (optional). You can use {name}."
                  rows={2}
                  className="mt-2 text-sm"
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addOutcome}
            disabled={value.outcomes.length >= 8}
            className="text-sm font-medium text-brand hover:underline disabled:opacity-40"
          >
            + Add outcome
          </button>
        </>
      )}
    </div>
  );
}
