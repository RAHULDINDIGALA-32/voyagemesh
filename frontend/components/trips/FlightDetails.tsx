import { Plane, StickyNote } from "lucide-react";
import type { FlightCard, FlightOption } from "@/types/trip";

export function hasFlightData(f?: FlightCard | null) {
  return Boolean(f?.metric || f?.summary || f?.options?.length || f?.notes?.length);
}

/** "Hyderabad (HYD)" -> { big: "HYD", small: "Hyderabad" }; otherwise show the text as-is. */
function splitPlace(value?: string) {
  if (!value) return { big: "—", small: "" };
  const code = value.match(/\b[A-Z]{3}\b/)?.[0];
  if (!code) return { big: value, small: "" };
  const small = value.replace(code, "").replace(/[()\-–,]/g, " ").replace(/\s+/g, " ").trim();
  return { big: code, small };
}

function Leg({
  place,
  time,
  align,
}: {
  place?: string;
  time?: string;
  align: "left" | "right";
}) {
  const { big, small } = splitPlace(place);
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <p className="truncate font-display text-2xl leading-none text-ink">{big}</p>
      {small ? <p className="mt-1 truncate text-[11px] text-ink-soft">{small}</p> : null}
      {time ? <p className="mt-2 font-mono text-[11px] leading-4 text-ink">{time}</p> : null}
    </div>
  );
}

function FlightOptionCard({ option, index }: { option: FlightOption; index: number }) {
  const title = option.airline || `Option ${index + 1}`;

  return (
    <li className="overflow-hidden rounded-xl border border-rule bg-paper-raised">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-rule px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          {option.flight_number ? (
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              {option.flight_number}
            </p>
          ) : null}
        </div>

        {option.cabin ? (
          <span className="shrink-0 rounded-full border border-brass/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brass">
            {option.cabin}
          </span>
        ) : null}
      </div>

      {/* Route */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-4 py-4">
        <Leg place={option.origin} time={option.departs} align="left" />

        <div className="flex min-w-[72px] flex-col items-center gap-1 pt-1.5">
          <span className="font-mono text-[10px] text-ink-soft">{option.duration || "\u00A0"}</span>
          <div className="flex w-full items-center text-brass">
            <span className="h-px flex-1 border-t border-dashed border-brass/60" />
            <Plane size={14} className="mx-1 shrink-0" />
            <span className="h-px flex-1 border-t border-dashed border-brass/60" />
          </div>
        </div>

        <Leg place={option.destination} time={option.arrives} align="right" />
      </div>

      {/* Footer */}
      {option.estimate || option.notes ? (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-rule px-4 py-3">
          {option.notes ? (
            <p className="min-w-0 flex-1 text-xs leading-5 text-ink-soft">{option.notes}</p>
          ) : (
            <span />
          )}

          {option.estimate ? (
            <div className="text-right">
              <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">
                Est. fare
              </p>
              <p className="font-display text-xl leading-tight text-ink">{option.estimate}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function FlightDetails({ flight }: { flight: FlightCard }) {
  const options = flight.options ?? [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      {flight.metric || flight.summary ? (
        <div className="rounded-xl border border-rule bg-paper-raised p-4">
          {flight.metric ? (
            <>
              <p className="font-mono text-[9px] uppercase tracking-[.18em] text-ink-soft">
                {flight.metric_label || "Flight estimate"}
              </p>
              <p className="mt-1 font-display text-4xl leading-tight text-ink">{flight.metric}</p>
            </>
          ) : null}

          {flight.summary ? (
            <p className={`${flight.metric ? "mt-3" : ""} text-sm leading-6 text-ink-soft`}>
              {flight.summary}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Options */}
      <section>
        <h3 className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[.16em] text-brass">
          <span>Options</span>
          {options.length ? <span className="text-ink-soft">{options.length} found</span> : null}
        </h3>

        {options.length ? (
          <ul className="space-y-3">
            {options.map((option, i) => (
              <FlightOptionCard
                key={`${option.flight_number ?? option.airline ?? "opt"}-${i}`}
                option={option}
                index={i}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Flight details are not available yet.</p>
        )}
      </section>

      {/* Notes */}
      {flight.notes?.length ? (
        <section className="rounded-xl border border-rule p-4">
          <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-brass">
            <StickyNote size={13} /> Good to know
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-ink-soft">
            {flight.notes.map((n, i) => (
              <li key={`${n}-${i}`}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}