import Link from "next/link";
import { Logo } from "./Logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { label: "Seasons", href: "/seasons" },
      { label: "Teams", href: "/teams" },
      { label: "Drivers", href: "/drivers" },
      { label: "Circuits", href: "/circuits" },
      { label: "Eras", href: "/eras" },
      { label: "Records", href: "/records" },
    ],
  },
  {
    title: "Tools",
    links: [
      { label: "Ask the Archive", href: "/ask" },
      { label: "Compare drivers", href: "/drivers/compare" },
      { label: "Search", href: "/search" },
      { label: "Glossary", href: "/glossary" },
      { label: "My Archive", href: "/my-archive" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "About the archive", href: "/about" },
      { label: "Data sources", href: "/about#data" },
      { label: "Image credits", href: "/credits" },
      { label: "AI & accuracy", href: "/about#ai" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-carbon">
      <div className="shell grid-12 gap-y-10 py-16">
        <div className="col-span-4 sm:col-span-8 lg:col-span-4">
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-mist">
            An encyclopedic, year-by-year archive of the Formula 1 World Championship, from Silverstone 1950 to the current season.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="col-span-2 sm:col-span-2 lg:col-span-2">
            <h2 className="eyebrow mb-4">{c.title}</h2>
            <ul className="space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-white/85 hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="col-span-4 sm:col-span-8 lg:col-span-2">
          <h2 className="eyebrow mb-4">Data</h2>
          <ul className="space-y-2.5 text-sm text-white/85">
            <li><a className="hover:underline" href="https://api.jolpi.ca/ergast/" rel="noopener" target="_blank">Jolpica-F1 API</a></li>
            <li><a className="hover:underline" href="https://commons.wikimedia.org" rel="noopener" target="_blank">Wikimedia Commons</a></li>
            <li><a className="hover:underline" href="https://www.wikipedia.org" rel="noopener" target="_blank">Wikipedia (CC BY-SA)</a></li>
            <li><a className="hover:underline" href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank">OpenStreetMap</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-rule">
        <div className="shell flex flex-col gap-3 py-6 text-xs leading-relaxed text-mist md:flex-row md:items-center md:justify-between">
          <p>
            GRID ARCHIVE is an unofficial fan project and is not affiliated with Formula 1, the FIA, or any team. F1, FORMULA ONE and related marks are trademarks of their respective owners.
          </p>
          <p className="shrink-0">Text adapted from Wikipedia is available under CC BY-SA 4.0. Some articles are AI-assisted and labelled as such.</p>
        </div>
      </div>
    </footer>
  );
}
