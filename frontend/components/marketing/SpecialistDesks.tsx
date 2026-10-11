"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
  type WheelEvent,
} from "react";
import { reducedMotion } from "./useMotion";

const MS = 4500;
const SCROLL_COOLDOWN = 700;
const SCROLL_THRESHOLD = 60;

const DESKS = [
  {
    id: "Brief",
    role: "Turns your rough idea into constraints.",
    data: [
      "ROUTE  HYD → NRT",
      "DATES  12–21 Mar",
      "PARTY  3 travelers",
      "AGENTS  Flight · Hotel · Weather · Budget · Itinerary · Final",
    ],
    note: "Missing details become review questions.",
  },
  {
    id: "Flights",
    role: "Researches route options and schedules.",
    data: ["HYD → NRT · 12 MAR", "2 route options · 1 stop"],
    note: "Typical schedules; fares not guaranteed.",
  },
  {
    id: "Stay",
    role: "Compares areas and stays against your pace.",
    data: ["Tokyo · 5 nights", "Kanazawa · 3 nights"],
    note: "Availability and prices are not implied.",
  },
  {
    id: "Weather",
    role: "Adds seasonal context and packing implications.",
    data: ["Mar · cool, changeable", "Layers + rain shell"],
    note: "Forecast confidence drops beyond ~10 days.",
  },
  {
    id: "Budget",
    role: "Builds a working estimate with stated assumptions.",
    data: [
      "Envelope    INR 180,000",
      "Estimate    INR 196,400",
      "Decision    Review required",
    ],
    note: "Estimate, not a quote.",
  },
  {
    id: "Itinerary",
    role: "Sequences days, then pauses for your review.",
    data: ["Day 1 · Arrive, light evening", "Day 4 · Train to Kanazawa"],
    note: "One free evening a day, as briefed.",
  },
  {
    id: "Chart",
    role: "Synthesizes everything into one voyage document.",
    data: ["Cover · Flights · Stay", "Weather · Ledger · Packing"],
    note: "Export as checklist PDF or workbook.",
  },
];

const LAST_DESK = DESKS.length - 1;

/**
 * Auto-advances while visible.
 *
 * Scroll down: next desk.
 * Scroll up: previous desk.
 * At the final desk, downward scrolling continues normally.
 * Manual navigation does not disable auto-cycling.
 */
export function SpecialistDesks() {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const lastScrollRef = useRef(0);
  const scrollCooldownRef = useRef(false);
  const scrollAccumulatorRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const selectDesk = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, LAST_DESK));

    activeRef.current = clamped;
    setActive(clamped);
  }, []);

  // Track visibility for timer-based progression.
  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setSeen(entry.isIntersecting),
      { threshold: 0.4 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Automatically advance every 4.5 seconds while visible.
  useEffect(() => {
    if (!seen || reducedMotion()) return;

    const timer = setTimeout(() => {
      selectDesk((active + 1) % DESKS.length);
    }, MS);

    return () => clearTimeout(timer);
  }, [active, seen, selectDesk]);

  // Clean up the scroll cooldown timer.
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleScrollNavigation = useCallback(
    (direction: 1 | -1) => {
      if (scrollCooldownRef.current) return;

      const current = activeRef.current;
      const next = current + direction;

      // Do not trap scrolling at either end.
      if (next < 0 || next > LAST_DESK) {
        scrollAccumulatorRef.current = 0;
        return;
      }

      selectDesk(next);

      scrollCooldownRef.current = true;
      scrollAccumulatorRef.current = 0;

      cooldownTimerRef.current = setTimeout(() => {
        scrollCooldownRef.current = false;
      }, SCROLL_COOLDOWN);
    },
    [selectDesk],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (reducedMotion()) return;

      const element = containerRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Only interpret wheel gestures while the component
      // occupies a meaningful portion of the viewport.
      const isRelevant =
        rect.top < viewportHeight * 0.8 &&
        rect.bottom > viewportHeight * 0.2;

      if (!isRelevant) {
        scrollAccumulatorRef.current = 0;
        return;
      }

      // Ignore horizontal trackpad gestures.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }

      const now = Date.now();

      // Reset the accumulator after a pause in scrolling.
      if (now - lastScrollRef.current > 180) {
        scrollAccumulatorRef.current = 0;
      }

      lastScrollRef.current = now;
      scrollAccumulatorRef.current += event.deltaY;

      if (scrollCooldownRef.current) return;

      if (
        scrollAccumulatorRef.current >= SCROLL_THRESHOLD
      ) {
        handleScrollNavigation(1);
      } else if (
        scrollAccumulatorRef.current <= -SCROLL_THRESHOLD
      ) {
        handleScrollNavigation(-1);
      }
    },
    [handleScrollNavigation],
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (reducedMotion()) return;

      const startY = touchStartYRef.current;
      const endY = event.changedTouches[0]?.clientY;

      touchStartYRef.current = null;

      if (startY == null || endY == null) return;

      const delta = startY - endY;

      if (Math.abs(delta) < SCROLL_THRESHOLD) return;

      const element = containerRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();

      if (
        rect.top >= window.innerHeight * 0.8 ||
        rect.bottom <= window.innerHeight * 0.2
      ) {
        return;
      }

      handleScrollNavigation(delta > 0 ? 1 : -1);
    },
    [handleScrollNavigation],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          selectDesk(activeRef.current + 1);
          break;

        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          selectDesk(activeRef.current - 1);
          break;

        case "Home":
          event.preventDefault();
          selectDesk(0);
          break;

        case "End":
          event.preventDefault();
          selectDesk(LAST_DESK);
          break;
      }
    },
    [selectDesk],
  );

  const desk = DESKS[active];

  return (
    <div
      ref={containerRef}
      data-reveal
      data-testid="specialist-desks"
      data-desk={desk.id}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="grid gap-6 md:grid-cols-[200px_1fr]"
    >
      <div
        role="group"
        aria-label="Specialist desks"
        onKeyDown={handleKeyDown}
        className="flex gap-2 overflow-x-auto md:flex-col"
      >
        {DESKS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectDesk(index)}
            aria-current={index === active ? "step" : undefined}
            className={`relative min-h-11 shrink-0 overflow-hidden border px-3 text-left font-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-steel ${
              index === active
                ? "border-brass text-brass"
                : "border-rule text-ink-soft hover:text-ink"
            }`}
          >
            {String(index + 1).padStart(2, "0")} · {item.id}

            {index === active &&
              seen &&
              !reducedMotion() && (
                <span
                  key={active}
                  className="vm-bar absolute bottom-0 left-0 h-[2px] w-full bg-brass"
                  style={{ animationDuration: `${MS}ms` }}
                />
              )}
          </button>
        ))}
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        key={desk.id}
        className="vm-fade border border-rule bg-paper-raised p-6"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">
          {desk.id} Agent
        </p>

        <p className="mt-3 font-display text-2xl">
          {desk.role}
        </p>

        <pre className="mt-5 whitespace-pre-wrap border border-rule bg-paper p-4 font-mono text-xs leading-6">
          {desk.data.join("\n")}
        </pre>

        <p className="mt-4 text-sm text-ink-soft">
          Limit: {desk.note}
        </p>
      </div>
    </div>
  );
}
