import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Destructive-action dialog for deleting a form. Requires typing the form's
 * title to enable the delete button — deleting also removes every response,
 * so a plain two-button confirm is too easy to click through.
 */
export function DeleteFormDialog({
  open,
  formTitle,
  responseCount,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  formTitle: string;
  /** Number of responses that will be deleted along with the form, if known. */
  responseCount?: number;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const matches = typed.trim() === formTitle.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert className="size-4" />
            </span>
            Delete this form?
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-ink">"{formTitle}"</span>
            {typeof responseCount === "number" && responseCount > 0 ? (
              <>
                {" "}
                and its{" "}
                <span className="font-semibold text-ink">
                  {responseCount} {responseCount === 1 ? "response" : "responses"}
                </span>{" "}
                will be permanently deleted.
              </>
            ) : (
              <> will be permanently deleted.</>
            )}{" "}
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches && !pending) onConfirm();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm-title" className="text-xs text-ink/60">
              Type the form title to confirm
            </Label>
            <Input
              id="delete-confirm-title"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={formTitle}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!matches || pending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete form"
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
