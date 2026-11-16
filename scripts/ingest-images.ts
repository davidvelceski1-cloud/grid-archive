/**
 * Image ingestion from Wikimedia Commons (free licences only).
 *  1. Match each driver / team / circuit to Wikidata (QID from its Wikipedia page)
 *     and read P18 (image) — plus P15 (route map) for circuits.
 *  2. Read Commons extmetadata; keep only CC0 / Public Domain / CC BY / CC BY-SA.
 *  3. Download, resize to WebP srcset sizes with sharp → public/images/{kind}/{slug}-{w}.webp
 *     (track maps are kept as SVG).
 *  4. Save author, licence and source URL in the Image table.
 *
 * Usage: npm run images:ingest [-- --only=drivers|teams|circuits] [--limit=50] [--force]
 */
import "./lib/env";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient, type ImageKind } from "@prisma/client";
import { commonsInfo, isAllowedLicense, yearsPlausible, titleFromUrl, wikidataFiles, wikipediaLeadImages, wikipediaTrackSvg, commonsSearch, type CommonsImage } from "./lib/wiki";
import { fetchBinary } from "./lib/http";
import { NO_TEAM_PHOTO, TEAM_IMAGE_OVERRIDES } from "../data/curated/team-images";
import { CAR_IMAGE_OVERRIDES } from "../data/curated/cars";
import { carPattern, scoreCarFile } from "./lib/carMatch";

const prisma = new PrismaClient();
const PUBLIC = path.resolve(process.cwd(), "public");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const SIZES: Record<ImageKind, number[]> = {
  DRIVER: [320, 640],
  TEAM: [640, 1280],
  CAR: [640, 1280],
  CIRCUIT: [640, 1280],
  TRACK_MAP: [],
};
const DIR: Record<ImageKind, string> = { DRIVER: "drivers", TEAM: "teams", CAR: "cars", CIRCUIT: "circuits", TRACK_MAP: "tracks" };

interface Target {
  kind: ImageKind;
  entityId: string;
  slug: string;
  qid: string;
  alt: string;
  prop: "P18" | "P15";
  attach: (imageId: number) => Promise<unknown>;
  /** Commons file chosen directly (bypasses the Wikidata lookup). */
  file?: string;
  /** Years F1 raced here; track maps dated well outside them are rejected. */
  years?: [number, number];
}

