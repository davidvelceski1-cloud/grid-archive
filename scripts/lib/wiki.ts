/**
 * Wikipedia / Wikidata / Wikimedia Commons helpers.
 * - Wikipedia lead extracts (CC BY-SA 4.0) are stored as grounding text.
 * - Wikidata QIDs give exact entity matching for images (P18 image, P15 route map).
 * - Commons extmetadata supplies author + licence for every image we keep.
 */
import { fetchJson, setThrottle } from "./http";

const WP = "https://en.wikipedia.org/w/api.php";
const WD = "https://www.wikidata.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
// Wikimedia asks unauthenticated clients to stay well under its limits and to send a
// descriptive User-Agent with contact details (set HTTP_USER_AGENT in .env).
const WM_INTERVAL = Number(process.env.WIKIMEDIA_INTERVAL_MS ?? 1000);
setThrottle("en.wikipedia.org", WM_INTERVAL);
setThrottle("www.wikidata.org", WM_INTERVAL);
setThrottle("commons.wikimedia.org", WM_INTERVAL);
setThrottle("upload.wikimedia.org", WM_INTERVAL);
setThrottle("thumb.wikimedia.org", 500);

export function titleFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/wikipedia\.org\/wiki\/(.+)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch {
    return m[1].replace(/_/g, " ");
  }
}

interface WpPage {
  title: string;
  missing?: string;
  extract?: string;
  pageprops?: { wikibase_item?: string };
}
interface WpResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, WpPage>;
  };
}

export interface WikiInfo {
  title: string;
  url: string;
  extract: string | null;
  qid: string | null;
}

/** Resolve up to N titles → final page title, lead extract and Wikidata QID. */
export async function wikipediaInfo(titles: string[]): Promise<Map<string, WikiInfo>> {
  const out = new Map<string, WikiInfo>();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "extracts|pageprops",
      exintro: "1",
      explaintext: "1",
      exlimit: "20",
      ppprop: "wikibase_item",
      redirects: "1",
      titles: batch.join("|"),
    });
    // TextExtracts returns only as many extracts as fit its size budget and
    // signals the rest with `continue.excontinue`, so page through.
    const follow = new Map<string, string>();
    const pages = new Map<string, WpPage>();
    for (let cont: string | undefined, guard = 0; guard < 25; guard++) {
      if (cont) params.set("excontinue", cont);
      const data = await fetchJson<WpResponse & { continue?: { excontinue?: string } }>(`${WP}?${params}`, { namespace: "wikipedia" });
      const q = data.query ?? {};
      for (const n of q.normalized ?? []) follow.set(n.from, n.to);
      for (const r of q.redirects ?? []) follow.set(r.from, r.to);
      for (const p of Object.values(q.pages ?? {})) {
        const prev = pages.get(p.title);
        pages.set(p.title, { ...prev, ...p, extract: p.extract || prev?.extract });
      }
      cont = data.continue?.excontinue;
      if (!cont) break;
    }
    for (const t of batch) {
      let final = t;
      for (let hop = 0; hop < 3 && follow.has(final); hop++) final = follow.get(final)!;
      const p = pages.get(final);
      if (!p || p.missing !== undefined) continue;
      out.set(t, {
        title: p.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
        extract: p.extract?.trim() || null,
        qid: p.pageprops?.wikibase_item ?? null,
      });
    }
  }
  return out;
}

interface WdResponse {
  entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }>;
}

/** Fetch Commons file names for the given Wikidata properties (e.g. P18, P15). */
export async function wikidataFiles(qids: string[], props: string[]): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  for (let i = 0; i < qids.length; i += 50) {
    const batch = qids.slice(i, i + 50);
    const params = new URLSearchParams({ action: "wbgetentities", format: "json", props: "claims", ids: batch.join("|") });
    const data = await fetchJson<WdResponse>(`${WD}?${params}`, { namespace: "wikidata" });
    for (const [qid, ent] of Object.entries(data.entities ?? {})) {
      const rec: Record<string, string> = {};
      for (const p of props) {
        // Prefer the last-listed value for P18 (often the most recent photo); first otherwise.
        const claims = ent.claims?.[p] ?? [];
        const v = claims[0]?.mainsnak?.datavalue?.value;
        if (typeof v === "string") rec[p] = v;
      }
      out.set(qid, rec);
    }
  }
  return out;
}

