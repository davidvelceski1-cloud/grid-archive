# GRID ARCHIVE

**Encyclopaedia of Formula 1 since 1950.**

### 🏁 [Open the live site → grid-archive-five.vercel.app](https://grid-archive-five.vercel.app)

An encyclopedic, AI-powered archive of Formula 1 World Championship history, 1950 to the current season. Every season, team (including defunct ones), driver and circuit has its own page; everything links to everything else; and **Ask the Archive** answers plain-language questions from the archive's own database, with citations.

> GRID ARCHIVE is an unofficial fan project and is not affiliated with Formula 1, the FIA, or any team.

**Stack:** Next.js 15 (App Router, ISR) · TypeScript · Tailwind CSS · PostgreSQL + Prisma + pgvector · Claude (chat, summaries, articles) · Voyage AI (embeddings, optional) · Recharts · Leaflet + OpenStreetMap.

## Screenshots

| | |
|---|---|
| ![Home page](docs/screenshots/home.jpg) **Home**: "This week in F1 history" | ![Explore the archive](docs/screenshots/explore.jpg) **Explore**: seasons, teams, drivers, circuits, eras |
| ![2026 season](docs/screenshots/season-2026.jpg) **Season pages**: champions, headline, key numbers | ![2026 grid](docs/screenshots/season-grid.jpg) **The grid**: every team's chassis, engine and drivers |
| ![Team history](docs/screenshots/team-history.jpg) **Team history**: chassis and engines year by year | ![Car gallery](docs/screenshots/car-gallery.jpg) **Car gallery**: notable cars with freely licensed photos |
| ![Driver page](docs/screenshots/driver.jpg) **Drivers**: career stats and charts | ![Circuit page](docs/screenshots/circuit.jpg) **Circuits**: maps, layouts and winners |
| ![Records](docs/screenshots/records.jpg) **Records**: leaderboards filterable by era | ![Mega menu](docs/screenshots/mega-menu.jpg) **Navigation**: mega menus with pictures |
| ![Ask the Archive](docs/screenshots/ask.jpg) **Ask the Archive**: questions answered from the database, with sources | |

---

## Quick start

