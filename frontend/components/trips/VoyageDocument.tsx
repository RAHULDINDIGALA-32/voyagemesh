"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BedDouble,
  CalendarDays,
  CircleDollarSign,
  CloudSun,
  Flag,
  MapPin,
  Plane,
  Route,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ItineraryDays, isItineraryExpanded } from "@/components/trips/ItineraryDays";
import { WeatherDetails, hasWeatherData } from "@/components/trips/WeatherDetails";
//import { Stamp } from "@/components/ui/Stamp";
import { downloadPlanPdf } from "@/lib/export/documents";
import { asTripDocument } from "@/lib/plan/parse";
import type { TripDocument, TripPayload } from "@/types/trip";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function getScrollParent(el: HTMLElement): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;

  while (node && node !== document.body && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      /(auto|scroll|overlay)/.test(overflowY) &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }

  return window;
}

const shown = (value?: string) => value?.trim() || "Not specified";

const facts = (...items: Array<string | undefined>) =>
  items.filter((item) => item?.trim()).join(" · ");

/* ------------------------------------------------------------------ */
/*  Building blocks                                                    */
/* ------------------------------------------------------------------ */

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
    <section className="relative rounded-2xl border border-rule bg-paper/95 p-5 shadow-[0_10px_30px_-22px_color-mix(in_oklab,var(--ink)_60%,transparent)] transition-[border-color,box-shadow] duration-300 hover:border-brass/60 hover:shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--ink)_70%,transparent)]">
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
      <span className="relative grid size-11 shrink-0 place-items-center rounded-full border border-brass bg-paper-raised text-brass">
        <span
          className="absolute inset-0 rounded-full border border-brass/50 motion-safe:animate-ping"
          aria-hidden="true"
        />
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

