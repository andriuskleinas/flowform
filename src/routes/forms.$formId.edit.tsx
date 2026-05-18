import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Eye,
  GripVertical,
  Plus,
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
import { type QuestionOptions, getRatingMax, getMcOptions } from "@/lib/form-utils";
import { StatusPill } from "@/components/status-pill";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/forms/$formId/edit")({
  component: EditFormPage,
});

function EditFormPage() {
  const { formId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: `/forms/${formId}/edit` } });
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

const TYPE_DEFAULTS: Record<QuestionType, { label: string; options: QuestionOptions }> = {
  text: { label: "Untitled question", options: null },
  multiple_choice: { label: "Untitled question", options: ["Option 1", "Option 2"] },
  rating: { label: "Untitled question", options: { max: 5 } },
};

type DraftQuestion = Question & { isNew?: boolean; isDeleted?: boolean };

function snapshotKey(
  form: { title: string; description: string | null },
  questions: Array<Pick<Question, "id" | "type" | "label" | "options">>,
) {
  return JSON.stringify({
    title: form.title.trim(),
    description: (form.description ?? "").trim(),
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label.trim(),
      options: q.options ?? null,
    })),
  });
}

function EditFormAuthed({ formId, userId }: { formId: string; userId: string }) {
  const qc = useQueryClient();

  const formQ = useQuery({
    queryKey: ["form", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, description, user_id, status")
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
        .select("id, form_id, type, label, options, position")
        .eq("form_id", formId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Question[];
    },
  });

  // Local draft state — server-truth is mirrored in `snapshot`.
  const [snapshot, setSnapshot] = useState<{
    form: { title: string; description: string | null };
    questions: Question[];
  } | null>(null);
  const [draftForm, setDraftForm] = useState<{ title: string; description: string | null }>({
    title: "",
    description: null,
  });
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [discardOpen, setDiscardOpen] = useState(false);

  // Initialize / re-sync draft from server when (a) we don't have one yet,
  // or (b) the server snapshot changed AND the user has no unsaved changes.
  useEffect(() => {
    const sf = formQ.data;
    if (!sf) return;
    const sq = questionsQ.data ?? [];
    const newSnap = {
      form: { title: sf.title, description: sf.description ?? null },
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
    if (visibleDraftQuestions.length !== snapshot.questions.length) return true;
    for (let i = 0; i < visibleDraftQuestions.length; i++) {
      const v = visibleDraftQuestions[i];
      const s = snapshot.questions[i];
      if (v.isNew) return true;
      if (v.id !== s.id) return true;
      if (v.type !== s.type) return true;
      if (v.label !== s.label) return true;
      if (JSON.stringify(v.options ?? null) !== JSON.stringify(s.options ?? null)) return true;
    }
    return false;
  }, [draftForm, visibleDraftQuestions, snapshot]);

  // Block in-app navigation away while there are unsaved changes.
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    enableBeforeUnload: isDirty,
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
          ? { ...q, type, options: TYPE_DEFAULTS[type].options }
          : q,
      ),
    );
  const addDraftQuestion = (type: QuestionType) =>
    setDraftQuestions((qs) => [
      ...qs,
      {
        id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
        form_id: formId,
        type,
        label: TYPE_DEFAULTS[type].label,
        options: TYPE_DEFAULTS[type].options,
        position: qs.length,
        isNew: true,
      },
    ]);
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

      // 1. Prepare form patch (runs concurrently with question ops below).
      const trimmedTitle = draftForm.title.trim() || "Untitled form";
      const trimmedDesc =
        draftForm.description && draftForm.description.trim() !== ""
          ? draftForm.description.trim()
          : null;
      const formPatch: { title?: string; description?: string | null } = {};
      if (trimmedTitle !== snapshot.form.title) formPatch.title = trimmedTitle;
      if ((trimmedDesc ?? null) !== (snapshot.form.description ?? null))
        formPatch.description = trimmedDesc;
      const formPatchOp =
        Object.keys(formPatch).length > 0
          ? supabase.from("forms").update(formPatch).eq("id", formId).then(({ error }) => {
              if (error) throw error;
            })
          : Promise.resolve();

      // 2. Build inserts + updates (positions = visible draft order).
      const visible = draftQuestions.filter((q) => !q.isDeleted);
      const newRows: {
        form_id: string;
        type: QuestionType;
        label: string;
        options: QuestionOptions;
        position: number;
      }[] = [];
      const updateOps: Promise<void>[] = [];

      for (let i = 0; i < visible.length; i++) {
        const q = visible[i];
        const label = q.label.trim() || "Untitled question";
        if (q.isNew) {
          newRows.push({ form_id: formId, type: q.type, label, options: q.options ?? null, position: i });
        } else {
          const orig = snapshot.questions.find((o) => o.id === q.id);
          const patch: { position: number; type?: QuestionType; label?: string; options?: QuestionOptions } = { position: i };
          if (orig) {
            if (orig.type !== q.type) patch.type = q.type;
            if (orig.label !== label) patch.label = label;
            if (JSON.stringify(orig.options ?? null) !== JSON.stringify(q.options ?? null))
              patch.options = q.options ?? null;
          } else {
            patch.type = q.type;
            patch.label = label;
            patch.options = q.options ?? null;
          }
          updateOps.push(
            supabase.from("questions").update(patch).eq("id", q.id).then(({ error }) => {
              if (error) throw error;
            }),
          );
        }
      }

      // Run form patch, batch insert, and all updates concurrently.
      const insertOp =
        newRows.length > 0
          ? supabase.from("questions").insert(newRows).then(({ error }) => {
              if (error) throw error;
            })
          : Promise.resolve();

      await Promise.all([formPatchOp, insertOp, ...updateOps]);

      // Deletes run last: if anything above fails, we haven't lost data yet.
      const toDeleteIds = draftQuestions.filter((q) => !q.isNew && q.isDeleted).map((q) => q.id);
      if (toDeleteIds.length > 0) {
        const { error } = await supabase.from("questions").delete().in("id", toDeleteIds);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Saved");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["form", formId] }),
        qc.invalidateQueries({ queryKey: ["questions", formId] }),
        qc.invalidateQueries({ queryKey: ["public-form", formId] }),
        qc.invalidateQueries({ queryKey: ["public-questions", formId] }),
        qc.invalidateQueries({ queryKey: ["forms"] }),
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

  /* -------------------------------- Publish -------------------------------- */

  const togglePublish = useMutation({
    mutationFn: async (next: "draft" | "published") => {
      const { error } = await supabase.from("forms").update({ status: next }).eq("id", formId);
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      toast.success(next === "published" ? "Form published" : "Moved back to draft");
      qc.invalidateQueries({ queryKey: ["form", formId] });
      qc.invalidateQueries({ queryKey: ["forms"] });
      qc.invalidateQueries({ queryKey: ["public-form", formId] });
    },
    onError: (e: Error) => toast.error(e.message),
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
              <Label htmlFor="form-title-edit" className="text-xs">Title</Label>
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
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill status={form.status as "draft" | "published"} />
            {isDirty && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Unsaved changes
              </span>
            )}
          </div>
        </div>
        <div className="mt-4">
          {form.status === "published" ? (
            <button
              type="button"
              onClick={() => togglePublish.mutate("draft")}
              disabled={togglePublish.isPending}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => togglePublish.mutate("published")}
              disabled={
                togglePublish.isPending || visibleDraftQuestions.length === 0 || isDirty
              }
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
        </div>
      </header>

      <div className="mt-8">
        <section>
          <h2 className="text-lg font-bold">Questions</h2>
          <p className="mt-1 text-xs text-ink/50">
            Drag the handle to reorder. Click <span className="font-semibold">Save</span> to keep your changes.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                    onChangeLabel={(label) => setDraftLabel(q.id, label)}
                    onChangeOptions={(options) => setDraftOptions(q.id, options)}
                    onChangeType={(type) => setDraftType(q.id, type)}
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
                <DropdownMenuItem onClick={() => addDraftQuestion("text")}>
                  Short answer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addDraftQuestion("multiple_choice")}>
                  Multiple choice
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addDraftQuestion("rating")}>
                  Rating scale
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>
      </div>

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
            ) : (
              visibleDraftQuestions.map((q, i) => (
                <div key={q.id} className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/40">
                    Question {i + 1}
                  </p>
                  <QuestionRender
                    question={q}
                    value={previewAnswers[q.id]}
                    onChange={(v) => setPreviewAnswers((a) => ({ ...a, [q.id]: v }))}
                  />
                </div>
              ))
            )}

            {visibleDraftQuestions.length > 0 && (
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
        onConfirm={() => blocker.proceed()}
        onCancel={() => blocker.reset()}
      />
    </Shell>
  );
}

/* ------------------------------ Sortable card ------------------------------ */

function SortableQuestionCard({
  question,
  index,
  total,
  onChangeLabel,
  onChangeOptions,
  onChangeType,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: Question;
  index: number;
  total: number;
  onChangeLabel: (label: string) => void;
  onChangeOptions: (options: QuestionOptions) => void;
  onChangeType: (type: QuestionType) => void;
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
            onChange={(v) => {
              const trimmed = v.trim();
              if (trimmed && trimmed !== question.label) onChangeLabel(trimmed);
            }}
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
            <option value="text">Short answer</option>
            <option value="multiple_choice">Multiple choice</option>
            <option value="rating">Rating scale</option>
          </select>
        </div>
      </div>

      {question.type === "multiple_choice" && (
        <div className="mt-4">
          <OptionsEditor
            options={getMcOptions(question.options)}
            onChange={onChangeOptions}
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
            {[3, 5, 7, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}
    </li>
  );
}

/* ----------------------------- Debounced input ----------------------------- */

function useDebouncedLocal(
  value: string,
  onChange: (v: string) => void,
  delay = 600,
) {
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

