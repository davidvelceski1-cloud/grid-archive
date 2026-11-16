"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Credit, Placeholder, type ImageData } from "../ArchiveImage";

export interface HeroStory {
  kicker: string;
  title: string;
  dek: string;
  href: string;
  image?: (ImageData & { srcSet?: string }) | null;
  color?: string;
}

/** Full-screen rotating feature stories. Pauses on hover/focus; no auto-rotation under reduced motion. */
export function HeroCarousel({ stories }: { stories: HeroStory[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || stories.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % stories.length), 8000);
    return () => clearInterval(t);
  }, [paused, stories.length]);
  if (!stories.length) return null;
  const s = stories[i];

  return (
    <section
      className="relative isolate h-[calc(100svh-4rem)] min-h-[560px] overflow-hidden bg-ink"
      aria-roledescription="carousel"
      aria-label="Featured stories"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {stories.map((st, idx) => (
        <div key={st.href} className={`absolute inset-0 -z-10 transition-opacity duration-1000 ${idx === i ? "opacity-100" : "opacity-0"}`} aria-hidden={idx !== i}>
          {st.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={st.image.path} srcSet={st.image.srcSet} sizes="100vw" alt={st.image.alt} className={`h-full w-full object-cover opacity-75 ${idx === i ? "animate-kenburns" : ""}`} fetchPriority={idx === 0 ? "high" : "low"} />
          ) : (
            <Placeholder fallback={st.color ? { kind: "team", name: "", color: st.color } : { kind: "season", label: "" }} />
          )}
        </div>
      ))}
      <div className="hero-gradient absolute inset-0 -z-10" />
      <div className="side-gradient absolute inset-0 -z-10" />

      <div className="shell flex h-full flex-col justify-end pb-16 sm:pb-20">
        <div key={i} className="max-w-4xl animate-fade-up" aria-live={paused ? "polite" : "off"}>
          <p className="eyebrow-accent">{s.kicker}</p>
          <h1 className="mt-4 text-display-xl text-white">{s.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">{s.dek}</p>
          <Link href={s.href} className="btn mt-8">
            Read the story <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="mt-12 flex items-end justify-between gap-6">
          <div className="flex gap-2" role="tablist" aria-label="Choose story">
            {stories.map((st, idx) => (
              <button
                key={st.href}
                type="button"
                role="tab"
                aria-selected={idx === i}
                aria-label={`${idx + 1}: ${st.kicker}`}
                onClick={() => setI(idx)}
                className="group py-3"
              >
                <span className={`block h-[3px] w-12 transition-colors sm:w-20 ${idx === i ? "bg-signal" : "bg-white/30 group-hover:bg-white/70"}`} />
                <span className={`mt-2 hidden text-left text-[0.65rem] font-bold uppercase tracking-[0.14em] sm:block ${idx === i ? "text-white" : "text-mist"}`}>{st.kicker}</span>
              </button>
            ))}
          </div>
          {s.image && <Credit image={s.image} className="max-w-xs text-right" />}
        </div>
      </div>
    </section>
  );
}
