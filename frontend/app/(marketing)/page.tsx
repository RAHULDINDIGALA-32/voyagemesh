import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { MeshCanvas } from "@/components/marketing/MeshCanvas";
import { LandingHeader } from "@/components/marketing/LandingHeader";
import { DispatchConsole } from "@/components/marketing/DispatchConsole";
import { Reveal } from "@/components/marketing/useMotion";
import { DispatchLog } from "@/components/marketing/DispatchLog";
import { SpecialistDesks } from "@/components/marketing/SpecialistDesks";
import { ReviewBoard } from "@/components/marketing/ReviewBoard";
import { VoyageFolio } from "@/components/marketing/VoyageFolio";
import { Section, Trust, Close, Footer } from "@/components/marketing/Sections";

export const metadata: Metadata = {
  title: "VoyageMesh — Travel planning, reviewed by you",
  description:
    "VoyageMesh turns a travel brief into a reviewable voyage document with specialist research for flights, stays, weather, budget, and itinerary.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "VoyageMesh",
  applicationCategory: "TravelApplication",
  description: "Multi-agent travel planning workspace with human review and a living voyage document.",
};

export default async function LandingPage() {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/app");
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
  }

  return (
    <div className="min-h-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingHeader />
      <Reveal />
      <main className="chart-wash">
        <section 
        id="hero"
        className=" chart-wash relative overflow-hidden px-6 py-16 md:px-10 md:py-24">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.28]">
            <MeshCanvas />
          </div>
          <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">
                Multi-agent travel workspace
              </p>
              <h1 className="mt-4 max-w-xl font-display text-5xl leading-[1.04] md:text-6xl">
                Plan the trip. Keep the last word.
              </h1>
              <p className="mt-6 max-w-[54ch] text-base leading-relaxed text-ink-soft md:text-lg">
                Give VoyageMesh a brief. Specialist desks research flights, stays, weather, and budget, then assemble a voyage document — pausing whenever a decision is yours.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  data-testid="hero-launch"
                  data-agent-action="signup"
                  className="inline-flex min-h-11 items-center rounded-[3px] border border-brass bg-brass px-5 text-sm text-paper transition-opacity hover:opacity-90"
                >
                  Launch App
                </Link>
                <a
                  href="#mesh"
                  className="inline-flex min-h-11 items-center rounded-[3px] border border-rule px-5 text-sm transition-colors hover:border-ink"
                >
                  Inspect Mesh
                </a>
              </div>
              <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Flights · Stay · Weather · Budget · Itinerary · Human review
              </p>
            </div>
            <DispatchConsole />
          </div>
        </section>
        <DispatchLog />
        <Section
          id="mesh"
          kicker="The mesh"
          title="Seven desks. One supervisor. Nothing invented in the gaps."
          lede="Each specialist works a lane. The supervisor routes the brief, holds the document, and stops the workflow when you need to decide."
        >
          <SpecialistDesks />
        </Section>
        <Section
          id="review"
          kicker="Human review"
          title="Automation that knows when to wait."
          lede="Missing constraints, an over-envelope estimate, or a day plan that needs taste: the mesh pauses and puts the choice in front of you."
        >
          <ReviewBoard />
        </Section>
        <Section
          id="document"
          kicker="Voyage document"
          title="The conversation is the workbench. The document is the handoff."
          lede="Cover, routes, stays, ledger, and days — assembled as a folio you can review and export."
        >
          <VoyageFolio />
        </Section>
        <Trust />
        <Close />
      </main>
      <Footer />
    </div>
  );
}