async function saveImage(t: Target, img: CommonsImage): Promise<number | null> {
  const dir = path.join(PUBLIC, "images", DIR[t.kind]);
  mkdirSync(dir, { recursive: true });
  let mainPath: string;
  let srcset: { w: number; path: string }[] | null = null;
  let width = img.width;
  let height = img.height;

  if (t.kind === "TRACK_MAP") {
    if (img.mime !== "image/svg+xml") return null;
    const buf = await fetchBinary(img.url);
    mainPath = `/images/${DIR[t.kind]}/${t.slug}.svg`;
    writeFileSync(path.join(PUBLIC, mainPath), buf);
  } else {
    if (!/^image\/(jpeg|png|webp|tiff|gif)/.test(img.mime)) return null;
    const buf = await fetchBinary(img.thumbUrl);
    const meta = await sharp(buf).metadata();
    width = meta.width ?? width;
    height = meta.height ?? height;
    srcset = [];
    for (const w of SIZES[t.kind]) {
      if (srcset.length && w > width) break;
      const rel = `/images/${DIR[t.kind]}/${t.slug}-${w}.webp`;
      await sharp(buf).rotate().resize({ width: Math.min(w, width), withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(PUBLIC, rel));
      srcset.push({ w: Math.min(w, width), path: rel });
    }
    mainPath = srcset.at(-1)!.path;
    height = Math.round((height / width) * srcset.at(-1)!.w);
    width = srcset.at(-1)!.w;
  }

  const data = {
    path: mainPath,
    srcset: srcset ?? undefined,
    width,
    height,
    alt: t.alt,
    author: img.author,
    license: img.license,
    licenseUrl: img.licenseUrl,
    sourceUrl: img.sourceUrl,
    commonsFile: img.file,
  };
  const row = await prisma.image.upsert({
    where: { kind_entityId: { kind: t.kind, entityId: t.entityId } },
    create: { kind: t.kind, entityId: t.entityId, ...data },
    update: data,
  });
  return row.id;
}

async function run(targets: Target[]) {
  const force = args.force === "true";
  const existing = new Set(
    (await prisma.image.findMany({ select: { kind: true, entityId: true } })).map((i) => `${i.kind}:${i.entityId}`),
  );
  const todo = targets.filter((t) => force || !existing.has(`${t.kind}:${t.entityId}`)).slice(0, Number(args.limit ?? Infinity));
  if (!todo.length) return;

  const props = [...new Set(todo.map((t) => t.prop))];
  const needWd = todo.filter((t) => !t.file);
  const files = needWd.length ? await wikidataFiles([...new Set(needWd.map((t) => t.qid))], props) : new Map<string, Record<string, string>>();
  const fileFor = (t: Target) => t.file ?? files.get(t.qid)?.[t.prop];
  const info = await commonsInfo([...new Set(todo.map(fileFor).filter((f): f is string => Boolean(f)))]);

  let ok = 0, skippedLicense = 0, none = 0;
  for (const t of todo) {
    const f = fileFor(t);
    const img = f ? info.get(f) : undefined;
    if (!img) { none++; continue; }
    if (t.kind === "TRACK_MAP" && !yearsPlausible(img.file, t.years)) { none++; continue; }
    // No logos, badges or emblems (the spec forbids team logos; they also make poor hero images).
    if (t.kind !== "TRACK_MAP" && (/(logo|badge|emblem|crest|plate|insignia)/i.test(img.file) || (t.kind === "TEAM" && /\.svg$/i.test(img.file)))) { none++; continue; }
    if (!isAllowedLicense(img.license)) { skippedLicense++; continue; }
    try {
      const id = await saveImage(t, img);
      if (id) { await t.attach(id); ok++; }
    } catch (e) {
      console.warn(`  ! ${t.kind} ${t.slug}: ${(e as Error).message}`);
    }
    if ((ok + 1) % 25 === 0) console.log(`  … ${ok} saved`);
  }
  console.log(`  ${todo[0].kind}: saved ${ok}, no image ${none}, licence rejected ${skippedLicense}`);
}

async function main() {
  const only = args.only;
  if (!only || only === "drivers") {
    const drivers = await prisma.driver.findMany({ where: { wikidataId: { not: null } }, orderBy: { lastYear: "desc" } });
    await run(
      drivers.map((d) => ({
        kind: "DRIVER" as const, entityId: d.id, slug: d.slug, qid: d.wikidataId!, prop: "P18" as const,
        alt: `Portrait of ${d.fullName}`,
        attach: (imageId: number) => prisma.driver.update({ where: { id: d.id }, data: { imageId } }),
      })),
    );
  }
  if (!only || only === "teams") {
    const pinned = [...Object.keys(TEAM_IMAGE_OVERRIDES), ...NO_TEAM_PHOTO];
    const teams = await prisma.team.findMany({ where: { wikidataId: { not: null }, id: { notIn: pinned } } });
    await run(
      teams.map((c) => ({
        kind: "TEAM" as const, entityId: c.id, slug: c.slug, qid: c.wikidataId!, prop: "P18" as const,
        alt: `${c.name} racing car`,
        attach: (imageId: number) => prisma.team.update({ where: { id: c.id }, data: { imageId } }),
      })),
    );
  }
  if (!only || only === "circuits") {
    const circuits = await prisma.circuit.findMany({ where: { wikidataId: { not: null } } });
    await run(
      circuits.map((c) => ({
        kind: "CIRCUIT" as const, entityId: c.id, slug: c.slug, qid: c.wikidataId!, prop: "P18" as const,
        alt: `View of ${c.name}`,
        attach: (imageId: number) => prisma.circuit.update({ where: { id: c.id }, data: { imageId } }),
      })),
    );
    await run(
      circuits.map((c) => ({
        kind: "TRACK_MAP" as const, entityId: c.id, slug: c.slug, qid: c.wikidataId!, prop: "P15" as const,
        years: c.firstYear && c.lastYear ? ([c.firstYear, c.lastYear] as [number, number]) : undefined,
        alt: `Track layout of ${c.name}`,
        attach: (imageId: number) => prisma.circuit.update({ where: { id: c.id }, data: { trackMapId: imageId } }),
      })),
    );
  }
  if (!only || only === "teams" || only === "fallback") {
    // Editor-reviewed Commons photos for teams Wikidata has no image for.
    const teams = (await prisma.team.findMany({ where: { id: { in: Object.keys(TEAM_IMAGE_OVERRIDES) } } })).filter((c) => !TEAM_IMAGE_OVERRIDES[c.id].startsWith("car:"));
    await run(
      teams.map((c) => ({
        kind: "TEAM" as const, entityId: c.id, slug: c.slug, qid: c.wikidataId ?? "", prop: "P18" as const, file: TEAM_IMAGE_OVERRIDES[c.id],
        alt: `${c.name} racing car`,
        attach: (imageId: number) => prisma.team.update({ where: { id: c.id }, data: { imageId } }),
      })),
    );
  }
  if (!only || only === "drivers" || only === "teams" || only === "fallback") {
    // Fallback: the lead image of the Wikipedia article, for entities Wikidata has no P18 for.
    const drivers = only === "teams" ? [] : await prisma.driver.findMany({ where: { imageId: null, url: { not: null }, starts: { gt: 0 } } });
    const teams = only === "drivers" ? [] : await prisma.team.findMany({ where: { imageId: null, url: { not: null }, entries: { gt: 0 }, id: { notIn: [...NO_TEAM_PHOTO, ...Object.keys(TEAM_IMAGE_OVERRIDES)] } } });
    const titleOf = new Map<string, string>();
    for (const e of [...drivers, ...teams]) {
      const t = titleFromUrl(e.url);
      if (t) titleOf.set(e.id, t.replace(/#.*$/, ""));
    }
    const lead = await wikipediaLeadImages([...new Set(titleOf.values())]);
    const pick = (id: string) => {
      const f = lead.get(titleOf.get(id) ?? "");
      return f && !/\.svg$/i.test(f) ? f : undefined; // skip logos/diagrams
    };
    const dTargets: Target[] = drivers.flatMap((d) => {
      const file = pick(d.id);
      return file ? [{ kind: "DRIVER" as const, entityId: d.id, slug: d.slug, qid: d.wikidataId ?? "", prop: "P18" as const, file, alt: `Portrait of ${d.fullName}`, attach: (imageId: number) => prisma.driver.update({ where: { id: d.id }, data: { imageId } }) }] : [];
    });
    const tTargets: Target[] = teams.flatMap((c) => {
      const file = pick(c.id);
      return file ? [{ kind: "TEAM" as const, entityId: c.id, slug: c.slug, qid: c.wikidataId ?? "", prop: "P18" as const, file, alt: `${c.name} racing car`, attach: (imageId: number) => prisma.team.update({ where: { id: c.id }, data: { imageId } }) }] : [];
    });
    console.log(`  Wikipedia lead-image candidates: ${dTargets.length}/${drivers.length} drivers, ${tTargets.length}/${teams.length} teams`);
    await run(dTargets);
    await run(tTargets);
  }
  if (!only || only === "teams" || only === "fallback") {
    // Last resort for teams with no free photo anywhere (mostly 1950s Indianapolis
    // builders): reuse the portrait of the driver who raced for them most often.
    // The image keeps its own alt text ("Portrait of …"), so it is never passed off as the car.
    const bare = await prisma.team.findMany({ where: { imageId: null, entries: { gt: 0 } }, select: { id: true, name: true } });
    let n = 0;
    for (const t of bare) {
      const top = await prisma.$queryRaw<{ imageId: number }[]>`
        SELECT d."imageId" FROM "Result" r JOIN "Driver" d ON d.id = r."driverId"
        WHERE r."constructorId" = ${t.id} AND d."imageId" IS NOT NULL
        GROUP BY d.id, d."imageId" ORDER BY COUNT(*) DESC LIMIT 1`;
      if (top[0]) {
        await prisma.team.update({ where: { id: t.id }, data: { imageId: top[0].imageId } });
        n++;
      }
    }
    console.log(`  TEAM driver-portrait fallback: ${n}/${bare.length}`);
  }
  if (!only || only === "teams" || only === "fallback") {
    // Final fallback: a photo of the circuit where the team raced most (its own caption
    // names the circuit). Used only for one-off entrants with no car or driver photo.
    const bare = await prisma.team.findMany({ where: { imageId: null, entries: { gt: 0 } }, select: { id: true } });
    let n = 0;
    for (const t of bare) {
      const top = await prisma.$queryRaw<{ imageId: number }[]>`
        SELECT c."imageId" FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId" JOIN "Circuit" c ON c.id = ra."circuitId"
        WHERE r."constructorId" = ${t.id} AND c."imageId" IS NOT NULL
        GROUP BY c.id, c."imageId" ORDER BY COUNT(*) DESC LIMIT 1`;
      if (top[0]) {
        await prisma.team.update({ where: { id: t.id }, data: { imageId: top[0].imageId } });
        n++;
      }
    }
    console.log(`  TEAM circuit-photo fallback: ${n}/${bare.length}`);
  }
  if (!only || only === "cars") {
    // Car register: search Commons for each chassis and accept only files that name
    // the make and the exact model (see lib/carMatch.ts). Editors can pin a file in
    // CAR_IMAGE_OVERRIDES (data/curated/cars.ts).
    const chassis = await prisma.chassis.findMany({ where: { imageId: null }, include: { team: true } });
    const targets: Target[] = [];
    const unmatched: string[] = [];
    for (const c of chassis) {
      let file = CAR_IMAGE_OVERRIDES[c.id];
      if (!file) {
        const p = carPattern(c.name);
        const clean = c.name.replace(/['‘’"]/g, "").replace(/\s+/g, " ");
        const found = new Set<string>();
        for (const q of [clean, `${clean} Formula One`, `${p.makes[0] ?? ""} ${p.model}`]) {
          for (const f of await commonsSearch(q, 20)) if (/\.(jpe?g|png)$/i.test(f)) found.add(f);
        }
        const best = [...found].map((f) => ({ f, s: scoreCarFile(f, p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0];
        file = best?.f;
      }
      if (!file) { unmatched.push(c.name); continue; }
      targets.push({
        kind: "CAR", entityId: c.id, slug: c.id, qid: "", prop: "P18", file,
        alt: `${c.name} (${c.year})`,
        attach: (imageId: number) => prisma.chassis.update({ where: { id: c.id }, data: { imageId } }),
      });
    }
    console.log(`  car photo candidates: ${targets.length}/${chassis.length}${unmatched.length ? `; no match: ${unmatched.join(", ")}` : ""}`);
    await run(targets);
  }
  if (!only || only === "cars" || only === "teams" || only === "fallback") {
    // Teams pinned to a car-register photo ("car:<chassis id>") always use it.
    let n = 0;
    for (const [teamId, ref] of Object.entries(TEAM_IMAGE_OVERRIDES)) {
      if (!ref.startsWith("car:")) continue;
      const car = await prisma.chassis.findUnique({ where: { id: ref.slice(4) }, select: { imageId: true } });
      if (car?.imageId) {
        await prisma.team.updateMany({ where: { id: teamId }, data: { imageId: car.imageId } });
        n++;
      }
    }
    console.log(`  TEAM photos from the car register: ${n}`);
  }
  if (!only || only === "circuits" || only === "tracks") {
    // Fallback track maps from each circuit's Wikipedia article.
    const missing = await prisma.circuit.findMany({ where: { trackMapId: null, url: { not: null } } });
    const targets: Target[] = [];
    for (const c of missing) {
      const title = titleFromUrl(c.url);
      if (!title) continue;
      const file = await wikipediaTrackSvg(title, [c.name, c.locality ?? "", title], c.firstYear && c.lastYear ? [c.firstYear, c.lastYear] : undefined);
      if (file) targets.push({ kind: "TRACK_MAP", entityId: c.id, slug: c.slug, qid: c.wikidataId ?? "", prop: "P15", file, years: c.firstYear && c.lastYear ? [c.firstYear, c.lastYear] : undefined, alt: `Track layout of ${c.name}`, attach: (imageId: number) => prisma.circuit.update({ where: { id: c.id }, data: { trackMapId: imageId } }) });
    }
    console.log(`  track-map candidates from Wikipedia: ${targets.length}/${missing.length}`);
    await run(targets);
  }
  if (!existsSync(path.join(PUBLIC, "images"))) mkdirSync(path.join(PUBLIC, "images"), { recursive: true });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
