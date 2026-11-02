"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { reducedMotion } from "./useMotion";

const BRIEF =
  "Nine days in Japan from Hyderabad, three travelers, moderate pace, good food.";

const HUB = { x: 200, y: 132 };

const NODES = [
  { id: "Flights", x: 70, y: 42, note: "Two route options. Fares not implied." },
  { id: "Stay", x: 70, y: 222, note: "Tokyo 5 nights · Kanazawa 3 nights." },
  { id: "Weather", x: 330, y: 42, note: "March: cool, changeable. Pack a shell." },
  { id: "Budget", x: 330, y: 222, note: "Estimate exceeds the envelope." },
  { id: "Itinerary", x: 200, y: 36, note: "Day plan ready for your review." },
  { id: "Final", x: 200, y: 228, note: "Voyage document assembled." },
];

const STATUS = ["Briefing", ...NODES.map((node) => node.id), "Ready"];

export function DispatchConsole() {
  const [stage, setStage] = useState(0);
  const [typed, setTyped] = useState(0);
  const [inspect, setInspect] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<(SVGLineElement | null)[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const lineTweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (reducedMotion()) {
      setTyped(BRIEF.length);
      setStage(STATUS.length - 1);
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(linesRef.current.filter(Boolean), { strokeDashoffset: 0 });
      const typing = { n: 0 };
      const timeline = gsap.timeline({
        repeat: -1,
        repeatDelay: 2.2,
        onRepeat: () => {
          setStage(0);
          setTyped(0);
        },
      });

      timeline.to(typing, {
        n: BRIEF.length,
        duration: 2.2,
        ease: "none",
        onUpdate: () => setTyped(Math.floor(typing.n)),
      });

      NODES.forEach((_, index) => {
        timeline.call(() => {
          setStage(index + 1);
          lineTweenRef.current?.kill();
          linesRef.current.forEach((line) => {
            if (!line) return;
            gsap.set(line, { strokeDasharray: "3 5", strokeDashoffset: 0, stroke: "" });
          });
          const line = linesRef.current[index];
          if (!line) return;
          const length = line.getTotalLength();
          gsap.set(line, {
            stroke: "var(--brass)",
            strokeDasharray: `${length} ${length}`,
            strokeDashoffset: length,
          });
          lineTweenRef.current = gsap.to(line, {
            strokeDashoffset: 0,
            duration: 0.7,
            ease: "power2.inOut",
          });
        });
        timeline.to({}, { duration: 1.45 });
      });

      timeline.call(() => {
        lineTweenRef.current?.kill();
        gsap.set(linesRef.current.filter(Boolean), { strokeDashoffset: 0 });
        setStage(STATUS.length - 1);
      });
      timeline.to({}, { duration: 2.8 });
      timelineRef.current = timeline;
    }, rootRef);

    return () => {
      lineTweenRef.current?.kill();
      timelineRef.current?.kill();
      lineTweenRef.current = null;
      timelineRef.current = null;
      ctx.revert();
    };
  }, []);

  const active =
    inspect ??
    (stage >= 1 && stage <= NODES.length ? NODES[stage - 1].id : null);

  const pause = () => {
    timelineRef.current?.pause();
    lineTweenRef.current?.pause();
  };
  const resume = () => {
    setInspect(null);
    timelineRef.current?.resume();
    lineTweenRef.current?.resume();
  };

  const inspected = NODES.find((node) => node.id === active);

  return (
    <div
      ref={rootRef}
      data-testid="dispatch-console"
      data-stage={STATUS[stage]}
      onMouseEnter={pause}
      onMouseLeave={resume}
      className="overflow-hidden border border-rule bg-paper-raised shadow-[0_24px_60px_-36px_rgba(26,24,20,0.45)]"
    >
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
        <span>Chart desk · Illustrative</span>
        <span className="hidden sm:inline">HYD → NRT · 12–21 Mar</span>
        <span className={stage === STATUS.length - 1 ? "text-olive" : "text-brass"}>
          {STATUS[stage]}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="border-b border-rule p-4 lg:border-b-0 lg:border-r">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">Brief</p>
          <p className="mt-2 min-h-[88px] rounded-[3px] border border-rule bg-paper p-3 text-sm leading-6">
            {BRIEF.slice(0, typed)}
            <span className="ml-px inline-block h-4 w-[2px] translate-y-0.5 bg-brass motion-safe:animate-pulse" />
          </p>
          <ul className="mt-4 space-y-1.5">
            {NODES.map((node, index) => {
              const done = stage > index + 1 || stage === STATUS.length - 1;
              const on = active === node.id;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setInspect(node.id)}
                    onFocus={() => setInspect(node.id)}
                    className={`flex w-full items-center justify-between rounded-[3px] px-2 py-1.5 text-left font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                      on ? "bg-paper text-brass" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    <span>{node.id}</span>
                    <span className={done ? "text-olive" : on ? "text-brass" : ""}>
                      {done ? "set" : on ? "live" : "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="p-2">
          <svg viewBox="0 0 400 270" className="w-full" aria-hidden="true">
            {NODES.map((node, index) => (
              <line
                key={node.id}
                ref={(element) => {
                  linesRef.current[index] = element;
                }}
                x1={HUB.x}
                y1={HUB.y}
                x2={node.x}
                y2={node.y}
                strokeDasharray="3 5"
                strokeWidth={active === node.id ? 1.6 : 1}
                className={active === node.id ? "stroke-brass" : "stroke-rule"}
              />
            ))}
            <circle cx={HUB.x} cy={HUB.y} r="18" className="fill-paper stroke-brass" />
            <text x={HUB.x} y={HUB.y + 3} textAnchor="middle" className="fill-brass font-mono text-[8px] uppercase">
              SUP
            </text>
            {NODES.map((node) => {
              const isActive = active === node.id;
              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setInspect(node.id)}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isActive ? 11 : 8}
                    className={
                      isActive
                        ? "fill-brass stroke-brass"
                        : node.id === "Final"
                          ? "fill-paper stroke-olive"
                          : "fill-paper stroke-steel"
                    }
                  />
                  <text
                    x={node.x}
                    y={node.y + (node.y > 160 ? 22 : -16)}
                    textAnchor="middle"
                    className="fill-ink-soft font-mono text-[8px] uppercase tracking-widest"
                  >
                    {node.id}
                  </text>
                </g>
              );
            })}
          </svg>

          <div aria-live="polite" className="min-h-[92px] px-3 pb-3">
            {inspect && inspected ? (
              <p className="vm-fade border border-rule bg-paper p-3 text-sm">{inspected.note}</p>
            ) : stage === 4 ? (
              <p className="vm-fade border border-danger/50 p-3 text-sm">
                Estimate exceeds your envelope. Review?
              </p>
            ) : stage === 5 ? (
              <div className="vm-fade border border-brass p-3 text-sm">
                Your proposed day plan is ready.
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-brass">
                  Accept · Modify · Regenerate
                </p>
              </div>
            ) : stage === 6 ? (
              <div className="vm-fade border border-rule p-3 text-sm">
                Final review complete.
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-brass">
                  Assembling voyage document
                </p>
              </div>
            ) : stage === 7 ? (
              <div className="vm-fade border border-rule bg-paper p-3">
                <p className="font-display text-xl">Tokyo · Kanazawa · 12–21 Mar</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-olive">
                  Ready · Voyage document
                </p>
              </div>
            ) : (
              <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                Hover a desk to inspect. Playback pauses while you look.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
