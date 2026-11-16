/** Server-side data access shared by pages and API routes. */
import { unstable_cache } from "next/cache";
import type { Image } from "@prisma/client";
import { prisma } from "./db";
import { searchKey } from "./text";
import type { NavData } from "@/components/SiteHeader";
import type { SearchHit } from "@/components/SearchOverlay";

/** Pick the smallest srcset entry that is at least `minWidth` wide. */
export function thumb(image: Pick<Image, "path" | "srcset"> | null | undefined, minWidth = 400): string | null {
  if (!image) return null;
  const set = Array.isArray(image.srcset) ? (image.srcset as { w: number; path: string }[]) : [];
  return set.find((s) => s.w >= minWidth)?.path ?? set.at(-1)?.path ?? image.path;
}

export const getLatestYear = unstable_cache(
  async () => (await prisma.season.findFirst({ orderBy: { year: "desc" }, select: { year: true } }))?.year ?? new Date().getFullYear(),
  ["latest-year"],
  { revalidate: 3600, tags: ["archive"] },
);

/** The era's most successful champion with a photo (most titles; earliest first on ties). */
export function eraHero<D extends { id: string; image: unknown | null }>(seasons: { year: number; championDriver: D | null }[]): D | null {
  const count = new Map<string, { d: D; n: number; first: number }>();
  for (const s of seasons) {
    const d = s.championDriver;
    if (!d?.image) continue;
    const c = count.get(d.id) ?? { d, n: 0, first: s.year };
    c.n++;
    count.set(d.id, c);
  }
  return [...count.values()].sort((a, b) => b.n - a.n || a.first - b.first)[0]?.d ?? null;
}

export const getNavData = unstable_cache(
  async (): Promise<NavData> => {
    const [seasons, teams, drivers, circuits, eras] = await Promise.all([
      prisma.season.findMany({
        where: { championDriverId: { not: null } },
        orderBy: { year: "desc" },
        take: 4,
        include: { championDriver: { include: { image: true } } },
      }),
      prisma.team.findMany({
        where: { status: { not: "ACTIVE" }, entries: { gte: 50 } },
        orderBy: { wins: "desc" },
        take: 4,
        include: { image: true },
      }),
      prisma.driver.findMany({ where: { titles: { gt: 0 } }, orderBy: [{ titles: "desc" }, { wins: "desc" }], take: 4, include: { image: true } }),
      prisma.circuit.findMany({ orderBy: { raceCount: "desc" }, take: 4, include: { image: true } }),
      prisma.era.findMany({ orderBy: { order: "desc" }, take: 4, include: { seasons: { include: { championDriver: { include: { image: true } } } } } }),
    ]);
    return {
      seasons: seasons.map((s) => ({ href: `/seasons/${s.year}`, title: `${s.year} season`, meta: s.championDriver?.fullName ?? "", image: thumb(s.championDriver?.image) })),
      teams: teams.map((t) => ({ href: `/teams/${t.slug}`, title: t.name, meta: `Lost team · ${t.firstYear}–${t.lastYear}`, image: thumb(t.image), color: t.color })),
      drivers: drivers.map((d) => ({ href: `/drivers/${d.slug}`, title: d.fullName, meta: `${d.titles}× World Champion`, image: thumb(d.image) })),
      circuits: circuits.map((c) => ({ href: `/circuits/${c.slug}`, title: c.name, meta: `${c.raceCount} Grands Prix`, image: thumb(c.image) })),
      eras: eras.map((e) => {
        const hero = eraHero(e.seasons);
        return { href: `/eras/${e.slug}`, title: e.name, meta: `${e.startYear}–${e.endYear ?? "today"}${hero ? ` · ${hero.fullName}` : ""}`, image: thumb(hero?.image) };
      }),
    };
  },
  ["nav-data"],
  { revalidate: 3600, tags: ["archive"] },
);

export async function searchArchive(q: string, limit = 6): Promise<SearchHit[]> {
  const key = searchKey(q);
  if (key.length < 2) return [];
  const words = key.split(" ").filter(Boolean);
  const year = key.match(/\b(19[5-9]\d|20[0-4]\d)\b/)?.[1];
  const all = (field: string) => ({ AND: words.filter((w) => w !== year).map((w) => ({ [field]: { contains: w } })) });

  const [drivers, teams, circuits, eras, glossary, seasons, races] = await Promise.all([
    prisma.driver.findMany({ where: all("searchName"), orderBy: [{ starts: "desc" }], take: limit, include: { image: true } }),
    prisma.team.findMany({ where: all("searchName"), orderBy: { entries: "desc" }, take: limit, include: { image: true } }),
    prisma.circuit.findMany({ where: all("searchName"), orderBy: { raceCount: "desc" }, take: limit, include: { image: true } }),
    prisma.era.findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 3 }),
    prisma.glossaryTerm.findMany({ where: { term: { contains: q, mode: "insensitive" } }, take: 3 }),
    year ? prisma.season.findMany({ where: { year: Number(year) }, include: { championDriver: true } }) : Promise.resolve([]),
    year && words.length > 1
      ? prisma.race.findMany({
          where: { year: Number(year), name: { contains: words.find((w) => w !== year)!, mode: "insensitive" } },
          include: { winner: true },
          take: 4,
        })
      : Promise.resolve([]),
  ]);

  const hits: SearchHit[] = [];
  for (const s of seasons) hits.push({ type: "season", title: `${s.year} season`, meta: s.championDriver ? `Champion: ${s.championDriver.fullName}` : "In progress", href: `/seasons/${s.year}` });
  for (const r of races) hits.push({ type: "race", title: `${r.year} ${r.name}`, meta: r.winner ? `Winner: ${r.winner.fullName}` : "Upcoming", href: `/seasons/${r.year}/${r.slug}` });
  if (!year || words.length > 1) {
    for (const d of drivers) hits.push({ type: "driver", title: d.fullName, meta: [d.nationality, d.firstYear ? `${d.firstYear}–${d.lastYear}` : null, d.titles ? `${d.titles}× champion` : null].filter(Boolean).join(" · "), href: `/drivers/${d.slug}`, image: thumb(d.image, 300) });
    for (const t of teams) hits.push({ type: "team", title: t.name, meta: [t.nationality, t.firstYear ? `${t.firstYear}–${t.lastYear}` : null, t.status === "ACTIVE" ? "Active" : "Defunct"].filter(Boolean).join(" · "), href: `/teams/${t.slug}`, image: thumb(t.image, 300), color: t.color });
    for (const c of circuits) hits.push({ type: "circuit", title: c.name, meta: [c.locality, c.country, `${c.raceCount} GPs`].filter(Boolean).join(" · "), href: `/circuits/${c.slug}`, image: thumb(c.image, 300) });
  }
  for (const e of eras) hits.push({ type: "era", title: e.name, meta: `${e.startYear}–${e.endYear ?? "today"}`, href: `/eras/${e.slug}` });
  for (const g of glossary) hits.push({ type: "glossary", title: g.term, meta: g.short, href: `/glossary#${g.slug}` });
  return hits;
}

export async function getArticle(entityType: "SEASON" | "DRIVER" | "TEAM" | "CIRCUIT", entityId: string) {
  return prisma.article.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
}

export interface SourceRef {
  title: string;
  url: string;
  license?: string;
}

export function articleSources(sources: unknown): SourceRef[] {
  return Array.isArray(sources) ? (sources as SourceRef[]) : [];
}
