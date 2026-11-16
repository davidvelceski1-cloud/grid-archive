/**
 * Curated constructor metadata and lineage. Keys are Jolpica constructorIds.
 * Everything here is editable later in /admin; ingestion only fills empty fields
 * on re-runs, so manual edits are not overwritten (see scripts/ingest-curated.ts).
 */

/** Jolpica splits some early teams by engine (e.g. "brabham-repco"). We fold
 *  them into one canonical team and keep the engine on each result. */
const COMPOUND_PARENTS: Record<string, string> = {
  brabham: "brabham",
  cooper: "cooper",
  eagle: "eagle",
  lotus: "team_lotus",
  march: "march",
  mclaren: "mclaren",
  matra: "matra",
  shadow: "shadow",
  de_tomaso: "de_tomaso",
  lds: "lds",
  brm: "brm",
};

export function canonicalConstructor(id: string): { id: string; engine: string | null } {
  const dash = id.indexOf("-");
  if (dash > 0) {
    const prefix = id.slice(0, dash);
    const parent = COMPOUND_PARENTS[prefix];
    if (parent) {
      const engine = id
        .slice(dash + 1)
        .split("_")
        .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
        .join(" ");
      return { id: parent, engine };
    }
  }
  return { id, engine: null };
}

/** Display names for canonical ids that do not exist as plain Jolpica records. */
export const SYNTHETIC_CONSTRUCTORS: Record<string, { name: string; nationality: string }> = {
  de_tomaso: { name: "De Tomaso", nationality: "Italian" },
};

/** Override the public URL slug where the Jolpica id is not friendly. */
export const SLUG_OVERRIDES: Record<string, string> = {
  team_lotus: "lotus",
  lotus_f1: "lotus-f1",
  lotus_racing: "lotus-racing",
  alfa: "alfa-romeo",
  rb: "racing-bulls",
  mf1: "midland",
  spyker_mf1: "spyker-mf1",
};

export interface TeamMeta {
  color?: string;
  founded?: number;
  base?: string;
  founder?: string;
  whyDisappeared?: string;
}

