-- Live results / presenter mode streams new responses over Supabase Realtime.
--
-- postgres_changes evaluates RLS for each subscriber, so only workspace
-- members (the existing "Workspace members can view responses" policy) ever
-- receive a row; anonymous respondents can't read responses and get nothing.
ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;
