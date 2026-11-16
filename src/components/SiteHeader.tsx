"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { SearchOverlay } from "./SearchOverlay";

export interface MenuFeature {
  href: string;
  title: string;
  meta: string;
  image?: string | null;
  color?: string | null;
}

export interface NavData {
  seasons: MenuFeature[];
  teams: MenuFeature[];
  drivers: MenuFeature[];
  circuits: MenuFeature[];
  eras: MenuFeature[];
}

type Section = keyof NavData;

const NAV: { key: Section | "records" | "ask"; label: string; href: string; blurb?: string; links?: { label: string; href: string }[] }[] = [
  {
    key: "seasons", label: "Seasons", href: "/seasons",
    blurb: "Every World Championship season from 1950 to today, with full results, standings and stories.",
    links: [{ label: "All seasons", href: "/seasons" }, { label: "Current season", href: "/seasons/current" }, { label: "Records", href: "/records" }],
  },
  {
    key: "teams", label: "Teams", href: "/teams",
    blurb: "Every constructor that ever raced, from works giants to lost privateers, with their lineage.",
    links: [{ label: "All teams", href: "/teams" }, { label: "Current grid", href: "/teams?status=active" }, { label: "Lost teams", href: "/teams?status=defunct" }],
  },
  {
    key: "drivers", label: "Drivers", href: "/drivers",
    blurb: "More than 800 Grand Prix starters, with biographies, statistics and head-to-heads.",
    links: [{ label: "A–Z index", href: "/drivers" }, { label: "World Champions", href: "/drivers?champions=1" }, { label: "Compare drivers", href: "/drivers/compare" }],
  },
  {
    key: "circuits", label: "Circuits", href: "/circuits",
    blurb: "Every venue on a world map, from Monaco's streets to the old Nordschleife.",
    links: [{ label: "World map", href: "/circuits" }, { label: "Current calendar", href: "/circuits?status=active" }, { label: "Street circuits", href: "/circuits?type=STREET" }],
  },
  {
    key: "eras", label: "Eras", href: "/eras",
    blurb: "Ten eras that shaped the sport, from front-engined pioneers to the 2026 rulebook.",
    links: [{ label: "All eras", href: "/eras" }, { label: "Glossary", href: "/glossary" }],
  },
  { key: "records", label: "Records", href: "/records" },
  { key: "ask", label: "Ask the Archive", href: "/ask" },
];

