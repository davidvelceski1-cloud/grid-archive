/**
 * Polite HTTP helpers for the ingestion scripts: a disk cache (gzip JSON), a
 * minimum interval between requests, and exponential back-off on 429/5xx.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

export const USER_AGENT =
  process.env.HTTP_USER_AGENT ?? "GridArchive/1.0 (unofficial F1 history fan project; data ingestion script)";

// Serverless filesystems are read-only except /tmp (used by the cron route on Vercel).
export const CACHE_DIR =
  process.env.CACHE_DIR ?? (process.env.VERCEL ? "/tmp/grid-archive-cache" : path.resolve(process.cwd(), "data", "cache"));

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Throttle = { minIntervalMs: number; last: number };
const throttles = new Map<string, Throttle>();

/** Configure a per-host minimum interval between requests. */
export function setThrottle(host: string, minIntervalMs: number) {
  throttles.set(host, { minIntervalMs, last: 0 });
}

async function waitTurn(host: string) {
  const t = throttles.get(host);
  if (!t) return;
  const wait = t.last + t.minIntervalMs - Date.now();
  if (wait > 0) await sleep(wait);
  t.last = Date.now();
}

function cacheFile(namespace: string, url: string) {
  const key = createHash("sha1").update(url).digest("hex").slice(0, 20);
  return path.join(CACHE_DIR, namespace, `${key}.json.gz`);
}

export function readCache<T>(namespace: string, url: string): T | undefined {
  const file = cacheFile(namespace, url);
  if (!existsSync(file)) return undefined;
  return JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as T;
}

function writeCache(namespace: string, url: string, data: unknown) {
  try {
    const file = cacheFile(namespace, url);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, gzipSync(JSON.stringify(data)));
  } catch (e) {
    console.warn(`cache write skipped: ${(e as Error).message}`);
  }
}

export interface FetchJsonOptions {
  namespace: string;
  /** Skip the disk cache (used by the live update job for the current season). */
  fresh?: boolean;
  retries?: number;
}

export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
  if (!opts.fresh) {
    const hit = readCache<T>(opts.namespace, url);
    if (hit !== undefined) return hit;
  }
  const host = new URL(url).host;
  const retries = opts.retries ?? 6;
  let delay = 5_000;
  for (let attempt = 0; ; attempt++) {
    await waitTurn(host);
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(delay);
      delay *= 2;
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as T;
      writeCache(opts.namespace, url, data);
      return data;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay;
      console.warn(`  ${res.status} from ${host}; retrying in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      delay = Math.min(delay * 2, 15 * 60_000);
      continue;
    }
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
}

export async function fetchBinary(url: string): Promise<Buffer> {
  const host = new URL(url).host;
  let delay = 10_000;
  for (let attempt = 0; ; attempt++) {
    await waitTurn(host);
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 7) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay);
      delay = Math.min(delay * 2, 5 * 60_000);
      continue;
    }
    throw new Error(`GET ${url} failed: ${res.status}`);
  }
}
