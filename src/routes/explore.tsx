import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { Logo } from "@/components/logo";
import { enterDemo } from "@/lib/demo/mode";

/**
 * Opens the demo workspace: a signed-in Flowform with example forms and
 * responses, running entirely in the browser. No account needed.
 */
export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Demo workspace — Flowform" },
      {
        name: "description",
        content: "Look around a Flowform workspace with example forms and results. No sign-up.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  useEffect(() => {
    enterDemo("/dashboard");
  }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface text-ink">
      <Logo />
      <p className="text-sm text-ink/55">Opening the demo workspace…</p>
    </div>
  );
}
