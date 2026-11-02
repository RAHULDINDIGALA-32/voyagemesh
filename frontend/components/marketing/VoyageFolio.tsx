"use client";

import { useState } from "react";
import { Stamp } from "@/components/ui/Stamp";

const LEAVES = [
  {
    id: "cover",
    label: "Cover",
    content: (
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">Voyage</p>
        <p className="mt-3 font-display text-4xl leading-tight">Tokyo · Kanazawa</p>
        <p className="mt-2 font-mono text-sm">12–21 Mar · 3 travelers · HYD → NRT</p>
        <p className="mt-8 max-w-[42ch] text-sm leading-6 text-ink-soft">
          A working document assembled from specialist research. Assumptions stay visible. Nothing is booked.
        </p>
        <div className="mt-8">
          <Stamp tone="olive">Ready</Stamp>
        </div>
      </div>
    ),
  },
  {
    id: "flights",
    label: "Flights",
    content: (
      <div className="space-y-4 font-mono text-sm leading-7">
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Route options</p>
        <p>HYD → NRT · 12 Mar · 1 stop · typical schedule</p>
        <p>NRT → HYD · 21 Mar · 1 stop · typical schedule</p>
        <p className="text-ink-soft">Fares unavailable from source — not estimated as fact.</p>
      </div>
    ),
  },
  {
    id: "stay",
    label: "Stay",
    content: (
      <div className="space-y-4 text-sm leading-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">Nights</p>
        <p>Tokyo · 5 nights · walkable base, evening food nearby</p>
        <p>Kanazawa · 3 nights · garden district, quieter pace</p>
        <p className="text-ink-soft">Availability and rates are not implied.</p>
      </div>
    ),
  },
  {
    id: "ledger",
    label: "Ledger",
    content: (
      <div className="font-mono text-sm leading-7">
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Working estimate</p>
        <p>Flights .............. est.</p>
        <p>Stays ................ est.</p>
        <p>Daily spend .......... est.</p>
        <p className="mt-3 text-danger">Over envelope · review required</p>
      </div>
    ),
  },
  {
    id: "days",
    label: "Days",
    content: (
      <div className="space-y-3 text-sm leading-6">
        <p><span className="font-mono text-[10px] uppercase text-brass">01</span> Arrive · light evening</p>
        <p><span className="font-mono text-[10px] uppercase text-brass">04</span> Train to Kanazawa</p>
        <p><span className="font-mono text-[10px] uppercase text-brass">09</span> Depart NRT</p>
        <p className="pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">PDF · XLSX</p>
      </div>
    ),
  },
] as const;

export function VoyageFolio() {
  const [active, setActive] = useState(0);
  const leaf = LEAVES[active];

  return (
    <div data-reveal className="overflow-hidden border border-rule">
      <div className="flex flex-wrap border-b border-rule bg-paper-raised" role="tablist" aria-label="Voyage document leaves">
        {LEAVES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={`min-h-11 border-r border-rule px-4 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors last:border-r-0 focus-visible:outline-2 focus-visible:outline-steel ${
              index === active ? "bg-paper text-brass" : "text-ink-soft hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid min-h-[280px] bg-paper md:grid-cols-[12px_1fr]">
        <div aria-hidden className="hidden bg-brass/30 md:block" />
        <div key={leaf.id} className="vm-fade p-6 md:p-10">
          {leaf.content}
        </div>
      </div>
    </div>
  );
}
