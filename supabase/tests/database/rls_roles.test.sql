-- Row-level security for the four workspace roles (owner / admin / editor /
-- viewer), an outsider, and anonymous respondents.
-- Run with `supabase test db` (CI does this against a fresh local stack).

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(27);

-- ---------------------------------------------------------------------------
-- Fixtures (as the superuser, before any role switch)
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
VALUES
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.local', '{}'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', '{}'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editor@test.local', '{}'),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@test.local', '{}'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@test.local', '{}');

INSERT INTO public.workspace_members (owner_id, member_id, role) VALUES
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', 'admin'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003', 'editor'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000004', 'viewer');

INSERT INTO public.forms (id, user_id, title, status) VALUES
  ('f0000000-0000-4000-a000-00000000000d', '00000000-0000-4000-a000-000000000001', 'Draft form', 'draft'),
  ('f0000000-0000-4000-a000-00000000000f', '00000000-0000-4000-a000-000000000001', 'Live form', 'published');

INSERT INTO public.questions (id, form_id, type, label, position, required) VALUES
  ('a0000000-0000-4000-a000-000000000001', 'f0000000-0000-4000-a000-00000000000f', 'text', 'Name?', 0, false);

INSERT INTO public.responses (id, form_id, answers) VALUES
  ('b0000000-0000-4000-a000-000000000001', 'f0000000-0000-4000-a000-00000000000f',
   '{"a0000000-0000-4000-a000-000000000001": "Ada"}');

INSERT INTO public.response_sessions (id, form_id, answers, ip_hash) VALUES
  ('c0000000-0000-4000-a000-000000000001', 'f0000000-0000-4000-a000-00000000000f', '{}', 'x');

-- Act as a signed-in user for the rest of the transaction (until RESET ROLE).
CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reading forms: every role sees the workspace's draft, outsiders don't
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as('00000000-0000-4000-a000-000000000001');
SELECT is((SELECT count(*)::int FROM forms WHERE id = 'f0000000-0000-4000-a000-00000000000d'), 1, 'owner sees the draft form');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-4000-a000-000000000002');
SELECT is((SELECT count(*)::int FROM forms WHERE id = 'f0000000-0000-4000-a000-00000000000d'), 1, 'admin sees the draft form');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-4000-a000-000000000003');
SELECT is((SELECT count(*)::int FROM forms WHERE id = 'f0000000-0000-4000-a000-00000000000d'), 1, 'editor sees the draft form');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-4000-a000-000000000004');
SELECT is((SELECT count(*)::int FROM forms WHERE id = 'f0000000-0000-4000-a000-00000000000d'), 1, 'viewer sees the draft form');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-4000-a000-000000000005');
SELECT is((SELECT count(*)::int FROM forms WHERE id = 'f0000000-0000-4000-a000-00000000000d'), 0, 'outsider does not see the draft form');

-- ---------------------------------------------------------------------------
-- Responses and partial sessions: viewer and up only
-- ---------------------------------------------------------------------------

SELECT is((SELECT count(*)::int FROM responses), 0, 'outsider reads no responses');
SELECT is((SELECT count(*)::int FROM response_sessions), 0, 'outsider reads no partial sessions');
SELECT throws_ok(
  $$SELECT get_form_dropoff('f0000000-0000-4000-a000-00000000000f', 30, NULL)$$,
  '42501', NULL, 'outsider cannot read drop-off');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-4000-a000-000000000004');
SELECT is((SELECT count(*)::int FROM responses), 1, 'viewer reads the response');
SELECT is((SELECT count(*)::int FROM response_sessions), 1, 'viewer reads the partial session');
SELECT lives_ok(
  $$SELECT get_form_dropoff('f0000000-0000-4000-a000-00000000000f', 30, NULL)$$,
  'viewer can read drop-off');

-- ---------------------------------------------------------------------------
-- Writing forms and questions: editor and up
-- ---------------------------------------------------------------------------

SELECT results_eq(
  $$WITH u AS (UPDATE forms SET title = 'Viewer edit' WHERE id = 'f0000000-0000-4000-a000-00000000000d' RETURNING 1)
    SELECT count(*)::int FROM u$$,
  ARRAY[0], 'viewer cannot update a form');
