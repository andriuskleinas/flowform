const widthClass = {
  sm: "max-w-2xl px-6 py-12 md:px-8 md:py-16",
  md: "max-w-5xl px-6 py-10 md:px-8 md:py-14",
  lg: "max-w-6xl px-6 py-10 md:px-8 md:py-14",
} as const;

export function Shell({
  children,
  width = "lg",
}: {
  children: React.ReactNode;
  width?: keyof typeof widthClass;
}) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className={`mx-auto ${widthClass[width]}`}>{children}</main>
    </div>
  );
}
