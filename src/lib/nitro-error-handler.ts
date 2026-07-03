import { toResponse, type H3Event } from "h3";
import { defineErrorHandler } from "nitro";

import { consumeLastCapturedError, reportError } from "./error-capture";
import { renderErrorPage } from "./error-page";

// h3 can swallow an in-handler throw into a generic JSON 500 body before it
// ever reaches request middleware — this is the last line of defense. For
// anything below 500 (404s, validation errors, etc.) defer to h3's own
// default response so normal error semantics are unaffected.
export default defineErrorHandler((error, event) => {
  const status = (error as { status?: number }).status ?? 500;
  if (status < 500) return toResponse(error, event as unknown as H3Event);

  const recovered = consumeLastCapturedError() ?? error;
  reportError(recovered, { source: "nitro-error-handler" });

  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
});
