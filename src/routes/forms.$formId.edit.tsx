import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuestionRender, type Question, type QuestionType } from "@/components/question-render";

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

const TYPE_DEFAULTS: Record<QuestionType, { label: string; options: any }> = {
  text: { label: "Untitled question", options: null },
  multiple_choice: { label: "Untitled question", options: ["Option 1", "Option 2"] },
  rating: { label: "Untitled question", options: { max: 5 } },
};

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["questions", formId] });
    qc.invalidateQueries({ queryKey: ["public-questions", formId] });
  };

  const addQuestion = useMutation({
    mutationFn: async (type: QuestionType) => {
      const list = questionsQ.data ?? [];
      const position = list.length;
      const { error } = await supabase.from("questions").insert({
        form_id: formId,
        type,
        label: TYPE_DEFAULTS[type].label,
        options: TYPE_DEFAULTS[type].options,
        position,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Question> }) => {
      const { error } = await supabase.from("questions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  // Persist a full reorder by writing each row's new position.
  const reorder = useMutation({
    mutationFn: async (ordered: Question[]) => {
      // Optimistic cache update
      qc.setQueryData(
        ["questions", formId],
        ordered.map((q, i) => ({ ...q, position: i })),
      );
      for (let i = 0; i < ordered.length; i++) {
        const q = ordered[i];
        if (q.position === i) continue;
        const { error } = await supabase
          .from("questions")
          .update({ position: i })
          .eq("id", q.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: Error) => {
      toast.error(e.message);
      invalidate();
    },
  });

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

  if (formQ.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-64" />
      </Shell>
    );
  }

  if (!formQ.data || formQ.data.user_id !== userId) {
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

  const form = formQ.data;
  const questions = questionsQ.data ?? [];
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/forms/${formId}` : "";

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(questions, oldIndex, newIndex);
    reorder.mutate(next);
  };

  const moveBy = (id: string, delta: number) => {
    const idx = questions.findIndex((q) => q.id === id);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= questions.length) return;
    reorder.mutate(arrayMove(questions, idx, target));
  };

  const changeType = (q: Question, type: QuestionType) => {
    if (q.type === type) return;
    updateQuestion.mutate({
      id: q.id,
      patch: { type, options: TYPE_DEFAULTS[type].options },
    });
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
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          title="Opens the page respondents see in a new tab"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
        >
          <ExternalLink className="size-4" /> Preview public form
        </a>
      </div>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{form.title}</h1>
          <StatusPill status={form.status as "draft" | "published"} />
        </div>
        {form.description && <p className="mt-2 text-ink/60">{form.description}</p>}
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
              disabled={togglePublish.isPending || questions.length === 0}
              title={questions.length === 0 ? "Add at least one question first" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Publish form
            </button>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Editor */}
        <section>
          <h2 className="text-lg font-bold">Questions</h2>
          <p className="mt-1 text-xs text-ink/50">
            Drag the handle to reorder. Edits save automatically.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <ul className="mt-4 space-y-4">
                {questions.map((q, i) => (
                  <SortableQuestionCard
                    key={q.id}
                    question={q}
                    index={i}
                    total={questions.length}
                    onChangeLabel={(label) => updateQuestion.mutate({ id: q.id, patch: { label } })}
                    onChangeOptions={(options) => updateQuestion.mutate({ id: q.id, patch: { options } })}
                    onChangeType={(type) => changeType(q, type)}
                    onDelete={() => deleteQuestion.mutate(q.id)}
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
                <DropdownMenuItem onClick={() => addQuestion.mutate("text")}>
                  Short answer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion.mutate("multiple_choice")}>
                  Multiple choice
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion.mutate("rating")}>
                  Rating scale
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>

        {/* Preview */}
        <section className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-lg font-bold">Preview</h2>
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h3 className="text-2xl font-extrabold tracking-tight">{form.title}</h3>
            {form.description && <p className="mt-2 text-sm text-ink/60">{form.description}</p>}
            <div className="mt-6 space-y-6">
              {questions.length === 0 && (
                <p className="text-sm text-ink/40">No questions yet — add one to see a preview.</p>
              )}
              {questions.map((q) => (
                <QuestionRender key={q.id} question={q} value={undefined} disabled />
              ))}
            </div>
          </div>
        </section>
      </div>
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
  onChangeOptions: (options: any) => void;
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
            options={Array.isArray(question.options) ? question.options : []}
            onChange={onChangeOptions}
          />
        </div>
      )}

      {question.type === "rating" && (
        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">Max rating</Label>
          <select
            value={question.options?.max ?? 5}
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

function DebouncedInput({
  value,
  onChange,
  placeholder,
  delay = 600,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  delay?: number;
}) {
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

  return (
    <Input
      value={local}
      placeholder={placeholder}
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      onChange={(e) => {
        setLocal(e.target.value);
        schedule(e.target.value);
      }}
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
  const [draft, setDraft] = useState(options);
  useEffect(() => setDraft(options), [options.join("\u0001")]);

  const commit = (next: string[]) => {
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Options</Label>
      {draft.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            onChange={(e) => setDraft(draft.map((o, j) => (j === i ? e.target.value : o)))}
            onBlur={() => onChange(draft)}
          />
          <button
            type="button"
            onClick={() => commit(draft.filter((_, j) => j !== i))}
            className="rounded p-2 text-ink/50 hover:bg-ink/5"
            aria-label="Remove option"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => commit([...draft, `Option ${draft.length + 1}`])}
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="mx-auto max-w-6xl px-6 py-10 md:px-8 md:py-14">{children}</main>
    </div>
  );
}

export function StatusPill({ status }: { status: "draft" | "published" }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" /> Published live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-semibold text-ink/60">
      <span className="size-1.5 rounded-full bg-ink/40" /> Draft
    </span>
  );
}
