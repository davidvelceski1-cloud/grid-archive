/** Text helpers shared by the app and the ingestion scripts. */

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slugify(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lower-case, accent-free search key. */
export function searchKey(s: string): string {
  return stripAccents(s).toLowerCase().replace(/\s+/g, " ").trim();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC", ...opts });
}

export function formatPoints(p: number): string {
  return Number.isInteger(p) ? String(p) : p.toFixed(1).replace(/\.0$/, "");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function ageAt(birth: Date | null | undefined, at: Date): number | null {
  if (!birth) return null;
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const m = at.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

/** Years + days, e.g. "19 years, 214 days". */
export function preciseAge(birth: Date, at: Date): { years: number; days: number; label: string } {
  const years = ageAt(birth, at)!;
  const anniversary = new Date(Date.UTC(birth.getUTCFullYear() + years, birth.getUTCMonth(), birth.getUTCDate()));
  const days = Math.round((at.getTime() - anniversary.getTime()) / 86_400_000);
  return { years, days, label: `${years} years, ${days} days` };
}

const DEMONYM_TO_ISO: Record<string, string> = {
  American: "US", Argentine: "AR", Argentinian: "AR", Australian: "AU", Austrian: "AT", Belgian: "BE",
  Brazilian: "BR", British: "GB", Canadian: "CA", Chilean: "CL", Chinese: "CN", Colombian: "CO",
  Czech: "CZ", Danish: "DK", Dutch: "NL", "East German": "DE", Finnish: "FI", French: "FR", German: "DE",
  Hungarian: "HU", Indian: "IN", Indonesian: "ID", Irish: "IE", Italian: "IT", Japanese: "JP",
  Liechtensteiner: "LI", Malaysian: "MY", Mexican: "MX", Monegasque: "MC", "New Zealander": "NZ",
  Polish: "PL", Portuguese: "PT", Rhodesian: "ZW", Russian: "RU", "South African": "ZA", Spanish: "ES",
  Swedish: "SE", Swiss: "CH", Thai: "TH", Uruguayan: "UY", Venezuelan: "VE", "Hong Kong": "HK",
  "Argentine-Italian": "AR", "American-Italian": "US", Moroccan: "MA",
};

const COUNTRY_TO_ISO: Record<string, string> = {
  UK: "GB", "United Kingdom": "GB", USA: "US", "United States": "US", UAE: "AE", "United Arab Emirates": "AE",
  Italy: "IT", France: "FR", Germany: "DE", Spain: "ES", Monaco: "MC", Belgium: "BE", Netherlands: "NL",
  Austria: "AT", Hungary: "HU", Switzerland: "CH", Portugal: "PT", Sweden: "SE", Brazil: "BR",
  Argentina: "AR", Mexico: "MX", Canada: "CA", Japan: "JP", China: "CN", Korea: "KR", "South Korea": "KR",
  India: "IN", Malaysia: "MY", Singapore: "SG", Bahrain: "BH", "Saudi Arabia": "SA", Qatar: "QA",
  Azerbaijan: "AZ", Russia: "RU", Turkey: "TR", Australia: "AU", "South Africa": "ZA", Morocco: "MA",
};

export function isoFromNationality(n?: string | null): string | null {
  return n ? DEMONYM_TO_ISO[n] ?? null : null;
}

export function isoFromCountry(c?: string | null): string | null {
  return c ? COUNTRY_TO_ISO[c] ?? null : null;
}

/** Regional-indicator flag emoji from an ISO-3166 alpha-2 code. */
export function flagEmoji(iso: string | null): string {
  if (!iso) return "";
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
