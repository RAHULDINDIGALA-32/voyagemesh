"use client";

import Link from "next/link";
import { Stamp } from "@/components/ui/Stamp";
import type { TripRecord } from "@/types/trip";


function stamp(status: string): { tone: "ink" | "brass" | "olive" | "danger"; label: string } {
  if (status === "ready") return { tone: "olive", label: "READY" };
  if (status === "awaiting_you") return { tone: "brass", label: "HOLD" };
  if (status === "blocked" || status === "failed") return { tone: "danger", label: "HOLD" };
  return { tone: "ink", label: "DRAFT" };
}

export function FoldList({ trips }: { trips: TripRecord[] }) {
  if (!trips.length) {
    return <p className="mt-12 text-sm text-ink-soft">No voyage charts yet. Dispatch a briefing first.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-rule border-y border-rule">
      {trips.map((trip) => {
        const mark = stamp(trip.status);
        const dest = trip.cover?.destination || trip.title;
        return (
          <li key={trip.trip_id}>
            <Link
              href={`/app/trips/${trip.thread_id}`}
              className="group grid grid-cols-[1fr_auto] items-center gap-4 py-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
            >
              <span className="font-display text-2xl leading-none group-hover:text-steel">{dest}</span>
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft md:block">
                {trip.cover?.travel_dates || "dates open"} · {trip.cover?.traveler_count || "—"} pax
              </span>
              <Stamp tone={mark.tone}>{mark.label}</Stamp>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
