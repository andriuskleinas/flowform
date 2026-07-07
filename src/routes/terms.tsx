import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — Flowform" },
      {
        name: "description",
        content: "The terms that govern your use of Flowform.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="July 3, 2026">
      <section>
        <h2>The service</h2>
        <p>
          Flowform lets you build, share, and analyze one-question-at-a-time forms. By creating an
          account you agree to these terms. Flowform is currently offered free of charge during
          early access.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You own the forms you create and the responses you collect. You are responsible for the
          content of your forms and for having a lawful basis to collect the information you ask
          for.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don&apos;t use Flowform to collect data deceptively or without consent.</li>
          <li>
            Don&apos;t request passwords, payment card numbers, or similarly sensitive credentials
            through forms.
          </li>
          <li>Don&apos;t use the service for spam, harassment, or anything unlawful.</li>
          <li>Don&apos;t attempt to disrupt the service or access other users&apos; data.</li>
        </ul>
        <p>We may suspend accounts that violate these rules.</p>
      </section>

      <section>
        <h2>Early access</h2>
        <p>
          Flowform is under active development. Features may change, and while we work hard to keep
          the service reliable, it is provided &ldquo;as is&rdquo; without warranties of any kind
          during early access.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          To the maximum extent permitted by law, Flowform is not liable for indirect or
          consequential damages arising from your use of the service. Keep copies of anything you
          can&apos;t afford to lose.
        </p>
      </section>

      <section>
        <h2>Changes to these terms</h2>
        <p>
          We may update these terms as the product evolves. If we make material changes, we&apos;ll
          notify you by email or in the app before they take effect.
        </p>
      </section>
    </LegalPage>
  );
}
