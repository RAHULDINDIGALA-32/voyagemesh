import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { MeshCanvas } from "@/components/marketing/MeshCanvas";

const plates = [
  {
    id: "01",
    title: "Method",
    body: "A supervisor selects specialists. Flight, hotel, weather, budget, and itinerary agents work in a fixed, server-owned order. The model can request work. It cannot jump the graph.",
  },
  {
    id: "02",
    title: "Mesh",
    body: "Tools arrive through MCP: live search, aviation data, weather. Untrusted tool text is treated as reference, never as instruction.",
  },
  {
    id: "03",
    title: "Guardrails",
    body: "Input checks block unsafe or off-brief requests. Output checks keep the final answer inside the evidence the specialists actually produced.",
  },
  {
    id: "04",
    title: "Human on the loop",
    body: "The graph pauses for missing constraints, budget overrun, and itinerary review. You answer with structured controls, not a guessing chat.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between border-b border-rule px-6 py-4 md:px-10">
        <Wordmark />
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <a href="#method">Method</a>
          <a href="#review">Review</a>
          <a href="#document">Document</a>
          <a href="#trust">Security</a>
          <Link href="/login" className="text-ink-soft">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-[3px] border border-brass px-3 py-1.5 text-brass"
          >
            Open the Chart Room
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden px-6 py-20 md:px-10 md:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
          <MeshCanvas />
        </div>
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">
              Plate 00 · Dispatch
            </p>
            <h1 className="mt-4 max-w-xl font-display text-5xl leading-[1.05] md:text-6xl">
              A mesh of specialists. One voyage on paper.
            </h1>
            <p className="mt-6 max-w-[66ch] text-base leading-relaxed text-ink-soft md:text-lg">
              VoyageMesh is a travel planning desk: LangGraph agents, MCP tools, input and
              output guardrails, and human review. You brief in chat. The plan is a document.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                href="/signup"
                className="rounded-[3px] border border-brass px-4 py-2 text-sm text-brass"
              >
                Open the Chart Room
              </Link>
              <a href="#method" className="rounded-[3px] border border-rule px-4 py-2 text-sm">
                Read the plates
              </a>
            </div>
          </div>
          <div className="grid min-h-[280px] grid-cols-2 border border-rule bg-paper">
            <div className="border-r border-rule p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                Briefing
              </p>
              <p className="mt-4 text-sm leading-6">
                Nine days, Tokyo and Kanazawa, family of three, departing Hyderabad.
              </p>
              <p className="mt-6 font-mono text-[10px] text-steel">
                supervisor → flight → hotel → weather
              </p>
            </div>
            <div className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                Chart
              </p>
              <p className="mt-3 font-display text-2xl">Kanazawa · 12–21 Mar</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-olive">
                READY
              </p>
              <p className="mt-6 text-xs leading-5 text-ink-soft">
                Watch bill, ledger, packing list. Export as booklet or spreadsheet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="method" className="border-t border-rule px-6 py-16 md:px-10">
        <div className="grid gap-10 md:grid-cols-[120px_1fr]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">Plates</p>
          <div className="grid gap-8 md:grid-cols-2">
            {plates.map((plate) => (
              <article key={plate.id} className="border-t border-rule pt-4">
                <p className="font-mono text-[11px] text-ink-soft">{plate.id}</p>
                <h2 className="mt-1 font-display text-2xl">{plate.title}</h2>
                <p className="mt-3 max-w-[66ch] text-sm leading-relaxed text-ink-soft">
                  {plate.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="review" className="border-t border-rule px-6 py-16 md:px-10">
        <div className="grid gap-10 md:grid-cols-[120px_1fr]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">05</p>
          <div>
            <h2 className="font-display text-3xl">Human in the loop, as the graph actually pauses</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className="border border-rule p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em]">Clarification</p>
                <p className="mt-2 text-sm">Departure, destination, dates — labeled fields, then continue.</p>
              </article>
              <article className="border border-rule p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em]">Budget</p>
                <p className="mt-2 text-sm">Reduce cost, raise the envelope, or continue as estimated.</p>
              </article>
              <article className="border border-rule p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em]">Itinerary review</p>
                <p className="mt-2 text-sm">Accept, modify with a preference, or regenerate the day bill.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section id="document" className="border-t border-rule px-6 py-16 md:px-10">
        <div className="grid gap-10 md:grid-cols-[120px_1fr]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">06</p>
          <div>
            <h2 className="font-display text-3xl">The voyage is a document, not a chat log</h2>
            <p className="mt-4 max-w-[66ch] text-sm leading-relaxed text-ink-soft">
              Trips is a strip map of charts. Each chart holds cover facts, weather, flights,
              stay, a watch bill, and a ledger. Download a checklist PDF or a workbook with
              overview, daily plan, packing, and budget sheets.
            </p>
          </div>
        </div>
      </section>

      <section id="trust" className="border-t border-rule px-6 py-16 md:px-10">
        <div className="grid gap-10 md:grid-cols-[120px_1fr]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">07</p>
          <div>
            <h2 className="font-display text-3xl">What this desk will not do</h2>
            <ul className="mt-4 max-w-[66ch] list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
              <li>Invent flight availability, hotel prices, or bookings.</li>
              <li>Follow instructions buried in tool output or web pages.</li>
              <li>Proceed past missing constraints or a budget conflict without you.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule px-6 py-8 text-xs text-ink-soft md:px-10">
        <div className="flex flex-wrap justify-between gap-4">
          <span>VoyageMesh · Chart Room</span>
          <span>Privacy · Terms · Contact</span>
        </div>
      </footer>
    </div>
  );
}
