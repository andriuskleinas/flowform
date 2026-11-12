import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell, AppShellSkeleton } from "@/components/app-shell";
import { isSigningOut } from "@/lib/sign-out";
import { ProfileSection, btnPrimary } from "@/components/profile/section";
import { AppearanceSection } from "@/components/profile/appearance-section";
import { PendingInvitations, RoleBadge, TeamSection } from "@/components/profile/team-section";
import { SecuritySection } from "@/components/profile/security-section";
import { DataSection } from "@/components/profile/data-section";
import { getInitialsFromProfile, cn } from "@/lib/utils";
import { useWorkspaces } from "@/lib/workspace";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Flowform" },
      { name: "description", content: "Manage your Flowform account, team and preferences." },
    ],
  }),
  component: ProfilePage,
});

const profileSchema = z.object({
  first_name: z.string().trim().max(50, "First name must be 50 characters or less"),
  last_name: z.string().trim().max(50, "Last name must be 50 characters or less"),
  email: z.string().trim().email("Invalid email address").max(255),
});

const NAV = [
  { id: "account", label: "Account" },
  { id: "appearance", label: "Appearance" },
  { id: "team", label: "Team" },
  { id: "security", label: "Security" },
  { id: "data", label: "Your data" },
  { id: "danger", label: "Danger zone" },
] as const;

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && !isSigningOut()) {
      navigate({ to: "/login", search: { redirect: "/profile" } });
    }
  }, [loading, user, navigate]);

  if (loading || !user) return <AppShellSkeleton width="md" />;

  return (
    <ProfileAuthed
      userId={user.id}
      email={user.email ?? ""}
      pendingEmail={user.new_email ?? null}
      createdAt={user.created_at}
      lastSignInAt={user.last_sign_in_at}
    />
  );
}

