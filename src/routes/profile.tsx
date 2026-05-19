import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Flowform" },
      { name: "description", content: "Manage your Flowform account details." },
    ],
  }),
  component: ProfilePage,
});

const profileSchema = z.object({
  first_name: z.string().trim().max(50, "First name must be 50 characters or less"),
  last_name: z.string().trim().max(50, "Last name must be 50 characters or less"),
  email: z.string().trim().email("Invalid email address").max(255),
});

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
    if (!loading && !user) {
      navigate({ to: "/login", search: { redirect: "/profile" } });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface text-ink">
        <div className="mx-auto max-w-2xl px-6 py-16 md:px-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      </div>
    );
  }

  return <ProfileAuthed userId={user.id} email={user.email ?? ""} createdAt={user.created_at} />;
}

function ProfileAuthed({
  userId,
  email,
  createdAt,
}: {
  userId: string;
  email: string;
  createdAt: string | undefined;
}) {
  const queryClient = useQueryClient();

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
        toast.success("Confirmation email sent. Click the link to finalize the change.");
      } else if (nameChanged) {
        toast.success("Profile updated");
      } else {
        toast.message("No changes to save");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-ink/5">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <span className="size-3 rounded-sm bg-white" />
            </span>
            <span className="text-xl font-bold tracking-tight">Flowform</span>
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-10 md:px-8 md:pt-14">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Profile</h1>
        <p className="mt-3 text-base text-ink/60 md:text-lg">Manage your account details.</p>

        <p className="mt-2 text-sm text-ink/50">
          Account created on{" "}
          <span className="font-medium text-ink/70">{formatDate(createdAt)}</span>
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">Name</Label>
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
              <Label htmlFor="last_name">Surname</Label>
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
            <p className="text-xs text-ink/50">
              Changing your email requires confirmation from the new address.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !hydrated}
            className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:opacity-50 md:w-auto"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </form>
      </main>
    </div>
  );
}
