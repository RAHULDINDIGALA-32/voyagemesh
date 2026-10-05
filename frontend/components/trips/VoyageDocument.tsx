"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  BedDouble,
  CalendarDays,
  CircleDollarSign,
  MapPin,
  Plane,
  Route,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Stamp } from "@/components/ui/Stamp";
import { downloadPlanPdf } from "@/lib/export/documents";
import { asTripDocument } from "@/lib/plan/parse";
import type { TripDocument, TripPayload } from "@/types/trip";

const shown = (value?: string) => value?.trim() || "Not specified";

const facts = (...items: Array<string | undefined>) =>
  items.filter((item) => item?.trim()).join(" · ");

function Card({
  title,
  icon,
  metric,
  label,
  children,
}: {
  title: string;
  icon: ReactNode;
  metric?: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-rule bg-paper/95 p-5 shadow-[0_10px_30px_-22px_color-mix(in_oklab,var(--ink)_60%,transparent)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-brass">
          {icon}
          <h2 className="font-display text-2xl text-ink">{title}</h2>
        </div>

        {metric ? (
          <div className="text-right">
            <p className="font-mono text-xs text-ink">{metric}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">
              {label}
            </p>
          </div>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function Connector({
  icon,
  side,
}: {
  icon: ReactNode;
  side: "left" | "right";
}) {
  return (
    <div
      className={`relative h-16 ${
        side === "left" ? "md:ml-[29%]" : "md:mr-[29%]"
      }`}
      aria-hidden="true"
    >
      <div className="absolute left-1/2 top-0 h-8 border-l border-dashed border-brass/70" />
      <div className="absolute left-1/2 top-7 grid size-8 -translate-x-1/2 place-items-center rounded-full border border-brass bg-paper text-brass">
        {icon}
      </div>
      <div className="absolute left-1/2 top-[60px] h-4 border-l border-dashed border-brass/70" />
    </div>
  );
}

function Endpoint({
  label,
  location,
  icon,
}: {
  label: string;
  location?: string;
  icon: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md items-center justify-center gap-3">
      <span className="grid size-10 place-items-center rounded-full border border-brass bg-paper-raised text-brass">
        {icon}
      </span>
      <div className="rounded-xl border border-rule bg-paper-raised px-4 py-3">
        <p className="font-mono text-[9px] uppercase tracking-[.18em] text-ink-soft">
          {label}
        </p>
        <p className="font-display text-xl">{shown(location)}</p>
      </div>
    </div>
  );
}

function TimelinePanel({
  trip,
  onClose,
}: {
  trip: TripDocument;
  onClose: () => void;
}) {
  const events = trip.timeline?.events ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/25 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Trip timeline"
    >
      <aside className="h-full w-full max-w-xl overflow-y-auto rounded-2xl border border-rule bg-paper p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-brass">
              Trip timeline
            </p>
            <h2 className="mt-1 font-display text-3xl">
              {trip.destination || "Your voyage"}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-soft hover:bg-paper-raised"
            aria-label="Close timeline"
          >
            <X size={19} />
          </button>
        </div>

        <section className="mt-7">
          <h3 className="font-display text-xl">Trip summary</h3>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {trip.trip_summary || "Your plan is being prepared."}
          </p>
        </section>

        <section className="mt-7">
          <h3 className="font-display text-xl">Packing checklist</h3>
          <ul className="mt-3 space-y-2">
            {(trip.packing?.items ?? []).map((item, index) => (
              <li
                key={`${item.item}-${index}`}
                className="flex gap-3 text-sm"
              >
                <span className="mt-1 size-3 rounded-sm border border-rule" />
                <span>
                  <strong className="font-medium">{item.item}</strong>
                  {item.reason ? (
                    <span className="text-ink-soft"> — {item.reason}</span>
                  ) : null}
                </span>
              </li>
            ))}

            {!trip.packing?.items?.length ? (
              <li className="text-sm text-ink-soft">
                No packing items have been generated yet.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="mt-7">
          <h3 className="font-display text-xl">Journey, start to finish</h3>
          <p className="mt-2 text-sm text-ink-soft">
            {trip.timeline?.summary}
          </p>

          <ol className="mt-4 border-l border-rule pl-5">
            {events.map((event, index) => (
              <li
                key={`${event.title}-${index}`}
                className="relative pb-5"
              >
                <span className="absolute -left-[1.65rem] top-1 size-3 rounded-full border-2 border-paper bg-brass" />
                <p className="font-mono text-[10px] uppercase tracking-wide text-brass">
                  {event.when || event.kind || "Trip moment"}
                </p>
                <p className="mt-1 text-sm font-medium">{event.title}</p>
                {event.detail ? (
                  <p className="mt-1 text-sm leading-6 text-ink-soft">
                    {event.detail}
                  </p>
                ) : null}
              </li>
            ))}

            {!events.length ? (
              <li className="text-sm text-ink-soft">
                Timeline details will appear when planning is complete.
              </li>
            ) : null}
          </ol>
        </section>
      </aside>
    </div>
  );
}

export function VoyageDocument({
  payload,
  conversationId,
}: {
  payload: TripPayload;
  conversationId?: string | null;
}) {
  const trip = asTripDocument(payload);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const flight = trip.flights;
  const hotel = trip.hotels;
  const budget = trip.budget;
  const itinerary = trip.itinerary;

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-brass">
            Voyage chart
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">
            {trip.destination
              ? `Journey to ${trip.destination}`
              : "Your voyage"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            {trip.trip_summary ||
              "Your trip plan will appear here after planning is complete."}
          </p>
        </div>

        <Stamp
          tone={
            payload.status === "completed" || payload.status === "ready"
              ? "olive"
              : "brass"
          }
        >
          {payload.status.replaceAll("_", " ")}
        </Stamp>
      </header>

      <div className="mb-10 flex flex-wrap gap-2">
        {conversationId ? (
          <Link
            href={`/app/c/${conversationId}`}
            className="rounded-lg border border-rule px-3 py-2 text-xs hover:bg-paper-raised"
          >
            Open chat
          </Link>
        ) : null}

        <Button type="button" onClick={() => setTimelineOpen(true)}>
          Trip timeline
        </Button>

        <Button
          type="button"
          onClick={() => void downloadPlanPdf(payload)}
        >
          Download PDF
        </Button>
      </div>

      <Endpoint
        label="Starting from"
        location={trip.origin}
        icon={<MapPin size={19} />}
      />

      <Connector side="left" icon={<Plane size={15} />} />

      <div className="space-y-0">
        <div className="md:mr-[48%]">
          <Card
            title="Flight"
            icon={<Plane size={19} />}
            metric={flight?.metric}
            label={flight?.metric_label}
          >
            {flight?.summary ? (
              <p className="text-sm leading-6 text-ink-soft">
                {flight.summary}
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              {(flight?.options ?? []).slice(0, 2).map((option, index) => (
                <div key={index} className="border-t border-rule pt-3">
                  <p className="text-sm font-medium">
                    {facts(option.airline, option.flight_number) ||
                      "Route option"}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {facts(
                      option.origin && option.destination
                        ? `${option.origin} → ${option.destination}`
                        : undefined,
                      option.departs,
                      option.arrives,
                      option.duration,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {facts(option.cabin, option.estimate, option.notes)}
                  </p>
                </div>
              ))}

              {!(flight?.options?.length) ? (
                <p className="text-sm text-ink-soft">
                  Flight details are not available yet.
                </p>
              ) : null}
            </div>
          </Card>
        </div>

        <Connector side="right" icon={<BedDouble size={15} />} />

        <div className="md:ml-[48%]">
          <Card
            title="Hotels"
            icon={<BedDouble size={19} />}
            metric={hotel?.metric}
            label={hotel?.metric_label}
          >
            {hotel?.summary ? (
              <p className="text-sm leading-6 text-ink-soft">
                {hotel.summary}
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              {(hotel?.options ?? []).slice(0, 2).map((option, index) => (
                <div key={index} className="border-t border-rule pt-3">
                  <p className="text-sm font-medium">
                    {option.name || "Stay option"}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {facts(
                      option.area,
                      option.nights,
                      option.style,
                      option.estimate_per_night,
                    )}
                  </p>
                  {option.why ? (
                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                      {option.why}
                    </p>
                  ) : null}
                </div>
              ))}

              {!(hotel?.options?.length) ? (
                <p className="text-sm text-ink-soft">
                  Accommodation details are not available yet.
                </p>
              ) : null}
            </div>
          </Card>
        </div>

        <Connector
          side="left"
          icon={<CircleDollarSign size={15} />}
        />

        <div className="md:mr-[48%]">
          <Card
            title="Budget"
            icon={<CircleDollarSign size={19} />}
            metric={budget?.estimated_total || budget?.metric}
            label={budget?.metric_label}
          >
            {budget?.summary ? (
              <p className="text-sm leading-6 text-ink-soft">
                {budget.summary}
              </p>
            ) : null}

            <dl className="mt-4 space-y-2 border-t border-rule pt-3">
              {(budget?.lines ?? []).slice(0, 5).map((line, index) => (
                <div
                  key={index}
                  className="flex items-baseline justify-between gap-4 text-xs"
                >
                  <dt>{line.category}</dt>
                  <dd className="text-right text-ink-soft">
                    {facts(line.amount, line.notes)}
                  </dd>
                </div>
              ))}

              {!(budget?.lines?.length) ? (
                <p className="text-sm text-ink-soft">
                  Budget line items are not available yet.
                </p>
              ) : null}
            </dl>
          </Card>
        </div>

        <Connector side="right" icon={<CalendarDays size={15} />} />

        <div className="md:ml-[48%]">
          <Card
            title="Itinerary"
            icon={<CalendarDays size={19} />}
            metric={itinerary?.metric}
            label={itinerary?.metric_label}
          >
            {itinerary?.summary ? (
              <p className="text-sm leading-6 text-ink-soft">
                {itinerary.summary}
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              {(itinerary?.days ?? []).slice(0, 3).map((day, index) => (
                <div
                  key={`${day.day}-${index}`}
                  className="border-t border-rule pt-3"
                >
                  <p className="text-sm font-medium">
                    {facts(day.day, day.title)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-soft">
                    {day.summary}
                  </p>
                  {day.stops?.[0] ? (
                    <p className="mt-1 text-xs text-ink-soft">
                      {facts(
                        day.stops[0].time,
                        day.stops[0].title,
                        day.stops[0].place,
                      )}
                    </p>
                  ) : null}
                </div>
              ))}

              {!(itinerary?.days?.length) ? (
                <p className="text-sm text-ink-soft">
                  Day plans are not available yet.
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <Connector side="left" icon={<Route size={15} />} />

      <Endpoint
        label="Destination"
        location={trip.destination}
        icon={<MapPin size={19} />}
      />

      {timelineOpen ? (
        <TimelinePanel
          trip={trip}
          onClose={() => setTimelineOpen(false)}
        />
      ) : null}
    </article>
  );
}

