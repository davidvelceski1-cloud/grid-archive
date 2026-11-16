/**
 * Hand-reviewed Wikimedia Commons photos for teams whose Wikidata entry has no
 * usable image (P18). Each file was chosen by an editor from Commons search
 * results and shows that constructor's own car. Licences are still checked at
 * ingestion time (CC0 / Public Domain / CC BY / CC BY-SA only).
 */
export const TEAM_IMAGE_OVERRIDES: Record<string, string> = {
  ligier: "1981 Ligier JS17, Silverstone 2015 (David Merrett).jpg",
  haas: "Romain Grosjean Haas VF-18 Barcelona testing.jpg",
  force_india: "2009 Force India VJM 02.jpg",
  aston_martin: "FIA F1 Austria 2023 Nr. 14 (1).jpg",
  toyota: "Toyota F1 car (4022008664).jpg",
  alpine: "FIA F1 Austria 2024 Nr. 10 Gasly (side).jpg",
  surtees: "S18.10.54 - Formel 1 - 34 - Surtees TS-11, 1971 - Tony Trimmer - paddock - DSC 2162 Optimizer (37944088012).jpg",
  larrousse: "Manoir de l'Automobile - 195 - F1 Lola Larousse LC 89 V12 Lamborghini.jpg",
  ats: "Keke Rosberg - ATS HS1 leads Patrick Depailler - Tyrrell 008 at Druids at the 1978 British Grand Prix (50050266816).jpg",
  footwork: "Motor-Sport-Museum am Hockenheimring, 1991 Footwork Porsche A11C, pic1.jpg",
  honda: "Honda RA300 front-left Honda Collection Hall.jpg",
  jaguar: "Jaguar R3 2002 Irvine.jpg",
  toleman: "Toleman TG184 at Goodwood 2014 001.jpg",
  manor: "Pascal Wehrlein - Manor Racing Team MRT05 (30056222506).jpg",
  lotus_racing: "Lotus T127 Circuit de Catalunya (25-02-2010).jpg",
  iso_marlboro: "Iso-Marlboro Williams Pescarolo GP73FR.jpg",
  rial: "F1 1988, Rial ARC1, Spa Francorchamps (55425564171) (cropped).jpg",
  cadillac: "CADILLAC MAC-26.jpg",
  audi: "Nico Hülkenberg Audi R26 2026.jpg",
  fondmetal: "1992 Andrea Chiesa Fondmetal.jpg",
  parnelli: "Mario Andretti's Parnelli VPJ-4, 1975 British Grand Prix.jpg",
  mf1: "MidlandF1 China 2006.jpg",
  tecno: "1972 Tecno PA123 (19807884464).jpg",
  watson: "Watson-Offenhauser 1962 Indy 500 Winner - Rodger Ward.jpg",
  tomaso: "De Tomaso 505 F1 1970 (7137059557).jpg",
  era: "ERA E-type at Goodwood Revival 2012.jpg",
  boro: "-33 - Ensign MN175 - 1975.jpg",
  stevens: "Stevens- Offenhauser 1951.jpg",
  veritas: "Veritas Meteor.jpg",
  trevis: "A.J. Foyt Trevis-Offy (2534474648).jpg",
  frazer_nash: "1952 Frazer Nash Le Mans Replica.jpg",
  lancia: "Lancia D50 at Goodwood Revival 2012.jpg",
  osca: "OSCA MT4 (1955) (5066831265).jpg",
  gilby: "Gilby-Climax from 1961 at the Goodwood Revival, 2014.jpg",
  token: "Token RJ02., Goodwood Members' Meeting 2015.jpg",
  moda: "Andrea-Moda-S921-MC.jpg",
  "tec-mec": "Maserati TecMec.jpg",
  bugatti: "Bugatti GP Type 251.jpg",
  connew: "Connew PC1-Cosworth.jpg",
  // Replacements for Wikidata images that are not the team's F1 car (HQ buildings,
  // road cars, other racing series, emblems). "car:<id>" reuses a car-register photo.
  ferrari: "car:ferrari-f2004",
  red_bull: "car:red-bull-rb19",
  tyrrell: "car:tyrrell-003",
  maserati: "car:maserati-250f",
  matra: "car:matra-ms80",
  vanwall: "car:vanwall-vw5",
  dallara: "Dallara 191 Brands Hatch 2018 (30627329587).jpg",
  simca: "Simca-Gordini T15.jpg",
  lago: "Talbot-Lago T26C Rozier 1951.jpeg",
  porsche: "Porsche 804 at Goodwood 2010.jpg",
  penske: "Penske PC3 2001 Silverstone Classic.jpg",
  pacific: "Bertrand Gachot - Pacific PR01 at the 1994 British Grand Prix (32418697731).jpg",
  coloni: "Coloni FC188B 2008 Donington Park.jpg",
  simtek: "Jean-Marc Gounon - Simtek S941 at the 1994 British Grand Prix (31729354513).jpg",
  minardi: "Fernando Alonso, Minardi PS01 (8968566453).jpg",
  hwm: "HWM 1952 at Silverstone Classic 2011.jpg",
};

/**
 * Teams whose only available pictures are not their F1 car (road cars, sports cars,
 * emblems, other series). They skip automatic sources and use the driver-portrait /
 * circuit fallback instead.
 */
export const NO_TEAM_PHOTO = ["martini", "politoys", "bellasi", "bmw", "alta", "emw"];
