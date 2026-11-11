-- Pending invitations for the signed-in user, with who they're from (the
-- invitee can't read the owner's profile directly).
CREATE OR REPLACE FUNCTION public.get_my_invites()
RETURNS TABLE (id uuid, owner_id uuid, role text, created_at timestamptz, owner_name text, owner_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.id, i.owner_id, i.role, i.created_at,
         NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
         u.email::text
  FROM public.workspace_invites i
  JOIN auth.users u ON u.id = i.owner_id
  LEFT JOIN public.profiles p ON p.id = i.owner_id
  WHERE auth.uid() IS NOT NULL
    AND i.email = lower(auth.jwt() ->> 'email')
  ORDER BY i.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_invites() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_invites() TO authenticated;