SELECT throws_ok(
  $$INSERT INTO forms (user_id, title) VALUES ('00000000-0000-4000-a000-000000000001', 'By viewer')$$,
  '42501', NULL, 'viewer cannot create a form in the workspace');
SELECT throws_ok(
  $$INSERT INTO questions (form_id, type, label, position) VALUES ('f0000000-0000-4000-a000-00000000000d', 'text', 'Q', 0)$$,
  '42501', NULL, 'viewer cannot add a question');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-4000-a000-000000000003');
SELECT results_eq(
  $$WITH u AS (UPDATE forms SET title = 'Editor edit' WHERE id = 'f0000000-0000-4000-a000-00000000000d' RETURNING 1)
    SELECT count(*)::int FROM u$$,
  ARRAY[1], 'editor updates a form');
SELECT lives_ok(
  $$INSERT INTO forms (id, user_id, title) VALUES ('f0000000-0000-4000-a000-0000000000e1', '00000000-0000-4000-a000-000000000001', 'By editor')$$,
  'editor creates a form in the workspace');
SELECT lives_ok(
  $$INSERT INTO questions (form_id, type, label, position) VALUES ('f0000000-0000-4000-a000-00000000000d', 'text', 'Q', 0)$$,
  'editor adds a question');
SELECT results_eq(
  $$WITH d AS (DELETE FROM forms WHERE id = 'f0000000-0000-4000-a000-0000000000e1' RETURNING 1)
    SELECT count(*)::int FROM d$$,
  ARRAY[0], 'editor cannot delete a form');
SELECT results_eq(
  $$WITH u AS (UPDATE workspace_members SET role = 'admin' WHERE member_id = '00000000-0000-4000-a000-000000000004' RETURNING 1)
    SELECT count(*)::int FROM u$$,
  ARRAY[0], 'editor cannot change member roles');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Admin: delete forms, manage members
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as('00000000-0000-4000-a000-000000000002');
SELECT results_eq(
  $$WITH d AS (DELETE FROM forms WHERE id = 'f0000000-0000-4000-a000-0000000000e1' RETURNING 1)
    SELECT count(*)::int FROM d$$,
  ARRAY[1], 'admin deletes a form');
SELECT results_eq(
  $$WITH u AS (UPDATE workspace_members SET role = 'editor' WHERE member_id = '00000000-0000-4000-a000-000000000004' RETURNING 1)
    SELECT count(*)::int FROM u$$,
  ARRAY[1], 'admin changes a member role');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Owner: responses are permanent; sessions are written only via the RPC
-- ---------------------------------------------------------------------------

SELECT pg_temp.act_as('00000000-0000-4000-a000-000000000001');
SELECT results_eq(
  $$WITH d AS (DELETE FROM responses RETURNING 1) SELECT count(*)::int FROM d$$,
  ARRAY[0], 'even the owner cannot delete a response');
SELECT throws_ok(
  $$INSERT INTO response_sessions (id, form_id, ip_hash) VALUES (gen_random_uuid(), 'f0000000-0000-4000-a000-00000000000f', 'y')$$,
  '42501', NULL, 'clients cannot insert partial sessions directly');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Anonymous respondents: published forms only
-- ---------------------------------------------------------------------------

SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM forms WHERE id = 'f0000000-0000-4000-a000-00000000000f'), 1, 'anon sees the published form');
SELECT is((SELECT count(*)::int FROM forms WHERE id = 'f0000000-0000-4000-a000-00000000000d'), 0, 'anon does not see the draft');
SELECT is((SELECT count(*)::int FROM responses), 0, 'anon reads no responses');
RESET ROLE;

-- The progress RPC accepts anon writes for a published form only.
SET LOCAL ROLE anon;
SELECT lives_ok(
  $$SELECT save_response_progress('c0000000-0000-4000-a000-000000000002', 'f0000000-0000-4000-a000-00000000000f',
      '{"a0000000-0000-4000-a000-000000000001": "Grace", "not-a-question": 1}'::jsonb,
      'a0000000-0000-4000-a000-000000000001', '{}')$$,
  'anon saves progress on a published form');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
