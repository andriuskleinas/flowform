import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Form categories ("topics"). Each user owns their own list in
 * `form_categories`; forms point at one via `forms.category_id`.
 * Colour keys must match the CHECK constraint on form_categories.color.
 */
export const CATEGORY_COLORS = [
  "slate",
  "blue",
  "teal",
  "green",
  "amber",
  "orange",
  "red",
  "pink",
  "violet",
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const CATEGORY_NAME_MAX = 40;

/** Full class strings (not interpolated) so Tailwind keeps them. */
export const COLOR_CLASSES: Record<CategoryColor, { dot: string; tag: string; label: string }> = {
  slate: { dot: "bg-slate-500", tag: "bg-slate-500/10 text-slate-700", label: "Slate" },
  blue: { dot: "bg-blue-600", tag: "bg-blue-600/10 text-blue-700", label: "Blue" },
  teal: { dot: "bg-teal-500", tag: "bg-teal-500/10 text-teal-700", label: "Teal" },
  green: { dot: "bg-green-600", tag: "bg-green-600/10 text-green-700", label: "Green" },
  amber: { dot: "bg-amber-500", tag: "bg-amber-500/15 text-amber-800", label: "Amber" },
  orange: { dot: "bg-orange-500", tag: "bg-orange-500/10 text-orange-700", label: "Orange" },
  red: { dot: "bg-red-500", tag: "bg-red-500/10 text-red-700", label: "Red" },
  pink: { dot: "bg-pink-500", tag: "bg-pink-500/10 text-pink-700", label: "Pink" },
  violet: { dot: "bg-violet-500", tag: "bg-violet-500/10 text-violet-700", label: "Violet" },
};

export function colorClasses(color: string | null | undefined) {
  return COLOR_CLASSES[(color as CategoryColor) ?? "slate"] ?? COLOR_CLASSES.slate;
}

export type FormCategory = { id: string; name: string; color: CategoryColor };

export const categoriesKey = (userId: string) => ["form-categories", userId] as const;

export function useCategories(userId: string) {
  return useQuery({
    queryKey: categoriesKey(userId),
    queryFn: async (): Promise<FormCategory[]> => {
      const { data, error } = await supabase
        .from("form_categories")
        .select("id, name, color")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({ ...c, color: c.color as CategoryColor }));
    },
  });
}

/** Collapse whitespace the same way the DB CHECK expects (trimmed, ≤40). */
export function normalizeCategoryName(raw: string) {
  return raw.trim().replace(/\s+/g, " ").slice(0, CATEGORY_NAME_MAX);
}

/** Turn a unique-violation on (user_id, lower(name)) into a readable message. */
export function categoryErrorMessage(e: { code?: string; message?: string }, name?: string) {
  if (e.code === "23505") return `You already have a category called “${name ?? "that"}”.`;
  return e.message || "Couldn’t save the category. Try again.";
}

/** Next colour that isn't used yet, so new categories are easy to tell apart. */
export function suggestColor(existing: FormCategory[]): CategoryColor {
  const used = new Set(existing.map((c) => c.color));
  return CATEGORY_COLORS.find((c) => c !== "slate" && !used.has(c)) ?? "slate";
}

/** Invalidate everything that shows category names/colours. */
export function invalidateCategoryViews(qc: ReturnType<typeof useQueryClient>, userId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: categoriesKey(userId) }),
    qc.invalidateQueries({ queryKey: ["dashboard-forms", userId] }),
    qc.invalidateQueries({ queryKey: ["form-category"] }),
  ]);
}

export function useCreateCategory(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: CategoryColor }) => {
      const clean = normalizeCategoryName(name);
      const { data, error } = await supabase
        .from("form_categories")
        .insert({ name: clean, color })
        .select("id, name, color")
        .single();
      if (error)
        throw Object.assign(new Error(categoryErrorMessage(error, clean)), { code: error.code });
      return { ...data, color: data.color as CategoryColor } as FormCategory;
    },
    onSuccess: () => invalidateCategoryViews(qc, userId),
  });
}
