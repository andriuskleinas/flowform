import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProfileSection, SectionRow, btnDanger, btnSecondary } from "./section";

/** Everything the account owns, as one JSON file (GDPR-style export). */
async function exportAccount(userId: string, email: string) {
  const [profile, forms, categories, members] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, display_name, theme, created_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("forms").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("form_categories").select("name, color, created_at").eq("user_id", userId),
    supabase.rpc("get_workspace_members", { p_owner: userId }),
  ]);
  for (const r of [profile, forms, categories, members]) if (r.error) throw r.error;

  const formIds = (forms.data ?? []).map((f) => f.id);
  let questions: { form_id: string }[] = [];
  let responses: { form_id: string }[] = [];
  if (formIds.length) {
    const [q, r] = await Promise.all([
      supabase.from("questions").select("*").in("form_id", formIds).order("position"),
      supabase.from("responses").select("*").in("form_id", formIds).order("submitted_at"),
    ]);
    if (q.error) throw q.error;
    if (r.error) throw r.error;
    questions = q.data ?? [];
    responses = r.data ?? [];
  }
  const byForm = <T extends { form_id: string }>(rows: T[], id: string) =>
    rows.filter((r) => r.form_id === id);

  const payload = {
    exported_at: new Date().toISOString(),
    account: { email, ...profile.data },
    team: members.data,
    categories: categories.data,
    forms: (forms.data ?? []).map((f) => ({
      ...f,
      questions: byForm(questions, f.id),
      responses: byForm(responses, f.id),
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flowform-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { forms: formIds.length, responses: responses.length };
}

function DeleteAccountDialog({
  open,
  email,
  onOpenChange,
}: {
  open: boolean;
  email: string;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  const run = async () => {
    setDeleting(true);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      toast.error(error.message || "Couldn't delete the account");
      return;
    }
    // The user row is gone; clear the local session without a server call.
    await supabase.auth.signOut({ scope: "local" });
    qc.clear();
    toast.success("Your account and all its data were deleted");
    navigate({ to: "/" });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your profile, every form you own, their questions and all
            collected responses, and removes everyone from your team. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="block text-sm text-ink/70">
          Type <span className="font-mono text-ink">{email}</span> to confirm
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Type your email to confirm"
            className="mt-2 h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-ink outline-none focus:border-destructive/50 focus:ring-2 focus:ring-destructive/15"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <button
            type="button"
            disabled={!matches || deleting}
            onClick={run}
            className="inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-40"
          >
            {deleting ? "Deleting…" : "Delete account forever"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DataSection({ userId, email }: { userId: string; email: string }) {
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      const n = await exportAccount(userId, email);
      toast.success(`Exported ${n.forms} forms and ${n.responses} responses`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <ProfileSection
        id="data"
        title="Your data"
        description="It's yours — take it with you any time."
      >
        <SectionRow
          title="Export everything"
          description="One JSON file with your profile, team, categories, forms, questions and every response."
        >
          <button
            type="button"
            className={btnSecondary + " shrink-0"}
            onClick={onExport}
            disabled={exporting}
          >
            <Download className="size-4" />
            {exporting ? "Preparing…" : "Download export"}
          </button>
        </SectionRow>
      </ProfileSection>

      <ProfileSection id="danger" title="Danger zone" danger>
        <SectionRow
          title="Delete account"
          description="Permanently remove your account, your workspace and all of its data. Workspaces you're a member of are not affected."
        >
          <button
            type="button"
            className={btnDanger + " shrink-0"}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete account
          </button>
        </SectionRow>
      </ProfileSection>

      <DeleteAccountDialog open={deleteOpen} email={email} onOpenChange={setDeleteOpen} />
    </>
  );
}
