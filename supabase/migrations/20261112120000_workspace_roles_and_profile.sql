-- Team access: every account is a workspace. Its owner can invite people as
-- admin, editor or viewer, and members work on the owner's forms.
--
--   viewer  read forms, questions, responses, analytics; export
--   editor  + create / edit / publish / close forms, manage categories
--   admin   + delete forms, invite and manage members
--   owner   + everything, incl. deleting the account (implicit, not a row)
--
-- Also: profiles.theme (light / dark / system) and a self-serve account
-- deletion RPC.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.workspace_members (
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, member_id),
  CHECK (owner_id <> member_id)
);
CREATE INDEX workspace_members_member_idx ON public.workspace_members (member_id);

CREATE TABLE public.workspace_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 255),
  role       text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, email)
);
CREATE INDEX workspace_invites_email_idx ON public.workspace_invites (email);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD COLUMN theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system'));

-- ---------------------------------------------------------------------------
-- Role helpers (private schema: not exposed through PostgREST)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.workspace_role(p_owner uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN p_owner = auth.uid() THEN 'owner'
    ELSE (
      SELECT m.role FROM public.workspace_members m
      WHERE m.owner_id = p_owner AND m.member_id = auth.uid()
    )
  END;
$$;

CREATE OR REPLACE FUNCTION private.has_role(p_owner uuid, p_min text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (CASE private.workspace_role(p_owner)
       WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1
     END)
    >=
    (CASE p_min WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'editor' THEN 2 ELSE 1 END),
    false
  );
$$;

REVOKE ALL ON FUNCTION private.workspace_role(uuid) FROM public;
REVOKE ALL ON FUNCTION private.has_role(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION private.workspace_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- forms / questions / responses / categories: owner-only -> role-based
-- ---------------------------------------------------------------------------

DROP POLICY "Users can view their own forms" ON public.forms;
DROP POLICY "Users can create their own forms" ON public.forms;
DROP POLICY "Users can update their own forms" ON public.forms;
DROP POLICY "Users can delete their own forms" ON public.forms;

CREATE POLICY "Workspace members can view forms" ON public.forms
  FOR SELECT TO authenticated USING (private.has_role(user_id, 'viewer'));
CREATE POLICY "Editors can create forms" ON public.forms
  FOR INSERT TO authenticated WITH CHECK (private.has_role(user_id, 'editor'));
CREATE POLICY "Editors can update forms" ON public.forms
  FOR UPDATE TO authenticated
  USING (private.has_role(user_id, 'editor'))
  WITH CHECK (private.has_role(user_id, 'editor'));
CREATE POLICY "Admins can delete forms" ON public.forms
  FOR DELETE TO authenticated USING (private.has_role(user_id, 'admin'));

-- A form never moves between workspaces (an editor of two workspaces could
-- otherwise re-home one).
CREATE OR REPLACE FUNCTION private.forms_owner_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A form cannot be moved to another workspace' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER forms_owner_immutable
  BEFORE UPDATE OF user_id ON public.forms
  FOR EACH ROW EXECUTE FUNCTION private.forms_owner_immutable();

DROP POLICY "Owners can view their questions" ON public.questions;
DROP POLICY "Owners can insert questions" ON public.questions;
DROP POLICY "Owners can update questions" ON public.questions;
DROP POLICY "Owners can delete questions" ON public.questions;

CREATE POLICY "Workspace members can view questions" ON public.questions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = questions.form_id AND private.has_role(f.user_id, 'viewer')));
CREATE POLICY "Editors can insert questions" ON public.questions
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = questions.form_id AND private.has_role(f.user_id, 'editor')));
CREATE POLICY "Editors can update questions" ON public.questions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = questions.form_id AND private.has_role(f.user_id, 'editor')))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = questions.form_id AND private.has_role(f.user_id, 'editor')));
CREATE POLICY "Editors can delete questions" ON public.questions
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = questions.form_id AND private.has_role(f.user_id, 'editor')));

DROP POLICY "Owners can view responses" ON public.responses;
CREATE POLICY "Workspace members can view responses" ON public.responses
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = responses.form_id AND private.has_role(f.user_id, 'viewer')));

DROP POLICY "Users can view their own categories" ON public.form_categories;
DROP POLICY "Users can create their own categories" ON public.form_categories;
DROP POLICY "Users can update their own categories" ON public.form_categories;
DROP POLICY "Users can delete their own categories" ON public.form_categories;

CREATE POLICY "Workspace members can view categories" ON public.form_categories
  FOR SELECT TO authenticated USING (private.has_role(user_id, 'viewer'));
CREATE POLICY "Editors can create categories" ON public.form_categories
  FOR INSERT TO authenticated WITH CHECK (private.has_role(user_id, 'editor'));
