import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — Flowform" },
      {
        name: "description",
        content: "The rules for using Flowform, in plain English.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="13 November 2026">
      <section>
        <h2>The service</h2>
        <p>
          Flowform lets you build, share and analyse forms. Creating an account means you accept
          these terms. Flowform is free during early access.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You own your forms and the responses you collect. You’re responsible for what your forms
          ask and for having a lawful reason to ask it.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don’t collect data deceptively or without consent.</li>
          <li>Don’t ask for passwords, card numbers or similar credentials.</li>
          <li>Don’t use Flowform for spam, harassment or anything unlawful.</li>
          <li>Don’t try to disrupt the service or reach other people’s data.</li>
        </ul>
        <p>We may suspend accounts that break these rules.</p>
      </section>

      <section>
        <h2>Early access</h2>
        <p>
          Flowform is still being built, and features may change. We work to keep it reliable, but
          during early access it’s provided “as is”, without warranties of any kind.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          As far as the law allows, Flowform isn’t liable for indirect or consequential damages from
          using the service. Keep copies of anything you can’t afford to lose.
        </p>
      </section>

      <section>
        <h2>Changes to these terms</h2>
        <p>
          We may update these terms as the product changes. For material changes, we’ll tell you by
          email or in the app before they take effect.
        </p>
      </section>
    </LegalPage>
  );
}
