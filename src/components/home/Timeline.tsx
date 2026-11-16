"use client";

import Link from "next/link";
import { useRef, useState } from "react";

export interface TimelineEra {
  slug: string;
  name: string;
  startYear: number;
  endYear: number | null;
}
export interface TimelineYear {
  year: number;
  champion: string | null;
  team: string | null;
}

/** Interactive horizontal timeline 1950 → today, banded by era. */
export function Timeline({ eras, years }: { eras: TimelineEra[]; years: TimelineYear[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<TimelineYear | null>(null);
  const last = years.at(-1)?.year ?? new Date().getFullYear();
  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.7, behavior: "smooth" });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="min-h-[1.5rem] text-sm text-mist" aria-live="polite">
          {hover ? (
            <>
              <span className="font-bold text-white">{hover.year}</span>
              {hover.champion ? ` — ${hover.champion}${hover.team ? ` · ${hover.team}` : ""}` : " — season in progress"}
            </>
          ) : (
            "Hover or focus a year; select it to open the season."
          )}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => scroll(-1)} className="chip" aria-label="Scroll timeline back">←</button>
          <button type="button" onClick={() => scroll(1)} className="chip" aria-label="Scroll timeline forward">→</button>
        </div>
      </div>
      <div ref={scroller} className="no-scrollbar overflow-x-auto pb-2">
        <div className="flex min-w-max gap-[3px]">
          {eras.map((era, idx) => {
            const ys = years.filter((y) => y.year >= era.startYear && y.year <= (era.endYear ?? last));
            return (
              <div key={era.slug} className="flex flex-col">
                <Link href={`/eras/${era.slug}`} className={`mb-2 border-t-[3px] pt-2 pr-4 text-[0.66rem] font-bold uppercase tracking-[0.14em] hover:text-white ${idx % 2 ? "border-white/40 text-mist" : "border-signal text-white/90"}`}>
                  {era.name}
                  <span className="block font-medium normal-case tracking-normal text-mist">{era.startYear}–{era.endYear ?? "now"}</span>
                </Link>
                <ol className="flex gap-[3px]">
                  {ys.map((y) => (
                    <li key={y.year}>
                      <Link
                        href={`/seasons/${y.year}`}
                        onMouseEnter={() => setHover(y)}
                        onFocus={() => setHover(y)}
                        aria-label={`${y.year}${y.champion ? `, champion ${y.champion}` : ""}`}
                        className="group flex h-28 w-9 flex-col justify-end bg-graphite px-1 pb-2 transition-colors hover:bg-signal focus:bg-signal sm:w-11"
                      >
                        <span className="block origin-bottom-left translate-x-3 -rotate-90 whitespace-nowrap text-xs font-bold tabular-nums text-white/80 group-hover:text-white">
                          {y.year}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