CREATE POLICY "Editors can update categories" ON public.form_categories
  FOR UPDATE TO authenticated
  USING (private.has_role(user_id, 'editor'))
  WITH CHECK (private.has_role(user_id, 'editor'));
CREATE POLICY "Editors can delete categories" ON public.form_categories
  FOR DELETE TO authenticated USING (private.has_role(user_id, 'editor'));

-- ---------------------------------------------------------------------------
-- Members + invites policies
-- ---------------------------------------------------------------------------

-- Anyone in a workspace sees who else is in it.
CREATE POLICY "Workspace members can view members" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (member_id = (SELECT auth.uid()) OR private.has_role(owner_id, 'viewer'));
-- Rows are only created by accept_workspace_invite().
CREATE POLICY "Admins can change member roles" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (private.has_role(owner_id, 'admin') AND member_id <> (SELECT auth.uid()))
  WITH CHECK (private.has_role(owner_id, 'admin') AND member_id <> (SELECT auth.uid()));
CREATE POLICY "Admins remove members, anyone can leave" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (private.has_role(owner_id, 'admin') OR member_id = (SELECT auth.uid()));

CREATE POLICY "Admins and invitees can view invites" ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (private.has_role(owner_id, 'admin')
         OR email = lower((SELECT auth.jwt()) ->> 'email'));
CREATE POLICY "Admins can create invites" ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(owner_id, 'admin') AND invited_by = (SELECT auth.uid()));
CREATE POLICY "Admins can change invites" ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (private.has_role(owner_id, 'admin'))
  WITH CHECK (private.has_role(owner_id, 'admin'));
CREATE POLICY "Admins revoke, invitees decline" ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (private.has_role(owner_id, 'admin')
         OR email = lower((SELECT auth.jwt()) ->> 'email'));

-- Inviting yourself or someone already in the workspace is a no-op mistake.
CREATE OR REPLACE FUNCTION private.check_workspace_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.owner_id AND lower(u.email) = NEW.email) THEN
    RAISE EXCEPTION 'That address owns this workspace' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.workspace_members m JOIN auth.users u ON u.id = m.member_id
    WHERE m.owner_id = NEW.owner_id AND lower(u.email) = NEW.email
  ) THEN
    RAISE EXCEPTION 'That person is already a member' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER check_workspace_invite
  BEFORE INSERT ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION private.check_workspace_invite();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv public.workspace_invites;
  my_email text := lower(auth.jwt() ->> 'email');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.workspace_invites
  WHERE id = p_invite_id AND email = my_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.workspace_members (owner_id, member_id, role, invited_by)
  VALUES (inv.owner_id, auth.uid(), inv.role, inv.invited_by)
  ON CONFLICT (owner_id, member_id) DO UPDATE SET role = EXCLUDED.role;

  DELETE FROM public.workspace_invites WHERE id = inv.id;
  RETURN inv.owner_id;
END;
$$;

-- Workspaces the caller can open: their own plus every membership.
CREATE OR REPLACE FUNCTION public.get_my_workspaces()
RETURNS TABLE (owner_id uuid, role text, owner_name text, owner_email text, form_count bigint, member_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH ws AS (
    SELECT auth.uid() AS owner_id, 'owner'::text AS role
    WHERE auth.uid() IS NOT NULL
    UNION ALL
    SELECT m.owner_id, m.role FROM public.workspace_members m WHERE m.member_id = auth.uid()
  )
  SELECT ws.owner_id,
         ws.role,
         NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), '') AS owner_name,
         u.email::text,
         (SELECT COUNT(*) FROM public.forms f WHERE f.user_id = ws.owner_id),
         (SELECT COUNT(*) FROM public.workspace_members m WHERE m.owner_id = ws.owner_id)
  FROM ws
  JOIN auth.users u ON u.id = ws.owner_id
  LEFT JOIN public.profiles p ON p.id = ws.owner_id
  ORDER BY (ws.role = 'owner') DESC, owner_name NULLS LAST;
$$;

