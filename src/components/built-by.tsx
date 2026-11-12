/** Portfolio credit shown in every footer. Inherits size and muted colour. */
export function BuiltBy() {
  return (
    <span>
      Built by{" "}
      <a
        href="https://github.com/andriuskleinas"
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink/75 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink/50"
      >
        Andrius Kleinas
      </a>
    </span>
  );
}
