import { MapPin, Moon, StickyNote } from "lucide-react";
import type { HotelCard, HotelOption } from "@/types/trip";

export function hasHotelData(h?: HotelCard | null) {
  return Boolean(h?.metric || h?.summary || h?.options?.length || h?.notes?.length);
}

function HotelOptionCard({ option, index }: { option: HotelOption; index: number }) {
  return (
    <li className="overflow-hidden rounded-xl border border-rule bg-paper-raised">
      <div className="p-4">
        {/* Name + style */}
        <div className="flex items-start justify-between gap-3">
          <h4 className="min-w-0 font-display text-xl leading-snug text-ink">
            {option.name || `Stay option ${index + 1}`}
          </h4>

          {option.style ? (
            <span className="shrink-0 rounded-full border border-brass/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brass">
              {option.style}
            </span>
          ) : null}
        </div>

        {/* Meta + price */}
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="space-y-1.5 text-xs text-ink-soft">
            {option.area ? (
              <p className="flex items-center gap-1.5">
                <MapPin size={13} className="shrink-0 text-brass" />
                <span>{option.area}</span>
              </p>
            ) : null}
            {option.nights ? (
              <p className="flex items-center gap-1.5">
                <Moon size={13} className="shrink-0 text-brass" />
                <span>{option.nights}</span>
              </p>
            ) : null}
          </div>

          {option.estimate_per_night ? (
            <div className="shrink-0 text-right">
              <p className="font-display text-xl leading-tight text-ink">
                {option.estimate_per_night}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">
                per night
              </p>
            </div>
          ) : null}
        </div>

        {/* Why */}
        {option.why ? (
          <p className="mt-4 border-l-2 border-brass/60 pl-3 text-xs leading-5 text-ink-soft">
            {option.why}
          </p>
        ) : null}
      </div>

      {option.source ? (
        <div className="border-t border-rule px-4 py-2">
          <p className="font-mono text-[10px] text-ink-soft">
            Source · <span className="text-ink">{option.source}</span>
          </p>
        </div>
      ) : null}
    </li>
  );
}

export function HotelDetails({ hotel }: { hotel: HotelCard }) {
  const options = hotel.options ?? [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      {hotel.metric || hotel.summary ? (
        <div className="rounded-xl border border-rule bg-paper-raised p-4">
          {hotel.metric ? (
            <>
              <p className="font-mono text-[9px] uppercase tracking-[.18em] text-ink-soft">
                {hotel.metric_label || "Stay estimate"}
              </p>
              <p className="mt-1 font-display text-4xl leading-tight text-ink">{hotel.metric}</p>
            </>
          ) : null}

          {hotel.summary ? (
            <p className={`${hotel.metric ? "mt-3" : ""} text-sm leading-6 text-ink-soft`}>
              {hotel.summary}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Options */}
      <section>
        <h3 className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[.16em] text-brass">
          <span>Where to stay</span>
          {options.length ? <span className="text-ink-soft">{options.length} picks</span> : null}
        </h3>

        {options.length ? (
          <ul className="space-y-3">
            {options.map((option, i) => (
              <HotelOptionCard key={`${option.name ?? "stay"}-${i}`} option={option} index={i} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Accommodation details are not available yet.</p>
        )}
      </section>

      {/* Notes */}
      {hotel.notes?.length ? (
        <section className="rounded-xl border border-rule p-4">
          <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-brass">
            <StickyNote size={13} /> Good to know
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-ink-soft">
            {hotel.notes.map((n, i) => (
              <li key={`${n}-${i}`}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}