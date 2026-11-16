/**
 * Database errors carry PostgREST codes and JWT jargon. Owners get a plain
 * sentence instead; the original is logged on the server.
 */
export function friendlyDbError(err: { code?: string; message?: string }): Error {
  console.error("Database error in a server function:", err);
  const auth =
    err.code === "PGRST301" ||
    err.code === "PGRST303" ||
    /jwt|token|key type/i.test(err.message ?? "");
  return new Error(
    auth
      ? "Your session has expired. Log in again and try once more."
      : "Couldn’t load the responses. Try again in a moment.",
  );
}