/** Highlights the nav entry for the section currently in view. */
function useActiveSection() {
  const [active, setActive] = useState<string>(NAV[0].id);
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

function ProfileAuthed({
  userId,
  email,
  pendingEmail,
  createdAt,
  lastSignInAt,
}: {
  userId: string;
  email: string;
  pendingEmail: string | null;
  createdAt: string | undefined;
  lastSignInAt: string | undefined;
}) {
  const queryClient = useQueryClient();
  const activeSection = useActiveSection();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_forms");
      if (error) throw error;
      const rows = data ?? [];
      return {
        forms: rows.length,
        live: rows.filter((r) => r.status === "published").length,
        responses: rows.reduce((n, r) => n + Number(r.response_count), 0),
      };
    },
  });

  const { data: workspaces = [] } = useWorkspaces(userId);
  const memberships = workspaces.filter((w) => w.role !== "owner");
  const myTeam = workspaces.find((w) => w.role === "owner");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailValue, setEmailValue] = useState(email);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated && !isLoading) {
      setFirstName(profile?.first_name ?? "");
      setLastName(profile?.last_name ?? "");
      setEmailValue(email);
      setHydrated(true);
    }
  }, [hydrated, isLoading, profile, email]);

  // Scroll to a hash target (e.g. /profile#invitations) once content exists.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView(), 300);
    return () => window.clearTimeout(t);
  }, []);

  const dirty =
    hydrated &&
    (firstName.trim() !== (profile?.first_name ?? "") ||
      lastName.trim() !== (profile?.last_name ?? "") ||
      emailValue.trim() !== email);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      email: emailValue,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSubmitting(true);
    try {
      const nameChanged =
        (parsed.data.first_name || null) !== (profile?.first_name ?? null) ||
        (parsed.data.last_name || null) !== (profile?.last_name ?? null);

      if (nameChanged) {
        const display = `${parsed.data.first_name} ${parsed.data.last_name}`.trim() || null;
        const { error } = await supabase
          .from("profiles")
          .update({
            first_name: parsed.data.first_name || null,
            last_name: parsed.data.last_name || null,
            display_name: display,
          })
          .eq("id", userId);
        if (error) throw error;
      }

      let emailNotice = false;
      if (parsed.data.email !== email) {
        const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
        if (error) throw error;
        emailNotice = true;
      }

      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });

      if (emailNotice) {
        toast.success("Confirmation email sent. Click the link to finish the change.");
      } else if (nameChanged) {
        toast.success("Profile updated");
      } else {
        toast.message("No changes to save");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t update your profile. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fullName = [profile?.first_name, profile?.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  const initials = getInitialsFromProfile(
    profile?.first_name,
    profile?.last_name,
    profile?.display_name,
    email,
  );

  return (
    <AppShell userId={userId} email={email} width="md">
      {/* Identity header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground"
        >
          {initials}
        </span>
        <div className="min-w-0">
          {isLoading ? (
            <Skeleton className="h-9 w-56" />
          ) : (
            <h1 className="font-display truncate text-[26px] leading-tight md:text-[28px]">
              {fullName || "Settings"}
            </h1>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink/55">
            <span className="truncate">{email}</span>
            <span aria-hidden>·</span>
            <span>Member since {formatDate(createdAt)}</span>
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-hairline bg-card sm:grid-cols-4">
        {[
          { label: "Forms", value: stats?.forms },
          { label: "Live now", value: stats?.live },
          { label: "Responses", value: stats?.responses },
          { label: "Teammates", value: myTeam?.member_count },
        ].map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "border-hairline p-4 md:p-5",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t sm:border-t-0",
              i === 2 && "sm:border-l",
            )}
          >
            <dt className="text-xs text-ink/55">{s.label}</dt>
            <dd className="mt-0.5 text-2xl font-medium tabular-nums tracking-tight text-ink">
              {s.value === undefined ? <Skeleton className="h-7 w-10" /> : s.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>

      {memberships.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink/55">
          Also a member of
          {memberships.map((w) => (
            <Link
              key={w.owner_id}
              to="/dashboard"
              search={{ ws: w.owner_id }}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card py-0.5 pl-2.5 pr-1 text-ink/75 hover:border-ink/25 hover:text-ink"
            >
              {w.owner_name || w.owner_email}
              <RoleBadge role={w.role} className="h-4" />
            </Link>
          ))}
        </p>
      )}

      <div className="mt-10 grid gap-10 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10">
        <nav aria-label="Profile sections" className="hidden md:block">
          <ul className="sticky top-20 space-y-0.5 lg:top-8">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  aria-current={activeSection === n.id ? "true" : undefined}
                  className={cn(
                    "block rounded-md border-l-2 px-3 py-1.5 text-sm transition-colors",
                    activeSection === n.id
                      ? "border-brand bg-brand/[0.06] font-medium text-ink"
                      : "border-transparent text-ink/55 hover:text-ink",
                    n.id === "danger" && activeSection !== n.id && "text-destructive/80",
                  )}
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-14">
          <PendingInvitations userId={userId} compact />

          <ProfileSection
            id="account"
            title="Account"
            description="Your name appears to teammates and in the dashboard greeting."
          >
            <form onSubmit={onSubmit} className="space-y-5 p-5 md:p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={50}
                    autoComplete="given-name"
                    placeholder="Jane"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={50}
                    autoComplete="family-name"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  maxLength={255}
                  autoComplete="email"
                  required
                />
                {pendingEmail ? (
                  <p className="text-xs text-brand">
                    Waiting for confirmation of <span className="font-medium">{pendingEmail}</span>{" "}
                    — check that inbox.
                  </p>
                ) : (
                  <p className="text-xs text-ink/50">
                    Changing your email requires confirmation from the new address.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-hairline pt-5">
                <button type="submit" disabled={submitting || !dirty} className={btnPrimary}>
                  {submitting ? "Saving…" : "Save changes"}
                </button>
                {dirty && !submitting && (
                  <span className="text-xs text-ink/50">You have unsaved changes</span>
                )}
              </div>
            </form>
          </ProfileSection>

          <AppearanceSection userId={userId} />
          <TeamSection userId={userId} />
          <SecuritySection lastSignInAt={lastSignInAt} />
          <DataSection userId={userId} email={email} />
        </div>
      </div>
    </AppShell>
  );
}
