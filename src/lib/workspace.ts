import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Team access. Every account is a workspace; its owner invites people as
 * admin / editor / viewer. The database enforces all of this (RLS +
 * `private.has_role`) — these helpers only decide what the UI offers.
 */
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
export type InviteRole = Exclude<WorkspaceRole, "owner">;

export const INVITE_ROLES: InviteRole[] = ["admin", "editor", "viewer"];

const RANK: Record<WorkspaceRole, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export const ROLE_INFO: Record<WorkspaceRole, { label: string; summary: string }> = {
  owner: { label: "Owner", summary: "Full control, including the team and the account itself." },
  admin: {
    label: "Admin",
    summary: "Everything an editor can do, plus deleting forms and managing the team.",
  },
  editor: { label: "Editor", summary: "Create, edit, publish and close forms; manage categories." },
  viewer: { label: "Viewer", summary: "Read-only: forms, responses, analytics and CSV export." },
};

export function isWorkspaceRole(v: unknown): v is WorkspaceRole {
  return v === "owner" || v === "admin" || v === "editor" || v === "viewer";
}

export function atLeast(role: WorkspaceRole | null | undefined, min: WorkspaceRole) {
  return !!role && RANK[role] >= RANK[min];
}

/** What a role may do in the UI. Mirrors the RLS policies. */
export function permissions(role: WorkspaceRole | null | undefined) {
  return {
    canView: atLeast(role, "viewer"),
    canEdit: atLeast(role, "editor"),
    canDelete: atLeast(role, "admin"),
    canManageTeam: atLeast(role, "admin"),
  };
}

export type Workspace = {
  owner_id: string;
  role: WorkspaceRole;
  owner_name: string | null;
  owner_email: string;
  form_count: number;
  member_count: number;
};

export const workspacesKey = (userId: string) => ["workspaces", userId] as const;

export function useWorkspaces(userId: string) {
  return useQuery({
    queryKey: workspacesKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Workspace[]> => {
      const { data, error } = await supabase.rpc("get_my_workspaces");
      if (error) throw error;
      return (data ?? []).map((w) => ({
        ...w,
        role: isWorkspaceRole(w.role) ? w.role : "viewer",
        form_count: Number(w.form_count),
        member_count: Number(w.member_count),
      }));
    },
  });
}

/** The caller's role in `ownerId`'s workspace (null while loading / none). */
export function useWorkspaceRole(userId: string, ownerId: string | null | undefined) {
  const q = useWorkspaces(userId);
  if (!ownerId) return { role: null, isLoading: q.isLoading };
  if (ownerId === userId) return { role: "owner" as const, isLoading: false };
  const ws = q.data?.find((w) => w.owner_id === ownerId);
  return { role: ws?.role ?? null, isLoading: q.isLoading || q.isPending };
}

export function workspaceName(w: Pick<Workspace, "owner_name" | "owner_email" | "role">) {
  if (w.role === "owner") return "My workspace";
  const who = w.owner_name?.trim() || w.owner_email.split("@")[0];
  return `${who}'s workspace`;
}

export type PendingInvite = {
  id: string;
  owner_id: string;
  role: InviteRole;
  created_at: string;
  owner_name: string | null;
  owner_email: string;
};

export const pendingInvitesKey = (userId: string) => ["pending-invites", userId] as const;

/** Invitations addressed to the signed-in user's email. */
export function usePendingInvites(userId: string) {
  return useQuery({
    queryKey: pendingInvitesKey(userId),
    queryFn: async (): Promise<PendingInvite[]> => {
      const { data, error } = await supabase.rpc("get_my_invites");
      if (error) throw error;
      return (data ?? []).map((i) => ({
        ...i,
        role: (INVITE_ROLES as string[]).includes(i.role) ? (i.role as InviteRole) : "viewer",
      }));
    },
  });
}
