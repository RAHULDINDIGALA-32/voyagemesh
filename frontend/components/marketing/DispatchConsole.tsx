"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { reducedMotion } from "./useMotion";

const BRIEF =
    "Nine days in Japan from Hyderabad, three travelers, moderate pace, good food.";

const HUB = { x: 180, y: 110 };

const NODES = [
    { id: "Flights", x: 50, y: 40 },
    { id: "Stay", x: 50, y: 180 },
    { id: "Weather", x: 310, y: 40 },
    { id: "Budget", x: 310, y: 180 },
    { id: "Itinerary", x: 180, y: 40 },
    { id: "Final", x: 180, y: 195 },
];

const STATUS = ["Briefing", ...NODES.map((node) => node.id), "Ready"];

export function DispatchConsole() {
    const [stage, setStage] = useState(0);
    const [typed, setTyped] = useState(0);

    const rootRef = useRef<HTMLDivElement>(null);
    const linesRef = useRef<(SVGLineElement | null)[]>([]);
    const timelineRef = useRef<gsap.core.Timeline | null>(null);
    const lineTweenRef = useRef<gsap.core.Tween | null>(null);

    useEffect(() => {
        if (reducedMotion()) {
            return;
        }

        const ctx = gsap.context(() => {
            // Initialize connection lines.
            gsap.set(linesRef.current.filter(Boolean), {
                strokeDashoffset: 0,
            });

            const typing = { n: 0 };

            const timeline = gsap.timeline({
                repeat: -1,
                repeatDelay: 2.4,
                onRepeat: () => {
                    setStage(0);
                    setTyped(0);
                },
            });

            // Typewriter effect.
            timeline.to(typing, {
                n: BRIEF.length,
                duration: 2.4,
                ease: "none",
                onUpdate: () => {
                    setTyped(Math.floor(typing.n));
                },
            });

            // Activate nodes sequentially.
            NODES.forEach((node, index) => {
                timeline.call(() => {
                    setStage(index + 1);

                    // Stop the previous connection animation.
                    lineTweenRef.current?.kill();
                    lineTweenRef.current = null;

                    // Reset every connection.
                    linesRef.current.forEach((line) => {
                        if (!line) return;

                        gsap.set(line, {
                            strokeDasharray: "3 5",
                            strokeDashoffset: 0,
                            stroke: "",
                        });
                    });

                    const line = linesRef.current[index];

                    if (!line) return;

                    // Animate the highlight from SUP to this node.
                    const length = line.getTotalLength();

                    gsap.set(line, {
                        stroke: "#B08D57",
                        strokeDasharray: `${length} ${length}`,
                        strokeDashoffset: length,
                    });

                    lineTweenRef.current = gsap.to(line, {
                        strokeDashoffset: 0,
                        duration: 0.8,
                        ease: "power2.inOut",
                    });
                });

                // Pause before activating the next node.
                timeline.to({}, { duration: 1.55 });
            });

            // All nodes have been processed; transition to Ready.
            timeline.call(() => {
                lineTweenRef.current?.kill();
                lineTweenRef.current = null;

                gsap.set(linesRef.current.filter(Boolean), {
                    strokeDashoffset: 0,
                });

                setStage(STATUS.length - 1);
            });

            // Keep the completed state visible before restarting.
            timeline.to({}, { duration: 3 });

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
        stage >= 1 && stage <= NODES.length
            ? NODES[stage - 1].id
            : null;

    const handleMouseEnter = () => {
        timelineRef.current?.pause();
        lineTweenRef.current?.pause();
    };

    const handleMouseLeave = () => {
        timelineRef.current?.resume();
        lineTweenRef.current?.resume();
    };

    return (
        <div
            ref={rootRef}
            data-testid="dispatch-console"
            data-stage={STATUS[stage]}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="border border-rule bg-paper-raised"
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                <span>Dispatch · Illustrative</span>

                <span
                    className={
                        stage === STATUS.length - 1
                            ? "text-olive"
                            : "text-brass"
                    }
                >
                    {STATUS[stage]}
                </span>
            </div>

            {/* Typing brief */}
            <p className="mx-4 mt-4 min-h-[72px] rounded-[3px] border border-rule bg-paper p-3 text-sm leading-6">
                {BRIEF.slice(0, typed)}

                <span className="ml-px inline-block h-4 w-[2px] translate-y-0.5 bg-brass motion-safe:animate-pulse" />
            </p>

            {/* Network visualization */}
            <svg
                viewBox="0 0 360 230"
                className="w-full p-2"
                aria-hidden="true"
            >
                {/* Connections */}
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
                        strokeDashoffset="0"
                        strokeWidth={active === node.id ? 1.5 : 1}
                        className={
                            active === node.id
                                ? "stroke-brass"
                                : "stroke-rule"
                        }
                    />
                ))}

                {/* Central hub */}
                <circle
                    cx={HUB.x}
                    cy={HUB.y}
                    r={16}
                    className="fill-paper stroke-brass"
                />

                <text
                    x={HUB.x}
                    y={HUB.y + 3}
                    textAnchor="middle"
                    className="fill-brass font-mono text-[8px] uppercase"
                >
                    SUP
                </text>

                {/* Nodes */}
                {NODES.map((node) => {
                    const isActive = active === node.id;
                    const isFinal = node.id === "Final";

                    return (
                        <g key={node.id}>
                            <circle
                                cx={node.x}
                                cy={node.y}
                                r={isActive ? 12 : isFinal ? 10 : 8}
                                className={
                                    isActive
                                        ? "fill-brass stroke-brass"
                                        : isFinal
                                          ? "fill-paper stroke-olive"
                                          : "fill-paper stroke-steel"
                                }
                                style={{
                                    transition:
                                        "r 0.3s ease, fill 0.3s ease, stroke 0.3s ease",
                                }}
                            />

                            <text
                                x={node.x}
                                y={node.y + (node.y > 150 ? 24 : -16)}
                                textAnchor="middle"
                                className="fill-ink-soft font-mono text-[8px] uppercase tracking-widest"
                            >
                                {node.id}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Stage messages */}
            <div
                aria-live="polite"
                className="min-h-[84px] px-4 pb-4"
            >
                {stage === 4 && (
                    <p className="vm-fade border border-danger/50 p-3 text-sm">
                        Estimate exceeds your envelope. Review?
                    </p>
                )}

                {stage === 5 && (
                    <div className="vm-fade border border-brass p-3 text-sm">
                        Your proposed day plan is ready.

                        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-brass">
                            Accept · Modify · Regenerate
                        </p>
                    </div>
                )}

                {stage === 6 && (
                    <div className="vm-fade border border-brass p-3 text-sm">
                        Final review complete.

                        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-brass">
                            Final · Processing
                        </p>
                    </div>
                )}

                {stage === 7 && (
                    <div className="vm-fade border border-rule p-3">
                        <p className="font-display text-xl">
                            Tokyo · Kanazawa · 12–21 Mar
                        </p>

                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-olive">
                            Ready · Voyage document
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