Requirements: Node.js 20.12+ (22 LTS recommended) and a PostgreSQL 15+ database with the `vector` extension (Neon and Supabase both provide it).

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL and (optionally) API keys
npx prisma migrate deploy     # creates tables, pgvector + search indexes
npm run seed                  # downloads and builds the whole archive (see timings below)
npm run dev                   # http://localhost:3000
```

### No database yet? Run one locally with zero installs

```bash
npm run dev:db                # terminal 1: PGlite (Postgres in WASM, with pgvector) on 127.0.0.1:5433
```

and in `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable&connection_limit=1&pgbouncer=true"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable&connection_limit=1&pgbouncer=true"
```

The local database is for development only. For `next build` against it, set `NEXT_BUILD_CPUS=1`.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled Postgres connection used by the app |
| `DIRECT_URL` | yes | Direct (non-pooled) connection used by `prisma migrate` |
| `ANTHROPIC_API_KEY` | for AI | Claude: Ask the Archive, summaries, ELI5, On-this-day, AI articles, natural-language search |
| `CLAUDE_MODEL` | no | Defaults to `claude-opus-5-5` |
| `VOYAGE_API_KEY` | no | Vector embeddings (`voyage-3.5`, 1024 dims). Without it, retrieval uses Postgres full-text search |
| `ADMIN_PASSWORD` | for /admin | HTTP Basic auth, user `admin` |
| `CRON_SECRET` | for cron | Protects `/api/cron/update` |
| `NEXT_PUBLIC_SITE_URL` | prod | Canonical URLs, sitemap, Open Graph |
| `HTTP_USER_AGENT` | recommended | Wikimedia asks for a User-Agent with contact details |
| `JOLPICA_INTERVAL_MS`, `WIKIMEDIA_INTERVAL_MS` | no | Request pacing (defaults 7500 ms / 1000 ms) |

Keys are only read on the server (route handlers, server components, scripts). Nothing is prefixed `NEXT_PUBLIC_` except the site URL.

**Without any AI keys the site still works fully:** articles are assembled from the data, Ask the Archive returns the best-matching cited passages, and summaries are data-driven.

---

## The data pipeline

`npm run seed` runs every step in order. Each step is idempotent and cached, so an interrupted seed can simply be re-run.

| Step | Command | What it does | Cold run |
|---|---|---|---|
| 1 | `npm run data:fetch` | Downloads every season from the [Jolpica-F1 API](https://api.jolpi.ca/ergast/f1/) into `data/cache/` (gzip JSON). Respects Jolpica's 500 req/hour limit | ~75 min |
| 2 | (seed) | Upserts drivers, constructors, circuits; replaces each season's races, results, sprints, qualifying, standings | ~2 min |
| 3 | (seed) | Curated data from `data/curated/`: eras, team lineage, cars & engines, circuit types/layouts, regulation changes, glossary | seconds |
| 4 | (seed) | Recomputes career stats, champions, circuit stats, season headlines | ~1 min |
| 5 | `npm run data:wiki` | Wikipedia lead extracts (CC BY-SA, attributed) + Wikidata IDs | ~3 min |
| 6 | `npm run ai:articles` | Long-form articles: Claude for major entities if a key is set, data-template otherwise | template: ~2 min; AI: ~1 h |
| 7 | `npm run images:ingest` | Wikimedia Commons images (see below) | ~30–40 min |
| 8 | `npm run ai:embed` | Chunks everything into the RAG index and embeds new/changed chunks | ~2 min (+ embeddings) |

Flags: `npm run seed -- --no-images`, `--offline` (skip Wikipedia/Commons), `--from=2020` (reload only recent seasons).

Data notes: Jolpica splits some early teams by engine (`cooper-climax`, `brabham-repco`); these are folded into one team and the engine is kept on each result. Fastest-lap data is complete from 2004. Pole positions without qualifying data come from the starting grid.

### Images (free licences only)

`scripts/ingest-images.ts`:

1. Matches each driver, team and circuit to **Wikidata** via its Wikipedia page, then reads `P18` (image) and, for circuits, `P15` (route map, usually an SVG track layout).
2. Reads Commons `extmetadata` and keeps only **CC0, Public Domain, CC BY, CC BY-SA** (NC/ND, fair use and GFDL-only are rejected).
3. Downloads and converts with `sharp` to WebP srcset sizes in `public/images/{drivers|teams|circuits}/{slug}-{width}.webp`; track maps stay SVG in `public/images/tracks/`.
4. Stores author, licence, licence URL and source page in the `Image` table. Credits appear under images and on `/credits`.

Entities without a free image get a designed placeholder (team colour, driver initials, or a track outline). No F1, FIA or team logos are used.

Options: `--only=drivers|teams|circuits`, `--limit=50`, `--force`.

### Keeping the current season up to date

* **Vercel:** `vercel.json` schedules `GET /api/cron/update` every Monday 06:00 UTC. Vercel sends `Authorization: Bearer $CRON_SECRET`. The job re-downloads the current season, recomputes stats, refreshes the season article (unless edited by a human) and revalidates pages.
* **Anywhere else:** run `npm run update:current` from cron or GitHub Actions; it also refreshes the vector index.

Ask the Archive builds fact sheets live from the database for any entity named in a question, so fresh results are answerable immediately, even before re-embedding.

---

## AI features

| Feature | Where | How |
|---|---|---|
| Ask the Archive | floating button on every page, `/ask` | RAG: entity linking + full-text + vector search (reciprocal-rank fusion) → live fact sheets → Claude streams an answer citing `[n]` sources. Context-aware on entity pages. Optional stat cards. Says so when the archive lacks the answer |
| Summarise this page | season/team/driver/circuit heroes | Short or detailed; cached 7 days |
| Explain like I'm new to F1 | chat toggle, `/glossary` | Curated ELI5 text for glossary terms, Claude for anything else (cached) |
| On this day | homepage | Races and birthdays on today's date; AI note cached daily |
| Natural-language search | `/search` | Claude structured output → SQL filters (driver/team/circuit/years/outcome); unsupported criteria such as weather are reported and matched in article text |
| AI-assisted articles | every entity page | Generated only from the fact sheet + Wikipedia extract, labelled "AI-assisted", editable in `/admin` |

All Claude calls use `claude-opus-5-5` with server-side refusal fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). Chat runs at low effort; articles at medium. AI endpoints are rate-limited per IP.

**RAG pipeline files:** `src/lib/facts.ts` (fact sheets) · `src/lib/ai/chunk.ts` (chunking) · `scripts/build-embeddings.ts` (indexing, diff-based so unchanged chunks keep their vectors) · `src/lib/ai/retrieval.ts` (hybrid retrieval) · `src/lib/ai/answer.ts` (prompt + sources) · `src/app/api/ask/route.ts` (streaming NDJSON endpoint).

---

## Project structure

```
prisma/                 schema.prisma + migrations (init, search indexes)
data/curated/           hand-maintained eras, lineage, cars, circuits, regulations, glossary
scripts/                seed + ingestion (Jolpica, Wikipedia, Commons), articles, embeddings, update job, dev DB
  lib/                  http cache/throttle, Jolpica client, ingest, curated, wiki helpers
