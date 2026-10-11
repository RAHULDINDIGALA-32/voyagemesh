"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "./useMotion";

type Pt = { x: number; y: number; label: string };
type Geo = { w: number; h: number; d: string; pts: Pt[] };

export function RouteSpine() {
  const host = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const vessel = useRef<SVGGElement>(null);
  const [g, setG] = useState<Geo | null>(null);

  useEffect(() => {
    const root = host.current?.parentElement;
    if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const els = Array.from(root.querySelectorAll<HTMLElement>("[data-waypoint]"));
      const pts = els.map((el, i) => ({
        x: i % 2 ? Math.round(box.width - 28) : 28,
        y: Math.round(el.getBoundingClientRect().top - box.top + 64),
        label: el.dataset.waypoint ?? "",
      }));
      if (pts.length < 2) return;
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], p = (b.y - a.y) * 0.5;
        d += ` C ${a.x} ${a.y + p}, ${b.x} ${b.y - p}, ${b.x} ${b.y}`;
      }
      setG({ w: Math.round(box.width), h: Math.round(box.height), d, pts });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const p = path.current, v = vessel.current, root = host.current?.parentElement;
    if (!g || !p || !v || !root) return;
    gsap.registerPlugin(ScrollTrigger);
    const len = p.getTotalLength();
    const place = (t: number) => {
      const pt = p.getPointAtLength(len * t);
      v.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    };
    if (reducedMotion()) { p.style.strokeDashoffset = "0"; place(1); return; }
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    place(0);
    const st = ScrollTrigger.create({
      trigger: root, start: "top 55%", end: "bottom 55%", scrub: 0.5,
      onUpdate: (s) => { p.style.strokeDashoffset = `${len * (1 - s.progress)}`; place(s.progress); },
    });
    return () => st.kill();
  }, [g]);

  return (
    <div ref={host} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 hidden md:block">
      {g && (
        <svg width={g.w} height={g.h} viewBox={`0 0 ${g.w} ${g.h}`} fill="none" className="overflow-visible text-brass">
          <path d={g.d} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 7" strokeLinecap="round" />
          <path ref={path} d={g.d} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
          {g.pts.map((pt, i) => (
            <g key={i} transform={`translate(${pt.x} ${pt.y})`}>
              <circle r={4} className="fill-paper stroke-brass" />
              <text x={pt.x < 100 ? 12 : -12} y={4} textAnchor={pt.x < 100 ? "start" : "end"}
                className="fill-ink-soft font-mono text-[9px] uppercase tracking-[0.16em]">
                {String(i).padStart(2, "0")} · {pt.label}
              </text>
            </g>
          ))}
          <g ref={vessel}>
            <circle r={8} className="fill-brass/30">
              <animate attributeName="r" values="8;18;8" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values=".6;0;.6" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <path d="M0 -9 L3 0 L0 9 L-3 0Z M-9 0 L0 -3 L9 0 L0 3Z" className="fill-brass" />
          </g>
        </svg>
      )}
    </div>
  );
}
