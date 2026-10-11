"use client";
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fades up every [data-reveal] element as it enters the viewport. Mount once per page. */
export function Reveal() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) =>
        gsap.from(el, {
          opacity: 0, y: 28, duration: 0.6, ease: "power3.out",
          delay: Number(el.dataset.delay ?? 0),
          scrollTrigger: { trigger: el, start: "top 90%" },
        }),
      );
    });
    return () => ctx.revert();
  }, []);
  return null;
}