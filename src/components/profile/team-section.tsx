import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, LogOut, Mail, Minus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validateEmail } from "@/lib/auth-validation";
import { cn, getInitialsFromName, timeAgo } from "@/lib/utils";
import {
  INVITE_ROLES,
  ROLE_INFO,
  isWorkspaceRole,
  pendingInvitesKey,
  permissions,
  usePendingInvites,
  useWorkspaces,
  workspaceName,
  workspacesKey,
  type InviteRole,
  type WorkspaceRole,
} from "@/lib/workspace";
import { ProfileSection, btnPrimary, btnSecondary } from "./section";

function friendly(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : "";
  if (/duplicate key|workspace_invites_owner_id_email_key/i.test(msg))
    return "That address already has a pending invitation.";
  return msg || fallback;
}

export function RoleBadge({ role, className }: { role: WorkspaceRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm px-1.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        role === "owner" && "bg-ink text-paper",
        role === "admin" && "bg-brand/12 text-brand",
        role === "editor" && "bg-ink/[0.07] text-ink/75",
        role === "viewer" && "border border-hairline text-ink/55",
        className,
      )}
    >
      {ROLE_INFO[role].label}
    </span>
  );
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
      {getInitialsFromName(name || email.split("@")[0]) || "?"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Invitations addressed to me
// ---------------------------------------------------------------------------

export function PendingInvitations({
  userId,
  compact = false,
}: {
  userId: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const { data: invites = [] } = usePendingInvites(userId);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: pendingInvitesKey(userId) }),
      qc.invalidateQueries({ queryKey: workspacesKey(userId) }),
    ]);

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("accept_workspace_invite", { p_invite_id: id });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("You’ve joined the workspace");
      await refresh();
    },
    onError: (e) => toast.error(friendly(e, "Couldn’t accept the invitation")),
  });

  const decline = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.message("Invitation declined");
      await refresh();
    },
    onError: (e) => toast.error(friendly(e, "Couldn’t decline the invitation")),
  });

  if (invites.length === 0) return null;

  return (
    <div
      id="invitations"
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-xl border border-brand/30 bg-brand/[0.05]",
        compact ? "" : "mb-12",
      )}
    >
      {invites.map((inv) => {
        const who = inv.owner_name || inv.owner_email;
        return (
          <div
            key={inv.id}
            className="flex flex-col gap-3 border-t border-brand/15 p-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between md:px-5"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  <span className="font-medium">{who}</span> invited you to their workspace as{" "}
                  <span className="font-medium">{ROLE_INFO[inv.role].label.toLowerCase()}</span>.
                </p>
                <p className="mt-0.5 text-xs text-ink/55">
                  {ROLE_INFO[inv.role].summary} · {timeAgo(inv.created_at)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className={btnSecondary}
                disabled={decline.isPending || accept.isPending}
                onClick={() => decline.mutate(inv.id)}
              >
                Decline
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={accept.isPending || decline.isPending}
                onClick={() => accept.mutate(inv.id)}
              >
                <Check className="size-4" />
                Accept
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team management for one workspace
// ---------------------------------------------------------------------------

type Member = {
  user_id: string;
  role: WorkspaceRole;
  name: string | null;
  email: string;
  joined_at: string;
};

function TeamPanel({
  ownerId,
  userId,
  myRole,
}: {
  ownerId: string;
  userId: string;
  myRole: WorkspaceRole;
}) {
  const qc = useQueryClient();
  const { canManageTeam } = permissions(myRole);
  const membersKey = ["workspace-members", ownerId] as const;
  const invitesKey = ["workspace-invites", ownerId] as const;

  const members = useQuery({
    queryKey: membersKey,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase.rpc("get_workspace_members", { p_owner: ownerId });
      if (error) throw error;
      return (data ?? []).map((m) => ({ ...m, role: isWorkspaceRole(m.role) ? m.role : "viewer" }));
    },
  });

  const invites = useQuery({
    queryKey: invitesKey,
    enabled: canManageTeam,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_invites")
        .select("id, email, role, created_at")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("editor");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);

  const refreshTeam = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: membersKey }),
      qc.invalidateQueries({ queryKey: invitesKey }),
      qc.invalidateQueries({ queryKey: workspacesKey(userId) }),
    ]);

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workspace_invites").insert({
        owner_id: ownerId,
        email: email.trim().toLowerCase(),
        role,
        invited_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(`Invitation ready for ${email.trim()}`, {
        description: "It appears on their profile when they log in or sign up with that email.",
      });
      setEmail("");
      await refreshTeam();
    },
    onError: (e) => toast.error(friendly(e, "Couldn’t create the invitation")),
  });

  const changeRole = useMutation({
    mutationFn: async ({ memberId, next }: { memberId: string; next: InviteRole }) => {
      const { error } = await supabase
        .from("workspace_members")
        .update({ role: next })
        .eq("owner_id", ownerId)
        .eq("member_id", memberId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Role updated");
      await refreshTeam();
    },
    onError: (e) => toast.error(friendly(e, "Couldn’t change the role")),
  });

  const remove = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("owner_id", ownerId)
        .eq("member_id", memberId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setPendingRemove(null);
      toast.success("Removed from the workspace");
      await refreshTeam();
    },
    onError: (e) => toast.error(friendly(e, "Couldn’t remove that member")),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refreshTeam,
    onError: (e) => toast.error(friendly(e, "Couldn’t revoke the invitation")),
  });

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setEmailError(err);
    if (!err) invite.mutate();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile#invitations`);
      toast.success("Link copied. Send it with the invite.");
    } catch {
      toast.error("Couldn’t copy the link. Select it and copy it by hand.");
    }
  };

  return (
    <>
      {canManageTeam && (
        <form
          onSubmit={submitInvite}
          noValidate
          className="border-b border-hairline p-5 md:p-6"
          aria-label="Invite a teammate"
        >
          <p className="text-sm font-medium text-ink">Invite a teammate</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="name@company.com"
                aria-label="Email address"
                aria-invalid={!!emailError}
                autoComplete="off"
                maxLength={255}
                className={cn(
                  "h-9 w-full rounded-md border bg-card px-3 text-sm text-ink outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-brand/15",
                  emailError ? "border-destructive" : "border-input focus:border-brand/40",
                )}
              />
              {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
            </div>
            <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
              <SelectTrigger aria-label="Role" className="h-9 w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_INFO[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button type="submit" className={btnPrimary} disabled={invite.isPending}>
              <UserPlus className="size-4" />
              {invite.isPending ? "Inviting…" : "Invite"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink/50">{ROLE_INFO[role].summary}</p>
        </form>
      )}

      <ul aria-label="Members" className="divide-y divide-hairline">
        {members.isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 p-4 md:px-6">
              <span className="size-9 animate-pulse rounded-full bg-ink/[0.06]" />
              <span className="h-3 w-40 animate-pulse rounded bg-ink/[0.06]" />
            </li>
          ))}
        {members.data?.map((m) => {
          const isMe = m.user_id === userId;
          const editable = canManageTeam && m.role !== "owner" && !isMe;
          return (
            <li key={m.user_id} className="flex items-center gap-3 p-4 md:px-6">
              <Avatar name={m.name} email={m.email} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {m.name || m.email.split("@")[0]}
                  {isMe && <span className="ml-1.5 font-normal text-ink/45">(you)</span>}
                </p>
                <p className="truncate text-xs text-ink/55">{m.email}</p>
              </div>
              {editable ? (
                <div className="flex items-center gap-1">
                  <Select
                    value={m.role}
                    onValueChange={(v) =>
                      changeRole.mutate({ memberId: m.user_id, next: v as InviteRole })
                    }
                  >
                    <SelectTrigger
                      aria-label={`Role for ${m.email}`}
                      className="h-8 w-[6.5rem] text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {INVITE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_INFO[r].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setPendingRemove(m)}
                    aria-label={`Remove ${m.email}`}
                    title="Remove"
                    className="flex size-8 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <RoleBadge role={m.role} />
              )}
            </li>
          );
        })}
      </ul>

      {canManageTeam && (invites.data?.length ?? 0) > 0 && (
        <div className="border-t border-hairline p-5 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">
              Pending invitations{" "}
              <span className="font-mono text-xs text-ink/40">{invites.data!.length}</span>
            </p>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              <Copy className="size-3.5" />
              Copy join link
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {invites.data!.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 rounded-md border border-dashed border-hairline px-3 py-2"
              >
                <Mail className="size-4 shrink-0 text-ink/35" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink/80">{inv.email}</span>
                <span className="hidden text-xs text-ink/45 sm:inline">
                  {timeAgo(inv.created_at)}
                </span>
                {isWorkspaceRole(inv.role) && <RoleBadge role={inv.role} />}
                <button
                  type="button"
                  onClick={() => revoke.mutate(inv.id)}
                  disabled={revoke.isPending}
                  className="text-xs font-medium text-ink/50 hover:text-destructive"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        title={`Remove ${pendingRemove?.name || pendingRemove?.email || "member"}?`}
        description="They’ll lose access to every form and response in this workspace straight away. You can invite them again later."
        confirmLabel="Remove"
        destructive
        onConfirm={() => pendingRemove && remove.mutate(pendingRemove.user_id)}
        onCancel={() => setPendingRemove(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Permissions matrix
// ---------------------------------------------------------------------------

const MATRIX: { label: string; min: WorkspaceRole }[] = [
  { label: "View forms, responses & analytics", min: "viewer" },
  { label: "Export responses to CSV", min: "viewer" },
  { label: "Create, edit & publish forms", min: "editor" },
  { label: "Manage categories", min: "editor" },
  { label: "Delete forms", min: "admin" },
  { label: "Invite & manage teammates", min: "admin" },
  { label: "Delete the workspace (account)", min: "owner" },
];
const ORDER: WorkspaceRole[] = ["viewer", "editor", "admin", "owner"];

function PermissionMatrix() {
  return (
    <details className="group border-t border-hairline">
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-medium text-ink/70 hover:text-ink md:px-6 [&::-webkit-details-marker]:hidden">
        What can each role do?
        <span className="text-xs text-ink/40 group-open:hidden">Show</span>
        <span className="hidden text-xs text-ink/40 group-open:inline">Hide</span>
      </summary>
      <div className="overflow-x-auto px-5 pb-5 md:px-6">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-3 font-normal text-ink/45">Permission</th>
              {ORDER.map((r) => (
                <th key={r} className="px-2 py-2 text-center">
                  <RoleBadge role={r} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {MATRIX.map((row) => (
              <tr key={row.label}>
                <td className="py-2 pr-3 text-ink/75">{row.label}</td>
                {ORDER.map((r) => {
                  const ok = ORDER.indexOf(r) >= ORDER.indexOf(row.min);
                  return (
                    <td key={r} className="px-2 py-2 text-center">
                      {ok ? (
                        <Check className="mx-auto size-4 text-brand" aria-label="Allowed" />
                      ) : (
                        <Minus className="mx-auto size-4 text-ink/20" aria-label="Not allowed" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function TeamSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: workspaces = [] } = useWorkspaces(userId);
  const [active, setActive] = useState<string>(userId);
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);

  const others = workspaces.filter((w) => w.role !== "owner");
  const manageable = workspaces.filter((w) => permissions(w.role).canManageTeam);
  const activeWs = workspaces.find((w) => w.owner_id === active);
  const activeRole: WorkspaceRole = active === userId ? "owner" : (activeWs?.role ?? "viewer");

  const leave = useMutation({
    mutationFn: async (ownerId: string) => {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("owner_id", ownerId)
        .eq("member_id", userId);
      if (error) throw error;
    },
    onSuccess: async (_d, ownerId) => {
      setPendingLeave(null);
      if (active === ownerId) setActive(userId);
      toast.success("You left the workspace");
      await qc.invalidateQueries({ queryKey: workspacesKey(userId) });
    },
    onError: (e) => toast.error(friendly(e, "Couldn’t leave the workspace")),
  });

  const leaving = others.find((w) => w.owner_id === pendingLeave);

  return (
    <ProfileSection
      id="team"
      title="Team"
      description="Invite people and choose what they can do. The database enforces it, not just the buttons."
    >
      {manageable.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-4 md:px-6">
          <span className="text-xs text-ink/50">Managing</span>
          {manageable.map((w) => (
            <button
              key={w.owner_id}
              type="button"
              onClick={() => setActive(w.owner_id)}
              aria-pressed={active === w.owner_id}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-3 text-xs transition-colors",
                active === w.owner_id
                  ? "border-ink bg-ink text-paper"
                  : "border-hairline text-ink/70 hover:border-ink/25 hover:text-ink",
              )}
            >
              {workspaceName(w)}
            </button>
          ))}
        </div>
      )}

      <TeamPanel key={active} ownerId={active} userId={userId} myRole={activeRole} />
      <PermissionMatrix />

      {others.length > 0 && (
        <div className="border-t border-hairline p-5 md:p-6">
          <p className="text-sm font-medium text-ink">Workspaces you belong to</p>
          <ul className="mt-3 space-y-2">
            {others.map((w) => (
              <li
                key={w.owner_id}
                className="flex flex-col gap-3 rounded-lg border border-hairline p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="truncate">{workspaceName(w)}</span>
                    <RoleBadge role={w.role} />
                  </p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {w.form_count} {w.form_count === 1 ? "form" : "forms"} · {w.member_count + 1}{" "}
                    people
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to="/dashboard" search={{ ws: w.owner_id }} className={btnSecondary}>
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingLeave(w.owner_id)}
                    className={btnSecondary + " text-ink/70"}
                  >
                    <LogOut className="size-4" />
                    Leave
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={pendingLeave !== null}
        title={`Leave ${leaving ? workspaceName(leaving) : "this workspace"}?`}
        description="You’ll lose access to its forms and responses. An admin can invite you back."
        confirmLabel="Leave workspace"
        destructive
        onConfirm={() => pendingLeave && leave.mutate(pendingLeave)}
        onCancel={() => setPendingLeave(null)}
      />
    </ProfileSection>
  );
}
