import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Eye,
  GripVertical,
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
  JUMP_TO_END,
  QUESTION_TYPE_LABELS,
  RATING_MAX_CHOICES,
  defaultOptionsForType,
  getChoiceConfig,
  getRatingMax,
  logicEqual,
  questionOptionsEqual,
} from "@/lib/form-utils";
import { ConversationalForm } from "@/components/conversational-form";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/status-pill";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DeleteFormDialog } from "@/components/delete-form-dialog";
import { ShareFormDialog } from "@/components/share-form-dialog";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/forms/$formId/edit")({
  component: EditFormPage,
});

function EditFormPage() {
  const { formId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user)
      navigate({ to: "/login", search: { redirect: `/forms/${formId}/edit` } });
  }, [loading, user, navigate, formId]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface p-10">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  return <EditFormAuthed formId={formId} userId={user.id} />;
}

type DraftQuestion = Question & { isNew?: boolean; isDeleted?: boolean };

type DraftFormState = {
  title: string;
  description: string | null;
  display_mode: DisplayMode;
  thank_you_message: string | null;
};

function snapshotKey(
  form: DraftFormState,
  questions: Array<Pick<Question, "id" | "type" | "label" | "options" | "required" | "logic">>,
) {
  return JSON.stringify({
    title: form.title.trim(),
    description: (form.description ?? "").trim(),
    display_mode: form.display_mode,
    thank_you_message: (form.thank_you_message ?? "").trim(),
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label.trim(),
      options: q.options ?? null,
      required: q.required,
      logic: q.logic ?? null,
    })),
  });
}

