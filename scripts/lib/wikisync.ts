/** Pull Wikipedia lead extracts + Wikidata QIDs for every archive entity. */
import type { EntityType, PrismaClient } from "@prisma/client";
import { titleFromUrl, wikidataDeathDates, wikipediaInfo } from "./wiki";

export async function syncWikipedia(prisma: PrismaClient) {
  const [drivers, teams, circuits, seasons] = await Promise.all([
    prisma.driver.findMany({ select: { id: true, url: true } }),
    prisma.team.findMany({ select: { id: true, url: true } }),
    prisma.circuit.findMany({ select: { id: true, url: true } }),
    prisma.season.findMany({ select: { year: true, url: true } }),
  ]);

  const groups: { type: EntityType; rows: { id: string; url: string | null }[]; setQid?: (id: string, qid: string) => Promise<unknown> }[] = [
    { type: "DRIVER", rows: drivers, setQid: (id, qid) => prisma.driver.update({ where: { id }, data: { wikidataId: qid } }) },
    { type: "TEAM", rows: teams, setQid: (id, qid) => prisma.team.update({ where: { id }, data: { wikidataId: qid } }) },
    { type: "CIRCUIT", rows: circuits, setQid: (id, qid) => prisma.circuit.update({ where: { id }, data: { wikidataId: qid } }) },
    {
      type: "SEASON",
      rows: seasons.map((s) => ({ id: String(s.year), url: s.url ?? `https://en.wikipedia.org/wiki/${s.year}_Formula_One_World_Championship` })),
    },
  ];

  for (const g of groups) {
    const titles = new Map<string, string>(); // title → entity id
    for (const r of g.rows) {
      const t = titleFromUrl(r.url);
      if (t) titles.set(t, r.id);
    }
    const info = await wikipediaInfo([...titles.keys()]);
    let n = 0;
    for (const [title, id] of titles) {
      const w = info.get(title);
      if (!w) continue;
      if (w.qid && g.setQid) await g.setQid(id, w.qid);
      if (w.extract) {
        const data = { title: w.title, url: w.url, extract: w.extract, fetchedAt: new Date() };
        await prisma.wikiExtract.upsert({
          where: { entityType_entityId: { entityType: g.type, entityId: id } },
          create: { entityType: g.type, entityId: id, ...data },
          update: data,
        });
        n++;
      }
    }
    console.log(`  wikipedia ${g.type.toLowerCase()}: ${n}/${g.rows.length}`);
  }
  await syncDeathDates(prisma);
}

/** Jolpica has no dates of death: read Wikidata P570 (day precision only). */
export async function syncDeathDates(prisma: PrismaClient) {
  const drivers = await prisma.driver.findMany({ where: { wikidataId: { not: null } }, select: { id: true, wikidataId: true } });
  const dates = await wikidataDeathDates(drivers.map((d) => d.wikidataId!));
  let n = 0;
  for (const d of drivers) {
    const iso = dates.get(d.wikidataId!);
    if (!iso) continue;
    await prisma.driver.update({ where: { id: d.id }, data: { dateOfDeath: new Date(`${iso}T00:00:00Z`) } });
    n++;
  }
  console.log(`  dates of death (Wikidata): ${n}`);
}
