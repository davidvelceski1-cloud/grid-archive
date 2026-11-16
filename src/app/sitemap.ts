import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const statics = ["", "/seasons", "/teams", "/drivers", "/drivers/compare", "/circuits", "/eras", "/records", "/ask", "/glossary", "/credits", "/about"];
  try {
    const [seasons, races, teams, drivers, circuits, eras] = await Promise.all([
      prisma.season.findMany({ select: { year: true, updatedAt: true } }),
      prisma.race.findMany({ where: { winnerDriverId: { not: null } }, select: { year: true, slug: true } }),
      prisma.team.findMany({ where: { entries: { gt: 0 } }, select: { slug: true } }),
      prisma.driver.findMany({ where: { starts: { gt: 0 } }, select: { slug: true } }),
      prisma.circuit.findMany({ where: { raceCount: { gt: 0 } }, select: { slug: true } }),
      prisma.era.findMany({ select: { slug: true } }),
    ]);
    return [
      ...statics.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.8 })),
      ...seasons.map((s) => ({ url: `${base}/seasons/${s.year}`, lastModified: s.updatedAt, priority: 0.8 })),
      ...races.map((r) => ({ url: `${base}/seasons/${r.year}/${r.slug}`, priority: 0.5 })),
      ...teams.map((t) => ({ url: `${base}/teams/${t.slug}`, priority: 0.7 })),
      ...drivers.map((d) => ({ url: `${base}/drivers/${d.slug}`, priority: 0.6 })),
      ...circuits.map((c) => ({ url: `${base}/circuits/${c.slug}`, priority: 0.6 })),
      ...eras.map((e) => ({ url: `${base}/eras/${e.slug}`, priority: 0.6 })),
    ];
  } catch {
    return statics.map((p) => ({ url: `${base}${p}` }));
  }
}
