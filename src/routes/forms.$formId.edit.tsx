import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Eye,
  GitBranchPlus,
  GripVertical,
  Loader2,
  Lock,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { suggestQuestions, type SuggestedQuestion } from "@/lib/suggest-questions";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuestionRender, type Question, type QuestionType } from "@/components/question-render";
import {
  type QuestionOptions,
  type QuestionLogic,
  type Answers,
  type DisplayMode,
  type FormStatus,
  DEFAULT_FORM_TITLE,
  JUMP_TO_END,
  QUESTION_TYPE_LABELS,
  RATING_MAX_CHOICES,
  defaultOptionsForType,
  getChoiceConfig,
  getRatingMax,
  logicEqual,
  questionOptionsEqual,
  computeVisiblePath,
} from "@/lib/form-utils";
import { ConversationalForm } from "@/components/conversational-form";
import { FormSettingsPanel } from "@/components/form-settings-panel";
import {
  SCORABLE_TYPES,
  buildRecallVars,
  ensureFontLoaded,
  isValidKey,
  maxScore,
  parseFormSettings,
  parsePoints,
  placeholderKeys,
  recallText,
  scoringChoices,
  serializeFormSettings,
  settingsEqual,
  themeStyle,
  toKey,
  type FormSettings,
} from "@/lib/form-settings";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DeleteFormDialog } from "@/components/delete-form-dialog";
import { permissions, useWorkspaceRole } from "@/lib/workspace";
import { ShareFormDialog } from "@/components/share-form-dialog";
import { AppShell, AppShellSkeleton } from "@/components/app-shell";
import { FormHeader, actionPrimary, actionSecondary } from "@/components/form-header";
import { isSigningOut } from "@/lib/sign-out";
import { CategoryField } from "@/components/dashboard/category-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forms/$formId/edit")({
  component: EditFormPage,
});

function EditFormPage() {
  const { formId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && !isSigningOut())
      navigate({ to: "/login", search: { redirect: `/forms/${formId}/edit` } });
  }, [loading, user, navigate, formId]);

  if (loading || !user) return <AppShellSkeleton />;

  // Keyed by form: "Edit a copy" navigates editor → editor, and the copy must
  // not inherit the original's draft state.
  return <EditFormAuthed key={formId} formId={formId} userId={user.id} email={user.email ?? ""} />;
}

type DraftQuestion = Question & { isNew?: boolean; isDeleted?: boolean };

type DraftFormState = {
  title: string;
  description: string | null;
  display_mode: DisplayMode;
  thank_you_message: string | null;
  settings: FormSettings;
};

function snapshotKey(
  form: DraftFormState,
  questions: Array<
    Pick<
      Question,
      | "id"
      | "type"
      | "label"
      | "options"
      | "required"
      | "logic"
      | "ai_follow_up"
      | "recall_key"
      | "points"
    >
  >,
) {
  return JSON.stringify({
    title: form.title.trim(),
    description: (form.description ?? "").trim(),
    display_mode: form.display_mode,
    thank_you_message: (form.thank_you_message ?? "").trim(),
    settings: serializeFormSettings(form.settings),
    questions: questions.map((q) => ({
      recall_key: q.recall_key || null,
      points: q.points ?? null,
      id: q.id,
      type: q.type,
      label: q.label.trim(),
      options: q.options ?? null,
      required: q.required,
      logic: q.logic ?? null,
      ai_follow_up: !!q.ai_follow_up,
    })),
  });
}

function toSnapshot(
  sf: {
    title: string;
    description: string | null;
    display_mode: string;
    thank_you_message: string | null;
    settings?: unknown;
  },
  questions: Question[],
): { form: DraftFormState; questions: Question[] } {
  return {
    form: {
      title: sf.title === DEFAULT_FORM_TITLE ? "" : sf.title,
      description: sf.description ?? null,
      display_mode: sf.display_mode as DisplayMode,
      thank_you_message: sf.thank_you_message ?? null,
      settings: parseFormSettings(sf.settings),
    },
    questions,
  };
}

