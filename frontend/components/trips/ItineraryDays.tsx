"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Clapperboard, Compass, MapPin, MoonStar, Sunrise, Ticket } from "lucide-react";

import type { TripDocument } from "@/types/trip";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Day = NonNullable<NonNullable<TripDocument["itinerary"]>["days"]>[number];
type Stop = NonNullable<Day["stops"]>[number];

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function getScrollParent(el: HTMLElement): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

const pad = (n: number) => String(Math.round(n)).padStart(2, "0");
const has = (v?: string) => Boolean(v && v.trim());

const cleanStops = (day: Day): Stop[] =>
  (day.stops ?? []).filter((s) => has(s.time) || has(s.title) || has(s.place));

const dayHasContent = (day: Day) =>
  has(day.day) || has(day.title) || has(day.summary) || cleanStops(day).length > 0;

/** From this many visible days the card breaks out to full width and zig-zags. */
const EXPAND_FROM = 3;

export const isItineraryExpanded = (days?: Day[]) =>
  (days ?? []).filter(dayHasContent).length >= EXPAND_FROM;

/* Deterministic "random" so server and client markup match. */
const STARS = Array.from({ length: 9 }, (_, i) => ({
  left: (i * 37 + 11) % 92,
  top: (i * 53 + 7) % 70,
  size: 2 + (i % 3),
}));

/* ------------------------------------------------------------------ */
/*  Scenes: one visual identity + one GSAP choreography per variant    */
/* ------------------------------------------------------------------ */

type Scene = "sunrise" | "ticket" | "compass" | "film" | "night";
const SCENES: Scene[] = ["sunrise", "ticket", "compass", "film", "night"];

const SCENE_ICON: Record<Scene, ReactNode> = {
  sunrise: <Sunrise size={16} />,
  ticket: <Ticket size={16} />,
  compass: <Compass size={16} />,
  film: <Clapperboard size={16} />,
  night: <MoonStar size={16} />,
};

/** Surface treatment per scene (colours come from the existing tokens). */
const SCENE_SURFACE: Record<Scene, string> = {
  sunrise: "border-rule bg-gradient-to-b from-brass/15 via-paper-raised to-paper-raised",
  ticket: "border-dashed border-brass/70 bg-paper-raised",
  compass: "border-rule bg-paper-raised",
  film: "border-ink/70 bg-paper-raised",
  night: "border-ink bg-ink text-paper",
};

function SceneDecor({ scene }: { scene: Scene }) {
  switch (scene) {
    case "sunrise":
      return (
        <svg
          className="pointer-events-none absolute -right-2 top-0 h-24 w-36 text-brass"
          viewBox="0 0 144 96"
          fill="none"
          aria-hidden="true"
        >
          <circle className="d-glow" cx="100" cy="66" r="26" fill="currentColor" opacity="0.18" />
          <circle className="d-sun" cx="100" cy="66" r="14" fill="currentColor" />
          <path
            className="d-arc"
            d="M 20 76 Q 100 6 144 76"
            pathLength={1}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M 0 76 H 144" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
        </svg>
      );

    case "ticket":
      return (
        <>
          {/* punched notches */}
          <span className="pointer-events-none absolute -left-2 top-1/2 size-4 -translate-y-1/2 rounded-full border border-brass/70 bg-paper" />
          <span className="pointer-events-none absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full border border-brass/70 bg-paper" />
          <div
            className="d-stamp pointer-events-none absolute right-4 top-3 grid size-14 place-items-center rounded-full border-2 border-double border-brass text-brass"
            style={{ transform: "rotate(-8deg)" }}
            aria-hidden="true"
          >
            <span className="font-mono text-[8px] uppercase leading-tight tracking-widest">
              day
              <br />
              <span className="d-stamp-num text-sm font-semibold tracking-normal">00</span>
            </span>
          </div>
        </>
      );

    case "compass":
      return (
        <svg
          className="pointer-events-none absolute right-3 top-3 size-14 text-brass"
          viewBox="0 0 56 56"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="28" cy="28" r="25" stroke="currentColor" strokeOpacity="0.5" />
          <g stroke="currentColor" strokeOpacity="0.5">
            <path d="M28 3v5M28 48v5M3 28h5M48 28h5" />
          </g>
          <g className="d-needle">
            <path d="M28 10 L33 28 L28 26 L23 28 Z" fill="currentColor" />
            <path d="M28 46 L33 28 L28 30 L23 28 Z" fill="currentColor" opacity="0.3" />
          </g>
        </svg>
      );

    case "film":
      return (
        <>
          <div
            className="d-strip pointer-events-none absolute inset-x-0 top-0 h-2 opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, currentColor 0 8px, transparent 8px 16px)",
            }}
            aria-hidden="true"
          />
          <div
            className="d-strip pointer-events-none absolute inset-x-0 bottom-0 h-2 opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, currentColor 0 8px, transparent 8px 16px)",
            }}
            aria-hidden="true"
          />
          <div className="d-flash pointer-events-none absolute inset-0 bg-paper opacity-0" aria-hidden="true" />
        </>
      );

    case "night":
      return (
        <>
          {STARS.map((s, i) => (
            <span
              key={i}
              className="d-star pointer-events-none absolute rounded-full bg-brass"
              style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
              aria-hidden="true"
            />
          ))}
          <MoonStar
            className="d-moon pointer-events-none absolute right-4 top-3 text-brass"
            size={26}
            aria-hidden="true"
          />
        </>
      );
  }
}

