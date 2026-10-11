import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between  bg-paper/90 px-6 py-3 backdrop-blur-sm md:px-10">
      <Link href="/" aria-label="VoyageMesh home" className="ml-10"><Wordmark /></Link>
      <div className="flex items-center gap-3 text-sm mr-10">
        <Link href="/login" data-testid="login" data-agent-action="login"
          className="inline-flex min-h-11 items-center px-3 text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-steel">
          Log in
        </Link>
        <Link href="/signup" data-testid="launch-app" data-agent-action="signup"
          className="inline-flex min-h-11 items-center rounded-[3px] border border-brass px-4 text-brass transition-colors hover:bg-brass hover:text-paper focus-visible:outline-2 focus-visible:outline-steel">
          Launch App
        </Link>
      </div>
    </header>
  );
}