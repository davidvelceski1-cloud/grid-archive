/**
 * Chassis & engines for every team in every season.
 *
 * Jolpica has no chassis/engine data, so this reads the "Entries" table of each
 * season's Wikipedia article (Entrant | Constructor | Chassis | Engine/Power unit …),
 * expands row/col spans, matches each row to an archive team via the Constructor
 * cell's Wikipedia link (falling back to the name), and stores the result in
 * TeamSeason. Facts are attributed to Wikipedia (CC BY-SA) on the pages that show them.
 *
 *   npm run data:chassis              # all seasons
 *   npm run data:chassis -- --year=2026
 */
import "./lib/env";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { PrismaClient } from "@prisma/client";
import { fetchJson } from "./lib/http";
import { titleFromUrl } from "./lib/wiki";
import { searchKey } from "../src/lib/text";

const prisma = new PrismaClient();

/** Entry-list names that differ from the archive's team names (first word → team ids, tried in order). */
const ALIASES: Record<string, string[]> = {
  talbot: ["ligier"],
  subaru: ["coloni"],
  coloni: ["coloni"],
  eurobrun: ["eurobrun"],
  life: ["life"],
  mrt: ["manor"],
  rb: ["rb"],
  venturi: ["larrousse"],
  lola: ["lola", "larrousse"],
  eifelland: ["eifelland"],
  stevens: ["stevens"],
  frazer: ["frazer_nash"],
  lotus: ["lotus_racing", "lotus_f1", "team_lotus"],
  midland: ["mf1"],
  spyker: ["spyker_mf1", "spyker"],
};
const yearArg = process.argv.find((a) => a.startsWith("--year="))?.split("=")[1];

interface Cell {
  text: string; // lines joined with "\n"
  links: string[]; // linked article titles
  header: boolean;
}

