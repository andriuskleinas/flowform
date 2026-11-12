import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { LogoMark } from "@/components/logo";

/**
 * Short share link: /f/<first 8 characters of the form id> → /forms/<id>.
 * Shown under the QR code in live results mode, where a full UUID is too long
 * to read off a projector. Only published or closed forms resolve.
 */
export const Route = createFileRoute("/f/$code")({
  component: ShortLinkPage,
  head: () => ({ meta: [{ title: "Opening form — Flowform" }] }),
});

function ShortLinkPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("resolve_short_form_link", {
        p_code: code.toLowerCase(),
      });
      if (cancelled) return;
      if (error || !data) setMissing(true);
      else navigate({ to: "/forms/$formId", params: { formId: data }, replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
      <LogoMark className="size-9" />
      {missing ? (
        <>
          <h1 className="mt-5 font-display text-2xl text-ink">This link doesn’t lead anywhere</h1>
          <p className="mt-2 max-w-sm text-ink/60">
            The form may have been unpublished, or the link was mistyped. Check the address and try
            again.
          </p>
          <Link to="/" className="mt-6 text-brand underline">
            Go to Flowform
          </Link>
        </>
      ) : (
        <p className="mt-5 text-ink/60">Opening form…</p>
      )}
    </div>
  );
}
