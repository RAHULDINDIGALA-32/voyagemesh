import Link from "next/link";
import { CompassMark } from "@/components/brand/CompassMark";

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="VoyageMesh home"
      className={`inline-flex items-center gap-2 text-ink no-underline ${className}`}
    >
      <CompassMark size={22} />
      <span className="font-display text-lg tracking-tight">VoyageMesh</span>
    </Link>
  );
}