function cellOf($: cheerio.CheerioAPI, el: Element): Cell {
  const c = $(el).clone();
  // Flag icons link to countries ("United Kingdom") and must not count as the constructor link.
  c.find("sup, style, .reference, .mw-ref, .sortkey, .flagicon, [typeof='mw:File']").remove();
  c.find("br").replaceWith("\n");
  c.find("li").each((_, li) => { $(li).append("\n"); });
  const links = c
    .find("a[href^='/wiki/']")
    .map((_, a) => decodeURIComponent(($(a).attr("href") ?? "").replace(/^\/wiki\//, "")).replace(/_/g, " ").replace(/#.*$/, ""))
    .get();
  const text = c.text().replace(/\[[^\]]*\]/g, "").replace(/[ \t ]+/g, " ").split("\n").map((s) => s.trim()).filter(Boolean).join("\n");
  return { text, links, header: el.tagName === "th" };
}

/** Expand a wikitable into a rectangular grid, honouring rowspan/colspan. */
function grid($: cheerio.CheerioAPI, table: Element): Cell[][] {
  const out: Cell[][] = [];
  const trs = [...$(table).children("tbody").children("tr").toArray(), ...$(table).children("thead").children("tr").toArray(), ...$(table).children("tr").toArray()];
  trs.forEach((tr, r) => {
    out[r] ??= [];
    let col = 0;
    $(tr).children("td, th").each((_, el) => {
      while (out[r][col]) col++;
      const cell = cellOf($, el as Element);
      const rs = Number($(el).attr("rowspan") ?? 1) || 1;
      const cs = Number($(el).attr("colspan") ?? 1) || 1;
      for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) {
        out[r + dr] ??= [];
        out[r + dr][col + dc] = cell;
      }
      col += cs;
    });
  });
  return out;
}

function splitLines(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.replace(/\s*\(.*?\)\s*/g, " ").replace(/[*†‡§¶#]+/g, "").replace(/\s+/g, " ").trim())
    .filter((x) => x && x !== "—" && x !== "-" && !/^(tbc|tba|unknown)$/i.test(x));
}

async function parsePage(title: string) {
  const params = new URLSearchParams({ action: "parse", format: "json", prop: "text", redirects: "1", page: title });
  const d = await fetchJson<{ parse?: { title: string; text: { "*": string } }; error?: unknown }>(`https://en.wikipedia.org/w/api.php?${params}`, { namespace: "wikipedia-parse2" });
  return d.parse ?? null;
}

async function importYear(year: number, teams: { id: string; name: string; key: string; wikiTitle: string | null }[]) {
  const wiki = await prisma.wikiExtract.findUnique({ where: { entityType_entityId: { entityType: "SEASON", entityId: String(year) } } });
  const titles = [wiki?.title, `${year} Formula One World Championship`, `${year} Formula One season`].filter((t): t is string => Boolean(t));
  let page: Awaited<ReturnType<typeof parsePage>> = null;
  for (const t of titles) if ((page = await parsePage(t))) break;
  if (!page) return { year, rows: 0, matched: 0, unmatched: [] as string[] };
  // 1950–1960: the Indianapolis 500 counted for the championship; its entries are on a separate page.
  const indy = year <= 1960 ? await parsePage(`${year} Indianapolis 500`) : null;

  const $ = cheerio.load(page.text["*"] + (indy?.text["*"] ?? ""));
  const raced = await prisma.result.findMany({ where: { race: { year } }, select: { constructorId: true }, distinct: ["constructorId"] });
  const racedIds = new Set(raced.map((r) => r.constructorId));
  const candidates = teams.filter((t) => racedIds.has(t.id));

  const acc = new Map<string, { chassis: Set<string>; engines: Set<string> }>();
  const unmatched = new Set<string>();
  let rows = 0;

  $("table.wikitable").each((_, table) => {
    const g = grid($, table as Element);
    // Season entry lists have a Chassis column. Indianapolis 500 box scores (1950–60) have
    // only "Constructor" ("Salih-Offenhauser" = chassis builder + engine) next to "Qual".
    const isEntries = (row: Cell[] | undefined) => row?.some((c) => c?.header && /^chassis/i.test(c.text));
    const isIndy = (row: Cell[] | undefined) =>
      row?.some((c) => c?.header && /^constructor/i.test(c.text)) && row?.some((c) => c?.header && /^qual/i.test(c.text));
    const hi = g.findIndex((row) => isEntries(row) || isIndy(row));
    if (hi < 0) return;
    const head = g[hi].map((c) => (c?.text ?? "").toLowerCase());
    const cCha = head.findIndex((h) => /^chassis/.test(h));
    const cCon = head.findIndex((h) => /^constructor/.test(h));
    const cEng = head.findIndex((h) => /^(engine|power unit)/.test(h));
    if (process.env.DEBUG) console.log("table header", hi, head, "rows", g.length, "sample", g[hi + 1]?.map((c) => c?.text));
    if (cCon < 0) return;
    for (const row of g.slice(hi + 1)) {
      if (!row || row.every((c) => !c || c.header)) continue;
      const con = row[cCon];
      if (!con || /^constructor$/i.test(con.text)) continue;
      let cha = cCha >= 0 ? row[cCha] : undefined;
      let eng = cEng >= 0 ? row[cEng] : undefined;
      if (cCha < 0) {
        // Indianapolis: split "Builder-Engine" into chassis builder and engine.
        const [builder, ...engine] = con.text.split("\n")[0].split("-");
        cha = { text: builder.trim(), links: [], header: false };
        eng = engine.length ? { text: engine.join("-").trim(), links: [], header: false } : undefined;
      }
      if (!cha || cha.header || /^chassis$/i.test(cha.text)) continue;
      rows++;
      // Match by Wikipedia link first, then by name prefix.
      // Cells read "[Sponsor] Team-Engine" ("Elf Tyrrell-Ford", "Force India-Ferrari"): the last
      // link is the engine supplier and must never be taken for the team, and a sponsor link may
      // come first. So search the links before the engine, starting nearest to it.
      const hasEngine = /-/.test(con.text.split("\n")[0]) && con.links.length > 1;
      const pool = (hasEngine ? con.links.slice(0, -1) : con.links).map((l) => l.toLowerCase()).reverse();
      let team: (typeof candidates)[number] | undefined;
      for (const l of pool) {
        team = candidates.find((t) => t.wikiTitle && l === t.wikiTitle.toLowerCase());
        if (team) break;
      }
      if (!team) {
        const word = searchKey(con.text.split("\n")[0]).split(/[-\s]/)[0];
        for (const id of ALIASES[word] ?? []) {
          team = candidates.find((t) => t.id === id);
          if (team) break;
        }
      }
      if (!team) {
        const k = searchKey(con.text.split("\n")[0]);
        team = [...candidates].sort((a, b) => b.key.length - a.key.length).find((t) => k === t.key || k.startsWith(`${t.key}-`) || k.startsWith(`${t.key} `));
      }
      if (!team) {
        unmatched.add(con.text.split("\n")[0]);
        continue;
      }
      const a = acc.get(team.id) ?? { chassis: new Set<string>(), engines: new Set<string>() };
      splitLines(cha.text).forEach((x) => a.chassis.add(x));
      if (eng) splitLines(eng.text).forEach((x) => a.engines.add(x));
      acc.set(team.id, a);
    }
  });

  const source = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
  for (const [teamId, a] of acc) {
    const data = { chassis: [...a.chassis], engines: [...a.engines], source };
    await prisma.teamSeason.upsert({ where: { teamId_year: { teamId, year } }, create: { teamId, year, ...data }, update: data });
  }
  return { year, rows, matched: acc.size, of: candidates.length, unmatched: [...unmatched] };
}

async function main() {
  const teams = (await prisma.team.findMany({ select: { id: true, name: true, url: true } })).map((t) => ({
    id: t.id,
    name: t.name,
    key: searchKey(t.name),
    wikiTitle: titleFromUrl(t.url)?.replace(/#.*$/, "") ?? null,
  }));
  const years = yearArg ? [Number(yearArg)] : (await prisma.season.findMany({ select: { year: true }, orderBy: { year: "asc" } })).map((s) => s.year);
  let total = 0, covered = 0;
  for (const y of years) {
    const r = await importYear(y, teams);
    total += r.of ?? 0;
    covered += r.matched;
    console.log(`  ${y}: ${r.matched}/${r.of ?? "?"} teams${r.unmatched.length ? ` — unmatched: ${r.unmatched.slice(0, 6).join("; ")}` : ""}`);
  }
  console.log(`Chassis/engine data for ${covered}/${total} team-seasons.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
