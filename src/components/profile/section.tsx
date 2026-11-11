import { cn } from "@/lib/utils";

/** One titled block of the profile page; `id` is the in-page nav anchor. */
export function ProfileSection({
  id,
  title,
  description,
  danger = false,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2
        id={`${id}-heading`}
        className={cn("text-xl md:text-xl", danger ? "text-destructive" : "text-ink")}
      >
        {title}
      </h2>
      {description && <p className="mt-1.5 text-sm text-ink/60">{description}</p>}
      <div
        className={cn(
          "mt-5 rounded-xl border bg-card",
          danger ? "border-destructive/30" : "border-hairline",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** A row inside a section card, separated by hairlines. */
export function SectionRow({
  title,
  description,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-t border-hairline p-5 first:border-t-0 md:flex-row md:items-center md:justify-between md:p-6",
        className,
      )}
    >
      {(title || description) && (
        <div className="min-w-0">
          {title && <p className="text-sm font-medium text-ink">{title}</p>}
          {description && <p className="mt-0.5 text-sm text-ink/55">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export const btnPrimary =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:pointer-events-none disabled:opacity-50";

export const btnSecondary =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-hairline bg-card px-3.5 text-sm font-medium text-ink transition-colors hover:border-ink/25 hover:bg-ink/[0.03] disabled:pointer-events-none disabled:opacity-50";

export const btnDanger =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-destructive/40 bg-card px-3.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50";
