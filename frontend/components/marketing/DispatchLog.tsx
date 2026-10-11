const LINES = [
  "SUPERVISOR  routes brief → flights, stay, weather",
  "GUARDRAIL   input check passed",
  "FLIGHTS     2 route options found · fares unavailable",
  "WEATHER     seasonal context attached",
  "BUDGET      estimate exceeds envelope → review",
  "HITL        awaiting traveler decision",
  "ITINERARY   day plan ready for review",
  "CHART       voyage document assembled",
];
const Row = ({ hidden }: { hidden?: boolean }) => (
  <ul aria-hidden={hidden} className="flex shrink-0 gap-10 pr-10">
    {LINES.map((l) => <li key={l} className="whitespace-nowrap">{l}</li>)}
  </ul>
);
/** Time-based ticker: a looping, illustrative dispatch log. */
export function DispatchLog() {
  return (
    <div role="region" aria-label="Sample dispatch log (illustrative)"
      className="group overflow-hidden border-y border-rule bg-paper-raised py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
      <div className="vm-marquee flex w-max group-hover:[animation-play-state:paused]">
        <Row /><Row hidden />
      </div>
    </div>
  );
}