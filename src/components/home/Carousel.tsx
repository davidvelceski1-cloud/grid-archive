"use client";

import { useRef, type ReactNode } from "react";

/** Scroll-snap carousel with previous/next controls (keyboard and touch friendly). */
export function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const go = (dir: number) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="mb-4 flex justify-end gap-2">
        <button type="button" className="chip" onClick={() => go(-1)} aria-label="Previous">←</button>
        <button type="button" className="chip" onClick={() => go(1)} aria-label="Next">→</button>
      </div>
      <ul ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {children}
      </ul>
    </div>
  );
}
