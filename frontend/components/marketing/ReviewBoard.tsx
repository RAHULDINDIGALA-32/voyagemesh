"use client";

import { useState } from "react";
import { Stamp } from "@/components/ui/Stamp";

const REVIEWS = [
  {
    id: "clarify",
    label: "Clarification",
    kicker: "User review · constraint",
    question: "A few details are missing before the mesh can dispatch. Confirm departure, destination, and dates.",
    body: (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["Departure city", "Hyderabad"],
          ["Destination", "Japan"],
          ["Travel dates", "12–21 Mar"],
          ["Travelers", "3"],
        ].map(([label, value]) => (
          <label key={label} className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
            {label}
            <span className="rounded-[3px] border border-rule bg-paper px-3 py-2 font-sans text-sm normal-case tracking-normal text-ink">
              {value}
            </span>
          </label>
        ))}
        <div className="sm:col-span-2">
          <span className="inline-flex min-h-10 items-center rounded-[3px] border border-brass px-4 text-sm text-brass">
            Continue planning
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "budget",
    label: "Budget",
    kicker: "User review · envelope",
    question: "The working estimate is above your envelope. Choose how to continue.",
    body: (
      <div className="mt-4 space-y-4">
        <div className="grid gap-px border border-rule bg-rule sm:grid-cols-3">
          {[
            ["Your budget", "INR 180,000"],
            ["Estimated total", "INR 196,400"],
            ["Difference", "INR 16,400 over"],
          ].map(([label, value]) => (
            <div key={label} className="bg-paper px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">{label}</p>
              <p className="mt-1 font-display text-lg">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-10 items-center rounded-[3px] border border-brass px-3 text-sm text-brass">
            Continue
          </span>
          <span className="inline-flex min-h-10 items-center rounded-[3px] border border-rule px-3 text-sm">
            Reduce cost
          </span>
          <span className="inline-flex min-h-10 items-center rounded-[3px] border border-rule px-3 text-sm">
            Raise envelope
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "itinerary",
    label: "Itinerary",
    kicker: "User review · day plan",
    question: "The proposed day plan is ready. Accept it, change a preference, or regenerate.",
    body: (
      <div className="mt-4 space-y-3">
        <div className="space-y-3 border-y border-rule py-3 text-sm">
          <p className="font-medium">Day 1 · Arrive, light evening</p>
          <p className="text-xs leading-5 text-ink-soft">NRT → Tokyo · neighborhood walk · early rest</p>
          <p className="font-medium">Day 4 · Train to Kanazawa</p>
          <p className="text-xs leading-5 text-ink-soft">Shinkansen morning · Kenrokuen afternoon</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-brass">
          Accept · Modify · Regenerate
        </p>
      </div>
    ),
  },
] as const;

export function ReviewBoard() {
  const [active, setActive] = useState(0);
  const review = REVIEWS[active];

  return (
    <div data-reveal className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div role="tablist" aria-label="Review types" className="flex gap-2 overflow-x-auto lg:flex-col">
        {REVIEWS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={`min-h-11 shrink-0 rounded-[3px] border px-3 text-left font-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-steel ${
              index === active
                ? "border-brass text-brass"
                : "border-rule text-ink-soft hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <article className="border border-rule bg-paper-raised p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">{review.kicker}</p>
          <Stamp tone="brass">Paused for you</Stamp>
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed md:text-lg">{review.question}</p>
        {review.body}
      </article>
    </div>
  );
}