export const TEAM_META: Record<string, TeamMeta> = {
  ferrari: { color: "#DC0000", founded: 1929, base: "Maranello, Italy", founder: "Enzo Ferrari" },
  mclaren: { color: "#FF8000", founded: 1963, base: "Woking, United Kingdom", founder: "Bruce McLaren" },
  williams: { color: "#005AFF", founded: 1977, base: "Grove, United Kingdom", founder: "Frank Williams & Patrick Head" },
  mercedes: { color: "#00D2BE", founded: 1954, base: "Brackley, United Kingdom", founder: "Daimler-Benz (works team revived 2010)" },
  red_bull: { color: "#1E41FF", founded: 2005, base: "Milton Keynes, United Kingdom", founder: "Dietrich Mateschitz" },
  aston_martin: { color: "#006F62", founded: 2021, base: "Silverstone, United Kingdom", founder: "Lawrence Stroll (consortium)" },
  alpine: { color: "#0090FF", founded: 2021, base: "Enstone, United Kingdom", founder: "Groupe Renault" },
  haas: { color: "#B6BABD", founded: 2014, base: "Kannapolis, USA / Banbury, UK", founder: "Gene Haas" },
  rb: { color: "#6692FF", founded: 2024, base: "Faenza, Italy", founder: "Red Bull GmbH" },
  sauber: { color: "#52E252", founded: 1970, base: "Hinwil, Switzerland", founder: "Peter Sauber" },
  audi: { color: "#BB0A30", founded: 2026, base: "Hinwil, Switzerland / Neuburg, Germany", founder: "Audi AG" },
  cadillac: { color: "#C9A227", founded: 2026, base: "Fishers, USA / Silverstone, UK", founder: "TWG Motorsports & General Motors" },
  team_lotus: {
    color: "#0B5D3B",
    founded: 1952,
    base: "Hethel, United Kingdom",
    founder: "Colin Chapman",
    whyDisappeared:
      "After Colin Chapman's death in 1982, results faded and sponsorship dwindled. Team Lotus entered administration during the 1994 season and did not return for 1995. Its assets were partly absorbed by Pacific.",
  },
  brabham: {
    color: "#2E5E3E",
    founded: 1960,
    base: "Chessington, United Kingdom",
    founder: "Jack Brabham & Ron Tauranac",
    whyDisappeared:
      "Bernie Ecclestone sold the team in 1988. A string of owners followed, ending with Middlebridge, whose finances collapsed in 1992 amid legal disputes. Brabham folded after the 1992 Hungarian Grand Prix.",
  },
  cooper: {
    color: "#1D4D2F",
    founded: 1947,
    base: "Surbiton, United Kingdom",
    founder: "Charles & John Cooper",
    whyDisappeared:
      "Cooper pioneered the mid-engine layout but lost ground to monocoque designs such as the Lotus 25. Sponsorship ran out and the team withdrew after 1968.",
  },
  vanwall: {
    color: "#0F5132",
    founded: 1954,
    base: "Acton, United Kingdom",
    founder: "Tony Vandervell",
    whyDisappeared:
      "Vanwall won the first Constructors' Championship in 1958, but Tony Vandervell's health declined after Stuart Lewis-Evans was fatally injured at the final race. The team scaled back after 1958 and made its last appearance in 1960.",
  },
  brm: {
    color: "#264D36",
    founded: 1945,
    base: "Bourne, United Kingdom",
    founder: "Raymond Mays & Peter Berthon",
    whyDisappeared:
      "After the 1962 title with Graham Hill, BRM declined through the 1970s under the Owen Organisation and later as Stanley-BRM. It ran out of money and made its last appearance in 1977.",
  },
  tyrrell: {
    color: "#0047AB",
    founded: 1958,
    base: "Ockham, United Kingdom",
    founder: "Ken Tyrrell",
    whyDisappeared:
      "Tyrrell had no works engine deal and too little sponsorship in the 1990s. Ken Tyrrell sold the team to British American Tobacco in 1997, and it raced as BAR from 1999.",
  },
  march: {
    color: "#C8102E",
    founded: 1969,
    base: "Bicester, United Kingdom",
    founder: "Max Mosley, Alan Rees, Graham Coaker & Robin Herd",
    whyDisappeared:
      "March raced as Leyton House in 1990–91, then reverted to March for 1992. The team ran out of funds before the 1993 season.",
  },
  ligier: {
    color: "#0055A4",
    founded: 1968,
    base: "Magny-Cours, France",
    founder: "Guy Ligier",
    whyDisappeared: "Alain Prost bought Ligier in early 1997 and renamed it Prost Grand Prix.",
  },
  arrows: {
    color: "#F18A00",
    founded: 1977,
    base: "Leafield, United Kingdom",
    founder: "Franco Ambrosio, Alan Rees, Jackie Oliver, Dave Wass & Tony Southgate",
    whyDisappeared:
      "Arrows never won a race. Its finances deteriorated under Tom Walkinshaw, the team missed races during the 2002 season, and it went into liquidation before 2003.",
  },
  minardi: {
    color: "#1A1A1A",
    founded: 1979,
    base: "Faenza, Italy",
    founder: "Giancarlo Minardi",
    whyDisappeared:
      "Paul Stoddart sold Minardi to Red Bull in 2005, and it became Scuderia Toro Rosso for 2006.",
  },
  jordan: {
    color: "#F9D71C",
    founded: 1991,
    base: "Silverstone, United Kingdom",
    founder: "Eddie Jordan",
    whyDisappeared: "Eddie Jordan sold the team to the Midland Group in 2005, and it raced as MF1 Racing in 2006.",
  },
  stewart: {
    color: "#FFFFFF",
    founded: 1997,
    base: "Milton Keynes, United Kingdom",
    founder: "Jackie & Paul Stewart",
    whyDisappeared: "Ford bought the team in 1999 and rebranded it as Jaguar Racing for 2000.",
  },
  jaguar: {
    color: "#004225",
    founded: 2000,
    base: "Milton Keynes, United Kingdom",
    founder: "Ford Motor Company",
    whyDisappeared: "Ford decided to leave F1 and sold the team to Red Bull for a nominal sum in late 2004.",
  },
  bar: {
    color: "#E8E8E8",
    founded: 1999,
    base: "Brackley, United Kingdom",
    founder: "British American Tobacco & Craig Pollock",
    whyDisappeared: "Honda took full ownership for 2006 as tobacco advertising bans tightened.",
  },
  honda: {
    color: "#CC0000",
    founded: 2006,
    base: "Brackley, United Kingdom",
    founder: "Honda Motor Company",
    whyDisappeared:
      "Honda withdrew in December 2008, citing the global financial crisis. Ross Brawn led a management buy-out that became Brawn GP.",
  },
  brawn: {
    color: "#D7F24A",
    founded: 2009,
    base: "Brackley, United Kingdom",
    founder: "Ross Brawn",
    whyDisappeared:
      "Brawn GP won both 2009 titles in its only season, then Mercedes-Benz bought it and it became the Mercedes works team from 2010.",
  },
  toyota: {
    color: "#CC0000",
    founded: 2002,
    base: "Cologne, Germany",
    founder: "Toyota Motor Corporation",
    whyDisappeared:
      "Toyota spent heavily for eight seasons without a win and withdrew at the end of 2009 during the global financial crisis.",
  },
  super_aguri: {
    color: "#E60012",
    founded: 2006,
    base: "Leafield, United Kingdom",
    founder: "Aguri Suzuki",
    whyDisappeared:
      "Super Aguri ran Honda-supported cars, but a planned sale fell through and Honda stopped funding it. The team withdrew after the 2008 Spanish Grand Prix, four races into the season.",
  },
  spyker: {
    color: "#FF6600",
    founded: 2007,
    base: "Silverstone, United Kingdom",
    founder: "Spyker Cars",
    whyDisappeared: "Spyker sold the team to Vijay Mallya and Michiel Mol, and it became Force India for 2008.",
  },
  mf1: { color: "#B5121B", founded: 2006, base: "Silverstone, United Kingdom", founder: "Alex Shnaider (Midland Group)" },
  force_india: {
    color: "#F596C8",
    founded: 2008,
    base: "Silverstone, United Kingdom",
    founder: "Vijay Mallya & Michiel Mol",
    whyDisappeared:
      "Force India entered administration in mid-2018. A consortium led by Lawrence Stroll bought its assets, and it continued as Racing Point.",
  },
  racing_point: { color: "#F596C8", founded: 2018, base: "Silverstone, United Kingdom", founder: "Lawrence Stroll (consortium)" },
  toro_rosso: { color: "#1E3D8F", founded: 2006, base: "Faenza, Italy", founder: "Red Bull GmbH" },
  alphatauri: { color: "#2B4562", founded: 2020, base: "Faenza, Italy", founder: "Red Bull GmbH" },
  hrt: {
    color: "#8B6914",
    founded: 2010,
    base: "Madrid, Spain",
    founder: "José Ramón Carabante",
    whyDisappeared:
      "HRT was underfunded and failed to qualify on several occasions. It was sold to Thesan Capital in 2011 and folded when no buyer was found before the 2013 entry deadline.",
  },
  caterham: {
    color: "#005030",
    founded: 2012,
    base: "Leafield, United Kingdom",
    founder: "Tony Fernandes",
    whyDisappeared:
      "Tony Fernandes sold the team in 2014, and it entered administration that October. It missed two races, returned for the 2014 finale with crowd-funding, and never raced again.",
  },
  lotus_racing: { color: "#005030", founded: 2010, base: "Hingham, United Kingdom", founder: "Tony Fernandes" },
  virgin: { color: "#CC0000", founded: 2010, base: "Dinnington, United Kingdom", founder: "Manor Grand Prix with Virgin Group backing" },
  marussia: {
    color: "#6E0000",
    founded: 2012,
    base: "Banbury, United Kingdom",
    founder: "Marussia Motors",
    whyDisappeared:
      "Marussia entered administration in late 2014 after Jules Bianchi's accident and financial collapse. It was rescued as Manor for 2015.",
  },
  manor: {
    color: "#ED1C24",
    founded: 2016,
    base: "Banbury, United Kingdom",
    founder: "Stephen Fitzpatrick",
    whyDisappeared:
      "Manor entered administration in January 2017 after missing out on tenth place, and the prize money that came with it, in the 2016 Constructors' Championship. No buyer was found.",
  },
  lotus_f1: { color: "#000000", founded: 2012, base: "Enstone, United Kingdom", founder: "Genii Capital" },
  renault: { color: "#FFF500", founded: 1977, base: "Enstone, UK / Viry-Châtillon, France", founder: "Régie Renault" },
  benetton: {
    color: "#00A651",
    founded: 1986,
    base: "Enstone, United Kingdom",
    founder: "Benetton Group",
    whyDisappeared: "Renault bought the team in 2000 and rebranded it as Renault F1 from 2002.",
  },
  toleman: {
    color: "#1C5BA8",
    founded: 1981,
    base: "Witney, United Kingdom",
    founder: "Ted Toleman",
    whyDisappeared: "The Benetton family, previously its sponsor, bought the team, and it became Benetton Formula for 1986.",
  },
  prost: {
    color: "#002395",
    founded: 1997,
    base: "Guyancourt, France",
    founder: "Alain Prost",
    whyDisappeared:
      "Prost Grand Prix struggled for results and money despite Peugeot engines. It went into liquidation in early 2002.",
  },
  bmw_sauber: { color: "#FFFFFF", founded: 2006, base: "Hinwil, Switzerland", founder: "BMW AG" },
  // Jolpica uses one id for the 1950–51 & 1979–85 works team and the 2019–23 Sauber-run entry.
  alfa: {
    color: "#900000",
    founded: 1910,
    base: "Milan, Italy (works team) · Hinwil, Switzerland (2019–23)",
    founder: "A.L.F.A. (Anonima Lombarda Fabbrica Automobili)",
  },
  matra: {
    color: "#1C3F94",
    founded: 1965,
    base: "Vélizy, France",
    founder: "Jean-Luc Lagardère (Matra Sports)",
    whyDisappeared: "Matra won the 1969 title with Ken Tyrrell, then ran its own team until 1972 before concentrating on sports cars and engine supply.",
  },
  hesketh: {
    color: "#FFFFFF",
    founded: 1973,
    base: "Easton Neston, United Kingdom",
    founder: "Lord Alexander Hesketh",
    whyDisappeared: "Lord Hesketh ran out of money after James Hunt's 1975 Dutch Grand Prix win. Reduced efforts continued until 1978.",
  },
  wolf: {
    color: "#1C2B4D",
    founded: 1977,
    base: "Reading, United Kingdom",
    founder: "Walter Wolf",
    whyDisappeared: "Walter Wolf sold his assets to Fittipaldi Automotive at the end of 1979.",
  },
  shadow: {
    color: "#111111",
    founded: 1973,
    base: "Northampton, United Kingdom",
    founder: "Don Nichols",
    whyDisappeared: "After key staff left to found Arrows in 1977, Shadow faded and sold out to Theodore Racing during 1980.",
  },
  ensign: { color: "#C8102E", founded: 1973, base: "Walsall, United Kingdom", founder: "Morris Nunn" },
  surtees: { color: "#E31B23", founded: 1970, base: "Edenbridge, United Kingdom", founder: "John Surtees" },
  lola: { color: "#8B0000", founded: 1958, base: "Huntingdon, United Kingdom", founder: "Eric Broadley" },
  maserati: { color: "#002D72", founded: 1914, base: "Modena, Italy", founder: "The Maserati brothers" },
  lancia: { color: "#003399", founded: 1906, base: "Turin, Italy", founder: "Vincenzo Lancia" },
  gordini: { color: "#1C5BA8", founded: 1946, base: "Paris, France", founder: "Amédée Gordini" },
  porsche: { color: "#B0B4BA", founded: 1931, base: "Stuttgart, Germany", founder: "Ferdinand Porsche" },
  bmw: { color: "#0066B1" },
  zakspeed: { color: "#FFFFFF", founded: 1968, base: "Niederzissen, Germany", founder: "Erich Zakowski" },
  larrousse: { color: "#2E3B8F", founded: 1987, base: "Antony, France", founder: "Gérard Larrousse" },
  footwork: { color: "#F18A00" },
  leyton: { color: "#5BC2E7" },
  onyx: { color: "#2A62B4" },
  pacific: { color: "#3C2A6E" },
  simtek: { color: "#4B2C83" },
  forti: { color: "#FFD700" },
};

