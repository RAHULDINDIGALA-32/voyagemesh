import Link from "next/link";

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="VoyageMesh home"
      className={`inline-flex items-baseline gap-2 text-ink no-underline ${className}`}
    >
      <span className="font-mono text-[11px] tracking-[0.18em] text-brass">VM</span>
      <span className="font-display text-lg tracking-tight">VoyageMesh</span>
    </Link>
  );
}
