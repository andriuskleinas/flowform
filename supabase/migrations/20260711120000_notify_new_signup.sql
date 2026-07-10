-- Notify the owner via Slack when a new user confirms their email (not on
-- raw signup, so unconfirmed/bot attempts don't create noise). The webhook
-- URL lives in Supabase Vault (`slack_signup_webhook_url`), never in a
-- migration file, since this repo may go public.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_new_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  webhook_url text;
BEGIN
  SELECT decrypted_secret INTO webhook_url
  FROM vault.decrypted_secrets
  WHERE name = 'slack_signup_webhook_url'
  LIMIT 1;

  IF webhook_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := webhook_url,
    body := jsonb_build_object(
      'text', format('New Flowform signup: %s', NEW.email)
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_new_signup() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_new_signup();
