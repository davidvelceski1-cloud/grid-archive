/**
 * Re-download image files that the database knows about but that are missing on
 * disk (e.g. after copying the project without public/images, or after a cleanup
 * tool removed files). Uses the exact Commons file already recorded for each image,
 * so the chosen pictures never change.
 *
 *   npm run images:repair
 */
import "./lib/env";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { commonsInfo } from "./lib/wiki";
import { fetchBinary } from "./lib/http";

const prisma = new PrismaClient();
const PUBLIC = path.resolve(process.cwd(), "public");

async function main() {
  const images = await prisma.image.findMany();
  const broken = images.filter((i) => {
    const files = [i.path, ...(Array.isArray(i.srcset) ? (i.srcset as { path: string }[]).map((s) => s.path) : [])];
    return files.some((f) => !existsSync(path.join(PUBLIC, f)));
  });
  console.log(`Images in database: ${images.length}; with missing files: ${broken.length}`);
  if (!broken.length) return;

  const info = await commonsInfo([...new Set(broken.map((i) => i.commonsFile))]);
  let ok = 0;
  let failed = 0;
  for (const img of broken) {
    const c = info.get(img.commonsFile);
    if (!c) {
      failed++;
      console.warn(`  ! not found on Commons: ${img.commonsFile}`);
      continue;
    }
    try {
      if (img.path.endsWith(".svg")) {
        const buf = await fetchBinary(c.url);
        mkdirSync(path.dirname(path.join(PUBLIC, img.path)), { recursive: true });
        writeFileSync(path.join(PUBLIC, img.path), buf);
      } else {
        const buf = await fetchBinary(c.thumbUrl);
        const set = Array.isArray(img.srcset) ? (img.srcset as { w: number; path: string }[]) : [{ w: img.width ?? 1280, path: img.path }];
        for (const s of set) {
          const out = path.join(PUBLIC, s.path);
          mkdirSync(path.dirname(out), { recursive: true });
          await sharp(buf).rotate().resize({ width: s.w, withoutEnlargement: true }).webp({ quality: 74 }).toFile(out);
        }
      }
      ok++;
      if (ok % 50 === 0) console.log(`  … ${ok} repaired`);
    } catch (e) {
      failed++;
      console.warn(`  ! ${img.commonsFile}: ${(e as Error).message}`);
    }
  }
  console.log(`Repaired ${ok}, failed ${failed}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