function EditFormAuthed({ formId, userId }: { formId: string; userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const formQ = useQuery({
    queryKey: ["form", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, description, user_id, status, display_mode, thank_you_message")
        .eq("id", formId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const questionsQ = useQuery({
    queryKey: ["questions", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, form_id, type, label, options, position, required, logic")
        .eq("form_id", formId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Question[];
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
  });
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Answers>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Once the form is deleted, unsaved-changes blocking must not trap the
  // redirect to the dashboard.
  const deletedRef = useRef(false);

  // Initialize / re-sync draft from server when (a) we don't have one yet,
  // or (b) the server snapshot changed AND the user has no unsaved changes.
  useEffect(() => {
    const sf = formQ.data;
    if (!sf) return;
    const sq = questionsQ.data ?? [];
    const newSnap = {
      form: {
        title: sf.title,
        description: sf.description ?? null,
        display_mode: sf.display_mode as DisplayMode,
        thank_you_message: sf.thank_you_message ?? null,
      },
      questions: sq,
    };
    if (!snapshot) {
      setSnapshot(newSnap);
      setDraftForm(newSnap.form);
      setDraftQuestions(sq.map((q) => ({ ...q })));
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
      setSnapshot(newSnap);
      setDraftForm(newSnap.form);
      setDraftQuestions(sq.map((q) => ({ ...q })));
    } else if (serverChanged && !draftMatchesOldSnap) {
      // Keep user's edits; just update snapshot reference for future diffs.
      setSnapshot(newSnap);
    }
  }, [formQ.data, questionsQ.data]);

  const visibleDraftQuestions = draftQuestions.filter((q) => !q.isDeleted);

  const isDirty = useMemo(() => {
    if (!snapshot) return false;
    if (draftForm.title !== snapshot.form.title) return true;
    if ((draftForm.description ?? null) !== (snapshot.form.description ?? null)) return true;
    if (draftForm.display_mode !== snapshot.form.display_mode) return true;
    if ((draftForm.thank_you_message ?? null) !== (snapshot.form.thank_you_message ?? null))
      return true;
    if (visibleDraftQuestions.length !== snapshot.questions.length) return true;
    for (let i = 0; i < visibleDraftQuestions.length; i++) {
      const v = visibleDraftQuestions[i];
      const s = snapshot.questions[i];
      if (v.isNew) return true;
      if (v.id !== s.id) return true;
      if (v.type !== s.type) return true;
      if (v.label !== s.label) return true;
      if (v.required !== s.required) return true;
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
            { ...q, type, options: defaultOptionsForType(type), logic: null }
          : q,
      ),
    );
  const setDraftRequired = (id: string, required: boolean) =>
    setDraftQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, required } : q)));
  const setDraftLogic = (id: string, logic: QuestionLogic) =>
    setDraftQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, logic } : q)));
  const addDraftQuestion = (type: QuestionType) =>
    setDraftQuestions((qs) => [
      ...qs,
      {
        id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
        form_id: formId,
        type,
        label: "Untitled question",
        options: defaultOptionsForType(type),
        position: qs.length,
        required: true,
        logic: null,
        isNew: true,
      },
    ]);
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
      }));

      const { error } = await supabase.rpc("save_form_editor", {
        p_form_id: formId,
        p_form: {
          title: draftForm.title,
          description: draftForm.description,
          display_mode: draftForm.display_mode,
          thank_you_message: draftForm.thank_you_message,
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
      // Force draft to re-sync from fresh server data on the next effect tick.
      setSnapshot(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doDiscard = () => {
    if (!snapshot) return;
    setDraftForm(snapshot.form);
    setDraftQuestions(snapshot.questions.map((q) => ({ ...q })));
    setDiscardOpen(false);
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
            ? "Form closed — no longer accepting responses"
            : "Moved back to draft",
      );
      qc.invalidateQueries({ queryKey: ["form", formId] });
      qc.invalidateQueries({ queryKey: ["forms"] });
      qc.invalidateQueries({ queryKey: ["dashboard-forms"] });
      qc.invalidateQueries({ queryKey: ["public-form", formId] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      await navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete form"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (formQ.isLoading || !snapshot) {
    return (
      <Shell>
        <Skeleton className="h-10 w-64" />
      </Shell>
    );
  }

  const form = formQ.data;
  if (!form || form.user_id !== userId) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Form not found</h1>
        <p className="mt-2 text-ink/60">It may have been deleted, or you don't have access.</p>
        <Link to="/dashboard" className="mt-6 inline-block text-brand underline">
          Back to dashboard
        </Link>
      </Shell>
    );
  }

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

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          {form.status === "published" && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
            >
              <Share2 className="size-4" /> Share
            </button>
          )}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
          >
            <Eye className="size-4" /> Preview
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={() => setDiscardOpen(true)}
              disabled={saveAll.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={() => saveAll.mutate()}
            disabled={!isDirty || saveAll.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveAll.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <header className="mt-6 rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="form-title-edit" className="text-xs">
                Title
              </Label>
              <DebouncedInput
                value={draftForm.title}
                onChange={(v) => setDraftForm((f) => ({ ...f, title: v }))}
                placeholder="Form title"
                className="text-2xl font-extrabold tracking-tight md:text-3xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-description-edit" className="text-xs">
                Description <span className="font-normal text-ink/40">(optional)</span>
              </Label>
              <DebouncedTextarea
                value={draftForm.description ?? ""}
                onChange={(v) => setDraftForm((f) => ({ ...f, description: v === "" ? null : v }))}
                placeholder="What's this form for?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-thanks-edit" className="text-xs">
                Thank-you message{" "}
                <span className="font-normal text-ink/40">(optional, shown after submitting)</span>
              </Label>
              <DebouncedTextarea
                value={draftForm.thank_you_message ?? ""}
                onChange={(v) =>
                  setDraftForm((f) => ({ ...f, thank_you_message: v === "" ? null : v }))
                }
                placeholder="Thanks! Your response was recorded."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Respondent experience</Label>
              <div className="flex gap-2">
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
                    onClick={() => setDraftForm((f) => ({ ...f, display_mode: mode }))}
                    className={
                      "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors " +
                      (draftForm.display_mode === mode
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-ink/15 bg-white text-ink/60 hover:bg-ink/5")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink/40">
                {draftForm.display_mode === "conversational"
                  ? "Respondents see one question at a time with a progress bar — logic jumps apply here."
                  : "Respondents see every question on a single page."}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill status={form.status as FormStatus} />
            {isDirty && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Unsaved changes
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Publish form
            </button>
          )}
          {form.status === "published" && (
            <>
              <button
                type="button"
                onClick={() => setStatus.mutate("closed")}
                disabled={setStatus.isPending}
                title="Stop accepting responses. The link keeps working and shows a closed notice."
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
              >
                Close form
              </button>
              <button
                type="button"
                onClick={() => setStatus.mutate("draft")}
                disabled={setStatus.isPending}
                title="Take the form offline entirely — the link shows an unpublished notice."
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
              >
                Unpublish
              </button>
            </>
          )}
          {form.status === "closed" && (
            <>
              <button
                type="button"
                onClick={() => setStatus.mutate("published")}
                disabled={setStatus.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:shadow-lg hover:shadow-brand/25 disabled:opacity-50"
              >
                Reopen form
              </button>
              <span className="text-xs text-ink/50">
                Closed — the link shows "this survey is closed" and no new responses are accepted.
              </span>
            </>
          )}
        </div>
      </header>

      <div className="mt-8">
        <section>
          <h2 className="text-lg font-bold">Questions</h2>
          <p className="mt-1 text-xs text-ink/50">
            Drag the handle to reorder. Click <span className="font-semibold">Save</span> to keep
            your changes.
          </p>

          {(responseCountQ.data ?? 0) > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This form already has{" "}
              <span className="font-semibold">
                {responseCountQ.data} {responseCountQ.data === 1 ? "response" : "responses"}
              </span>
              . Changing a question's type or deleting it can make those answers hard to interpret
              in your results.
            </div>
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
              <ul className="mt-4 space-y-4">
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
                    onChangeLogic={(logic) => setDraftLogic(q.id, logic)}
                    onDuplicate={() => duplicateDraftQuestion(q.id)}
                    onDelete={() => removeDraftQuestion(q.id)}
                    onMoveUp={() => moveBy(q.id, -1)}
                    onMoveDown={() => moveBy(q.id, 1)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <div className="mt-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:shadow-lg hover:shadow-brand/25"
                >
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
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-5">
          <h2 className="text-sm font-bold text-destructive">Danger zone</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink/60">
              Permanently delete this form
              {(responseCountQ.data ?? 0) > 0
                ? ` and its ${responseCountQ.data} ${responseCountQ.data === 1 ? "response" : "responses"}`
                : ""}
              .
            </p>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-white px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="size-4" /> Delete form
            </button>
          </div>
        </section>
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
            <DialogTitle className="text-2xl font-extrabold tracking-tight">
              {draftForm.title || "Untitled form"}
            </DialogTitle>
            {draftForm.description ? (
              <DialogDescription className="text-base text-ink/60">
                {draftForm.description}
              </DialogDescription>
            ) : null}
            <p className="mt-2 text-xs uppercase tracking-wide text-ink/40">
              {isDirty
                ? "Preview — includes unsaved changes"
                : "Preview — this is what respondents will see"}
            </p>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            {visibleDraftQuestions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink/15 p-6 text-center text-sm text-ink/50">
                No questions yet — add one to see a preview.
              </p>
            ) : draftForm.display_mode === "conversational" ? (
              <ConversationalForm
                questions={visibleDraftQuestions}
                answers={previewAnswers}
                onAnswer={(qid, v) => setPreviewAnswers((a) => ({ ...a, [qid]: v }))}
                onSubmit={() => {}}
                preview
              />
            ) : (
              visibleDraftQuestions.map((q, i) => (
                <div key={q.id} className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/40">
                    Question {i + 1}
                    {!q.required && (
                      <span className="ml-2 font-medium text-ink/35">· Optional</span>
                    )}
                  </p>
                  <QuestionRender
                    question={q}
                    value={previewAnswers[q.id]}
                    onChange={(v) => setPreviewAnswers((a) => ({ ...a, [q.id]: v }))}
                  />
                </div>
              ))
            )}

            {visibleDraftQuestions.length > 0 && draftForm.display_mode === "classic" && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-ink/50">Responses aren't recorded in preview.</p>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground opacity-60"
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
        title="Discard changes?"
        description="All unsaved changes will be lost. This cannot be undone."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={doDiscard}
        onCancel={() => setDiscardOpen(false)}
      />

      <ConfirmDialog
        open={blocker.status === "blocked"}
        title="Leave without saving?"
        description="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </Shell>
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
  onChangeLogic: (logic: QuestionLogic) => void;
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

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm"
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
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Q{index + 1}
          </span>
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
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <select
            value={question.type}
            onChange={(e) => onChangeType(e.target.value as QuestionType)}
            className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

      {(() => {
        const cfg = getChoiceConfig(question.options);
        const jumpEligible =
          question.type === "dropdown" ||
          question.type === "yes_no" ||
          (question.type === "multiple_choice" && !cfg.multi);
        if (!jumpEligible) return null;
        const choices = question.type === "yes_no" ? ["Yes", "No"] : cfg.choices;
        if (choices.length === 0) return null;
        const jumps = question.logic?.jumps ?? {};
        const setJump = (choice: string, target: string) => {
          const next = { ...jumps };
          if (target === "") delete next[choice];
          else next[choice] = target;
          onChangeLogic(Object.keys(next).length > 0 ? { jumps: next } : null);
        };
        return (
          <details
            className="mt-4 rounded-xl bg-surface/60 p-3"
            open={Object.keys(jumps).length > 0}
          >
            <summary className="cursor-pointer text-xs font-semibold text-ink/70">
              Logic jumps{" "}
              <span className="font-normal text-ink/40">
                — route respondents based on their answer (conversational mode)
              </span>
            </summary>
            <div className="mt-3 space-y-2">
              {choices.map((choice) => (
                <div key={choice} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink/70">
                    If <span className="font-semibold text-ink">"{choice}"</span>
                  </span>
                  <select
                    value={jumps[choice] ?? ""}
                    onChange={(e) => setJump(choice, e.target.value)}
                    className="w-52 rounded-md border border-input bg-white px-2 py-1.5 text-xs shadow-sm"
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
          </details>
        );
      })()}

      <div className="mt-4 flex items-center gap-2 border-t border-ink/5 pt-3">
        <Switch
          id={`q-${question.id}-required`}
          checked={question.required}
          onCheckedChange={onChangeRequired}
        />
        <Label htmlFor={`q-${question.id}-required`} className="text-xs font-normal">
          Required
        </Label>
      </div>
    </li>
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
  value,
  onChange,
  placeholder,
  delay,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}) {
  const { local, onLocalChange, flush } = useDebouncedLocal(value, onChange, delay);
  return (
    <Input
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
  value,
  onChange,
  placeholder,
  delay,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  delay?: number;
  rows?: number;
}) {
  const { local, onLocalChange, flush } = useDebouncedLocal(value, onChange, delay);
  return (
    <Textarea
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