export interface CommonsImage {
  file: string;
  url: string; // original
  thumbUrl: string; // ≤1600px wide raster (for SVG: PNG render)
  width: number;
  height: number;
  mime: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  description: string | null;
}

interface CommonsResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    pages?: Record<
      string,
      {
        title: string;
        missing?: string;
        imageinfo?: {
          url: string;
          thumburl?: string;
          width: number;
          height: number;
          mime: string;
          descriptionurl: string;
          extmetadata?: Record<string, { value: string }>;
        }[];
      }
    >;
  };
}

/** Licences we are allowed to republish with attribution. */
export function isAllowedLicense(short: string): boolean {
  const s = short.trim().toLowerCase();
  if (/^cc0/.test(s)) return true;
  if (/public domain|^pd\b|^pd-/.test(s)) return true;
  if (/^cc by(-sa)? \d/.test(s)) return true; // CC BY x.y / CC BY-SA x.y (excludes NC/ND)
  return false;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();
}

export async function commonsInfo(files: string[]): Promise<Map<string, CommonsImage>> {
  const out = new Map<string, CommonsImage>();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "1280", // a standard Wikimedia thumbnail size: served pre-rendered from thumb.wikimedia.org without bot throttling
      titles: batch.map((f) => `File:${f}`).join("|"),
    });
    const data = await fetchJson<CommonsResponse>(`${COMMONS}?${params}`, { namespace: "commons" });
    const norm = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of Object.values(data.query?.pages ?? {})) {
      const ii = page.imageinfo?.[0];
      if (!ii || page.missing !== undefined) continue;
      const meta = ii.extmetadata ?? {};
      const license = meta.LicenseShortName?.value ?? "";
      const requested = (norm.get(page.title) ?? page.title).replace(/^File:/, "");
      out.set(requested, {
        file: page.title.replace(/^File:/, ""),
        url: ii.url,
        thumbUrl: ii.thumburl ?? ii.url,
        width: ii.width,
        height: ii.height,
        mime: ii.mime,
        author: stripHtml(meta.Artist?.value ?? meta.Credit?.value ?? "Unknown author").slice(0, 200) || "Unknown author",
        license,
        licenseUrl: meta.LicenseUrl?.value ?? null,
        sourceUrl: ii.descriptionurl,
        description: meta.ImageDescription?.value ? stripHtml(meta.ImageDescription.value).slice(0, 300) : null,
      });
    }
  }
  return out;
}

interface WdTimeResponse {
  entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: { time?: string; precision?: number } } } }[]> }>;
}

/** Wikidata P570 (date of death) as "YYYY-MM-DD", only when known to the day. */
export async function wikidataDeathDates(qids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < qids.length; i += 50) {
    const batch = qids.slice(i, i + 50);
    const params = new URLSearchParams({ action: "wbgetentities", format: "json", props: "claims", ids: batch.join("|") });
    const data = await fetchJson<WdTimeResponse>(`${WD}?${params}`, { namespace: "wikidata" });
    for (const [qid, ent] of Object.entries(data.entities ?? {})) {
      const v = ent.claims?.P570?.[0]?.mainsnak?.datavalue?.value;
      const m = v?.time?.match(/^\+(\d{4}-\d{2}-\d{2})T/);
      if (m && (v?.precision ?? 0) >= 11) out.set(qid, m[1]);
    }
  }
  return out;
}

const NOT_A_MAP = /(flag|logo|icon|symbol|commons-|wiki|edit-|question_book|ambox|padlock|portal|crystal|nuvola|disambig|locator|location_map|relief|blank_map|map_of|pictogram|_seal|coat_of_arms|wappen|drapeau|ensign|climate|normals|chart|graph|population|election|weather)/i;

/**
 * Fallback for circuits without a Wikidata route map (P15): pick the SVG track
 * layout shown on the circuit's Wikipedia article. Licence is still checked on Commons.
 */
