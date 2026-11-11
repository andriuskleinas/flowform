-- Responses are an immutable record: owners can no longer delete individual
-- responses. Dropping the DELETE policy leaves RLS denying it for every client
-- role. Deleting a whole form still removes its responses — ON DELETE CASCADE
-- runs as a system trigger and is not subject to RLS.
DROP POLICY IF EXISTS "Owners can delete responses" ON public.responses;
