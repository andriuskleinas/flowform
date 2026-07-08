import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function buildEmbedSnippet(url: string) {
  return `<iframe src="${url}" width="100%" height="600" style="border:none;border-radius:12px" title="Flowform survey"></iframe>`;
}

/**
 * Share hub for a published/closed form: copy link, QR code for print or
 * in-person use, embed snippet, and the native share sheet on devices that
 * support it.
 */
export function ShareFormDialog({
  open,
  onOpenChange,
  formId,
  formTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formTitle: string;
}) {
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  // window.location isn't available during SSR; resolve on mount.
  const [origin, setOrigin] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    if (!open) setCopied(null);
  }, [open]);

  const url = `${origin}/forms/${formId}`;
  const embed = buildEmbedSnippet(url);

  const copy = async (text: string, which: "link" | "embed") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: formTitle, url });
    } catch {
      // User dismissed the share sheet — not an error.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share your form</DialogTitle>
          <DialogDescription className="truncate">{formTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="share-link" className="text-xs text-ink/60">
              Link
            </Label>
            <div className="flex items-center gap-2">
              <Input id="share-link" readOnly value={url} onFocus={(e) => e.target.select()} />
              <button
                type="button"
                onClick={() => copy(url, "link")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:shadow-lg hover:shadow-brand/25"
              >
                {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied === "link" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4">
            <div className="shrink-0 rounded-lg bg-white p-1.5">
              {origin && <QRCode value={url} size={104} aria-label="QR code for form link" />}
            </div>
            <div className="text-sm text-ink/60">
              <p className="font-semibold text-ink">QR code</p>
              <p className="mt-1">
                Point a phone camera at it — great for posters, slides, and in-person events.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="share-embed" className="text-xs text-ink/60">
                Embed on your site
              </Label>
              <button
                type="button"
                onClick={() => copy(embed, "embed")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                {copied === "embed" ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied === "embed" ? "Copied" : "Copy snippet"}
              </button>
            </div>
            <Textarea
              id="share-embed"
              readOnly
              rows={3}
              value={embed}
              onFocus={(e) => e.target.select()}
              className="font-mono text-xs"
            />
          </div>

          {canNativeShare && (
            <button
              type="button"
              onClick={nativeShare}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-ink/5"
            >
              <Share2 className="size-4" /> Share via…
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