/** False when every year in a file name lies well outside the years F1 raced there. */
export function yearsPlausible(file: string, f1Years?: [number, number]): boolean {
  const years = [...file.matchAll(/(19[0-9]{2}|20[0-9]{2})/g)].map((m) => Number(m[1]));
  if (!f1Years || !years.length) return true;
  return years.some((y) => y >= f1Years[0] - 2 && y <= f1Years[1] + 2);
}

export async function wikipediaTrackSvg(title: string, hints: string[], f1Years?: [number, number]): Promise<string | null> {
  const params = new URLSearchParams({ action: "query", format: "json", prop: "images", imlimit: "100", redirects: "1", titles: title });
  const data = await fetchJson<{ query?: { pages?: Record<string, { images?: { title: string }[] }> } }>(`${WP}?${params}`, { namespace: "wikipedia" });
  const files = Object.values(data.query?.pages ?? {}).flatMap((p) => p.images ?? []).map((i) => i.title.replace(/^File:/, ""));
  const svgs = files.filter((f) => /\.svg$/i.test(f) && !NOT_A_MAP.test(f.replace(/[ -]+/g, "_")));
  const words = hints.flatMap((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/)).filter((w) => w.length >= 4 && !["circuit", "international", "autodromo", "grand", "prix", "street"].includes(w));
  const score = (f: string) => {
    const k = f.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    let s = 0;
    if (/(circuit|track|layout|course|ring|strecke|map)/.test(k)) s += 2;
    for (const w of words) if (k.includes(w)) s += 3;
    if (/(rallycross|worldrx|moto|kart|drag|oval|endurance|formula ?e\b|formulae)/.test(k)) s -= 6;
    const years = [...k.matchAll(/(19[0-9]{2}|20[0-9]{2})/g)].map((m) => Number(m[1]));
    if (years.some((y) => y < 1950)) s -= 4;
    if (f1Years && years.length) {
      const inRange = years.some((y) => y >= f1Years[0] - 2 && y <= f1Years[1] + 2);
      s += inRange ? 2 : -3;
      s += Math.max(...years) / 100000; // tie-break: most recent layout
    }
    return s;
  };
  const best = svgs.map((f) => ({ f, s: score(f) })).filter((x) => x.s >= 3).sort((a, b) => b.s - a.s)[0];
  return best?.f ?? null;
}

/**
 * Lead image of each Wikipedia article (prop=pageimages). Used as a fallback when
 * Wikidata has no P18. Non-free files live on en.wikipedia only, so they are absent
 * from Commons and get rejected by the Commons licence check that follows.
 */
export async function wikipediaLeadImages(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({ action: "query", format: "json", prop: "pageimages", piprop: "name", pilimit: "50", redirects: "1", titles: batch.join("|") });
    const data = await fetchJson<{ query?: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages?: Record<string, { title: string; pageimage?: string }> } }>(`${WP}?${params}`, { namespace: "wikipedia" });
    const q = data.query ?? {};
    const follow = new Map<string, string>();
    for (const n of q.normalized ?? []) follow.set(n.from, n.to);
    for (const r of q.redirects ?? []) follow.set(r.from, r.to);
    const byTitle = new Map(Object.values(q.pages ?? {}).map((p) => [p.title, p.pageimage]));
    for (const t of batch) {
      let final = t;
      for (let hop = 0; hop < 3 && follow.has(final); hop++) final = follow.get(final)!;
      const img = byTitle.get(final);
      if (img) out.set(t, img.replace(/_/g, " "));
    }
  }
  return out;
}


/** Full-text search of Commons file pages; returns file names (no "File:" prefix). */
export async function commonsSearch(query: string, limit = 20): Promise<string[]> {
  const params = new URLSearchParams({ action: "query", format: "json", list: "search", srnamespace: "6", srlimit: String(limit), srsearch: query });
  const data = await fetchJson<{ query?: { search?: { title: string }[] } }>(`${COMMONS}?${params}`, { namespace: "commons-search" });
  return (data.query?.search ?? []).map((s) => s.title.replace(/^File:/, ""));
}
