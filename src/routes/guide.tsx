import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChevronRight, Plus } from "lucide-react";

import { AppShell, AppShellSkeleton, PageHeader } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { isSigningOut } from "@/lib/sign-out";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Guide — Flowform" },
      { name: "description", content: "Every Flowform feature, and where to find it." },
    ],
  }),
  component: GuidePage,
});

type Feature = {
  name: string;
  /** Marks work Claude does. */
  claude?: boolean;
  how: string;
  /** Click path to the feature, outermost first. */
  where: string[];
};

type Stage = { id: string; title: string; intro: string; features: Feature[] };

/**
 * The feature map. Every `where` is a real click path in the app; when a
 * label in the UI changes, change it here too.
 */
const STAGES: Stage[] = [
  {
    id: "build",
    title: "Build",
    intro:
      "Open a form and you land on its Build tab. Questions come first, with Form settings beside them.",
    features: [
      {
        name: "Start blank or from a template",
        how: "Three templates cover customer feedback, event feedback and a team pulse. A blank form covers the rest.",
        where: ["New form"],
      },
      {
        name: "Seven question types",
        how: "Short answer, long answer, multiple choice, dropdown, Yes / No, NPS and a rating scale. Drag questions to reorder them.",
        where: ["Build", "Add question"],
      },
      {
        name: "Draft questions",
        claude: true,
        how: "Claude reads your title and description and drafts five to eight questions. Add the ones you like.",
        where: ["Build", "Suggest questions"],
      },
      {
        name: "One at a time, or one page",
        how: "Conversational shows one question at a time with a progress bar. Classic puts every question on one page.",
        where: ["Build", "Respondent experience"],
      },
      {
        name: "Logic jumps",
        how: "Send people to a different question depending on their answer. Works on dropdown, Yes / No and single-choice questions, forward only.",
        where: ["Build", "a question", "Logic jumps"],
      },
      {
        name: "Answer recall",
        how: "Name an answer, then reuse it in a later question: “Thanks, {name}. What should we fix?”",
        where: ["Build", "a question", "Recall"],
      },
      {
        name: "Follow-up questions",
        claude: true,
        how: "When a written answer is short or vague, Claude asks one optional follow-up. Conversational forms only.",
        where: ["Build", "a text question", "AI follow-up"],
      },
      {
        name: "Branding",
        how: "Give a form its own accent colour, font and cover image.",
        where: ["Build", "Form settings", "Branding"],
      },
      {
        name: "After submit",
        how: "Write your own thank-you message, or send people on to a page of yours.",
        where: ["Build", "Form settings", "After submit"],
      },
      {
        name: "Quiz mode",
        how: "Give choices points, show people their score, and match score ranges to outcomes.",
        where: ["Build", "Form settings", "Quiz mode"],
      },
      {
        name: "Preview",
        how: "Answer the form yourself before anyone else does. Nothing is recorded.",
        where: ["Build", "Preview"],
      },
    ],
  },
  {
    id: "share",
    title: "Share",
    intro: "Publishing makes the link work. Until then, nobody can answer.",
    features: [
      {
        name: "Link, QR code and embed",
        how: "Copy the link, download a QR code, or paste the embed snippet into your site.",
        where: ["a published form", "Share"],
      },
      {
        name: "Publish, close, reopen",
        how: "A live form is locked so answers stay comparable. Close it to stop responses; the link then shows a closed notice.",
        where: ["Build", "top right"],
      },
      {
        name: "Update a form, keep the link",
        how: "Once a form has responses, update it as a new version under the same link. Earlier answers stay as they were.",
        where: ["Build", "Update this form"],
      },
      {
        name: "Hidden fields and UTM tags",
        how: "Add ?name=Ana to the link to carry data in. Tag links by source to see which one brings responses.",
        where: ["Build", "Form settings", "Hidden fields & UTM"],
      },
      {
        name: "One response each",
        how: "Each network address can answer a form once. People on the same Wi-Fi share that one response.",
        where: ["Always on"],
      },
    ],
  },
  {
    id: "learn",
    title: "Learn",
    intro: "Every form has a Results tab. It fills in as answers arrive.",
    features: [
      {
        name: "Overview",
        how: "Responses, views, completion rate and average time to fill, with a trend, a funnel and a chart for every question.",
        where: ["Results", "Overview"],
      },
      {
        name: "Drop-off",
        how: "See the exact question where people give up. It counts unfinished attempts, not guesses.",
        where: ["Results", "Overview", "Where people drop off"],
      },
      {
        name: "Summaries",
        claude: true,
        how: "Claude reads the open answers. You read the summary.",
        where: ["Results", "Overview", "Summary of open answers"],
      },
      {
        name: "Ask your responses",
        claude: true,
        how: "Ask a question in plain English. Claude answers from the data and shows the responses behind it.",
        where: ["Results", "Overview", "Ask your responses"],
      },
      {
        name: "Individual responses",
        how: "Read answers one person at a time as cards, or all together in a table. The table can include unfinished attempts.",
        where: ["Results", "Individual responses"],
      },
      {
        name: "Sources, scores and hidden fields",
        how: "Which links brought responses, how people scored, and the data that came in with the link.",
        where: ["Results", "Overview"],
      },
      {
        name: "Compare versions",
        how: "If a form was updated, see responses, completion and changes per version side by side.",
        where: ["Results", "Version"],
      },
      {
        name: "Export",
        how: "Every response as a CSV row, or a printable PDF report with a chart or quotes per question.",
        where: ["Results", "Export CSV / Export PDF"],
      },
    ],
  },
  {
    id: "present",
    title: "Present",
    intro: "For talks, workshops and meetings that should have been a form.",
    features: [
      {
        name: "Live results",
        how: "Full-screen results that update as answers arrive, with a QR code so the room can join. F for full screen, Space to auto-advance.",
        where: ["a form", "Present"],
      },
    ],
  },
  {
    id: "workspace",
    title: "Workspace",
    intro: "The parts that aren’t about one form.",
    features: [
      {
        name: "Search",
        how: "Jump to any form or page, or change the theme, from the keyboard.",
        where: ["Sidebar", "Search (⌘K)"],
      },
      {
        name: "Categories",
        how: "Colour-coded groups for your forms. Click one in the sidebar to see only its forms.",
        where: ["Sidebar", "Categories"],
      },
      {
        name: "List, cards or board",
        how: "Three layouts for the forms list. On the board, drag a form between Draft, Live and Closed.",
        where: ["Forms", "layout switch"],
      },
      {
        name: "Team and roles",
        how: "Invite people as admin, editor or viewer. Viewers read results; editors build and publish; admins also delete and manage the team.",
        where: ["Team"],
      },
      {
        name: "Workspaces",
        how: "Invited to someone else’s workspace? Switch between theirs and yours.",
        where: ["Sidebar", "workspace switcher"],
      },
      {
        name: "Dark mode",
        how: "Light, dark, or whatever your device says.",
        where: ["Settings", "Appearance"],
      },
      {
        name: "Your data",
        how: "Download everything you’ve collected, or delete your account and all of it.",
        where: ["Settings", "Your data"],
      },
    ],
  },
];

function GuidePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && !isSigningOut()) {
      navigate({ to: "/login", search: { redirect: "/guide" } });
    }
  }, [loading, user, navigate]);

  if (loading || !user) return <AppShellSkeleton width="md" />;

  return (
    <AppShell userId={user.id} email={user.email ?? ""} width="md">
      <PageHeader
        title="Guide"
        description="Every feature, what it does, and where to find it."
        actions={
          <Link
            to="/forms/new"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-card px-3 text-[13px] font-medium text-ink outline-none transition-colors hover:border-ink/25 focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Plus className="size-3.5" />
            New form
          </Link>
        }
      />

      {/* A form's life, left to right. Each step jumps to its section. */}
      <nav
        aria-label="Guide sections"
        className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-2 rounded-xl border border-hairline bg-card px-3 py-2.5"
      >
        {STAGES.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden className="size-3.5 text-ink/25" />}
            <a
              href={`#${s.id}`}
              className="rounded-md px-2 py-1 text-[13px] font-medium text-ink/70 outline-none transition-colors hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {s.title}
              <span className="ml-1.5 font-mono text-[11px] font-normal text-ink/40">
                {s.features.length}
              </span>
            </a>
          </span>
        ))}
      </nav>

      <div className="mt-10 space-y-12">
        {STAGES.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`}>
            <div className="grid gap-x-10 gap-y-4 md:grid-cols-[11rem_minmax(0,1fr)]">
              <div>
                <h2 id={`${s.id}-heading`} className="text-lg font-medium tracking-normal">
                  {s.title}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/55">{s.intro}</p>
              </div>
              <ul className="overflow-hidden rounded-xl border border-hairline bg-card">
                {s.features.map((f) => (
                  <li
                    key={f.name}
                    className="grid gap-x-6 gap-y-1.5 border-b border-hairline px-5 py-3.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]"
                  >
                    <div className="min-w-0">
                      <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium tracking-normal">
                        {f.name}
                        {f.claude && (
                          <span className="rounded-sm border border-brand/25 bg-accent px-1.5 py-px font-mono text-[10px] font-normal uppercase text-brand">
                            Claude
                          </span>
                        )}
                      </h3>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-ink/60">{f.how}</p>
                    </div>
                    <p
                      className="flex flex-wrap content-start items-center gap-x-1 gap-y-0.5 text-xs text-ink/55 sm:pt-0.5"
                      aria-label={`Where: ${f.where.join(", then ")}`}
                    >
                      {f.where.map((step, i) => (
                        <span key={step} className="inline-flex items-center gap-1" aria-hidden>
                          {i > 0 && <ChevronRight className="size-3 text-ink/30" />}
                          <span className={i === f.where.length - 1 ? "text-ink/80" : ""}>
                            {step}
                          </span>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