function EditFormAuthed({
  formId,
  userId,
  email,
}: {
  formId: string;
  userId: string;
  email: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Always refetch on open: the editor's lock depends on the live status,
  // which may have changed elsewhere (dashboard, another tab).
  const formQ = useQuery({
    queryKey: ["form", formId],
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select(
          "id, title, description, user_id, status, display_mode, thank_you_message, category_id, version, copied_from, settings",
        )
        .eq("id", formId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Team access: owner/admin/editor may edit; viewers get sent to responses.
  const formOwner = formQ.data?.user_id;
  const { role, isLoading: roleLoading } = useWorkspaceRole(userId, formOwner);
  const can = permissions(role);
  const dashboardSearch = formOwner && formOwner !== userId ? { ws: formOwner } : {};

  const questionsQ = useQuery({
    queryKey: ["questions", formId],
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select(
          "id, form_id, type, label, options, position, required, logic, ai_follow_up, recall_key, points",
        )
        .eq("form_id", formId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((q) => ({ ...q, points: parsePoints(q.points) })) as Question[];
    },
  });

  // Local draft state — server-truth is mirrored in `snapshot`.
  const [snapshot, setSnapshot] = useState<{
    form: DraftFormState;
    questions: Question[];
  } | null>(null);
  const [draftForm, setDraftForm] = useState<DraftFormState>({
    title: "",
    description: null,
    display_mode: "conversational",
    thank_you_message: null,
    settings: {},
  });
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Answers>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Below xl the questions and the form settings are two views of this page.
  const [pane, setPane] = useState<"questions" | "settings">("questions");
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  // After a copy goes live: offer to close the survey it was copied from.
  const [closeOriginal, setCloseOriginal] = useState<{ id: string; title: string } | null>(null);
  // AI question suggestions (moved here from /forms/new so it's available for
  // any form, and the editor is the single canonical builder).
  const [suggestions, setSuggestions] = useState<SuggestedQuestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addedSuggestionIds, setAddedSuggestionIds] = useState<Set<string>>(new Set());
  const [isSuggesting, startSuggesting] = useTransition();
  // Once the form is deleted, unsaved-changes blocking must not trap the
  // redirect to the dashboard.
  const deletedRef = useRef(false);
  // Adding an AI suggestion appends a question card *above* the suggestions
  // panel, which shifts the panel and scrolls the clicked row out of view.
  // We stash the row's pre-add viewport position and restore it after layout
  // so the list stays put and the user can keep clicking "Add".
  const scrollAnchorRef = useRef<{ el: HTMLElement; top: number } | null>(null);

  const resetDraftTo = (snap: { form: DraftFormState; questions: Question[] }) => {
    setSnapshot(snap);
    setDraftForm(snap.form);
    setDraftQuestions(snap.questions.map((q) => ({ ...q })));
  };

  // Initialize / re-sync draft from server when (a) we don't have one yet,
  // or (b) the server snapshot changed AND the user has no unsaved changes.
  // Build the draft only from data fetched since this editor opened, never
  // from an older cache entry.
  const ready = formQ.isFetchedAfterMount && questionsQ.isFetchedAfterMount;
  useEffect(() => {
    const sf = formQ.data;
    if (!sf || !ready) return;
    const sq = questionsQ.data ?? [];
    const newSnap = toSnapshot(sf, sq);
    if (!snapshot) {
      resetDraftTo(newSnap);
      return;
    }
    const visibleDraft = draftQuestions.filter((q) => !q.isDeleted);
    const draftMatchesOldSnap =
      snapshotKey(draftForm, visibleDraft) === snapshotKey(snapshot.form, snapshot.questions) &&
      !draftQuestions.some((q) => q.isNew);
    const serverChanged =
      snapshotKey(snapshot.form, snapshot.questions) !==
      snapshotKey(newSnap.form, newSnap.questions);
    if (serverChanged && draftMatchesOldSnap) {
      resetDraftTo(newSnap);
    } else if (serverChanged && !draftMatchesOldSnap) {
      // Keep user's edits; just update snapshot reference for future diffs.
      setSnapshot(newSnap);
    }
    // `snapshot === null` re-runs this whenever the draft is missing while data
    // is present, so the editor can never sit on its loading skeleton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formQ.data, questionsQ.data, ready, snapshot === null]);

  const visibleDraftQuestions = draftQuestions.filter((q) => !q.isDeleted);
  // Preview fills {placeholders} from preview answers; hidden fields show as
  // their own name so the owner can see where link values will appear.
  const previewRecallVars = buildRecallVars(
    visibleDraftQuestions,
    previewAnswers,
    Object.fromEntries((draftForm.settings.hidden_fields ?? []).map((f) => [f, `[${f}]`])),
  );
  useEffect(() => {
    ensureFontLoaded(draftForm.settings.theme?.font);
  }, [draftForm.settings.theme?.font]);

  // Compensate the scroll shift after a question is added (see scrollAnchorRef).
  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    scrollAnchorRef.current = null;
    // Re-pin the clicked row to its pre-add viewport position. `behavior:
    // "instant"` overrides the global `scroll-behavior: smooth`, so the
    // correction is a silent jump-free snap, not an animation.
    const pin = () => {
      const delta = anchor.el.getBoundingClientRect().top - anchor.top;
      if (delta !== 0) window.scrollBy({ top: delta, behavior: "instant" });
    };
    // First pass runs before paint (cancels the main insert shift); the rAF
    // pass absorbs any late reflow — a card's async render, dnd-kit re-measuring
    // — that would otherwise nudge the list after the frame paints.
    pin();
    const raf = requestAnimationFrame(pin);
    return () => cancelAnimationFrame(raf);
  }, [visibleDraftQuestions.length]);

  const isDirty = useMemo(() => {
    if (!snapshot) return false;
    if (draftForm.title !== snapshot.form.title) return true;
    if ((draftForm.description ?? null) !== (snapshot.form.description ?? null)) return true;
    if (draftForm.display_mode !== snapshot.form.display_mode) return true;
    if ((draftForm.thank_you_message ?? null) !== (snapshot.form.thank_you_message ?? null))
      return true;
    if (!settingsEqual(draftForm.settings, snapshot.form.settings)) return true;
    if (visibleDraftQuestions.length !== snapshot.questions.length) return true;
    for (let i = 0; i < visibleDraftQuestions.length; i++) {
      const v = visibleDraftQuestions[i];
      const s = snapshot.questions[i];
      if (v.isNew) return true;
      if (v.id !== s.id) return true;
      if (v.type !== s.type) return true;
      if (v.label !== s.label) return true;
      if (v.required !== s.required) return true;
      if (!!v.ai_follow_up !== !!s.ai_follow_up) return true;
      if ((v.recall_key || null) !== (s.recall_key || null)) return true;
      if (JSON.stringify(v.points ?? null) !== JSON.stringify(s.points ?? null)) return true;
      if (!questionOptionsEqual(v.options ?? null, s.options ?? null)) return true;
      if (!logicEqual(v.logic, s.logic)) return true;
    }
    return false;
  }, [draftForm, visibleDraftQuestions, snapshot]);

  // Block in-app navigation away while there are unsaved changes.
  // `withResolver: true` returns { status, proceed, reset } so we can drive
  // the confirm dialog below; without it the hook returns void.
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty && !deletedRef.current,
    enableBeforeUnload: isDirty,
    withResolver: true,
  });

  /* ----------------------------- Local mutators ---------------------------- */

  const setDraftLabel = (id: string, label: string) =>
    setDraftQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, label } : q)));
  const setDraftOptions = (id: string, options: QuestionOptions) =>
    setDraftQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, options } : q)));
  const setDraftType = (id: string, type: QuestionType) =>
    setDraftQuestions((qs) =>
      qs.map((q) =>
        q.id === id && q.type !== type
          ? // A type change invalidates choice-keyed jump rules along with options.
            {
              ...q,
              type,
              options: defaultOptionsForType(type),
              logic: null,
              points: null,
              // Follow-ups only exist for open-text questions.
              ai_follow_up: (type === "text" || type === "long_text") && !!q.ai_follow_up,
            }
          : q,
      ),
    );
  const setDraftRequired = (id: string, required: boolean) =>
    setDraftQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, required } : q)));
  const setDraftAiFollowUp = (id: string, ai_follow_up: boolean) =>
    setDraftQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ai_follow_up } : q)));
  const setDraftRecallKey = (id: string, recall_key: string | null) =>
    setDraftQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, recall_key } : q)));
  const setDraftPoints = (id: string, points: Record<string, number> | null) =>
    setDraftQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, points } : q)));
  const setDraftSettings = (settings: FormSettings) => setDraftForm((f) => ({ ...f, settings }));
  const setDraftLogic = (id: string, logic: QuestionLogic) =>
    setDraftQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, logic } : q)));
  const addDraftQuestion = (type: QuestionType) =>
    setDraftQuestions((qs) => [
      ...qs,
      {
        id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
        form_id: formId,
        type,
        label: "",
        options: defaultOptionsForType(type),
        position: qs.length,
        required: true,
        logic: null,
        isNew: true,
      },
    ]);
  const handleSuggest = () => {
    setSuggestError(null);
    startSuggesting(async () => {
      try {
        const results = await suggestQuestions({
          data: { title: draftForm.title, description: draftForm.description ?? "" },
        });
        setSuggestions(results);
        setAddedSuggestionIds(new Set());
      } catch (err: unknown) {
        setSuggestError(
          err instanceof Error ? err.message : "Claude couldn’t draft questions. Try again.",
        );
      }
    });
  };
  const addSuggestion = (s: SuggestedQuestion) => {
    setDraftQuestions((qs) => [
      ...qs,
      {
        id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
        form_id: formId,
        type: s.type,
        label: s.label,
        options: s.options,
        position: qs.length,
        required: true,
        logic: null,
        isNew: true,
      },
    ]);
    setAddedSuggestionIds((prev) => new Set(prev).add(s.id));
  };
  const duplicateDraftQuestion = (id: string) =>
    setDraftQuestions((qs) => {
      const idx = qs.findIndex((q) => q.id === id);
      if (idx < 0) return qs;
      const src = qs[idx];
      // Jump rules are copied as-is: the duplicate sits right after the
      // original, so forward-only targets remain valid (save re-sanitizes).
      const copy: DraftQuestion = {
        ...src,
        id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
        logic: src.logic ? JSON.parse(JSON.stringify(src.logic)) : null,
        recall_key: null,
        points: src.points ? { ...src.points } : null,
        options: src.options ? JSON.parse(JSON.stringify(src.options)) : null,
        isNew: true,
        isDeleted: false,
      };
      return [...qs.slice(0, idx + 1), copy, ...qs.slice(idx + 1)];
    });
  const removeDraftQuestion = (id: string) =>
    setDraftQuestions((qs) =>
      qs
        .map((q) => (q.id === id ? { ...q, isDeleted: true } : q))
        // Drop tmp/new questions entirely; keep server rows so they can be deleted on save.
        .filter((q) => !(q.isNew && q.isDeleted)),
    );
  const reorderDraft = (next: DraftQuestion[]) => setDraftQuestions(next);

  /* ---------------------------------- Save --------------------------------- */

  const saveAll = useMutation({
    mutationFn: async () => {
      if (!snapshot) throw new Error("Not loaded yet");

      const visible = draftQuestions.filter((q) => !q.isDeleted);

      // Drop jump rules that no longer make sense: unknown choices, targets
      // that aren't later questions, or targets that are unsaved (tmp) rows.
      // Sanitized here (needs choice configs + draft order); the RPC stores
      // the result as-is.
      const sanitizeLogic = (q: DraftQuestion, i: number): QuestionLogic => {
        const jumps = q.logic?.jumps;
        if (!jumps) return null;
        const cfg = getChoiceConfig(q.options);
        const eligible =
          q.type === "dropdown" ||
          q.type === "yes_no" ||
          (q.type === "multiple_choice" && !cfg.multi);
        if (!eligible) return null;
        const choices = q.type === "yes_no" ? ["Yes", "No"] : cfg.choices;
        const laterIds = new Set(
          visible
            .slice(i + 1)
            .filter((v) => !v.isNew)
            .map((v) => v.id),
        );
        const clean: Record<string, string> = {};
        for (const [choice, target] of Object.entries(jumps)) {
          if (!choices.includes(choice)) continue;
          if (target === JUMP_TO_END || laterIds.has(target)) clean[choice] = target;
        }
        return Object.keys(clean).length > 0 ? { jumps: clean } : null;
      };

      // Points only for choices that still exist on scorable questions.
      const sanitizePoints = (q: DraftQuestion) => {
        if (!q.points || !SCORABLE_TYPES.includes(q.type)) return null;
        const choices = new Set(scoringChoices(q));
        const clean = Object.fromEntries(
          Object.entries(q.points).filter(
            ([c, v]) => choices.has(c) && Number.isFinite(v) && v !== 0,
          ),
        );
        return Object.keys(clean).length > 0 ? clean : null;
      };

      // One transactional RPC replaces the old N+1 (update-per-question +
      // batch insert + trailing delete). Array order sets position; existing
      // ids are preserved (responses.answers is keyed by question id). The RPC
      // trims labels/title and normalizes empty description/thank-you, so raw
      // draft values are sent. New questions send id: null.
      const p_questions = visible.map((q, i) => ({
        id: q.isNew ? null : q.id,
        type: q.type,
        label: q.label,
        options: q.options ?? null,
        required: q.required,
        logic: sanitizeLogic(q, i),
        ai_follow_up: !!q.ai_follow_up,
        // First question wins a duplicated variable name.
        recall_key:
          q.recall_key &&
          isValidKey(q.recall_key) &&
          visible.findIndex((v) => v.recall_key === q.recall_key) === i
            ? q.recall_key
            : null,
        points: sanitizePoints(q),
      }));

      const { error } = await supabase.rpc("save_form_editor", {
        p_form_id: formId,
        p_form: {
          title: draftForm.title,
          description: draftForm.description,
          display_mode: draftForm.display_mode,
          thank_you_message: draftForm.thank_you_message,
          settings: serializeFormSettings(draftForm.settings),
        } as unknown as Json,
        p_questions: p_questions as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Saved");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["form", formId] }),
        qc.invalidateQueries({ queryKey: ["questions", formId] }),
        qc.invalidateQueries({ queryKey: ["public-form", formId] }),
        qc.invalidateQueries({ queryKey: ["public-questions", formId] }),
        qc.invalidateQueries({ queryKey: ["forms"] }),
        // Dashboard now uses an aggregated RPC under a separate query key.
        qc.invalidateQueries({ queryKey: ["dashboard-forms"] }),
      ]);
      // Re-sync the draft from the fresh server data directly. Clearing the
      // snapshot and waiting for the sync effect doesn't work: the refetch has
      // already landed by now, so the effect's deps never change again and the
      // editor would sit on its loading skeleton forever.
      const sf = qc.getQueryData<typeof formQ.data>(["form", formId]);
      const sq = qc.getQueryData<Question[]>(["questions", formId]) ?? [];
      if (sf) resetDraftTo(toSnapshot(sf, sq));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doDiscard = () => {
    if (!snapshot) return;
    setDiscardOpen(false);

    // A brand-new throwaway draft is deleted outright, since discarding it
    // leaves nothing worth keeping; anything with real saved content just
    // reverts its edits. See discardDeletesDraft for the exact criteria.
    if (discardDeletesDraft) {
      // deleteForm handles the toast + redirect to the dashboard.
      deleteForm.mutate();
      return;
    }

    setDraftForm(snapshot.form);
    setDraftQuestions(snapshot.questions.map((q) => ({ ...q })));
    // Edits are reverted; leave for the dashboard. Bypass the unsaved-changes
    // guard for this navigation (the draft now matches the saved snapshot).
    deletedRef.current = true;
    navigate({ to: "/dashboard", search: dashboardSearch });
  };

  /* ---------------------------- Status & delete ---------------------------- */

  const setStatus = useMutation({
    mutationFn: async (next: FormStatus) => {
      const { error } = await supabase.from("forms").update({ status: next }).eq("id", formId);
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      toast.success(
        next === "published"
          ? "Form published"
          : next === "closed"
            ? "Form closed. It no longer takes responses."
            : "Moved back to draft",
      );
      qc.invalidateQueries({ queryKey: ["form", formId] });
      qc.invalidateQueries({ queryKey: ["forms"] });
      qc.invalidateQueries({ queryKey: ["dashboard-forms"] });
      qc.invalidateQueries({ queryKey: ["public-form", formId] });
      void offerToCloseOriginal(next);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Publishing a copy while its original is still live would leave two
  // near-identical surveys collecting at once, so offer to close the original.
  const offerToCloseOriginal = async (next: FormStatus) => {
    const originalId = formQ.data?.copied_from;
    if (next !== "published" || !originalId) return;
    const { data } = await supabase
      .from("forms")
      .select("id, title, status")
      .eq("id", originalId)
      .maybeSingle();
    if (data?.status === "published") setCloseOriginal({ id: data.id, title: data.title });
  };

  // Category is organisational metadata, not survey content: it saves
  // immediately (outside the draft/Save flow) and stays editable on live forms.
  const setCategory = useMutation({
    mutationFn: async (categoryId: string | null) => {
      const { error } = await supabase
        .from("forms")
        .update({ category_id: categoryId })
        .eq("id", formId);
      if (error) throw error;
      return categoryId;
    },
    onSuccess: (categoryId) => {
      toast.success(categoryId ? "Category updated" : "Category removed");
      qc.invalidateQueries({ queryKey: ["form", formId] });
      qc.invalidateQueries({ queryKey: ["dashboard-forms"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn’t update the category. Try again."),
  });

  // Response count powers the delete-dialog warning ("…and its 32 responses").
  const responseCountQ = useQuery({
    queryKey: ["response-count", formId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("responses")
        .select("id", { count: "exact", head: true })
        .eq("form_id", formId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Answers already collected by the *current* version freeze it: editing would
  // mix answers to two different surveys. Edits go into a new version instead.
  const currentVersion = formQ.data?.version ?? 1;
  const versionResponsesQ = useQuery({
    queryKey: ["version-response-count", formId, currentVersion],
    enabled: !!formQ.data,
    refetchOnMount: "always",
    queryFn: async () => {
      const { count, error } = await supabase
        .from("responses")
        .select("id", { count: "exact", head: true })
        .eq("form_id", formId)
        .eq("form_version", currentVersion);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const startNewVersion = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("start_new_form_version", {
        p_form_id: formId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (next) => {
      setNewVersionOpen(false);
      toast.success("Form unlocked. Make your changes, then publish the update.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["form", formId] }),
        qc.invalidateQueries({ queryKey: ["version-response-count", formId] }),
        qc.invalidateQueries({ queryKey: ["form-versions", formId] }),
        qc.invalidateQueries({ queryKey: ["public-form", formId] }),
        qc.invalidateQueries({ queryKey: ["dashboard-forms"] }),
      ]);
    },
    onError: (e: Error) => {
      setNewVersionOpen(false);
      toast.error(e.message || "Couldn’t start a new version. Try again.");
    },
  });

  const copyForm = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("copy_form", { p_form_id: formId });
      if (error) throw error;
      return data;
    },
    onSuccess: async (newId) => {
      toast.success("Copy created. Edit it, then publish when ready.");
      qc.invalidateQueries({ queryKey: ["dashboard-forms"] });
      await navigate({ to: "/forms/$formId/edit", params: { formId: newId } });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn’t copy this form. Try again."),
  });

  const closeOriginalForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forms").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      setCloseOriginal(null);
      toast.success("Original form closed");
      qc.invalidateQueries({ queryKey: ["dashboard-forms"] });
      qc.invalidateQueries({ queryKey: ["form", id] });
      qc.invalidateQueries({ queryKey: ["public-form", id] });
    },
    onError: (e: Error) => {
      setCloseOriginal(null);
      toast.error(e.message || "Couldn’t close the original form. Try again.");
    },
  });

  const deleteForm = useMutation({
    mutationFn: async () => {
      // Cascades to questions + responses via ON DELETE CASCADE.
      const { error } = await supabase.from("forms").delete().eq("id", formId);
      if (error) throw error;
    },
    onSuccess: async () => {
      deletedRef.current = true;
      setDeleteOpen(false);
      toast.success("Form deleted");
      qc.invalidateQueries({ queryKey: ["dashboard-forms"] });
      await navigate({ to: "/dashboard", search: dashboardSearch });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn’t delete the form. Try again."),
  });

  // A brand-new throwaway draft — never published, no responses, and still the
  // pristine blank form — is deleted outright on discard rather than reverted.
  // This drives both doDiscard's behaviour and the confirm-dialog wording.
  const savedTitle = snapshot?.form.title.trim() ?? "";
  const discardDeletesDraft =
    formQ.data?.status === "draft" &&
    (responseCountQ.data ?? 0) === 0 &&
    (snapshot?.questions.length ?? 0) === 0 &&
    (savedTitle === "" || savedTitle === DEFAULT_FORM_TITLE) &&
    !snapshot?.form.description;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!formQ.isError && (!ready || (formQ.data && !snapshot) || (formQ.data && roleLoading))) {
    return <AppShellSkeleton />;
  }

  const form = formQ.data;
  if (form && role === "viewer") {
    return (
      <AppShell userId={userId} email={email} ownerId={form.user_id}>
        <h1 className="font-display text-[26px] leading-tight">View-only access</h1>
        <p className="mt-2 max-w-md text-ink/60">
          You’re a viewer in this workspace, so you can’t edit “{form.title}”. Its responses and
          analytics are open to you.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/forms/$formId/responses"
            params={{ formId: form.id }}
            className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand/90"
          >
            View responses
          </Link>
          <Link
            to="/dashboard"
            search={dashboardSearch}
            className="inline-flex h-9 items-center rounded-md border border-hairline bg-card px-4 text-sm font-medium text-ink hover:border-ink/25"
          >
            Back to forms
          </Link>
        </div>
      </AppShell>
    );
  }
  if (!form || !can.canEdit) {
    return (
      <AppShell userId={userId} email={email}>
        <h1 className="font-display text-[26px] leading-tight">Form not found</h1>
        <p className="mt-2 text-sm text-ink/60">
          It may have been deleted, or you don’t have access.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-block text-sm font-medium text-brand hover:underline"
        >
          Back to forms
        </Link>
      </AppShell>
    );
  }

  // Live (published) forms are read-only: editing questions under respondents
  // mid-survey would corrupt results. Close or unpublish first. The
  // save_form_editor RPC enforces the same rule server-side.
  const isLive = form.status === "published";
  const versionFrozen = (versionResponsesQ.data ?? 0) > 0;
  const isLocked = isLive || versionFrozen;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleDraftQuestions.findIndex((q) => q.id === active.id);
    const newIndex = visibleDraftQuestions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextVisible = arrayMove(visibleDraftQuestions, oldIndex, newIndex);
    // Rebuild draftQuestions: visible in new order, then keep deleted-marked rows at the end.
    const deleted = draftQuestions.filter((q) => q.isDeleted);
    reorderDraft([...nextVisible, ...deleted]);
  };

  const moveBy = (id: string, delta: number) => {
    const idx = visibleDraftQuestions.findIndex((q) => q.id === id);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= visibleDraftQuestions.length) return;
    const nextVisible = arrayMove(visibleDraftQuestions, idx, target);
    const deleted = draftQuestions.filter((q) => q.isDeleted);
    reorderDraft([...nextVisible, ...deleted]);
  };

  const headerActions = (
    <>
      {isDirty && !isLocked && (
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs text-ink/55">
          <span aria-hidden className="size-1.5 rounded-full bg-sun" />
          Unsaved changes
        </span>
      )}
      {form.status === "published" && (
        <button type="button" onClick={() => setShareOpen(true)} className={actionSecondary}>
          <Share2 className="size-3.5" /> Share
        </button>
      )}
      <button type="button" onClick={() => setPreviewOpen(true)} className={actionSecondary}>
        <Eye className="size-3.5" /> Preview
      </button>
      {isDirty && !isLocked && (
        <button
          type="button"
          onClick={() => setDiscardOpen(true)}
          disabled={saveAll.isPending}
          className={actionSecondary}
        >
          Discard
        </button>
      )}
      {!isLocked && (
        <button
          type="button"
          onClick={() => saveAll.mutate()}
          disabled={!isDirty || saveAll.isPending}
          className={form.status === "draft" ? actionSecondary : actionPrimary}
        >
          {saveAll.isPending ? "Saving…" : "Save"}
        </button>
      )}
      {form.status === "draft" && (
        <button
          type="button"
          onClick={() => setStatus.mutate("published")}
          disabled={setStatus.isPending || visibleDraftQuestions.length === 0 || isDirty}
          title={
            isDirty
              ? "Save your changes first"
              : visibleDraftQuestions.length === 0
                ? "Add at least one question first"
                : undefined
          }
          className={actionPrimary}
        >
          {currentVersion > 1 ? "Publish update" : "Publish form"}
        </button>
      )}
      {form.status === "published" && (
        <>
          <button
            type="button"
            onClick={() => setStatus.mutate("closed")}
            disabled={setStatus.isPending}
            title="Stop taking responses. The link stays up and shows a closed notice."
            className={actionSecondary}
          >
            Close form
          </button>
          <button
            type="button"
            onClick={() => setStatus.mutate("draft")}
            disabled={setStatus.isPending}
            title="Take the form offline. The link shows an unpublished notice."
            className={actionSecondary}
          >
            Unpublish
          </button>
        </>
      )}
      {form.status === "closed" && (
        <button
          type="button"
          onClick={() => setStatus.mutate("published")}
          disabled={setStatus.isPending || isDirty}
          title="Closed. The link shows a closed notice and takes no new responses."
          className={actionPrimary}
        >
          {currentVersion > 1 && !versionFrozen ? "Publish update" : "Reopen form"}
        </button>
      )}
    </>
  );

  return (
    <AppShell
      userId={userId}
      email={email}
      ownerId={form.user_id}
      header={
        <FormHeader
          formId={formId}
          title={form.title || DEFAULT_FORM_TITLE}
          status={form.status as FormStatus}
          version={currentVersion}
          ownerSearch={dashboardSearch}
          active="build"
          canEdit
          responseCount={responseCountQ.data}
          actions={headerActions}
        />
      }
    >
      {isLocked && (
        <div
          role="status"
          className="rounded-lg border border-brand/25 bg-accent px-4 py-3 text-sm text-ink"
        >
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-brand" />
            <p className="min-w-0 flex-1">
              <span className="font-semibold">
                {versionFrozen
                  ? `This form has ${versionResponsesQ.data} ${versionResponsesQ.data === 1 ? "response" : "responses"}, so its questions are locked.`
                  : "This form is live, so it can’t be edited."}
              </span>{" "}
              <span className="text-ink/70">
                {versionFrozen
                  ? "Editing now would mix answers to different questions. Edit a copy, or update this form under the same link."
                  : "Close or unpublish it (top right) to make changes, or edit a copy instead."}
              </span>
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
            <button
              type="button"
              onClick={() => copyForm.mutate()}
              disabled={copyForm.isPending}
              title="A new draft form with the same questions and its own link"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              <CopyPlus className="size-4" />
              {copyForm.isPending ? "Copying…" : "Edit a copy"}
            </button>
            {versionFrozen && (
              <button
                type="button"
                onClick={() => setNewVersionOpen(true)}
                disabled={startNewVersion.isPending}
                title="Keep the same link; new answers are tracked separately from earlier ones"
                className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-card px-3.5 py-1.5 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
              >
                <GitBranchPlus className="size-4" />
                {startNewVersion.isPending ? "Starting…" : "Update this form"}
              </button>
            )}
          </div>
          {versionFrozen && (
            <ul className="mt-2.5 space-y-0.5 pl-7 text-xs text-ink/55">
              <li>
                <span className="font-medium text-ink/75">Edit a copy:</span> a new form with its
                own link and results. Best for a new event, round or audience.
              </li>
              <li>
                <span className="font-medium text-ink/75">Update this form:</span> same link, so QR
                codes, embeds and emails keep working. Earlier answers are kept as v{currentVersion}{" "}
                so you can compare.
              </li>
            </ul>
          )}
        </div>
      )}

      {/* Two columns on wide screens. Below xl they become two views with a
          switch, so settings never sit under a long list of questions. */}
      <div
        role="group"
        aria-label="Editor view"
        className={cn(
          "inline-flex rounded-md border border-hairline bg-card p-0.5 xl:hidden",
          isLocked && "mt-5",
        )}
      >
        {(
          [
            ["questions", "Questions"],
            ["settings", "Form settings"],
          ] as const
        ).map(([view, label]) => (
          <button
            key={view}
            type="button"
            aria-pressed={pane === view}
            onClick={() => setPane(view)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40",
              pane === view ? "bg-ink text-paper" : "text-ink/55 hover:text-ink",
            )}
          >
            {label}
            {view === "questions" && (
              <span className="font-mono text-[11px] font-normal opacity-60">
                {visibleDraftQuestions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "mt-5 xl:grid xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start xl:gap-8",
          isLocked ? "xl:mt-6" : "xl:mt-0",
        )}
      >
        <div className={cn("min-w-0", pane !== "questions" && "hidden xl:block")}>
          <fieldset
            disabled={isLocked}
            className="min-w-0 space-y-3 rounded-lg border border-hairline bg-card p-4 disabled:opacity-70 sm:p-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="form-title-edit" className="text-xs">
                Title
              </Label>
              <DebouncedInput
                id="form-title-edit"
                value={draftForm.title}
                onChange={(v) => setDraftForm((f) => ({ ...f, title: v }))}
                placeholder="Name your form"
                className="font-display py-3 text-xl md:text-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-description-edit" className="text-xs">
                Description <span className="font-normal text-ink/40">(optional)</span>
              </Label>
              <DebouncedTextarea
                id="form-description-edit"
                value={draftForm.description ?? ""}
                onChange={(v) => setDraftForm((f) => ({ ...f, description: v === "" ? null : v }))}
                placeholder="What’s this form for?"
                rows={2}
              />
            </div>
          </fieldset>

          <section aria-labelledby="questions-heading" className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div>
                <h2
                  id="questions-heading"
                  className="flex items-baseline gap-2 text-lg font-semibold tracking-normal"
                >
                  Questions
                  <span className="font-mono text-xs font-normal text-ink/45">
                    {visibleDraftQuestions.length}
                  </span>
                </h2>
                {!isLocked && (
                  <p className="mt-1 text-xs text-ink/50">
                    Drag to reorder. Click <span className="font-semibold">Save</span> to keep your
                    changes.
                  </p>
                )}
              </div>
              <fieldset disabled={isLocked} className="min-w-0 disabled:opacity-70">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:justify-end">
                  <span id="display-mode-label" className="text-xs text-ink/55">
                    Respondent experience
                  </span>
                  <div
                    role="group"
                    aria-labelledby="display-mode-label"
                    className="inline-flex rounded-md border border-hairline bg-card p-0.5"
                  >
                    {(
                      [
                        ["conversational", "Conversational", "One question at a time"],
                        ["classic", "Classic", "All questions on one page"],
                      ] as const
                    ).map(([mode, label, hint]) => (
                      <button
                        key={mode}
                        type="button"
                        title={hint}
                        aria-pressed={draftForm.display_mode === mode}
                        onClick={() => setDraftForm((f) => ({ ...f, display_mode: mode }))}
                        className={cn(
                          "inline-flex h-7 items-center rounded px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40",
                          draftForm.display_mode === mode
                            ? "bg-accent text-accent-foreground"
                            : "text-ink/55 hover:text-ink",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-ink/40 sm:text-right">
                  {draftForm.display_mode === "conversational"
                    ? "One question at a time, with a progress bar. Logic jumps apply."
                    : "Every question on one page."}
                </p>
              </fieldset>
            </div>

            <fieldset disabled={isLocked} className="min-w-0 disabled:opacity-70">
              {!isLocked && currentVersion > 1 && (
                <div className="mt-3 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm text-ink/70">
                  You’re updating this form (
                  <span className="font-semibold text-ink">v{currentVersion}</span>). Earlier
                  answers stay as they were. Questions you keep stay comparable, and deleted ones
                  still show in earlier results.
                </div>
              )}

              {visibleDraftQuestions.length === 0 && (
                <p className="mt-4 rounded-lg border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-ink/55">
                  No questions yet.
                  {!isLocked && " Add one, or let Claude draft a few from your title."}
                </p>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={visibleDraftQuestions.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="mt-4 space-y-3">
                    {visibleDraftQuestions.map((q, i) => (
                      <SortableQuestionCard
                        key={q.id}
                        question={q}
                        index={i}
                        total={visibleDraftQuestions.length}
                        jumpTargets={visibleDraftQuestions
                          .map((t, ti) => ({
                            id: t.id,
                            label: t.label,
                            number: ti + 1,
                            isNew: !!t.isNew,
                          }))
                          .slice(i + 1)
                          .filter((t) => !t.isNew)}
                        onChangeLabel={(label) => setDraftLabel(q.id, label)}
                        onChangeOptions={(options) => setDraftOptions(q.id, options)}
                        onChangeType={(type) => setDraftType(q.id, type)}
                        onChangeRequired={(required) => setDraftRequired(q.id, required)}
                        conversational={draftForm.display_mode === "conversational"}
                        onChangeAiFollowUp={(on) => setDraftAiFollowUp(q.id, on)}
                        onChangeLogic={(logic) => setDraftLogic(q.id, logic)}
                        recallVars={[
                          ...visibleDraftQuestions
                            .slice(0, i)
                            .filter((t) => t.recall_key)
                            .map((t) => ({
                              key: t.recall_key as string,
                              hint: `Answer to “${t.label.slice(0, 40)}”`,
                            })),
                          ...(draftForm.settings.hidden_fields ?? []).map((f) => ({
                            key: f,
                            hint: "Hidden field from the link",
                          })),
                        ]}
                        takenKeys={visibleDraftQuestions
                          .filter((t) => t.id !== q.id && t.recall_key)
                          .map((t) => t.recall_key as string)}
                        onChangeRecallKey={(k) => setDraftRecallKey(q.id, k)}
                        quizEnabled={!!draftForm.settings.quiz?.enabled}
                        onChangePoints={(pts) => setDraftPoints(q.id, pts)}
                        onDuplicate={() => duplicateDraftQuestion(q.id)}
                        onDelete={() => removeDraftQuestion(q.id)}
                        onMoveUp={() => moveBy(q.id, -1)}
                        onMoveDown={() => moveBy(q.id, 1)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </fieldset>

            {!isLocked && (
              <div className="mt-5">
                {/* The two ways to get a question, side by side. */}
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className={cn(actionPrimary, "h-9 px-4")}>
                        <Plus className="size-4" /> Add question
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                        <DropdownMenuItem key={t} onClick={() => addDraftQuestion(t)}>
                          {QUESTION_TYPE_LABELS[t]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="button"
                    onClick={handleSuggest}
                    disabled={isSuggesting || !draftForm.title.trim()}
                    title={!draftForm.title.trim() ? "Add a title first" : undefined}
                    className={cn(actionSecondary, "h-9 px-3.5")}
                  >
                    {isSuggesting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Drafting…
                      </>
                    ) : (
                      <>
                        Suggest questions <ClaudeTag />
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-ink/50">
                  {draftForm.title.trim()
                    ? "Claude drafts questions from your title and description."
                    : "Add a title and Claude can draft questions from it."}
                </p>

                {suggestError && (
                  <p className="mt-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {suggestError}
                  </p>
                )}

                {suggestions.length > 0 && (
                  <div className="mt-4 rounded-lg border border-hairline bg-card">
                    <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
                      <h3 className="flex items-center gap-2 text-sm font-medium tracking-normal text-ink">
                        Drafts <ClaudeTag />
                      </h3>
                      <span className="font-mono text-[11px] text-ink/45">
                        {addedSuggestionIds.size} of {suggestions.length} added
                      </span>
                    </div>
                    <ul className="divide-y divide-hairline px-4">
                      {suggestions.map((s) => {
                        const added = addedSuggestionIds.has(s.id);
                        return (
                          <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-snug text-ink">{s.label}</p>
                              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink/45">
                                {s.type === "rating"
                                  ? `Rating scale (1–${getRatingMax(s.options)})`
                                  : QUESTION_TYPE_LABELS[s.type]}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                scrollAnchorRef.current = {
                                  el: e.currentTarget,
                                  top: e.currentTarget.getBoundingClientRect().top,
                                };
                                addSuggestion(s);
                              }}
                              disabled={added}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink/15 bg-card px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-ink/35 disabled:cursor-default disabled:border-ink/5 disabled:text-ink/30"
                            >
                              {added ? (
                                "Added"
                              ) : (
                                <>
                                  <Plus className="size-3" /> Add
                                </>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Stays in reach while the questions scroll. */}
        <div
          className={cn(
            "min-w-0 xl:sticky xl:top-28 xl:max-h-[calc(100vh-8.5rem)] xl:overflow-y-auto",
            pane !== "settings" && "hidden xl:block",
          )}
        >
          <FormSettingsPanel
            value={draftForm.settings}
            onChange={setDraftSettings}
            formId={formId}
            formTitle={draftForm.title}
            maxQuizScore={maxScore(visibleDraftQuestions)}
            scoredQuestionCount={
              visibleDraftQuestions.filter((q) => q.points && SCORABLE_TYPES.includes(q.type))
                .length
            }
            disabled={isLocked}
            category={
              <CategoryField
                userId={form.user_id}
                value={form.category_id ?? null}
                onChange={(id) => setCategory.mutate(id)}
                pending={setCategory.isPending}
              />
            }
            hasThankYou={!!draftForm.thank_you_message?.trim()}
            thankYouField={
              <div className="space-y-1.5">
                <Label htmlFor="form-thanks-edit" className="text-xs">
                  Thank-you message <span className="font-normal text-ink/40">(optional)</span>
                </Label>
                <DebouncedTextarea
                  id="form-thanks-edit"
                  value={draftForm.thank_you_message ?? ""}
                  onChange={(v) =>
                    setDraftForm((f) => ({ ...f, thank_you_message: v === "" ? null : v }))
                  }
                  placeholder="Thanks. Your response was recorded."
                  rows={2}
                />
                <p className="text-xs text-ink/45">Shown after someone submits.</p>
              </div>
            }
            footer={
              can.canDelete ? (
                <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/[0.03] p-4">
                  <h3 className="text-sm font-semibold tracking-normal text-destructive">
                    Danger zone
                  </h3>
                  <p className="mt-1 text-xs text-ink/60">
                    Permanently delete this form
                    {(responseCountQ.data ?? 0) > 0
                      ? ` and its ${responseCountQ.data} ${responseCountQ.data === 1 ? "response" : "responses"}`
                      : ""}
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/30 bg-card px-3 text-[13px] font-medium text-destructive outline-none hover:bg-destructive/5 focus-visible:ring-2 focus-visible:ring-destructive/30"
                  >
                    <Trash2 className="size-3.5" /> Delete form
                  </button>
                </div>
              ) : null
            }
          />
        </div>
      </div>

      <DeleteFormDialog
        open={deleteOpen}
        formTitle={form.title}
        responseCount={responseCountQ.data}
        pending={deleteForm.isPending}
        onConfirm={() => deleteForm.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />

      <ShareFormDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        formId={formId}
        formTitle={form.title}
      />

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (open) setPreviewAnswers({});
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {draftForm.title || DEFAULT_FORM_TITLE}
            </DialogTitle>
            {draftForm.description ? (
              <DialogDescription className="text-base text-ink/60">
                {draftForm.description}
              </DialogDescription>
            ) : null}
            <p className="eyebrow mt-2">
              {isDirty
                ? "Preview, including unsaved changes"
                : "Preview. This is what respondents see."}
            </p>
          </DialogHeader>

          <div className="mt-4 space-y-6" style={themeStyle(draftForm.settings.theme)}>
            {visibleDraftQuestions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink/15 p-6 text-center text-sm text-ink/50">
                No questions yet. Add one to see a preview.
              </p>
            ) : draftForm.display_mode === "conversational" ? (
              <ConversationalForm
                questions={visibleDraftQuestions}
                answers={previewAnswers}
                recallVars={previewRecallVars}
                onAnswer={(qid, v) => setPreviewAnswers((a) => ({ ...a, [qid]: v }))}
                onSubmit={() => {}}
                preview
              />
            ) : (
              computeVisiblePath(visibleDraftQuestions, previewAnswers)
                .map((idx) => visibleDraftQuestions[idx])
                .map((q, i) => (
                  <div key={q.id} className="rounded-lg border border-hairline bg-card p-5">
                    <p className="eyebrow mb-3">
                      Question {i + 1}
                      {!q.required && (
                        <span className="ml-2 font-medium text-ink/35">· Optional</span>
                      )}
                    </p>
                    <QuestionRender
                      question={{ ...q, label: recallText(q.label, previewRecallVars) }}
                      value={previewAnswers[q.id]}
                      onChange={(v) => setPreviewAnswers((a) => ({ ...a, [q.id]: v }))}
                    />
                  </div>
                ))
            )}

            {visibleDraftQuestions.length > 0 && draftForm.display_mode === "classic" && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-ink/50">Responses aren’t recorded in preview.</p>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground opacity-60 hover:bg-brand/90 transition-colors"
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={discardOpen}
        title={discardDeletesDraft ? "Discard this draft?" : "Discard changes?"}
        description={
          discardDeletesDraft
            ? "This empty draft will be deleted and you’ll go back to the dashboard. This can’t be undone."
            : "Your unsaved changes will be lost. This can’t be undone."
        }
        confirmLabel={discardDeletesDraft ? "Delete draft" : "Discard"}
        cancelLabel="Keep editing"
        destructive
        onConfirm={doDiscard}
        onCancel={() => setDiscardOpen(false)}
      />

      <ConfirmDialog
        open={newVersionOpen}
        title="Update this form?"
        description={
          (isLive
            ? "The form closes while you edit, so its link shows a closed notice until you publish the update. "
            : "Your edits go live under the same link when you publish. ") +
          `The ${versionResponsesQ.data ?? 0} answers collected so far are kept as v${currentVersion}, and new answers are counted as v${currentVersion + 1} so you can compare them on the results page.`
        }
        confirmLabel="Update this form"
        onConfirm={() => startNewVersion.mutate()}
        onCancel={() => setNewVersionOpen(false)}
      />

      <ConfirmDialog
        open={closeOriginal !== null}
        title="Close the original form?"
        description={`“${closeOriginal?.title ?? ""}” is still live. Close it so new answers only go to this copy? Its link will show a closed notice and its results stay as they are.`}
        confirmLabel="Close original"
        cancelLabel="Keep both live"
        onConfirm={() => closeOriginal && closeOriginalForm.mutate(closeOriginal.id)}
        onCancel={() => setCloseOriginal(null)}
      />

      <ConfirmDialog
        open={blocker.status === "blocked"}
        title="Leave without saving?"
        description="Your unsaved changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </AppShell>
  );
}

/* ------------------------------ Sortable card ------------------------------ */

type JumpTarget = { id: string; label: string; number: number };

function SortableQuestionCard({
  question,
  index,
  total,
  jumpTargets,
  onChangeLabel,
  onChangeOptions,
  onChangeType,
  onChangeRequired,
  onChangeLogic,
  conversational,
  onChangeAiFollowUp,
  recallVars,
  takenKeys,
  onChangeRecallKey,
  quizEnabled,
  onChangePoints,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: Question;
  index: number;
  total: number;
  jumpTargets: JumpTarget[];
  onChangeLabel: (label: string) => void;
  onChangeOptions: (options: QuestionOptions) => void;
  onChangeType: (type: QuestionType) => void;
  onChangeRequired: (required: boolean) => void;
  conversational: boolean;
  onChangeAiFollowUp: (on: boolean) => void;
  onChangeLogic: (logic: QuestionLogic) => void;
  recallVars: { key: string; hint: string }[];
  takenKeys: string[];
  onChangeRecallKey: (key: string | null) => void;
  quizEnabled: boolean;
  onChangePoints: (points: Record<string, number> | null) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const cfg = getChoiceConfig(question.options);
  const jumpEligible =
    question.type === "dropdown" ||
    question.type === "yes_no" ||
    (question.type === "multiple_choice" && !cfg.multi);
  const jumpChoices = !jumpEligible ? [] : question.type === "yes_no" ? ["Yes", "No"] : cfg.choices;
  const jumps = question.logic?.jumps ?? {};
  const jumpCount = Object.keys(jumps).length;
  const setJump = (choice: string, target: string) => {
    const next = { ...jumps };
    if (target === "") delete next[choice];
    else next[choice] = target;
    onChangeLogic(Object.keys(next).length > 0 ? { jumps: next } : null);
  };
  const followUpEligible = question.type === "text" || question.type === "long_text";
  const scorable = SCORABLE_TYPES.includes(question.type);
  const pointsAvailable = quizEnabled && scorable;
  const hasPoints = !!question.points && Object.keys(question.points).length > 0;
  const questionMax = maxScore([question]);

  // Which settings are open. Until the user toggles one, rules that already
  // exist stay in view (a locked form can't open anything), and Points opens
  // on every scorable question while Quiz mode is on.
  const [hadJumps] = useState(jumpCount > 0);
  const [toggled, setToggled] = useState<Partial<Record<SettingId, boolean>>>({});
  const openByDefault: Record<SettingId, boolean> = {
    logic: hadJumps && jumpEligible,
    recall: false,
    followup: false,
    points: pointsAvailable,
  };
  const isOpen = (id: SettingId) => toggled[id] ?? openByDefault[id];
  const togglePanel = (id: SettingId) =>
    setToggled((t) => ({ ...t, [id]: !(t[id] ?? openByDefault[id]) }));
  const panelId = (id: SettingId) => `q-${question.id}-${id}`;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-hairline bg-card p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            className="cursor-grab touch-none rounded p-1 text-ink/40 hover:bg-ink/5 hover:text-ink active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <span className="eyebrow">Q{index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Move up" onClick={onMoveUp} disabled={index === 0}>
            <ArrowUp className="size-4" />
          </IconBtn>
          <IconBtn label="Move down" onClick={onMoveDown} disabled={index === total - 1}>
            <ArrowDown className="size-4" />
          </IconBtn>
          <IconBtn label="Duplicate question" onClick={onDuplicate}>
            <CopyPlus className="size-4" />
          </IconBtn>
          <IconBtn label="Delete" onClick={onDelete}>
            <Trash2 className="size-4" />
          </IconBtn>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
        <div className="space-y-1.5">
          <Label className="text-xs">Question</Label>
          <DebouncedInput
            value={question.label}
            onChange={onChangeLabel}
            placeholder="Type your question…"
          />
          {recallVars.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="text-[11px] text-ink/45">Insert answer:</span>
              {recallVars.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  title={v.hint}
                  onClick={() => {
                    const base = question.label.replace(/\s+$/, "");
                    onChangeLabel(`${base}${base ? " " : ""}{${v.key}}`);
                  }}
                  className="rounded border border-brand/25 bg-brand/5 px-1.5 py-0.5 font-mono text-[11px] text-brand hover:bg-brand/10"
                >
                  {`{${v.key}}`}
                </button>
              ))}
            </div>
          )}
          {(() => {
            const known = new Set(recallVars.map((v) => v.key));
            const unknown = [...new Set(placeholderKeys(question.label))].filter(
              (k) => !known.has(k),
            );
            if (unknown.length === 0) return null;
            return (
              <p className="text-[11px] text-sun">
                {unknown.map((k) => `{${k}}`).join(", ")} doesn’t match an earlier answer or hidden
                field, so it will be left out.
              </p>
            );
          })()}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <select
            value={question.type}
            onChange={(e) => onChangeType(e.target.value as QuestionType)}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {question.type === "multiple_choice" &&
        (() => {
          const cfg = getChoiceConfig(question.options);
          return (
            <div className="mt-4 space-y-3">
              <OptionsEditor
                options={cfg.choices}
                onChange={(choices) => onChangeOptions({ choices, multi: cfg.multi })}
              />
              <div className="flex items-center gap-2">
                <Switch
                  id={`q-${question.id}-multi`}
                  checked={cfg.multi}
                  onCheckedChange={(multi) => onChangeOptions({ choices: cfg.choices, multi })}
                />
                <Label htmlFor={`q-${question.id}-multi`} className="text-xs font-normal">
                  Allow selecting multiple options
                </Label>
              </div>
            </div>
          );
        })()}

      {question.type === "dropdown" && (
        <div className="mt-4">
          <OptionsEditor
            options={getChoiceConfig(question.options).choices}
            onChange={(choices) => onChangeOptions(choices)}
          />
        </div>
      )}

      {question.type === "rating" && (
        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">Max rating</Label>
          <select
            value={getRatingMax(question.options)}
            onChange={(e) => onChangeOptions({ max: Number(e.target.value) })}
            className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
          >
            {RATING_MAX_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4 border-t border-hairline pt-3">
        <p className="text-xs font-medium text-ink/45">Question settings</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="mr-2 flex items-center gap-2">
            <Switch
              id={`q-${question.id}-required`}
              checked={question.required}
              onCheckedChange={onChangeRequired}
            />
            <Label htmlFor={`q-${question.id}-required`} className="text-xs font-normal">
              Required
            </Label>
          </div>
          <SettingToggle
            label="Logic jumps"
            status={jumpCount > 0 ? String(jumpCount) : null}
            available={jumpEligible}
            open={isOpen("logic")}
            controls={panelId("logic")}
            onClick={() => togglePanel("logic")}
          />
          <SettingToggle
            label="Recall"
            status={question.recall_key ? `{${question.recall_key}}` : null}
            available
            open={isOpen("recall")}
            controls={panelId("recall")}
            onClick={() => togglePanel("recall")}
          />
          <SettingToggle
            label="AI follow-up"
            claude
            status={question.ai_follow_up ? "On" : null}
            available={followUpEligible}
            open={isOpen("followup")}
            controls={panelId("followup")}
            onClick={() => togglePanel("followup")}
          />
          <SettingToggle
            label="Points"
            status={
              pointsAvailable && hasPoints ? (questionMax > 0 ? `${questionMax} pts` : "Set") : null
            }
            available={pointsAvailable}
            open={isOpen("points")}
            controls={panelId("points")}
            onClick={() => togglePanel("points")}
          />
        </div>

        {isOpen("logic") && (
          <SettingPanel
            id={panelId("logic")}
            title="Logic jumps"
            hint="Skip questions based on the answer."
          >
            {!jumpEligible ? (
              <p className="text-xs text-ink/55">
                Jumps work on dropdown, Yes / No and single-choice questions. Change the type to use
                them.
              </p>
            ) : jumpChoices.length === 0 ? (
              <p className="text-xs text-ink/55">Add an option first.</p>
            ) : (
              <div className="space-y-2">
                {jumpChoices.map((choice) => (
                  <div
                    key={choice}
                    className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink/70">
                      If <span className="font-semibold text-ink">"{choice}"</span>
                    </span>
                    <select
                      value={jumps[choice] ?? ""}
                      onChange={(e) => setJump(choice, e.target.value)}
                      className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-xs shadow-sm sm:w-52"
                    >
                      <option value="">→ Next question</option>
                      {jumpTargets.map((t) => (
                        <option key={t.id} value={t.id}>
                          → Q{t.number}: {t.label.slice(0, 40)}
                        </option>
                      ))}
                      <option value={JUMP_TO_END}>→ End of form</option>
                    </select>
                  </div>
                ))}
                <p className="text-xs text-ink/40">
                  Jumps go forward only. Newly added questions become targets after saving.
                </p>
              </div>
            )}
          </SettingPanel>
        )}

        {isOpen("recall") && (
          <SettingPanel
            id={panelId("recall")}
            title="Recall"
            hint="Name this answer to reuse it in later questions."
          >
            <RecallKeyField
              questionId={question.id}
              value={question.recall_key ?? null}
              taken={takenKeys}
              onChange={onChangeRecallKey}
            />
            <p className="mt-2 text-xs text-ink/50">
              {question.recall_key ? (
                <>
                  Write <span className="font-mono">{`{${question.recall_key}}`}</span> in any later
                  question and it becomes this answer.
                </>
              ) : (
                <>
                  Call it <span className="font-mono">name</span>, then a later question can say
                  “Thanks, <span className="font-mono">{"{name}"}</span>.”
                </>
              )}
            </p>
          </SettingPanel>
        )}

        {isOpen("followup") && (
          <SettingPanel
            id={panelId("followup")}
            title="AI follow-up"
            hint="Claude asks one more question when an answer is thin."
          >
            {!followUpEligible ? (
              <p className="text-xs text-ink/55">
                Follow-ups work on short answer and long answer questions. Change the type to use
                them.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`q-${question.id}-ai-follow-up`}
                    checked={!!question.ai_follow_up}
                    onCheckedChange={onChangeAiFollowUp}
                  />
                  <Label htmlFor={`q-${question.id}-ai-follow-up`} className="text-xs font-normal">
                    Ask a follow-up on this question
                  </Label>
                </div>
                <p className="mt-2 text-xs text-ink/50">
                  {conversational
                    ? "When an answer is short or vague, Claude asks one optional follow-up question before moving on."
                    : "Follow-ups only work in Conversational mode. Switch Respondent experience to use them."}
                </p>
              </>
            )}
          </SettingPanel>
        )}

        {isOpen("points") && (
          <SettingPanel id={panelId("points")} title="Points" hint="Quiz score for each answer.">
            {!quizEnabled ? (
              <p className="text-xs text-ink/55">
                Points belong to Quiz mode. Turn it on under Form settings, then score each answer
                here.
              </p>
            ) : !scorable ? (
              <p className="text-xs text-ink/55">
                Points work on multiple choice, dropdown and Yes / No questions. Change the type to
                use them.
              </p>
            ) : scoringChoices(question).length === 0 ? (
              <p className="text-xs text-ink/55">Add an option first.</p>
            ) : (
              <PointsEditor
                choices={scoringChoices(question)}
                points={question.points ?? null}
                onChange={onChangePoints}
              />
            )}
          </SettingPanel>
        )}
      </div>
    </li>
  );
}

/* ---------------------------- Question settings ---------------------------- */

type SettingId = "logic" | "recall" | "followup" | "points";

/** The small mono tag that marks work Claude does. */
function ClaudeTag() {
  return (
    <span className="rounded-sm border border-brand/25 bg-accent px-1.5 py-px font-mono text-[10px] font-normal uppercase tracking-wide text-brand">
      Claude
    </span>
  );
}

/**
 * One entry in a question's settings row. Every question shows the same four,
 * in the same order; one that doesn't apply is dimmed and, when opened, says
 * what it needs. `status` shows what is set without opening it.
 */
function SettingToggle({
  label,
  status,
  available,
  open,
  controls,
  onClick,
  claude,
}: {
  label: string;
  status: string | null;
  available: boolean;
  open: boolean;
  controls: string;
  onClick: () => void;
  claude?: boolean;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40",
        open
          ? "border-brand bg-accent font-medium text-accent-foreground"
          : status
            ? "border-ink/25 bg-card font-medium text-ink hover:border-ink/45"
            : available
              ? "border-hairline bg-card text-ink/65 hover:border-ink/25 hover:text-ink"
              : "border-hairline text-ink/40 hover:text-ink/65",
      )}
    >
      {label}
      {claude && <ClaudeTag />}
      {status && <span className="truncate font-mono text-[11px] font-normal">{status}</span>}
    </button>
  );
}

function SettingPanel({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="mt-3 rounded-lg border border-hairline bg-surface/60 p-3">
      <p className="text-xs font-semibold text-ink/75">
        {title} <span className="font-normal text-ink/45">{hint}</span>
      </p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/* ------------------------- Recall key / quiz points ------------------------ */

/**
 * Names this question's answer so later labels can say "Thanks, {name}!".
 * Committed on blur so a half-typed name never collides mid-edit.
 */
function RecallKeyField({
  questionId,
  value,
  taken,
  onChange,
}: {
  questionId: string;
  value: string | null;
  taken: string[];
  onChange: (key: string | null) => void;
}) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => setLocal(value ?? ""), [value]);
  const key = toKey(local);
  const clash = !!key && taken.includes(key);
  const commit = () => {
    if (!local.trim()) return onChange(null);
    if (!isValidKey(key) || clash) {
      setLocal(value ?? "");
      if (clash) toast.error(`{${key}} is already used by another question.`);
      return;
    }
    setLocal(key);
    onChange(key);
  };
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={`q-${questionId}-recall`} className="text-xs font-normal text-ink/55">
        Recall as
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-ink/35">
          {"{"}
        </span>
        <input
          id={`q-${questionId}-recall`}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="name"
          autoComplete="off"
          title="Name this answer to reuse it in later questions, e.g. {name}"
          className={
            "h-7 w-28 rounded-md border bg-card pl-4 pr-4 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
            (clash ? "border-destructive" : "border-input")
          }
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-ink/35">
          {"}"}
        </span>
      </div>
    </div>
  );
}

function PointsEditor({
  choices,
  points,
  onChange,
}: {
  choices: string[];
  points: Record<string, number> | null;
  onChange: (next: Record<string, number> | null) => void;
}) {
  if (choices.length === 0) return null;
  const set = (choice: string, raw: string) => {
    const n = Math.round(Number(raw));
    const next = { ...(points ?? {}) };
    if (!raw.trim() || !Number.isFinite(n) || n === 0) delete next[choice];
    else next[choice] = Math.max(-100, Math.min(100, n));
    onChange(Object.keys(next).length > 0 ? next : null);
  };
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {choices.map((c) => (
        <label key={c} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-ink/70">{c}</span>
          <input
            type="number"
            inputMode="numeric"
            value={points?.[c] ?? ""}
            placeholder="0"
            onChange={(e) => set(c, e.target.value)}
            className="h-8 w-20 rounded-md border border-input bg-card px-2 text-right font-mono text-sm shadow-sm"
          />
        </label>
      ))}
    </div>
  );
}

/* ----------------------------- Debounced input ----------------------------- */

function useDebouncedLocal(value: string, onChange: (v: string) => void, delay = 600) {
  const [local, setLocal] = useState(value);
  const lastExternal = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setLocal(value);
    }
  }, [value]);

  const schedule = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastExternal.current = v;
      onChange(v);
    }, delay);
  };

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (local !== lastExternal.current) {
      lastExternal.current = local;
      onChange(local);
    }
  };

  const onLocalChange = (v: string) => {
    setLocal(v);
    schedule(v);
  };

  return { local, onLocalChange, flush };
}

function DebouncedInput({
  id,
  value,
  onChange,
  placeholder,
  delay,
  className,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}) {
  const { local, onLocalChange, flush } = useDebouncedLocal(value, onChange, delay);
  return (
    <Input
      id={id}
      value={local}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      onChange={(e) => onLocalChange(e.target.value)}
      onBlur={flush}
    />
  );
}

function DebouncedTextarea({
  id,
  value,
  onChange,
  placeholder,
  delay,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  delay?: number;
  rows?: number;
}) {
  const { local, onLocalChange, flush } = useDebouncedLocal(value, onChange, delay);
  return (
    <Textarea
      id={id}
      value={local}
      placeholder={placeholder}
      rows={rows}
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      onChange={(e) => onLocalChange(e.target.value)}
      onBlur={flush}
    />
  );
}

/* ----------------------------- Options editor ----------------------------- */

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Options</Label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            onChange={(e) => onChange(options.map((o, j) => (j === i ? e.target.value : o)))}
          />
          <button
            type="button"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            className="rounded p-2 text-ink/50 hover:bg-ink/5"
            aria-label="Remove option"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...options, `Option ${options.length + 1}`])}
        className="text-sm font-medium text-brand hover:underline"
      >
        + Add option
      </button>
    </div>
  );
}

/* ---------------------------------- Misc ---------------------------------- */

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