export interface LineageEdge {
  from: string;
  to: string;
  year: number;
  kind: "renamed" | "bought" | "rebranded" | "merged";
  note?: string;
}

/** Ownership / naming lineage. Cycles are allowed (e.g. Sauber → BMW Sauber → Sauber). */
export const LINEAGE: LineageEdge[] = [
  { from: "tyrrell", to: "bar", year: 1999, kind: "bought", note: "Bought by British American Tobacco in 1997; raced as BAR from 1999" },
  { from: "bar", to: "honda", year: 2006, kind: "bought", note: "Honda took full ownership" },
  { from: "honda", to: "brawn", year: 2009, kind: "bought", note: "Management buy-out led by Ross Brawn" },
  { from: "brawn", to: "mercedes", year: 2010, kind: "bought", note: "Acquired by Daimler / Aabar" },
  { from: "jordan", to: "mf1", year: 2006, kind: "bought", note: "Sold to the Midland Group" },
  { from: "mf1", to: "spyker_mf1", year: 2006, kind: "bought", note: "Spyker took over late in 2006" },
  { from: "spyker_mf1", to: "spyker", year: 2007, kind: "renamed" },
  { from: "spyker", to: "force_india", year: 2008, kind: "bought", note: "Bought by Vijay Mallya and Michiel Mol" },
  { from: "force_india", to: "racing_point", year: 2018, kind: "bought", note: "Rescued from administration by a Lawrence Stroll consortium" },
  { from: "racing_point", to: "aston_martin", year: 2021, kind: "rebranded" },
  { from: "minardi", to: "toro_rosso", year: 2006, kind: "bought", note: "Sold to Red Bull" },
  { from: "toro_rosso", to: "alphatauri", year: 2020, kind: "rebranded" },
  { from: "alphatauri", to: "rb", year: 2024, kind: "rebranded" },
  { from: "stewart", to: "jaguar", year: 2000, kind: "bought", note: "Bought by Ford" },
  { from: "jaguar", to: "red_bull", year: 2005, kind: "bought", note: "Sold to Red Bull" },
  { from: "toleman", to: "benetton", year: 1986, kind: "bought" },
  { from: "benetton", to: "renault", year: 2002, kind: "bought", note: "Purchased by Renault in 2000" },
  { from: "renault", to: "lotus_f1", year: 2012, kind: "rebranded", note: "Genii Capital ownership, Lotus branding" },
  { from: "lotus_f1", to: "renault", year: 2016, kind: "bought", note: "Renault bought the team back" },
  { from: "renault", to: "alpine", year: 2021, kind: "rebranded" },
  { from: "sauber", to: "bmw_sauber", year: 2006, kind: "bought" },
  { from: "bmw_sauber", to: "sauber", year: 2010, kind: "bought", note: "Peter Sauber bought the team back" },
  { from: "sauber", to: "alfa", year: 2019, kind: "rebranded", note: "Alfa Romeo naming partnership" },
  { from: "alfa", to: "sauber", year: 2024, kind: "rebranded", note: "Raced as Kick Sauber" },
  { from: "sauber", to: "audi", year: 2026, kind: "bought", note: "Audi factory team" },
  { from: "virgin", to: "marussia", year: 2012, kind: "rebranded" },
  { from: "marussia", to: "manor", year: 2016, kind: "renamed", note: "Rescued from administration in 2015" },
  { from: "lotus_racing", to: "caterham", year: 2012, kind: "rebranded" },
  { from: "ligier", to: "prost", year: 1997, kind: "bought", note: "Bought by Alain Prost" },
  { from: "arrows", to: "footwork", year: 1991, kind: "renamed", note: "Footwork Corporation ownership" },
  { from: "footwork", to: "arrows", year: 1997, kind: "renamed", note: "Tom Walkinshaw era" },
  { from: "march", to: "leyton", year: 1990, kind: "renamed", note: "Leyton House ownership" },
  { from: "leyton", to: "march", year: 1992, kind: "renamed" },
];