-- Everyone in a workspace (owner first), with names + emails for the team list.
CREATE OR REPLACE FUNCTION public.get_workspace_members(p_owner uuid)
RETURNS TABLE (user_id uuid, role text, name text, email text, joined_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(p_owner, 'viewer') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, 'owner'::text,
         NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
         u.email::text, u.created_at
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_owner
  UNION ALL
  SELECT u.id, m.role,
         NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
         u.email::text, m.created_at
  FROM public.workspace_members m
  JOIN auth.users u ON u.id = m.member_id
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE m.owner_id = p_owner;
END;
$$;

-- Self-serve account deletion. Everything hangs off auth.users with
-- ON DELETE CASCADE (profile, forms -> questions/responses/events,
-- categories, memberships, invites).
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.accept_workspace_invite(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_my_workspaces() FROM public, anon;
REVOKE ALL ON FUNCTION public.get_workspace_members(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ---------------------------------------------------------------------------
-- Existing RPCs: owner checks -> role checks, plus a workspace parameter
-- ---------------------------------------------------------------------------

DROP FUNCTION public.get_dashboard_forms();
CREATE FUNCTION public.get_dashboard_forms(p_owner uuid DEFAULT NULL)
RETURNS TABLE(id uuid, title text, description text, created_at timestamptz, status text,
              category_id uuid, category text, category_color text, response_count bigint,
              question_count bigint, last_response_at timestamptz, responses_7d bigint,
              responses_90d bigint, views_90d bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    f.id, f.title, f.description, f.created_at, f.status, f.category_id,
    c.name, c.color, rs.total,
    (SELECT COUNT(*) FROM public.questions q WHERE q.form_id = f.id),
    rs.last_at, rs.d7, rs.d90, ev.views
  FROM public.forms f
  LEFT JOIN public.form_categories c ON c.id = f.category_id
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE r.submitted_at > now() - interval '7 days') AS d7,
           COUNT(*) FILTER (WHERE r.submitted_at > now() - interval '90 days') AS d90,
           MAX(r.submitted_at) AS last_at
    FROM public.responses r
    WHERE r.form_id = f.id
  ) rs
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS views
    FROM public.form_events e
    WHERE e.form_id = f.id AND e.kind = 'view' AND e.occurred_at > now() - interval '90 days'
  ) ev
  WHERE f.user_id = COALESCE(p_owner, auth.uid())
    AND private.has_role(COALESCE(p_owner, auth.uid()), 'viewer')
  ORDER BY f.created_at DESC;
$function$;
REVOKE ALL ON FUNCTION public.get_dashboard_forms(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_forms(uuid) TO authenticated;

DROP FUNCTION public.get_dashboard_summary(int);
CREATE FUNCTION public.get_dashboard_summary(p_days int DEFAULT 30, p_owner uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := COALESCE(p_owner, auth.uid());
  days int := LEAST(GREATEST(COALESCE(p_days, 30), 7), 365);
  win_start timestamptz := date_trunc('day', now()) - make_interval(days => days - 1);
  prev_start timestamptz := win_start - make_interval(days => days);
  result jsonb;
BEGIN
  IF uid IS NULL OR NOT private.has_role(uid, 'viewer') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  WITH my_forms AS (
    SELECT id FROM public.forms WHERE user_id = uid
  ),
  my_responses AS (
    SELECT r.form_id, r.submitted_at
    FROM public.responses r
    JOIN my_forms f ON f.id = r.form_id
  ),
  my_events AS (
    SELECT e.kind, e.occurred_at
    FROM public.form_events e
    JOIN my_forms f ON f.id = e.form_id
    WHERE e.occurred_at >= win_start AND e.kind IN ('view', 'start')
  )
  SELECT jsonb_build_object(
    'days', days,
    'total_responses', (SELECT COUNT(*) FROM my_responses),
    'responses_window', (SELECT COUNT(*) FROM my_responses WHERE submitted_at >= win_start),
    'responses_prev_window', (
      SELECT COUNT(*) FROM my_responses
      WHERE submitted_at >= prev_start AND submitted_at < win_start
    ),
    'views_window', (SELECT COUNT(*) FROM my_events WHERE kind = 'view'),
    'starts_window', (SELECT COUNT(*) FROM my_events WHERE kind = 'start'),
    'daily', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day::date, 'count', COALESCE(c.n, 0))
                                ORDER BY d.day), '[]'::jsonb)
      FROM generate_series(win_start, date_trunc('day', now()), interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', submitted_at) AS day, COUNT(*) AS n
        FROM my_responses
        WHERE submitted_at >= win_start
        GROUP BY 1
      ) c ON c.day = d.day
    )
  ) INTO result;

  RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_dashboard_summary(int, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(int, uuid) TO authenticated;

-- get_form_analytics + save_form_editor: swap the owner check for a role
-- check, bodies otherwise unchanged (patched in place from their definitions).
DO $$
DECLARE
  def text;
BEGIN
  def := pg_get_functiondef('public.get_form_analytics(uuid, int)'::regprocedure);
  def := replace(def,
    'SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND f.user_id = auth.uid()',
    'SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND private.has_role(f.user_id, ''viewer'')');
  IF position('private.has_role' in def) = 0 THEN
    RAISE EXCEPTION 'get_form_analytics owner check not found';
  END IF;
  EXECUTE def;

  def := pg_get_functiondef('public.save_form_editor(uuid, jsonb, jsonb)'::regprocedure);
  def := replace(def,
    'SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND f.user_id = auth.uid()',
    'SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND private.has_role(f.user_id, ''editor'')');
  IF position('private.has_role' in def) = 0 THEN
    RAISE EXCEPTION 'save_form_editor owner check not found';
  END IF;
  EXECUTE def;
END;
$$;
