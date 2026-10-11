import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { MeshCanvas } from "@/components/marketing/MeshCanvas";
import { LandingHeader } from "@/components/marketing/LandingHeader";
import { DispatchConsole } from "@/components/marketing/DispatchConsole";
import { Reveal } from "@/components/marketing/useMotion";
import { RouteSpine } from "@/components/marketing/RouteSpine";
import { DispatchLog } from "@/components/marketing/DispatchLog";
import { SpecialistDesks } from "@/components/marketing/SpecialistDesks";
import { Shell, HumanReview, DocumentPreview, Trust, Close, Footer } from "@/components/marketing/Sections";

export const metadata: Metadata = {
  title: "VoyageMesh — Travel planning, charted by specialists",
  description: "VoyageMesh turns a travel brief into a reviewable voyage document with specialist research for flights, stays, weather, budget, and itinerary.",
};

const jsonLd = {
  "@context": "https://schema.org", "@type": "SoftwareApplication", name: "VoyageMesh",
  applicationCategory: "TravelApplication",
  description: "Multi-agent travel planning workspace with human review and a living voyage document.",
};

export default async function LandingPage() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/app");
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
  }
  return (
    <div className="min-h-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingHeader />
      <div className="relative">
      <RouteSpine />
      <Reveal />
      <main className="relative z-10">
        <section data-waypoint="Dispatch" className="relative overflow-hidden px-6 py-16 md:px-10 md:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12]"><MeshCanvas /></div>
          <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">00 · Dispatch</p>
              <h1 className="mt-4 max-w-xl font-display text-5xl leading-[1.05] md:text-6xl">
                Travel planning, charted by a mesh of specialists.
              </h1>
              <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-ink-soft md:text-lg">
                VoyageMesh coordinates flights, stays, weather, budget, and day plans in one reviewable workspace. You provide the brief. The system handles the connective work.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" data-testid="hero-launch" data-agent-action="signup"
                  className="inline-flex min-h-11 items-center rounded-[3px] border border-brass bg-brass px-5 text-sm text-paper transition-opacity hover:opacity-90">
                  Launch App
                </Link>
                <a href="#method" className="inline-flex min-h-11 items-center rounded-[3px] border border-rule px-5 text-sm transition-colors hover:border-ink">
                  See the workflow
                </a>
              </div>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                The model proposes. The workflow decides. You review.
              </p>
            </div>
            <DispatchConsole />
          </div>
        </section>
        <DispatchLog />
        <Shell id="method" n="01" label="Method" title="One brief, seven desks.">
          <SpecialistDesks />
        </Shell>
        <HumanReview />
        <DocumentPreview />
        <Trust />
        <Close />
      </main>
      </div>
      <Footer />
    </div>
  );
}