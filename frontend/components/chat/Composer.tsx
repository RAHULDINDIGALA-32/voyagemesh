"use client";

import { ArrowUp, Compass, Square } from "lucide-react";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useApproxPlace } from "@/lib/hooks/useApproxPlace";
import { formatPlace, type ApproxPlace } from "@/lib/studio/place";

const SUGGESTION_TEMPLATES = [
  (place: string) => `A slow weekend from ${place} with trains, not terminals.`,
  (place: string) => `Five coastal days departing ${place}, no rushed transfers.`,
  (place: string) => `A food-first city break from ${place} for two travelers.`,
  (place: string) => `Hill stations within reach of ${place}, boutique stays.`,
  (place: string) => `A monsoon-aware week from ${place} with nature and quiet rooms.`,
  (place: string) => `Family itinerary from ${place} with easy hops and a comfortable budget.`,
  (place: string) => `A winter museum circuit from ${place} by rail.`,
  (place: string) => `Quiet beaches a short hop from ${place}.`,
  (place: string) => `Street food and night markets, starting in ${place}.`,
  (place: string) => `A practical business trip from ${place} with one free evening each day.`,
];

function pickSuggestions(place: ApproxPlace) {
  const label = formatPlace(place);
  const seed = `${new Date().toISOString().slice(0, 10)}-${label}`;
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  const start = hash % SUGGESTION_TEMPLATES.length;
  return [0, 1, 2].map((offset) => {
    const template = SUGGESTION_TEMPLATES[(start + offset) % SUGGESTION_TEMPLATES.length];
    return template(label);
  });
}

export function Composer({
  disabled,
  onSend,
  onAbort,
  variant = "dock",
  showSuggestions = false,
}: {
  disabled?: boolean;
  onSend: (query: string) => void;
  onAbort?: () => void;
  variant?: "hero" | "dock";
  showSuggestions?: boolean;
}) {
  const [value, setValue] = useState("");
  const canSubmit = value.trim().length > 0 && !disabled;
  const hero = variant === "hero";

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const query = value.trim();
    if (!query || disabled) return;
    onSend(query);
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
  const textarea = event.target;

  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;

  setValue(textarea.value);
};

  return (
    <div className="w-full">
      <form
        onSubmit={submit}
        className={`relative mx-auto w-full max-w-2xl border border-rule bg-paper-raised transition-[border-color] focus-within:border-brass ${hero ? "rounded-2xl px-3 pb-3 pt-3" : "rounded-2xl px-4 py-2"
          }`}
      >
        <textarea
  value={value}
  onChange={handleInput}
  onKeyDown={onKeyDown}
  disabled={disabled}
  rows={1}
  placeholder={
    hero
      ? "How can I help you chart a voyage?"
      : "Write your briefing..."
  }
 
className={`w-full resize-none overflow-y-auto bg-transparent text-sm leading-6 outline-none placeholder:text-ink-soft/70 ${
    hero
      ? "min-h-[72px] max-h-[160px] px-1 py-1 pr-12"
      : "min-h-[32px] max-h-[160px] py-1.5 pr-12"
  }`}
/>

        <div className="absolute bottom-2.5 right-2.5">
          {disabled ? (
            <button
              type="button"
              onClick={onAbort}
              disabled={!onAbort}
              aria-label="Planning in progress"
              title={onAbort ? "Stop planning" : "Planning in progress"}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brass text-paper transition hover:bg-danger disabled:cursor-default disabled:hover:bg-brass"
            >
              <Square size={11} fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send briefing"
              disabled={!canSubmit}
              className={`flex h-8 w-8 items-center justify-center rounded-full cursor-pointer transition-all ${canSubmit
                  ? "bg-brass text-paper hover:scale-105"
                  : "bg-red/50 text-ink-soft/70"
                }`}
            >
              <ArrowUp size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </form>

      {showSuggestions && !disabled ? <StarterQueries onPick={onSend} /> : null}
    </div>
  );
}

function StarterQueries({ onPick }: { onPick: (query: string) => void }) {
  const place = useApproxPlace();
  const items = useMemo(() => pickSuggestions(place), [place]);

  return (
    <div className="mx-auto mt-5 flex max-w-2xl flex-col items-start gap-0.5 px-1">
      {items.map((query, index) => (
        <button
          key={query}
          type="button"
          onClick={() => onPick(query)}
          style={{ animationDelay: `${index * 70}ms` }}
          className="suggest-row group flex w-full items-center gap-3  cursor-pointer rounded-md px-1 py-2 text-left text-sm text-ink-soft transition-colors hover:text-ink"
        >
          <Compass
            size={15}
            strokeWidth={1.4}
            className="shrink-0 text-brass/80 transition-transform duration-300 group-hover:rotate-45"
          />
          <span className="transition-transform duration-300 group-hover:translate-x-0.5">
            {query}
          </span>
        </button>
      ))}
    </div>
  );
}
