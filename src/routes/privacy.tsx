import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Flowform" },
      {
        name: "description",
        content: "What Flowform collects, why, and how it’s protected.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="13 November 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your account: your email address and any profile details you add.</li>
          <li>Your forms: the questions, settings and images you create.</li>
          <li>
            Responses: the answers people give to your forms, stored on your behalf. Answers are
            saved as people go, so you can see where they stop. Unfinished answers are deleted after
            90 days.
          </li>
          <li>
            A SHA-256 hash of each respondent’s IP address, not the address itself. We use it to
            limit each form to one response per network and to stop abuse.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To run the service: building, sharing and analysing your forms.</li>
          <li>To keep your account secure and log you in.</li>
          <li>To tell you about important changes to the service.</li>
        </ul>
        <p>We don’t sell your data or share it with anyone for advertising.</p>
      </section>

      <section>
        <h2>Claude features</h2>
        <p>
          Some features send text to Anthropic’s Claude API. Drafting sends the goal you describe.
          Follow-ups send the respondent’s answer to that question. Summaries and “Ask your results”
          send the answers being analysed. Flowform never uses your responses to train AI models.
        </p>
      </section>

      <section>
        <h2>Where your data lives</h2>
        <p>
          In a managed Postgres database on Supabase. Row-level security means each workspace can
          only read its own forms and responses. Every connection is encrypted.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Flowform only uses the cookies and local storage that keep you logged in and remember your
          settings. There are no advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can edit your profile at any time. You can ask for a copy of your data or for it to be
          deleted. Deleting your account removes your forms and their responses.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about this policy? Contact the Flowform team and we’ll reply promptly.</p>
      </section>
    </LegalPage>
  );
}
