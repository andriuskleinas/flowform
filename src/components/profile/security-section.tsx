import { useState } from "react";
import { Eye, EyeOff, KeyRound, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { ProfileSection, SectionRow, btnPrimary, btnSecondary } from "./section";

const MIN_PASSWORD = 6;

function formatDateTime(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The passwords don’t match.");
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) {
      setError(
        /different from the old/i.test(err.message)
          ? "Pick a password different from your current one."
          : err.message,
      );
      return;
    }
    toast.success("Password updated");
    onDone();
  };

  const field =
    "h-9 w-full rounded-md border border-input bg-card px-3 pr-9 text-sm text-ink outline-none placeholder:text-ink/40 focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

  return (
    <form onSubmit={submit} noValidate className="w-full space-y-3 md:max-w-sm">
      {/* Lets password managers attach the new password to the right account. */}
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          placeholder="New password"
          aria-label="New password"
          autoComplete="new-password"
          className={field}
          autoFocus
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-ink/40 hover:text-ink"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <input
        type={show ? "text" : "password"}
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          setError(null);
        }}
        placeholder="Confirm new password"
        aria-label="Confirm new password"
        autoComplete="new-password"
        className={field}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? "Updating…" : "Update password"}
        </button>
        <button type="button" className={btnSecondary} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function SecuritySection({ lastSignInAt }: { lastSignInAt: string | undefined }) {
  const [editingPassword, setEditingPassword] = useState(false);
  const [confirmOthers, setConfirmOthers] = useState(false);

  const signOutOthers = async () => {
    setConfirmOthers(false);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) toast.error(error.message);
    else toast.success("Logged out of every other device");
  };

  return (
    <ProfileSection id="security" title="Security" description="Keep your account locked down.">
      <SectionRow
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 text-ink/50" /> Password
          </span>
        }
        description={editingPassword ? undefined : "Change the password you use to log in."}
        className={cn(editingPassword && "md:items-start")}
      >
        {editingPassword ? (
          <PasswordForm onDone={() => setEditingPassword(false)} />
        ) : (
          <button type="button" className={btnSecondary} onClick={() => setEditingPassword(true)}>
            Change password
          </button>
        )}
      </SectionRow>
      <SectionRow
        title={
          <span className="flex items-center gap-2">
            <MonitorSmartphone className="size-4 text-ink/50" /> Sessions
          </span>
        }
        description={
          <>
            Last sign-in <span className="text-ink/75">{formatDateTime(lastSignInAt)}</span>. Lost a
            device? End every other session; this one stays logged in.
          </>
        }
      >
        <button
          type="button"
          className={btnSecondary + " shrink-0"}
          onClick={() => setConfirmOthers(true)}
        >
          Log out other devices
        </button>
      </SectionRow>

      <ConfirmDialog
        open={confirmOthers}
        title="Log out of other devices?"
        description="Every other browser and device logged in to this account will be logged out. You stay logged in here."
        confirmLabel="Sign them out"
        onConfirm={signOutOthers}
        onCancel={() => setConfirmOthers(false)}
      />
    </ProfileSection>
  );
}
