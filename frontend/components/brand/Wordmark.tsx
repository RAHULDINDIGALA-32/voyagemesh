import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-baseline gap-2 text-ink no-underline">
      <span className="font-mono text-[11px] tracking-[0.18em] text-brass">VM</span>
      <span className="font-display text-lg tracking-tight">VoyageMesh</span>
    </Link>
  );
}