/** Marker + row styling for each stop, per scene. */
function StopRow({ stop, scene }: { stop: Stop; scene: Scene }) {
  const soft = scene === "night" ? "text-paper/70" : "text-ink-soft";

  const body = (
    <div className="min-w-0">
      {has(stop.time) ? <p className="font-mono text-[10px] text-brass">{stop.time}</p> : null}
      {has(stop.title) ? <p className="text-sm font-medium leading-5">{stop.title}</p> : null}
      {has(stop.place) ? (
        <p className={`mt-0.5 flex items-center gap-1 text-xs ${soft}`}>
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{stop.place}</span>
        </p>
      ) : null}
    </div>
  );

  if (scene === "compass" || scene === "night") {
    return (
      <li className="d-stop relative pb-4 last:pb-0">
        <span
          className={`d-pin absolute -left-[1.6rem] top-1 grid size-3 place-items-center rounded-full border-2 ${
            scene === "night" ? "border-ink bg-brass" : "border-paper bg-brass"
          }`}
        />
        {body}
      </li>
    );
  }

  if (scene === "film") {
    return (
      <li className="d-stop mb-2 last:mb-0">
        <div className="d-frame rounded-md border border-ink/40 bg-paper px-3 py-2">{body}</div>
      </li>
    );
  }

  if (scene === "ticket") {
    return <li className="d-stop border-t border-dashed border-brass/50 py-2.5 first:border-t-0">{body}</li>;
  }

  return (
    <li className="d-stop flex gap-3 py-1.5">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brass" />
      {body}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  One day                                                            */
/* ------------------------------------------------------------------ */

function DayScene({ day, index, split }: { day: Day; index: number; split: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null); // wrapper (card + spine dot + tick)
  const cardRef = useRef<HTMLDivElement>(null);
  const side = index % 2 === 0 ? -1 : 1; // -1 left of the spine, 1 right
  const scene = SCENES[index % SCENES.length];
  const stops = cleanStops(day);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const card = cardRef.current;
    if (!root || !card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scroller = getScrollParent(root);
    const numEls = root.querySelectorAll<HTMLElement>(".d-num, .d-stamp-num");

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: {
          trigger: root,
          scroller,
          start: "clamp(top 90%)",
          toggleActions: "play none none reverse",
        },
      });

      // Shared: the day number counts up in every scene.
      const counter = { v: 0 };
      tl.to(
        counter,
        {
          v: index + 1,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: () => numEls.forEach((el) => (el.textContent = pad(counter.v))),
        },
        0,
      );
      tl.from(".d-head", { opacity: 0, y: 14, duration: 0.5 }, 0);

      // Zig-zag layout: card glides in from its own side, dot + tick link it to the spine.
      if (split) {
        tl.from(card, { x: side * 44, opacity: 0, duration: 0.7 }, 0)
          .from(".d-dot", { scale: 0, duration: 0.45, ease: "back.out(3)" }, 0.1)
          .from(
            ".d-tick",
            { scaleX: 0, transformOrigin: side < 0 ? "0% 50%" : "100% 50%", duration: 0.4 },
            0.15,
          );
      }

      switch (scene) {
        /* 1 · Sunrise: sun climbs over the horizon, arc draws, rows slide in */
        case "sunrise": {
          gsap.set(".d-arc", { strokeDasharray: 1, strokeDashoffset: 1 });
          tl.to(".d-arc", { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, 0.1)
            .fromTo(".d-sun", { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, 0.2)
            .from(".d-stop", { x: -26, opacity: 0, duration: 0.55, stagger: 0.12 }, 0.45);
          gsap.to(".d-glow", {
            scale: 1.3,
            opacity: 0.4,
            duration: 2.2,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            transformOrigin: "50% 50%",
          });
          break;
        }

        /* 2 · Ticket: stamp slams down, card thuds, rows flip like a departures board */
        case "ticket": {
          tl.fromTo(
            ".d-stamp",
            { scale: 2.6, rotation: -40, opacity: 0 },
            { scale: 1, rotation: -8, opacity: 1, duration: 0.55, ease: "back.out(1.8)" },
            0.2,
          )
            .to(card, { y: 3, duration: 0.06, yoyo: true, repeat: 3, ease: "none" }, 0.7)
            .from(
              ".d-stop",
              {
                rotationX: -85,
                opacity: 0,
                transformOrigin: "50% 0%",
                transformPerspective: 600,
                duration: 0.6,
                stagger: 0.14,
              },
              0.35,
            );
          break;
        }

        /* 3 · Compass: needle spins to north, route line draws, pins drop */
        case "compass": {
          tl.fromTo(
            ".d-needle",
            { rotation: -300, transformOrigin: "50% 50%" },
            { rotation: 0, duration: 1.3, ease: "elastic.out(1, 0.45)" },
            0.1,
          )
            .fromTo(
              ".d-line",
              { scaleY: 0 },
              { scaleY: 1, transformOrigin: "50% 0%", duration: 0.9, ease: "power2.inOut" },
              0.2,
            )
            .from(".d-pin", { y: -28, opacity: 0, duration: 0.7, ease: "bounce.out", stagger: 0.16 }, 0.35)
            .from(".d-stop > div", { x: 18, opacity: 0, duration: 0.5, stagger: 0.16 }, 0.4);
          break;
        }

        /* 4 · Film: frames wipe in under a camera flash while the strip rolls */
        case "film": {
          tl.fromTo(".d-flash", { opacity: 0.85 }, { opacity: 0, duration: 0.7, ease: "power2.out" }, 0.05).fromTo(
            ".d-frame",
            { clipPath: "inset(0 100% 0 0)", scale: 1.06 },
            {
              clipPath: "inset(0 0% 0 0)",
              scale: 1,
              duration: 0.65,
              stagger: 0.2,
              ease: "power2.inOut",
            },
            0.25,
          );
          gsap.to(".d-strip", {
            backgroundPositionX: "-32px",
            duration: 1.6,
            ease: "none",
            repeat: -1,
          });
          break;
        }

        /* 5 · Night: moon drifts in, stars twinkle, stops surface out of the dark */
        case "night": {
          tl.from(".d-moon", { x: 40, y: -18, rotation: 50, opacity: 0, duration: 1 }, 0.1)
            .fromTo(
              ".d-line",
              { scaleY: 0 },
              { scaleY: 1, transformOrigin: "50% 0%", duration: 1, ease: "power1.inOut" },
              0.3,
            )
            .from(
              ".d-stop",
              { opacity: 0, y: 14, filter: "blur(8px)", duration: 0.7, stagger: 0.16 },
              0.35,
            );
          gsap.to(".d-star", {
            opacity: 0.15,
            scale: 0.55,
            duration: 1.4,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            stagger: { each: 0.25, from: "random" },
          });
          break;
        }
      }
    }, root);

    return () => ctx.revert();
  }, [scene, index, split, side]);

  const dayLabel = day.day?.trim();
  const showLine = (scene === "compass" || scene === "night") && stops.length > 0;
  const soft = scene === "night" ? "text-paper/70" : "text-ink-soft";

  return (
    <div
      ref={rootRef}
      className={`relative ${split && side > 0 ? "md:translate-y-14" : ""}`}
    >
      {split ? (
        <>
          <span
            className={`d-tick pointer-events-none absolute top-6 hidden h-px w-8 bg-brass/60 md:block ${
              side < 0 ? "-right-8" : "-left-8"
            }`}
            aria-hidden="true"
          />
          <span
            className={`d-dot pointer-events-none absolute top-[1.125rem] z-10 hidden size-3 rounded-full border-2 border-paper bg-brass shadow-[0_0_0_4px_var(--paper)] md:block ${
              side < 0 ? "-right-[2.375rem]" : "-left-[2.375rem]"
            }`}
            aria-hidden="true"
          />
        </>
      ) : null}

    <div
      ref={cardRef}
      data-scene={scene}
      className={`relative overflow-hidden rounded-xl border p-4 ${SCENE_SURFACE[scene]} ${
        scene === "film" ? "py-6" : ""
      }`}
    >
      <SceneDecor scene={scene} />

      <div className="d-head relative pr-16">
        <div className="flex items-center gap-2 text-brass">
          {SCENE_ICON[scene]}
          <span className="font-display text-2xl leading-none">
            <span className="d-num">{pad(index + 1)}</span>
          </span>
          {dayLabel ? <span className="font-mono text-[10px] text-ink-soft">{dayLabel}</span> : null}
        </div>
        {has(day.title) ? <h3 className="mt-2 font-display text-lg leading-6">{day.title}</h3> : null}
        {has(day.summary) ? <p className={`mt-1 text-xs leading-5 ${soft}`}>{day.summary}</p> : null}
      </div>

      {stops.length > 0 ? (
        <ol className={`relative mt-4 ${showLine ? "pl-6" : ""}`}>
          {showLine ? (
            <span
              className="d-line absolute bottom-1 left-[5px] top-1 w-px bg-brass/70"
              aria-hidden="true"
            />
          ) : null}
          {stops.map((stop, i) => (
            <StopRow key={`${stop.title}-${i}`} stop={stop} scene={scene} />
          ))}
        </ol>
      ) : null}
    </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Public component                                                   */
/* ------------------------------------------------------------------ */

export function ItineraryDays({ days }: { days?: Day[] }) {
  // Days without any usable detail are ignored. No days → render nothing.
  const visible = (days ?? []).filter(dayHasContent);
  const split = visible.length >= EXPAND_FROM;
  const listRef = useRef<HTMLDivElement>(null);

  // The centre spine draws itself as you scroll down the days.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!split || !list) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".d-spine",
        { scaleY: 0 },
        {
          scaleY: 1,
          transformOrigin: "50% 0%",
          ease: "none",
          scrollTrigger: {
            trigger: list,
            scroller: getScrollParent(list),
            start: "clamp(top 75%)",
            end: "clamp(bottom 60%)",
            scrub: 0.6,
          },
        },
      );
    }, list);

    return () => ctx.revert();
  }, [split, visible.length]);

  if (!visible.length) return null;

  return (
    <div className="mt-4 border-t border-rule pt-5">
      <div
        ref={listRef}
        className={
          split
            ? "relative grid gap-5 md:grid-cols-2 md:gap-x-16 md:gap-y-6 md:pb-14"
            : "space-y-4"
        }
      >
        {split ? (
          <span
            className="d-spine pointer-events-none absolute bottom-0 left-[calc(50%-0.5px)] top-0 hidden w-px bg-brass/60 md:block"
            aria-hidden="true"
          />
        ) : null}

        {visible.map((day, i) => (
          <div key={`${day.day}-${i}`} className={split && i % 2 === 0 ? "md:col-start-1" : split ? "md:col-start-2" : ""}>
            <DayScene day={day} index={i} split={split} />
          </div>
        ))}
      </div>
    </div>
  );
}