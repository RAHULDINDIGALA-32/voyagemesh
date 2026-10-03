"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Stamp } from "@/components/ui/Stamp";
import { downloadPlanPdf, downloadPlanWorkbook } from "@/lib/export/documents";
import { parsePlan } from "@/lib/plan/parse";
import type { TripPayload } from "@/types/trip";

function Block({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <section className="border-t border-rule py-6">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{body}</p>
    </section>
  );
}

export function VoyageDocument({
  payload,
  conversationId,
}: {
  payload: TripPayload;
  conversationId?: string | null;
}) {
  const plan = parsePlan(payload);

  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">Voyage chart</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl leading-tight">{plan.title}</h1>
        <Stamp tone={plan.status === "completed" || plan.status === "ready" ? "olive" : "brass"}>
          {plan.status.replaceAll("_", " ")}
        </Stamp>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <dt className="text-ink-soft">Origin</dt>
          <dd className="font-mono text-xs">{plan.origin || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Destination</dt>
          <dd className="font-mono text-xs">{plan.destination || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Dates</dt>
          <dd className="font-mono text-xs">{plan.dates || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Travelers</dt>
          <dd className="font-mono text-xs">{plan.travelers || "—"}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        {conversationId ? (
          <Link
            href={`/app/c/${conversationId}`}
            className="rounded-[3px] border border-rule px-3 py-2 text-xs"
          >
            Open briefing
          </Link>
        ) : null}
        <Button type="button" onClick={() => void downloadPlanPdf(payload)}>
          Download PDF
        </Button>
        <Button type="button" onClick={() => void downloadPlanWorkbook(payload)}>
          Download spreadsheet
        </Button>
      </div>
      <Block title="Weather" body={plan.weather} />
      <Block title="Flights" body={plan.flights} />
      <Block title="Stay" body={plan.hotels} />
      <section className="border-t border-rule py-6">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          Watch bill
        </h2>
        {plan.days.length ? (
          <ol className="mt-4 space-y-5">
            {plan.days.map((day, index) => (
              <li key={day.title}>
                <p className="font-display text-xl">
                  <span className="mr-3 font-mono text-xs text-brass">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {day.title}
                </p>
                <ul className="mt-2 space-y-1 text-sm leading-6">
                  {day.items.map((item) => (
                    <li key={item} className="border-l border-rule pl-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
            {plan.itinerary || plan.answer || "The itinerary has not been drawn yet."}
          </p>
        )}
      </section>
      <Block title="Ledger" body={plan.budgetText} />
      <Block title="Assumptions" body={plan.assumptions} />
    </article>
  );
}
