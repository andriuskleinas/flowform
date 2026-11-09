import { useEffect, useState } from "react";
import { Check, Tag } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const CATEGORY_MAX = 40;

/**
 * Pick an existing category, type a new one, or clear it. Categories are
 * free text on `forms.category`; the dashboard derives the list from forms.
 */
export function CategoryDialog({
  open,
  formTitle,
  current,
  categories,
  pending,
  onSave,
  onCancel,
}: {
  open: boolean;
  formTitle: string;
  current: string | null;
  categories: string[];
  pending: boolean;
  onSave: (category: string | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(current ?? "");

  useEffect(() => {
    if (open) setValue(current ?? "");
  }, [open, current]);

  const trimmed = value.trim().replace(/\s+/g, " ");
  // Reuse the existing spelling when the typed name matches case-insensitively,
  // so "events" doesn't create a second "Events" group.
  const resolved = categories.find((c) => c.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
  const unchanged = (resolved || null) === (current ?? null);

  const submit = () => {
    if (pending || unchanged) return;
    onSave(resolved ? resolved.slice(0, CATEGORY_MAX) : null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set category</DialogTitle>
          <DialogDescription className="truncate">
            Group “{formTitle}” with related forms on your dashboard.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="category-input" className="text-xs font-medium text-ink/60">
            Category name
          </label>
          <div className="relative mt-1.5">
            <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
            <Input
              id="category-input"
              autoFocus
              value={value}
              maxLength={CATEGORY_MAX}
              placeholder="e.g. Events, HR, Product research"
              onChange={(e) => setValue(e.target.value)}
              className="pl-9"
            />
          </div>

          {categories.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-ink/60">Existing categories</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const active = c.toLowerCase() === trimmed.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setValue(c)}
                      className={
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors " +
                        (active
                          ? "border-brand/40 bg-brand/10 text-brand"
                          : "border-hairline bg-white text-ink/70 hover:border-ink/25 hover:text-ink")
                      }
                    >
                      {active && <Check className="size-3" />}
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 gap-2 sm:justify-between">
            <button
              type="button"
              disabled={pending || !current}
              onClick={() => onSave(null)}
              className="h-9 rounded-md px-3 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-0"
            >
              Remove category
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 rounded-md border border-hairline bg-white px-3.5 text-sm hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || unchanged}
                className="h-9 rounded-md bg-ink px-3.5 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-40"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
