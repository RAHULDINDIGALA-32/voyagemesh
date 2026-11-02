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
  <ul aria-hidden={hidden} className="flex shrink-0 gap-12 pr-12">
    {LINES.map((line) => (
      <li key={line} className="whitespace-nowrap">
        {line}
      </li>
    ))}
  </ul>
);

export function DispatchLog() {
  return (
    <div
      role="region"
      aria-label="Sample dispatch log (illustrative)"
      className="group flex items-center gap-4 overflow-hidden border-y border-rule bg-paper-raised py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft"
    >
      <span className="hidden shrink-0 items-center gap-2 pl-6 text-brass md:inline-flex md:px-10">
        <span className="h-1.5 w-1.5 rounded-full bg-brass motion-safe:animate-pulse" />
        Log
      </span>
      <div className="vm-marquee flex w-max group-hover:[animation-play-state:paused]">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
