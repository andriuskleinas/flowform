import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Flowform" },
      {
        name: "description",
        content: "How Flowform collects, uses, and protects your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="July 3, 2026">
      <section>
        <h2>What we collect</h2>
        <p>
          When you create a Flowform account we store your email address and the profile details you
          choose to add. When you build forms we store the forms, questions, and settings you
          create. When someone responds to your form we store their answers on your behalf.
        </p>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To provide the service — creating, sharing, and analyzing your forms.</li>
          <li>To secure your account and authenticate you when you log in.</li>
          <li>To notify you about important changes to the service.</li>
        </ul>
        <p>We do not sell your data, and we do not share it with third parties for advertising.</p>
      </section>

      <section>
        <h2>AI features</h2>
        <p>
          When you use AI question suggestions, the goal you describe is sent to Anthropic&apos;s
          Claude API to generate suggestions. Your form responses are never used to train AI models.
        </p>
      </section>

      <section>
        <h2>Where your data lives</h2>
        <p>
          Your data is stored in a managed Postgres database (Supabase) protected with row-level
          security, so each account can only access its own forms and responses. Connections to the
          service are encrypted in transit.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Flowform uses only the cookies and local storage needed to keep you signed in. There are
          no third-party advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can update your profile at any time from your account settings. You may request a copy
          or deletion of your data — deleting your account removes your forms and the responses
          collected with them.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about this policy? Reach out to the Flowform team and we&apos;ll get back to you
          promptly.
        </p>
      </section>
    </LegalPage>
  );
}
