"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { reducedMotion } from "./useMotion";

const MS = 4800;

const DESKS = [
  {
    id: "Brief",
    role: "Turns a rough idea into constraints the rest of the mesh can use.",
    data: ["HYD → NRT", "12–21 Mar · 3 travelers", "Pace moderate · food-forward"],
    note: "Missing details become review questions, not guesses.",
    x: 210,
    y: 48,
  },
  {
    id: "Flights",
    role: "Researches route options and typical schedules.",
    data: ["HYD → NRT · 12 Mar", "2 options · 1 stop"],
    note: "Schedules are typical. Fares are never implied.",
    x: 70,
    y: 118,
  },
  {
    id: "Stay",
    role: "Compares areas and stays against your pace.",
    data: ["Tokyo · 5 nights", "Kanazawa · 3 nights"],
    note: "Availability and prices are not implied.",
    x: 70,
    y: 208,
  },
  {
    id: "Weather",
    role: "Adds seasonal context and packing implications.",
    data: ["March · cool, changeable", "Layers + rain shell"],
    note: "Forecast confidence drops beyond about ten days.",
    x: 350,
    y: 118,
  },
  {
    id: "Budget",
    role: "Builds a working estimate with stated assumptions.",
    data: ["Envelope  INR 180,000", "Estimate  INR 196,400", "Decision  review required"],
    note: "An estimate, never a quote.",
    x: 350,
    y: 208,
  },
  {
    id: "Itinerary",
    role: "Sequences days, then pauses for your review.",
    data: ["Day 1 · Arrive, light evening", "Day 4 · Train to Kanazawa"],
    note: "One free evening a day, as briefed.",
    x: 210,
    y: 248,
  },
  {
    id: "Chart",
    role: "Synthesizes everything into one voyage document.",
    data: ["Cover · Flights · Stay", "Weather · Ledger · Packing"],
    note: "Export as a checklist PDF or workbook.",
    x: 210,
    y: 148,
  },
];

const LAST_DESK = DESKS.length - 1;
const HUB = DESKS[DESKS.length - 1];

export function SpecialistDesks() {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);

  const selectDesk = useCallback((next: number) => {
    const clamped = ((next % DESKS.length) + DESKS.length) % DESKS.length;
    activeRef.current = clamped;
    setActive(clamped);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || reducedMotion()) return;
    const timer = setTimeout(() => selectDesk(active + 1), MS);
    return () => clearTimeout(timer);
  }, [active, seen, selectDesk]);

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
      className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
    >
      <div
        role="group"
        aria-label="Specialist desks"
        onKeyDown={handleKeyDown}
        className="relative border border-rule bg-paper"
      >
        <svg viewBox="0 0 420 300" className="w-full" aria-hidden="true">
          {DESKS.slice(0, -1).map((node) => (
            <line
              key={node.id}
              x1={HUB.x}
              y1={HUB.y}
              x2={node.x}
              y2={node.y}
              className={desk.id === node.id || desk.id === "Chart" ? "stroke-brass" : "stroke-rule"}
              strokeWidth={desk.id === node.id ? 1.6 : 1}
            />
          ))}
          {DESKS.map((node, index) => {
            const on = index === active;
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => selectDesk(index)}
              >
                {on ? (
                  <circle cx={node.x} cy={node.y} r="18" className="fill-brass/15 stroke-brass" />
                ) : null}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.id === "Chart" ? 14 : 9}
                  className={
                    on
                      ? "fill-brass stroke-brass"
                      : node.id === "Chart"
                        ? "fill-paper stroke-olive"
                        : "fill-paper stroke-steel"
                  }
                />
                <text
                  x={node.id === "Chart" ? node.x + 22 : node.x}
                  y={node.id === "Chart" ? node.y + 4 : node.y + (node.y > 200 ? 28 : -18)}
                  textAnchor={node.id === "Chart" ? "start" : "middle"}
                  className={`font-mono text-[9px] uppercase tracking-[0.14em] ${on ? "fill-brass" : "fill-ink-soft"}`}
                >
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap gap-1.5 border-t border-rule p-3">
          {DESKS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectDesk(index)}
              aria-current={index === active ? "step" : undefined}
              className={`relative min-h-10 overflow-hidden rounded-[3px] border px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-steel ${
                index === active
                  ? "border-brass text-brass"
                  : "border-rule text-ink-soft hover:text-ink"
              }`}
            >
              {item.id}
              {index === active && seen && !reducedMotion() ? (
                <span
                  key={active}
                  className="vm-bar absolute bottom-0 left-0 h-[2px] w-full bg-brass"
                  style={{ animationDuration: `${MS}ms` }}
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <article
        aria-live="polite"
        aria-atomic="true"
        key={desk.id}
        className="vm-fade flex flex-col border border-rule bg-paper-raised p-6"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">
          {desk.id === "Chart" ? "Supervisor" : `${desk.id} desk`}
        </p>
        <h3 className="mt-3 font-display text-2xl leading-snug md:text-3xl">{desk.role}</h3>
        <ul className="mt-6 space-y-2 border-t border-rule pt-5 font-mono text-xs leading-6">
          {desk.data.map((line) => (
            <li key={line} className="flex gap-3">
              <span className="text-brass">▹</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-auto pt-6 text-sm leading-6 text-ink-soft">Limit: {desk.note}</p>
      </article>
    </div>
  );
}
