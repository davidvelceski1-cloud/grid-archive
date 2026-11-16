"use client";

import { useEffect, useRef, useState } from "react";

/** Large animated number that counts up once when scrolled into view (static under reduced motion). */
export function StatCounter({ value, label, sub, decimals = 0 }: { value: number; label: string; sub?: string; decimals?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;
    setShown(0);
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || started.current) return;
      started.current = true;
      const t0 = performance.now();
      const dur = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(value * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io.disconnect();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <div ref={ref}>
      <p className="eyebrow">{label}</p>
      <p className="stat-num mt-2 text-5xl text-white sm:text-6xl" aria-label={`${value.toLocaleString("en-GB")}`}>
        <span aria-hidden="true">{shown.toLocaleString("en-GB", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</span>
      </p>
      {sub && <p className="mt-2 text-sm text-mist">{sub}</p>}
    </div>
  );
}
