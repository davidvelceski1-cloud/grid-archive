/**
 * Step 1 of the data pipeline: download the full Jolpica-F1 history into the
 * local disk cache (data/cache/jolpica). Safe to interrupt and re-run: cached
 * pages are skipped. A cold run makes ~600 requests (≈75 minutes at the
 * default polite rate). Usage: npm run data:fetch [-- 1950 2026]
 */
import "./lib/env";
import { jolpica } from "./lib/jolpica";

async function main() {
  const [fromArg, toArg] = process.argv.slice(2).map(Number);
  console.log("Fetching reference tables…");
  const seasons = await jolpica.seasons();
  const years = seasons.map((s) => Number(s.season));
  const from = fromArg || Math.min(...years);
  const to = toArg || Math.max(...years);
  await jolpica.drivers();
  await jolpica.constructors();
  await jolpica.circuits();
  for (let y = from; y <= to; y++) {
    const t = Date.now();
    await jolpica.schedule(y);
    await jolpica.results(y);
    await jolpica.sprints(y);
    await jolpica.qualifying(y);
    await jolpica.driverStandings(y);
    await jolpica.constructorStandings(y);
    console.log(`  ${y} ✓ (${Math.round((Date.now() - t) / 1000)}s)`);
  }
  console.log("Jolpica cache complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