/** National racing colours used when a team has no curated colour. */
export const NATIONAL_COLOURS: Record<string, string> = {
  British: "#1F5F3F",
  Italian: "#B3001B",
  French: "#1E4FA0",
  German: "#9AA0A6",
  American: "#E8E8E8",
  Swiss: "#C8102E",
  Japanese: "#E60012",
  Austrian: "#D52B1E",
  Dutch: "#FF6600",
  Australian: "#00843D",
  Brazilian: "#009C3B",
  Spanish: "#C60B1E",
  Belgian: "#F4D03F",
  Canadian: "#D52B1E",
  "New Zealander": "#111111",
  "South African": "#007749",
  Indian: "#FF9933",
  Russian: "#0039A6",
  Irish: "#169B62",
  "Hong Kong": "#DE2910",
  Malaysian: "#010066",
  Mexican: "#006847",
};

/**
 * Notable episodes the results data cannot explain on its own. Each line becomes
 * a fact on the team's fact sheet (articles and Ask the Archive use it).
 */
export const TEAM_NOTES: Record<string, string[]> = {
  tyrrell: [
    "In 1984 Tyrrell was excluded from the World Championship and every one of its results that season was annulled. After the Detroit Grand Prix, scrutineers examined the water tank that was topped up during a late pit stop and found lead ballast in it, which meant the car had run below the minimum weight for most of the race. FISA ruled the car illegal, stripped all of Tyrrell's 1984 results and barred the team from the final rounds of the season. Tyrrell was then the only team still using a naturally aspirated Cosworth engine, and the case was widely seen as part of a wider political dispute over fuel limits for the turbo teams.",
  ],
};
