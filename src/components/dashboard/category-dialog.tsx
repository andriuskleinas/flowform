import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_COLORS,
  CATEGORY_NAME_MAX,
  COLOR_CLASSES,
  categoryErrorMessage,
  colorClasses,
  invalidateCategoryViews,
  normalizeCategoryName,
  suggestColor,
  useCategories,
  useCreateCategory,
  type CategoryColor,
  type FormCategory,
} from "@/lib/categories";

/* --------------------------------- Atoms --------------------------------- */

export function CategoryDot({
  color,
  className = "",
}: {
  color: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2 shrink-0 rounded-full ${colorClasses(color).dot} ${className}`}
    />
  );
}

export function CategoryTag({ name, color }: { name: string | null; color: string | null }) {
  if (!name) return null;
  return (
    <span
      className={`inline-flex max-w-[12rem] items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${colorClasses(color).tag}`}
    >
      <CategoryDot color={color} className="size-1.5" />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: CategoryColor;
  onChange: (c: CategoryColor) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1.5">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={COLOR_CLASSES[c].label}
          title={COLOR_CLASSES[c].label}
          onClick={() => onChange(c)}
          className={
            "flex size-6 items-center justify-center rounded-full ring-offset-2 transition-shadow " +
            COLOR_CLASSES[c].dot +
            (value === c ? " ring-2 ring-ink/60" : " hover:ring-2 hover:ring-ink/20")
          }
        >
          {value === c && <Check className="size-3.5 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

/* ------------------------- Pick or create (one form) ---------------------- */

/**
 * Choose a form's category: pick an existing one, create a new one inline
 * (name + colour), or clear it. Resolves to a category id (or null).
 */
export function CategoryDialog({
  open,
  userId,
  formTitle,
  currentId,
  pending = false,
  onSave,
  onCancel,
}: {
  open: boolean;
  userId: string;
  formTitle?: string;
  currentId: string | null;
  pending?: boolean;
  onSave: (categoryId: string | null) => void;
  onCancel: () => void;
}) {
  const { data: categories = [] } = useCategories(userId);
  const create = useCreateCategory(userId);
  const [selected, setSelected] = useState<string | null>(currentId);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<CategoryColor>("blue");

  useEffect(() => {
    if (!open) return;
    setSelected(currentId);
    setNewName("");
    setNewColor(suggestColor(categories));
    // Only reset when the dialog (re)opens, not on every categories refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentId]);

  const typed = normalizeCategoryName(newName);
  // Typing an existing name (any case) just selects it, so "events" never
  // tries to create a second "Events".
  const typedMatch = typed
    ? categories.find((c) => c.name.toLowerCase() === typed.toLowerCase())
    : undefined;
  const effective = typed ? (typedMatch?.id ?? "__new__") : selected;
  const unchanged = effective === currentId;
  const busy = pending || create.isPending;

  const submit = async () => {
    if (busy || unchanged) return;
    if (effective !== "__new__") return onSave(effective);
    try {
      const created = await create.mutateAsync({ name: typed, color: newColor });
      onSave(created.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Category</DialogTitle>
          <DialogDescription className="truncate">
            {formTitle ? `File “${formTitle}” under a topic.` : "File this form under a topic."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {categories.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink/60">Your categories</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const active = effective === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setNewName("");
                        setSelected(c.id);
                      }}
                      className={
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors " +
                        (active
                          ? "border-ink bg-ink text-paper"
                          : "border-hairline bg-card text-ink/75 hover:border-ink/25 hover:text-ink")
                      }
                    >
                      <CategoryDot color={c.color} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={categories.length > 0 ? "mt-5" : ""}>
            <label htmlFor="new-category" className="text-xs font-medium text-ink/60">
              {categories.length > 0 ? "Or create a new one" : "Create a category"}
            </label>
            <div className="relative mt-1.5">
              <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
              <Input
                id="new-category"
                autoComplete="off"
                autoFocus={categories.length === 0}
                value={newName}
                maxLength={CATEGORY_NAME_MAX}
                placeholder="e.g. Events, HR, Product research"
                onChange={(e) => setNewName(e.target.value)}
                className="pl-9"
              />
            </div>
            {typed && !typedMatch && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs text-ink/50">Colour</p>
                <ColorPicker value={newColor} onChange={setNewColor} />
              </div>
            )}
            {typedMatch && (
              <p className="mt-2 text-xs text-ink/50">
                You already have “{typedMatch.name}” — it will be used.
              </p>
            )}
          </div>

          <DialogFooter className="mt-6 gap-2 sm:justify-between">
            <button
              type="button"
              disabled={busy || !currentId}
              onClick={() => onSave(null)}
              className="h-9 rounded-md px-3 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-0"
            >
              Remove category
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 rounded-md border border-hairline bg-card px-3.5 text-sm hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || unchanged || effective === null}
                className="h-9 rounded-md bg-ink px-3.5 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-40"
              >
                {busy ? "Saving…" : effective === "__new__" ? "Create and save" : "Save"}
              </button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline "Category: [tag] Change" control for the editor and new-form page.
 * Opens CategoryDialog; `onChange` receives the chosen id.
 */
export function CategoryField({
  userId,
  value,
  onChange,
  pending = false,
}: {
  userId: string;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  pending?: boolean;
}) {
  const { data: categories = [] } = useCategories(userId);
  const [open, setOpen] = useState(false);
  const current = categories.find((c) => c.id === value) ?? null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-hairline bg-card px-2.5 text-xs text-ink/70 transition-colors hover:border-ink/25 hover:text-ink disabled:opacity-50"
      >
        {current ? (
          <>
            <CategoryDot color={current.color} />
            <span className="max-w-[10rem] truncate font-medium text-ink">{current.name}</span>
            <Pencil className="size-3 text-ink/40" />
          </>
        ) : (
          <>
            <Tag className="size-3.5" />
            Add category
          </>
        )}
      </button>
      <CategoryDialog
        open={open}
        userId={userId}
        currentId={value}
        pending={pending}
        onSave={(id) => {
          setOpen(false);
          onChange(id);
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/* ------------------------------ Manage (all) ------------------------------ */

export function ManageCategoriesDialog({
  open,
  onOpenChange,
  userId,
  formCounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Number of forms per category id. */
  formCounts: Map<string, number>;
}) {
  const { data: categories = [], isLoading } = useCategories(userId);
  const create = useCreateCategory(userId);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<CategoryColor>("blue");

  useEffect(() => {
    if (open) {
      setNewName("");
      setNewColor(suggestColor(categories));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const add = async () => {
    const name = normalizeCategoryName(newName);
    if (!name || create.isPending) return;
    try {
      const created = await create.mutateAsync({ name, color: newColor });
      setNewName("");
      setNewColor(suggestColor([...categories, created]));
      toast.success(`Created “${created.name}”`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
          <DialogDescription>
            Topics for grouping and filtering your forms. Renaming or recolouring updates every form
            in the category.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          className="rounded-lg border border-hairline bg-surface p-3"
        >
          <label htmlFor="manage-new-category" className="text-xs font-medium text-ink/60">
            New category
          </label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id="manage-new-category"
              autoComplete="off"
              value={newName}
              maxLength={CATEGORY_NAME_MAX}
              placeholder="e.g. Events"
              onChange={(e) => setNewName(e.target.value)}
              className="bg-card"
            />
            <button
              type="submit"
              disabled={!normalizeCategoryName(newName) || create.isPending}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-40"
            >
              <Plus className="size-4" /> Add
            </button>
          </div>
          <div className="mt-2.5">
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
        </form>

        <div className="max-h-[50vh] overflow-y-auto">
          {isLoading ? null : categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/50">
              No categories yet. Add one above, then file forms under it from the ⋯ menu or the
              editor.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {categories.map((c) => (
                <CategoryRow
                  key={c.id}
                  userId={userId}
                  category={c}
                  formCount={formCounts.get(c.id) ?? 0}
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({
  userId,
  category: c,
  formCount,
}: {
  userId: string;
  category: FormCategory;
  formCount: number;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(c.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => setName(c.name), [c.name]);

  const update = useMutation({
    mutationFn: async (patch: { name?: string; color?: CategoryColor }) => {
      const { error } = await supabase.from("form_categories").update(patch).eq("id", c.id);
      if (error) throw new Error(categoryErrorMessage(error, patch.name));
    },
    onSuccess: () => invalidateCategoryViews(qc, userId),
    onError: (e: Error) => {
      setName(c.name);
      toast.error(e.message);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      // forms.category_id is set to NULL by the FK (ON DELETE SET NULL).
      const { error } = await supabase.from("form_categories").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(`Deleted “${c.name}”`);
      await invalidateCategoryViews(qc, userId);
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete category"),
  });

  const commitName = () => {
    const clean = normalizeCategoryName(name);
    if (!clean) return setName(c.name);
    if (clean !== c.name) update.mutate({ name: clean });
    else setName(c.name);
  };

  return (
    <li className="flex items-center gap-2 py-2">
      <Popover open={colorOpen} onOpenChange={setColorOpen}>
        <PopoverTrigger
          aria-label={`Change colour of ${c.name}`}
          title="Change colour"
          className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-ink/5"
        >
          <CategoryDot color={c.color} className="size-3" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2.5">
          <ColorPicker
            value={c.color}
            onChange={(color) => {
              setColorOpen(false);
              if (color !== c.color) update.mutate({ color });
            }}
          />
        </PopoverContent>
      </Popover>

      <Input
        aria-label="Category name"
        autoComplete="off"
        value={name}
        maxLength={CATEGORY_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") setName(c.name);
        }}
        className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-2 shadow-none hover:border-hairline focus:border-input focus:bg-card"
      />

      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-ink/45">
        {formCount} {formCount === 1 ? "form" : "forms"}
      </span>

      {confirmDelete ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            title={
              formCount > 0
                ? `${formCount} ${formCount === 1 ? "form becomes" : "forms become"} uncategorized`
                : undefined
            }
            className="h-7 rounded-md bg-destructive px-2 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            aria-label="Cancel delete"
            onClick={() => setConfirmDelete(false)}
            className="rounded-md p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${c.name}`}
          title={
            formCount > 0
              ? `Delete — its ${formCount} ${formCount === 1 ? "form stays" : "forms stay"}, uncategorized`
              : "Delete"
          }
          onClick={() => setConfirmDelete(true)}
          className="shrink-0 rounded-md p-2 text-ink/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}
