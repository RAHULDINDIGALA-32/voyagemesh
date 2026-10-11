import Link from "next/link";

const Label = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">{n} · {children}</p>
);
export const Shell = ({ id, n, label, title, children }: { id: string; n: string; label: string; title: string; children: React.ReactNode }) => (
  <section id={id} data-waypoint={label} aria-labelledby={`${id}-h`} className="border-t border-rule px-6 py-16 md:px-10 md:py-24">
    <div className="mx-auto max-w-[1280px]">
      <Label n={n}>{label}</Label>
      <h2 id={`${id}-h`} className="mt-3 max-w-2xl font-display text-3xl md:text-4xl">{title}</h2>
      <div className="mt-10">{children}</div>
    </div>
  </section>
);

export function HumanReview() {
  const cards = [
    ["Clarification", "Departure, destination, dates: labeled fields, then continue."],
    ["Budget decision", "Reduce cost, raise the envelope, or continue as estimated."],
    ["Itinerary review", "Accept, modify with a preference, or regenerate the day plan."],
  ];
  return (
    <Shell id="review" n="02" label="Human Review" title="Good automation brings you in when the choice is yours.">
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(([t, b]) => (
          <article data-reveal key={t} className="border border-rule p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{t}</p>
            <p className="mt-3 text-sm leading-6 text-ink-soft">{b}</p>
          </article>
        ))}
      </div>
    </Shell>
  );
}

export function DocumentPreview() {
  return (
    <Shell id="document" n="03" label="Voyage Document" title="The conversation is the workbench. The document is the handoff.">
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-3 gap-px border border-rule bg-rule" aria-label="Sample voyage document, illustrative">
          <div className="bg-paper-raised p-5">
            <p className="font-mono text-[10px] uppercase text-ink-soft">Cover</p>
            <p className="mt-3 font-display text-2xl">Tokyo · Kanazawa</p>
            <p className="mt-1 font-mono text-[11px]">12–21 Mar · 3 travelers</p>
            <p className="mt-4 font-mono text-[10px] uppercase text-olive">Ready</p>
          </div>
          <div className="bg-paper p-5 font-mono text-xs leading-6">
            <p className="text-[10px] uppercase text-ink-soft">Ledger</p>
            <p>Flights ....... est.</p><p>Stays ......... est.</p><p>Daily spend .... est.</p>
            <p className="mt-2 text-danger">Over envelope: review</p>
          </div>
          <div className="bg-paper p-5 text-sm leading-6">
            <p className="font-mono text-[10px] uppercase text-ink-soft">Assumptions</p>
            <p className="mt-2 text-ink-soft">Schedules typical, fares unavailable, weather seasonal.</p>
            <p className="mt-3 font-mono text-[10px] uppercase text-steel">PDF · XLSX</p>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function Trust() {
  const items = [
    ["No invented bookings", "Availability and fares are never implied unless a source provided them."],
    ["No hidden decisions", "Missing constraints and conflicts become review steps."],
    ["No tool instructions", "Research output is reference data, never authority."],
  ];
  return (
    <Shell id="trust" n="04" label="Trust" title="What VoyageMesh will not invent.">
      <div className="grid gap-8 md:grid-cols-3">
        {items.map(([t, b]) => (
          <article data-reveal key={t} className="border-t border-rule pt-4">
            <h3 className="font-display text-xl">{t}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{b}</p>
          </article>
        ))}
      </div>
      <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">Agents · MCP · Guardrails · HITL · PostgreSQL · Supabase</p>
    </Shell>
  );
}

export function Close() {
  return (
    <section data-waypoint="Launch" className="border-t border-rule bg-paper-raised px-6 py-20 text-center md:px-10">
      <h2 data-reveal className="mx-auto max-w-2xl font-display text-4xl">Bring us the rough version of your trip.</h2>
      <p className="mt-4 text-ink-soft">Dates, destination, constraints, or just the idea. Start there.</p>
      <Link href="/signup" data-agent-action="signup"
        className="mt-8 inline-flex min-h-11 items-center rounded-[3px] border border-brass px-6 text-brass transition-colors hover:bg-brass hover:text-paper">
        Launch App
      </Link>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-rule px-6 py-8 text-xs text-ink-soft md:px-10">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-4">
        <span>VoyageMesh · Chart Room</span><span>Privacy · Terms · Contact</span>
      </div>
    </footer>
  );
}