src/app/                routes (see below), API routes, sitemap, robots, OG image
src/components/         header/mega-menu, search overlay, chat, charts, tables, map, page blocks
src/lib/                db, queries, facts, articles, lineage, AI (claude, embeddings, retrieval, answer)
tests/                  unit tests (node:test via tsx)
```

Routes: `/` · `/seasons` · `/seasons/[year]` · `/seasons/[year]/[race]` · `/teams` · `/teams/[slug]` · `/drivers` · `/drivers/[slug]` · `/drivers/compare` · `/circuits` · `/circuits/[slug]` · `/eras` · `/eras/[slug]` · `/records` · `/ask` · `/glossary` · `/search` · `/credits` · `/about` · `/my-archive` · `/admin`.

Database model: `Season, Race, Result, Qualifying, DriverStanding, ConstructorStanding, Driver, Team (table "Constructor"), ConstructorLineage, Circuit, CircuitLayout, Chassis, Engine, Era, Image, Article, WikiExtract, GlossaryTerm, Embedding, DailyFeature, IngestRun`. The constructor model is called `Team` in code because a Prisma model named `Constructor` collides with JavaScript's `Object.prototype.constructor`.

---

## Admin

`/admin` (Basic auth: `admin` / `ADMIN_PASSWORD`): ingestion history, article editor with Markdown preview and "Regenerate with AI", team metadata (founded, base, founder, colour, "why they disappeared"), season headlines. Human edits are never overwritten by the scripts.

---

## Deploying to Vercel + Neon

1. Create a Neon project. Copy the **pooled** connection string to `DATABASE_URL` and the **direct** one to `DIRECT_URL`. (Supabase: transaction pooler on port 6543 with `?pgbouncer=true` for `DATABASE_URL`, session/direct for `DIRECT_URL`.)
2. Locally, with those URLs in `.env`: `npx prisma migrate deploy && npm run seed`. Seeding from your machine keeps the long ingestion out of serverless time limits.
3. Commit `public/images/` (created by the seed) so the images ship with the site.
4. Import the repo into Vercel, add the environment variables, deploy. `npm run build` runs `prisma generate && next build`; pages are statically generated and revalidated hourly (ISR).
5. The cron in `vercel.json` takes over weekly updates.

---

## Development

```bash
npm test             # unit tests
npm run typecheck    # tsc --noEmit
```

Design: NASA.gov-inspired layout language (original logo; no NASA assets). Dark by default with light reading sections, signal red `#E4002B`, Inter + Public Sans, 12-column grid, square corners. Charts use a palette validated for colour-vision deficiency on the dark surface, with legends, direct labels and a "view as table" toggle. Motion respects `prefers-reduced-motion`.

## Licences & credits

Code: yours to choose. Results data: Jolpica-F1 (community-maintained Ergast successor). Text adapted from Wikipedia: CC BY-SA 4.0, attributed per page. Images: Wikimedia Commons under the licences listed on `/credits`. Maps: © OpenStreetMap contributors.
