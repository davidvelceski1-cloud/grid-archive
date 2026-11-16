/**
 * Decide whether a Commons file name shows a given chassis. A file only qualifies
 * when it names the make AND the exact model ("McLaren M23", "Lotus 25", "Brawn BGP 001"),
 * so a search hit for a different car of the same make is never used.
 */
const MAKE_WORDS = ["aston martin", "racing bulls", "alpine", "haas", "audi", "cadillac", "alfa romeo", "mercedes-benz", "mercedes", "red bull", "lancia-ferrari", "lancia", "ferrari", "maserati", "vanwall", "cooper", "brm", "lotus", "brabham", "matra", "tyrrell", "mclaren", "williams", "benetton", "renault", "brawn"];

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['"‘’“”]/g, "").replace(/\.(jpe?g|png)$/i, "");
}

export interface CarPattern {
  makes: string[];
  model: string; // normalised model token, e.g. "mp4/4", "312t2", "bgp 001"
  modelRe: RegExp; // exact model
  baseRe: RegExp | null; // model without a trailing variant letter (FW07B → FW07)
}

export function carPattern(name: string): CarPattern {
  const n = norm(name).replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const makes = MAKE_WORDS.filter((m) => n.includes(m));
  let rest = n;
  for (const m of [...makes].sort((a, b) => b.length - a.length)) rest = rest.replace(m, " ");
  // Drop marketing suffixes that file names rarely include.
  rest = rest.replace(/eq power\+?|eq performance|e performance/g, " ").replace(/\b(f1|hybrid|sharknose|fan car)\b/g, " ").replace(/\s+/g, " ").trim();
  const model = rest;
  // Separators are optional, both where the name has them and wherever letters meet digits
  // ("312T2" ≈ "312 T2", "MP4/4" ≈ "MP4-4", "BGP 001" ≈ "BGP001").
  const esc = (s: string) =>
    s
      .replace(/[\s/\-]+/g, " ")
      .replace(/([a-z])([0-9])|([0-9])([a-z])/g, (_m, a, b, c, d) => (a ? `${a} ${b}` : `${c} ${d}`))
      .split(" ")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s/\\-_]*");
  const modelRe = new RegExp(`(^|[^a-z0-9])${esc(model)}($|[^a-z0-9])`);
  const base = model.replace(/([0-9])[a-z]$/, "$1");
  const baseRe = base !== model ? new RegExp(`(^|[^a-z0-9])${esc(base)}($|[^a-z0-9])`) : null;
  const searchable = makes.length ? makes.map((m) => m.split(/[\s-]/)[0]) : [];
  return { makes: searchable, model, modelRe, baseRe };
}

/** 0 = not this car; higher is better (exact model beats the base model). */
export function scoreCarFile(file: string, p: CarPattern): number {
  const f = norm(file).replace(/_/g, " ");
  if (p.makes.length && !p.makes.some((m) => f.includes(m))) return 0;
  if (/(logo|badge|emblem|engine|motor|cockpit|steering|wheel|model|lego|replica|toy|diecast|scale|1:\d+|poster|stamp)/.test(f)) return 0;
  // Parts and road cars are never the racing car itself.
  if (/(fuel tank|rear wing|front wing|sidepod|\bnose\b|\bnase\b|gearbox|suspension|brake|diffuser|exhaust|dashboard|detail|mondial|spyder|spider|barchetta|berlinetta|coupe|sedan|saloon|autokarna|\bgt\b|fossil|dinosaur|vorderrad|hinterrad|lenkrad|reifen)/.test(f)) return 0;
  // A plain-number model ("003", "25", "158") must directly follow the make, so catalogue
  // numbers elsewhere in a file name ("TMP 2009.003") don't count.
  if (/^[0-9]+$/.test(p.model) && !p.makes.some((m) => new RegExp(`${m}([\\s\\-]+[a-z]+)?[\\s\\-_]*${p.model}($|[^0-9])`).test(f))) return 0;
  if (p.modelRe.test(f)) return 3;
  if (p.baseRe?.test(f)) return 1;
  return 0;
}
