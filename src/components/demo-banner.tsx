import { useEffect, useState } from "react";

import { exitDemo, isDemo } from "@/lib/demo/mode";

/** A slim reminder at the top of the app while the demo workspace is open. */
export function DemoBanner() {
  // sessionStorage only exists in the browser, so decide after mount.
  const [on, setOn] = useState(false);
  useEffect(() => setOn(isDemo()), []);
  if (!on) return null;
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-brand/20 bg-accent px-4 py-2 text-[13px] text-ink sm:px-5 md:px-8"
    >
      <p className="min-w-0">
        <span className="font-medium">Demo workspace.</span>{" "}
        <span className="text-ink/65">
          Change anything you like; it resets when you close the tab.
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => exitDemo("/signup")}
          className="font-medium text-brand outline-none hover:underline focus-visible:underline"
        >
          Start free
        </button>
        <button
          type="button"
          onClick={() => exitDemo("/")}
          className="text-ink/60 outline-none hover:text-ink focus-visible:text-ink"
        >
          Leave demo
        </button>
      </div>
    </div>
  );
}
