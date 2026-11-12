import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { FormStatus } from "@/lib/form-utils";

/** One row of the forms list: a form plus its counts, from one RPC. */
export type DashboardForm = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  status: FormStatus;
  category_id: string | null;
  category: string | null;
  category_color: string | null;
  response_count: number;
  question_count: number;
  last_response_at: string | null;
  responses_7d: number;
  responses_90d: number;
  views_90d: number;
};

export const dashboardFormsKey = (ownerId: string) => ["dashboard-forms", ownerId] as const;

/**
 * Every form in a workspace with its response and question counts.
 *
 * One round-trip: the `get_dashboard_forms` Postgres RPC aggregates
 * server-side. Shared by the dashboard, the sidebar (category counts) and the
 * command palette, so they all read one cache entry.
 */
export function useDashboardForms(ownerId: string) {
  return useQuery({
    queryKey: dashboardFormsKey(ownerId),
    enabled: !!ownerId,
    // This list changes from other tabs and devices (publishing a form
    // elsewhere doesn't invalidate this cache here), so always treat it as
    // stale: window focus and remounts refetch instead of showing an old list.
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_forms", { p_owner: ownerId });
      if (error) throw error;
      // `bigint` columns may come back as strings from PostgREST for very
      // large counts; coerce to numbers so the render path stays simple.
      return (data ?? []).map(
        (r): DashboardForm => ({
          ...r,
          status: r.status as FormStatus,
          category_id: r.category_id ?? null,
          category: r.category ?? null,
          category_color: r.category_color ?? null,
          last_response_at: r.last_response_at ?? null,
          response_count: Number(r.response_count),
          question_count: Number(r.question_count),
          responses_7d: Number(r.responses_7d),
          responses_90d: Number(r.responses_90d),
          views_90d: Number(r.views_90d),
        }),
      );
    },
  });
}
