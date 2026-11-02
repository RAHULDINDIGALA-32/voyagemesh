import Link from "next/link";
//import { CompassMark } from "@/components/brand/CompassMark";
import Image from "next/image";

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="VoyageMesh home"
      className={`inline-flex items-center gap-1 text-ink no-underline ${className}`}
    >
      <Image
  src="/vm-logo.png"
  alt="VoyageMesh"
  width={180}
  height={36}
  className="h-10 w-auto object-cover"
/>
      <span className="font-display text-lg tracking-tight">VoyageMesh</span>
    </Link>
  );
}