/* ------------------------------------------------------------------ */
/*  Timeline side panel (unchanged)                                    */
/* ------------------------------------------------------------------ */

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

        {trip.weather?.summary || trip.weather?.packing_hints?.length ? (
          <section className="mt-7">
            <h3 className="font-display text-xl">Weather and preparation</h3>
            {trip.weather.summary ? (
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {trip.weather.summary}
              </p>
            ) : null}
            {trip.weather.metric ? (
              <p className="mt-2 font-mono text-xs text-brass">
                {trip.weather.metric}
                {trip.weather.metric_label ? ` · ${trip.weather.metric_label}` : ""}
              </p>
            ) : null}
            {trip.weather.packing_hints?.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                {trip.weather.packing_hints.map((hint, index) => (
                  <li key={`${hint}-${index}`}>{hint}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

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

/* ------------------------------------------------------------------ */
/*  Curved route: measure real DOM positions → draw S-curves           */
/* ------------------------------------------------------------------ */

type Segment = { d: string; x: number; y: number };
type Layout = { w: number; h: number; segs: Segment[]; key: string };

/**
 * Each stop (endpoint or card) is a wrapper element. A curve leaves the
 * bottom-centre of one stop and enters the top-centre of the next using a
 * cubic Bézier with vertical tangents, which gives the S-shaped swing in
 * the sketch whenever stops sit on opposite sides, and a gentle straight
 * drop on mobile where they stack in one column.
 */
function buildLayout(container: HTMLElement, stops: HTMLElement[]): Layout {
  const box = container.getBoundingClientRect();

  const anchors = stops.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      cx: Math.round(r.left - box.left + r.width / 2),
      top: Math.round(r.top - box.top),
      bottom: Math.round(r.bottom - box.top),
    };
  });

  const segs: Segment[] = [];

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const x1 = a.cx;
    const y1 = a.bottom;
    const x2 = b.cx;
    const y2 = b.top;
    const pull = (y2 - y1) * 0.55;

    segs.push({
      d: `M ${x1} ${y1} C ${x1} ${y1 + pull}, ${x2} ${y2 - pull}, ${x2} ${y2}`,
      // The curve is symmetric, so t = 0.5 lands on the plain midpoint.
      x: Math.round((x1 + x2) / 2),
      y: Math.round((y1 + y2) / 2),
    });
  }

  const w = Math.round(box.width);
  const h = Math.round(box.height);

  return {
    w,
    h,
    segs,
    key: `${w}x${h}|${segs.map((s) => s.d).join("|")}`,
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const SPACER = "h-24 md:h-32";

export function VoyageDocument({
  payload,
  conversationId,
}: {
  payload: TripPayload;
  conversationId?: string | null;
}) {
  const trip = asTripDocument(payload);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);

  const flight = trip.flights;
  const hotel = trip.hotels;
  const weather = trip.weather;
  const budget = trip.budget;
  const itinerary = trip.itinerary;

  const routeRef = useRef<HTMLDivElement>(null);
  // 0 source · 1 flight · 2 hotels · 3 weather · 4 budget · 5 itinerary · 6 destination
  const stopRefs = useRef<Array<HTMLDivElement | null>>([]);

  const setStop = (index: number) => (el: HTMLDivElement | null) => {
    // Callback refs are intentionally collected for route measurement.
    // eslint-disable-next-line react-hooks/refs
    stopRefs.current[index] = el;
  };

  // Icon sitting on each curve (source→flight, flight→hotels, …)
  const connectorIcons = [
    <Plane key="plane" size={16} />,
    <BedDouble key="bed" size={16} />,
    <CloudSun key="weather" size={16} />,
    <CircleDollarSign key="budget" size={16} />,
    <CalendarDays key="itinerary" size={16} />,
    <Route key="route" size={16} />,
  ];

  /* ---- measure ---- */
  const measure = useCallback(() => {
    const container = routeRef.current;
    const stops = stopRefs.current.filter(Boolean) as HTMLElement[];
    if (!container || stops.length < 2) return;

    const next = buildLayout(container, stops);
    setLayout((prev) => (prev?.key === next.key ? prev : next));
  }, []);

  useEffect(() => {
    measure();

    const container = routeRef.current;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(schedule);
    if (container) observer.observe(container);
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [measure, payload]);

  /* ---- animate (GSAP) ---- */
  useEffect(() => {
    const root = routeRef.current;
    if (!layout || !root) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // The element that really scrolls (window, or an app-shell <main>).
    const scroller = getScrollParent(root);

    const ctx = gsap.context(() => {
      const progress = gsap.utils.toArray<SVGPathElement>(".js-progress");

      if (reduced) {
        gsap.set(progress, { strokeDashoffset: 0 });
        return;
      }

      // 1. Route draws itself as you scroll (scrubbed).
      progress.forEach((path) => {
        gsap.to(path, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: path,
            scroller,
            start: "clamp(top 80%)",
            end: "clamp(bottom 45%)",
            scrub: 0.6,
          },
        });
      });

      // 2. Dashed guide keeps drifting along the route.
      gsap.to(".js-flow", {
        strokeDashoffset: -10,
        duration: 1.1,
        ease: "none",
        repeat: -1,
      });

      // 3. Icon nodes pop in as the line reaches them.
      gsap.utils.toArray<HTMLElement>(".js-node").forEach((node) => {
        gsap.from(node, {
          scale: 0.3,
          opacity: 0,
          duration: 0.55,
          ease: "back.out(2.2)",
          scrollTrigger: {
            trigger: node,
            scroller,
            start: "clamp(top 88%)",
            toggleActions: "play none none reverse",
          },
        });
      });

      // 4. Cards and endpoints glide in from the side they sit on.
      gsap.utils.toArray<HTMLElement>(".js-stop").forEach((el) => {
        const side = Number(el.dataset.side ?? 0);
        gsap.from(el, {
          opacity: 0,
          y: 36,
          x: side * 28,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            scroller,
            start: "clamp(top 88%)",
            toggleActions: "play none none reverse",
          },
        });
      });
    }, root);

    // Failsafe: anything still hidden shortly after setup and already on
    // screen or above the fold gets revealed rather than left invisible.
    const failsafe = window.setTimeout(() => {
      gsap.utils.toArray<HTMLElement>(".js-stop", root).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && Number(getComputedStyle(el).opacity) === 0) {
          gsap.to(el, { opacity: 1, x: 0, y: 0, duration: 0.5 });
        }
      });
    }, 1200);

    // Positions were measured before fonts/data settled; recompute once.
    const refresh = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(refresh);
      window.clearTimeout(failsafe);
      ctx.revert();
    };
  }, [layout?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const expanded = isItineraryExpanded(itinerary?.days);
  const incompleteItinerary = payload.status === "completed" && !itinerary?.days?.length;

  return (
    <article className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-8 sm:pb-40 sm:pt-10">
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

        {/*
        <Stamp
          tone={
            payload.status === "completed" || payload.status === "ready"
              ? "olive"
              : "brass"
          }
        >
          {payload.status.replaceAll("_", " ")}
        </Stamp>
        */}
      </header>

      {incompleteItinerary ? (
        <div className="mb-8 border border-danger/40 bg-paper-raised p-4 text-sm text-danger">
          This voyage completed without a usable itinerary. Please return to the chat and retry the workflow.
        </div>
      ) : null}

      <div className="mb-10 flex flex-wrap gap-2">
        {conversationId ? (
          <Link
            href={`/app/c/${conversationId}`}
          >
            <Button type="button"
              className="rounded-lg border border-rule  hover:bg-paper-raised"
            >
              Open Chat
            </Button>

          </Link>
        ) : null}

        <Button type="button"
          className="rounded-lg border border-rule  hover:bg-paper-raised"
          onClick={() => setTimelineOpen(true)}>
          Trip Timeline
        </Button>

        <Button
          type="button"
          className="rounded-lg border border-rule  hover:bg-paper-raised"
          onClick={() => void downloadPlanPdf(payload)}
        >
          Download PDF
        </Button>
      </div>

      {/* ============ Route ============ */}
      <div ref={routeRef} className="relative">
        {/* Curves live behind everything */}
        {layout ? (
          <svg
            className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible text-brass"
            width={layout.w}
            height={layout.h}
            viewBox={`0 0 ${layout.w} ${layout.h}`}
            fill="none"
            aria-hidden="true"
          >
            {layout.segs.map((seg, i) => (
              <g key={i}>
                {/* faint dashed guide, always visible */}
                <path
                  className="js-flow"
                  d={seg.d}
                  stroke="currentColor"
                  strokeOpacity={0.4}
                  strokeWidth={1.25}
                  strokeDasharray="3 7"
                  strokeLinecap="round"
                />
                {/* solid brass line that draws on scroll */}
                <path
                  className="js-progress"
                  d={seg.d}
                  pathLength={1}
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
                />
              </g>
            ))}
          </svg>
        ) : null}

        {/* Source — sits right of centre, like the sketch */}
        <div ref={setStop(0)} className="relative z-10 md:ml-[48%]">
          <div className="js-stop" data-side="0">
            <Endpoint
              label="Starting from"
              location={trip.origin}
              icon={<MapPin size={19} />}
            />
          </div>
        </div>

        <div className={SPACER} aria-hidden="true" />

        {/* Flight — left */}
        <div ref={setStop(1)} className="relative z-10 md:mr-[48%]">
          <div className="js-stop" data-side="-1">
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
                {(flight?.options ?? []).map((option, index) => (
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

                {!flight?.options?.length ? (
                  <p className="text-sm text-ink-soft">
                    Flight details are not available yet.
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        </div>

        <div className={SPACER} aria-hidden="true" />

        {/* Hotels — right */}
        <div ref={setStop(2)} className="relative z-10 md:ml-[48%]">
          <div className="js-stop" data-side="1">
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
                {(hotel?.options ?? []).map((option, index) => (
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

                {!hotel?.options?.length ? (
                  <p className="text-sm text-ink-soft">
                    Accommodation details are not available yet.
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        </div>

        <div className={SPACER} aria-hidden="true" />


        {/* Weather — left */}
        <div ref={setStop(3)} className="relative z-10 md:mr-[48%]">
          <div className="js-stop" data-side="-1">
            <Card
              title={weather?.headline || "Weather"}
              icon={<CloudSun size={19} />}
            >
              {weather && hasWeatherData(weather) ? (
                <WeatherDetails weather={weather} />
              ) : (
                <p className="text-sm text-ink-soft">
                  Destination weather is not available yet.
                </p>
              )}
            </Card>
          </div>
        </div>

        <div className={SPACER} aria-hidden="true" />

        {/* Budget — right */}
        <div ref={setStop(4)} className="relative z-10 md:ml-[48%]">
          <div className="js-stop" data-side="-1">
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
                {(budget?.lines ?? []).map((line, index) => (
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

                {!budget?.lines?.length ? (
                  <p className="text-sm text-ink-soft">
                    Budget details are not available yet.
                  </p>
                ) : null}
              </dl>
            </Card>
          </div>
        </div>

        <div className={SPACER} aria-hidden="true" />

        {/* Itinerary — left */}
        <div ref={setStop(5)} className={`relative z-10 ${expanded ? "" : "md:mr-[48%]"}`}>
          <div className="js-stop" data-side={expanded ? 0 : 1}>
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
                {/*
                {(itinerary?.days ?? []).map((day, index) => (
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
                  */}

                <ItineraryDays days={itinerary?.days ?? []} />

                {!itinerary?.days?.length ? (
                  <p className="text-sm text-ink-soft">
                    Day plans are not available yet.
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        </div>

        <div className={SPACER} aria-hidden="true" />

        {/* Destination — right */}
        <div ref={setStop(6)} className="relative z-10 md:ml-[48%]">
          <div className="js-stop" data-side="0">
            <Endpoint
              label="Destination"
              location={trip.destination}
              icon={<Flag size={19} />}
            />
          </div>
        </div>

        {/* Icon nodes sit on the midpoint of every curve */}
        {layout?.segs.map((seg, i) => (
          <div
            key={i}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: seg.x, top: seg.y }}
            aria-hidden="true"
          >
            <div className="js-node grid size-10 place-items-center rounded-full border border-brass bg-paper text-brass shadow-[0_0_0_5px_var(--paper)]">
              {connectorIcons[i]}
            </div>
          </div>
        ))}
      </div>

      {timelineOpen ? (
        <TimelinePanel
          trip={trip}
          onClose={() => setTimelineOpen(false)}
        />
      ) : null}
    </article>
  );
}