export function SiteHeader({ nav }: { nav: NavData }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Section | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOpen(null);
    setDrawer(false);
    setSearch(false);
  }, [pathname]);

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(null);
      setDrawer(false);
    }
    const target = e.target as HTMLElement;
    if (e.key === "/" && !/input|textarea|select/i.test(target.tagName) && !target.isContentEditable) {
      e.preventDefault();
      setSearch(true);
    }
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
  }, [drawer]);

  const hoverOpen = (k: Section) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(k);
  };
  const hoverClose = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 160);
  };

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const openItem = NAV.find((n) => n.key === open);

  return (
    <>
      <a href="#main" className="sr-only z-[100] bg-signal px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-rule bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/85" onMouseLeave={hoverClose}>
        <div className="shell flex h-16 items-center justify-between gap-6">
          <Link href="/" aria-label="GRID ARCHIVE home" className="shrink-0">
            <Logo />
          </Link>

          <nav aria-label="Primary" className="hidden h-full lg:block">
            <ul className="flex h-full items-stretch">
              {NAV.map((item) => {
                const isMenu = Boolean(item.blurb);
                return (
                  <li key={item.key} className="flex" onMouseEnter={() => (isMenu ? hoverOpen(item.key as Section) : setOpen(null))}>
                    {isMenu ? (
                      // Clicking the name opens the section page; hovering previews it in the
                      // mega-menu, and the small arrow opens that preview for keyboard users.
                      <span className="relative flex items-center">
                        <Link
                          href={item.href}
                          onClick={() => setOpen(null)}
                          className={`flex h-full items-center pl-3.5 pr-1 text-[0.8rem] font-bold uppercase tracking-[0.12em] transition-colors xl:pl-4 ${open === item.key || active(item.href) ? "text-white" : "text-mist hover:text-white"}`}
                        >
                          {item.label}
                        </Link>
                        <button
                          type="button"
                          aria-expanded={open === item.key}
                          aria-controls="mega-menu"
                          aria-label={`Show ${item.label} menu`}
                          onClick={() => setOpen(open === item.key ? null : (item.key as Section))}
                          className={`flex h-full items-center pr-3 text-[0.6rem] transition-colors xl:pr-3.5 ${open === item.key ? "text-white" : "text-steel hover:text-white"}`}
                        >
                          <span aria-hidden="true" className={`inline-block transition-transform ${open === item.key ? "rotate-180" : ""}`}>▾</span>
                        </button>
                        <span className={`pointer-events-none absolute inset-x-3 bottom-0 h-[3px] bg-signal transition-transform ${open === item.key || active(item.href) ? "scale-x-100" : "scale-x-0"}`} />
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        className={`relative flex items-center px-3.5 text-[0.8rem] font-bold uppercase tracking-[0.12em] xl:px-4 ${item.key === "ask" ? "text-signal-bright hover:text-white" : active(item.href) ? "text-white" : "text-mist hover:text-white"}`}
                      >
                        {item.key === "ask" && <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 bg-signal" />}
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            <Link href="/my-archive" className="hidden p-2 text-mist hover:text-white sm:block" aria-label="My Archive (bookmarks)" title="My Archive">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
            </Link>
            <button type="button" onClick={() => setSearch(true)} className="p-2 text-white hover:text-signal-bright" aria-label="Search the archive (press /)">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" /></svg>
            </button>
            <button type="button" className="p-2 text-white lg:hidden" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          </div>
        </div>

        {/* Desktop mega-menu */}
        {openItem && openItem.blurb && (
          <div id="mega-menu" className="absolute inset-x-0 top-full hidden border-b border-rule bg-carbon shadow-2xl lg:block" onMouseEnter={() => hoverOpen(openItem.key as Section)} onMouseLeave={hoverClose}>
            <div className="shell grid-12 py-10">
              <div className="col-span-3 pr-6">
                <p className="eyebrow-accent">{openItem.label}</p>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-white/80">{openItem.blurb}</p>
                <ul className="mt-6 space-y-2.5">
                  {openItem.links!.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="group inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-white hover:text-signal-bright">
                        {l.label} <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <ul className="col-span-9 grid grid-cols-4 gap-5">
                {nav[openItem.key as Section].slice(0, 4).map((f) => (
                  <li key={f.href}>
                    <Link href={f.href} className="card-zoom group block">
                      <div className="relative aspect-[4/3] overflow-hidden bg-graphite" style={f.color ? { background: `linear-gradient(135deg, ${f.color}, #0b0d10 80%)` } : undefined}>
                        {f.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-mist">{f.meta}</p>
                      <p className="mt-1 font-display text-lg font-bold leading-tight text-white group-hover:text-signal-bright">{f.title}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-ink lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="shell flex h-16 items-center justify-between border-b border-rule">
            <Logo compact />
            <button type="button" onClick={() => setDrawer(false)} className="p-2" aria-label="Close menu">
              <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg>
            </button>
          </div>
          <nav aria-label="Mobile" className="shell py-4">
            <ul className="divide-y divide-rule">
              {NAV.map((item) => (
                <li key={item.key} className="py-1">
                  {item.links ? (
                    <div>
                      <div className="flex items-center justify-between">
                        {/* Tapping the name opens the page; "+" reveals the shortcuts. */}
                        <Link href={item.href} className="flex-1 py-4 font-display text-2xl font-extrabold uppercase tracking-tight">
                          {item.label}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setMobileOpen(mobileOpen === item.key ? null : item.key)}
                          aria-expanded={mobileOpen === item.key}
                          aria-controls={`m-${item.key}`}
                          aria-label={`Show ${item.label} shortcuts`}
                          className="px-3 py-4 text-2xl text-signal"
                        >
                          <span aria-hidden="true" className={`inline-block transition-transform ${mobileOpen === item.key ? "rotate-45" : ""}`}>+</span>
                        </button>
                      </div>
                      {mobileOpen === item.key && (
                        <div id={`m-${item.key}`}>
                          <p className="pb-3 text-sm text-mist">{item.blurb}</p>
                          <ul className="space-y-1 pb-4">
                            {item.links.map((l) => (
                              <li key={l.href}>
                                <Link href={l.href} className="block py-2 text-sm font-bold uppercase tracking-[0.12em] text-white/90">
                                  {l.label} →
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link href={item.href} className={`block py-4 font-display text-2xl font-extrabold uppercase tracking-tight ${item.key === "ask" ? "text-signal-bright" : ""}`}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
              <li className="py-1">
                <Link href="/my-archive" className="block py-4 font-display text-2xl font-extrabold uppercase tracking-tight">My Archive</Link>
              </li>
            </ul>
          </nav>
        </div>
      )}

      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </>
  );
}
