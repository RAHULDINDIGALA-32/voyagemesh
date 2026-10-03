"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const NODES = [
  { x: 40, y: 70 },
  { x: 160, y: 30 },
  { x: 280, y: 90 },
  { x: 400, y: 40 },
  { x: 520, y: 110 },
  { x: 640, y: 50 },
  { x: 220, y: 150 },
  { x: 470, y: 170 },
];

const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [1, 6],
  [6, 2],
  [3, 7],
  [7, 4],
  [0, 6],
];

export function MeshCanvas() {
  const root = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = root.current;
    if (!svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lines = svg.querySelectorAll("line");
    const dots = svg.querySelectorAll("circle");
    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
    timeline.fromTo(
      lines,
      { strokeDashoffset: 180 },
      { strokeDashoffset: 0, duration: 1.8, stagger: 0.12, ease: "power2.inOut" },
    );
    timeline.fromTo(
      dots,
      { scale: 0.4, transformOrigin: "center" },
      { scale: 1, duration: 0.4, stagger: 0.08, ease: "power1.out" },
      0,
    );
    return () => {
      timeline.kill();
    };
  }, []);

  return (
    <svg
      ref={root}
      viewBox="0 0 680 210"
      className="h-full w-full text-steel"
      aria-hidden
    >
      {EDGES.map(([a, b], index) => (
        <line
          key={index}
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="180"
          strokeDashoffset="180"
        />
      ))}
      {NODES.map((node, index) => (
        <circle key={index} cx={node.x} cy={node.y} r="2.4" fill="currentColor" />
      ))}
    </svg>
  );
}
