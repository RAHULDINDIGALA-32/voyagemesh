import Link from "next/link";

export function Section({
  id,
  kicker,
  title,
  lede,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="border-t border-rule px-6 py-10 md:px-10 md:py-15">
      <div className="mx-auto max-w-[1120px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">{kicker}</p>
        <h2 id={`${id}-h`} className="mt-3 max-w-3xl font-display text-3xl leading-tight md:text-5xl">
          {title}
        </h2>
        {lede ? <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-ink-soft">{lede}</p> : null}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

export function Trust() {
  const items = [
    ["No invented bookings", "Availability and fares are never implied unless a source provided them."],
    ["No hidden decisions", "Missing constraints and conflicts become review steps you can see."],
    ["No tool instructions", "Research output is reference data. It is never treated as authority."],
  ];
  return (
    <Section
      id="trust"
      kicker="Guardrails"
      title="What VoyageMesh will not invent."
      lede="The mesh is allowed to research, estimate, and pause. It is not allowed to bluff."
    >
      <div className="grid gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <p data-reveal className="font-display text-2xl leading-snug text-ink-soft md:text-3xl">
          Agents propose. The workflow decides. You review.
        </p>
        <div className="divide-y divide-rule border-y border-rule">
          {items.map(([title, body]) => (
            <article data-reveal key={title} className="py-5">
              <h3 className="font-display text-xl">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
            </article>
          ))}
        </div>
      </div>
      <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        LangGraph · MCP · Guardrails · HITL · PostgreSQL · Supabase
      </p>
    </Section>
  );
}

export function Close() {
  return (
    <section className="border-t border-rule px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto grid max-w-[1120px] items-end gap-10 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">Open a chart</p>
          <h2 data-reveal className="mt-3 max-w-xl font-display text-4xl leading-[1.08] md:text-5xl">
            Start with the rough version of the trip.
          </h2>
          <p className="mt-4 max-w-[46ch] text-ink-soft">
            Dates, destination, constraints, or just the idea. The mesh takes it from there — and stops when the choice is yours.
          </p>
        </div>
        <div className="md:text-right">
          <Link
            href="/signup"
            data-agent-action="signup"
            className="inline-flex min-h-11 items-center rounded-[3px] border border-brass bg-brass px-6 text-sm text-paper transition-opacity hover:opacity-90"
          >
            Launch App
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-rule px-6 py-8 text-xs text-ink-soft md:px-10">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4">
        <span>VoyageMesh · Agentic Travel Planner</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
