"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "./useMotion";

const VIEW = { w: 1440, h: 900 };
const ROSE = { x: 118, y: 118 };

const NODES = [
  { x: 180, y: 220 },
  { x: 340, y: 140 },
  { x: 520, y: 210 },
  { x: 710, y: 120 },
  { x: 900, y: 240 },
  { x: 1080, y: 160 },
  { x: 1260, y: 250 },
  { x: 430, y: 380 },
  { x: 640, y: 430 },
  { x: 860, y: 360 },
  { x: 1120, y: 420 },
  { x: 280, y: 520 },
  { x: 560, y: 620 },
  { x: 820, y: 560 },
  { x: 1040, y: 640 },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
  [1, 7], [2, 7], [2, 8], [4, 9], [5, 10],
  [7, 8], [8, 9], [9, 10],
  [0, 11], [7, 11], [8, 12], [9, 13], [10, 14],
  [11, 12], [12, 13], [13, 14],
];

const ROUTE = "M 210 540 C 420 380, 640 300, 860 340 S 1180 520, 1280 430";

export function MeshCanvas() {
  const root = useRef<SVGSVGElement>(null);
  const bearing = useRef<SVGLineElement>(null);
  const vessel = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const svg = root.current;
    const line = bearing.current;
    const mark = vessel.current;
    if (!svg || !line) return;

    const toLocal = (clientX: number, clientY: number) => {
      const box = svg.getBoundingClientRect();
      return {
        x: ((clientX - box.left) / box.width) * VIEW.w,
        y: ((clientY - box.top) / box.height) * VIEW.h,
      };
    };

    const onMove = (event: PointerEvent) => {
      const { x, y } = toLocal(event.clientX, event.clientY);
      line.setAttribute("x2", String(x));
      line.setAttribute("y2", String(y));
      mark?.setAttribute("cx", String(x));
      mark?.setAttribute("cy", String(y));
    };

    if (reducedMotion()) return;

    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const meridians = Array.from({ length: 15 }, (_, i) => 80 + i * 90);
  const parallels = Array.from({ length: 10 }, (_, i) => 60 + i * 84);

  return (
    <svg
      ref={root}
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full text-steel"
      aria-hidden
    >
      {meridians.map((x) => (
        <line key={`m-${x}`} x1={x} y1={0} x2={x} y2={VIEW.h} stroke="currentColor" strokeOpacity="0.14" />
      ))}
      {parallels.map((y) => (
        <line key={`p-${y}`} x1={0} y1={y} x2={VIEW.w} y2={y} stroke="currentColor" strokeOpacity="0.14" />
      ))}

      {EDGES.map(([a, b], index) => (
        <line
          key={index}
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke="currentColor"
          strokeOpacity="0.38"
          strokeWidth="0.9"
        />
      ))}

      <path
        d={ROUTE}
        fill="none"
        stroke="var(--brass)"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeDasharray="5 7"
      />

      {NODES.map((node, index) => (
        <circle key={index} cx={node.x} cy={node.y} r="2.6" fill="currentColor" opacity="0.7" />
      ))}

      <g transform={`translate(${ROSE.x} ${ROSE.y})`} className="text-brass">
        <circle r="28" fill="none" stroke="currentColor" strokeOpacity="0.45" />
        <circle r="6" fill="currentColor" />
        <path d="M0 -22 L3 0 L0 8 L-3 0Z" fill="currentColor" />
        <text y="-34" textAnchor="middle" className="fill-brass font-mono text-[9px] uppercase tracking-[0.2em]">
          N
        </text>
      </g>

      <line
        ref={bearing}
        x1={ROSE.x}
        y1={ROSE.y}
        x2={ROSE.x}
        y2={ROSE.y}
        stroke="var(--brass)"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      <circle ref={vessel} cx={ROSE.x} cy={ROSE.y} r="3.5" fill="var(--brass)" opacity="0.7" />
    </svg>
  );
}
