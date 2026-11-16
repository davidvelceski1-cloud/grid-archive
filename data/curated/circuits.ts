/** Curated circuit metadata keyed by Jolpica circuitId. Unlisted circuits default to PERMANENT. */
export const CIRCUIT_TYPE: Record<string, "STREET" | "ROAD"> = {
  monaco: "STREET",
  adelaide: "STREET",
  detroit: "STREET",
  dallas: "STREET",
  long_beach: "STREET",
  phoenix: "STREET",
  valencia: "STREET",
  marina_bay: "STREET",
  baku: "STREET",
  jeddah: "STREET",
  miami: "STREET",
  vegas: "STREET",
  las_vegas: "STREET",
  albert_park: "STREET",
  villeneuve: "STREET",
  madring: "STREET",
  pedralbes: "STREET",
  boavista: "STREET",
  montjuic: "ROAD",
  monsanto: "ROAD",
  "ain-diab": "ROAD",
  pescara: "ROAD",
  reims: "ROAD",
  essarts: "ROAD",
  charade: "ROAD",
  bremgarten: "ROAD",
  avus: "ROAD",
  spa: "ROAD",
  george: "ROAD",
  sebring: "ROAD",
};

/** Current-layout length (km) and turn count for recent venues. */
export const CIRCUIT_SPECS: Record<string, { lengthKm: number; turns: number }> = {
  bahrain: { lengthKm: 5.412, turns: 15 },
  jeddah: { lengthKm: 6.174, turns: 27 },
  albert_park: { lengthKm: 5.278, turns: 14 },
  suzuka: { lengthKm: 5.807, turns: 18 },
  shanghai: { lengthKm: 5.451, turns: 16 },
  miami: { lengthKm: 5.412, turns: 19 },
  imola: { lengthKm: 4.909, turns: 19 },
  monaco: { lengthKm: 3.337, turns: 19 },
  catalunya: { lengthKm: 4.657, turns: 14 },
  villeneuve: { lengthKm: 4.361, turns: 14 },
  red_bull_ring: { lengthKm: 4.318, turns: 10 },
  silverstone: { lengthKm: 5.891, turns: 18 },
  hungaroring: { lengthKm: 4.381, turns: 14 },
  spa: { lengthKm: 7.004, turns: 19 },
  zandvoort: { lengthKm: 4.259, turns: 14 },
  monza: { lengthKm: 5.793, turns: 11 },
  baku: { lengthKm: 6.003, turns: 20 },
  marina_bay: { lengthKm: 4.94, turns: 19 },
  americas: { lengthKm: 5.513, turns: 20 },
  rodriguez: { lengthKm: 4.304, turns: 17 },
  interlagos: { lengthKm: 4.309, turns: 15 },
  vegas: { lengthKm: 6.201, turns: 17 },
  losail: { lengthKm: 5.419, turns: 16 },
  yas_marina: { lengthKm: 5.281, turns: 16 },
};

export interface LayoutSeed {
  name: string;
  fromYear: number;
  toYear: number | null;
  lengthKm?: number;
  notes: string;
}

/** Major layout eras for circuits whose configuration changed significantly. */
export const CIRCUIT_LAYOUTS: Record<string, LayoutSeed[]> = {
  spa: [
    { name: "Original road circuit", fromYear: 1950, toYear: 1970, lengthKm: 14.1, notes: "Public roads linking Francorchamps, Malmedy and Stavelot. Fast and dangerous; dropped after 1970 on safety grounds." },
    { name: "Shortened modern circuit", fromYear: 1983, toYear: null, lengthKm: 7.0, notes: "A new link section keeps Eau Rouge and Raidillon. It has been refined several times since." },
  ],
  nurburgring: [
    { name: "Nordschleife", fromYear: 1951, toYear: 1976, lengthKm: 22.8, notes: "The 'Green Hell'. F1 left after Niki Lauda's 1976 crash." },
    { name: "GP-Strecke", fromYear: 1984, toYear: null, lengthKm: 5.1, notes: "Modern circuit built beside the old track; used for the European, Luxembourg and Eifel Grands Prix." },
  ],
  monza: [
    { name: "Road course with banking", fromYear: 1955, toYear: 1961, lengthKm: 10.0, notes: "Combined the road circuit with the high-speed oval in 1955, 1956, 1960 and 1961." },
    { name: "Road course", fromYear: 1950, toYear: null, lengthKm: 5.8, notes: "Chicanes added from 1972 onwards. The circuit is still known as the 'Temple of Speed'." },
  ],
  hockenheimring: [
    { name: "Forest circuit", fromYear: 1970, toYear: 2001, lengthKm: 6.8, notes: "Long flat-out straights through the forest, broken up by chicanes." },
    { name: "Tilke redesign", fromYear: 2002, toYear: null, lengthKm: 4.6, notes: "The forest section was removed and a hairpin and new stadium complex were added." },
  ],
  interlagos: [
    { name: "Original circuit", fromYear: 1973, toYear: 1980, lengthKm: 7.96, notes: "A long, sweeping layout wrapped around itself." },
    { name: "Modern circuit", fromYear: 1990, toYear: null, lengthKm: 4.3, notes: "Shortened layout including the Senna 'S'." },
  ],
  silverstone: [
    { name: "Airfield perimeter", fromYear: 1950, toYear: 1990, lengthKm: 4.7, notes: "Very fast layout on the perimeter roads of a wartime airfield." },
    { name: "Arena layout", fromYear: 2010, toYear: null, lengthKm: 5.9, notes: "New 'Arena' infield section; the pit complex moved to the Wing in 2011." },
  ],
  red_bull_ring: [
    { name: "Österreichring", fromYear: 1970, toYear: 1987, lengthKm: 5.9, notes: "A spectacularly fast circuit through the Styrian hills." },
    { name: "A1-Ring / Red Bull Ring", fromYear: 1997, toYear: null, lengthKm: 4.3, notes: "Shortened by Hermann Tilke; the circuit returned as the Red Bull Ring in 2014." },
  ],
};
