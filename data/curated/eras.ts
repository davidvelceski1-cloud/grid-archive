/** Hand-written era overviews. Editable later through /admin. */
export interface EraSeed {
  slug: string;
  name: string;
  startYear: number;
  endYear: number | null;
  tagline: string;
  summary: string;
  body: string;
}

export const ERAS: EraSeed[] = [
  {
    slug: "front-engine-pioneers",
    name: "Front-engine pioneers",
    startYear: 1950,
    endYear: 1960,
    tagline: "Supercharged Alfas, Fangio and the birth of a championship",
    summary:
      "The World Championship begins at Silverstone in 1950. Front-engined cars from Alfa Romeo, Ferrari, Maserati and Mercedes-Benz dominate, and Juan Manuel Fangio wins five titles with four different makes.",
    body: `## A championship is born
The first World Championship Grand Prix was held at Silverstone on 13 May 1950. Pre-war supercharged 1.5-litre Alfa Romeo 158s, the "Alfettas", won every race they started that year, and Giuseppe Farina became the first World Champion.

## Fangio's decade
Juan Manuel Fangio dominated the decade, winning titles with Alfa Romeo (1951), Mercedes-Benz (1954–55), Ferrari (1956) and Maserati (1957). Mercedes-Benz's W196, with fuel injection and desmodromic valves, set a new technical benchmark before the team withdrew after 1955.

## Rules and risk
The championship ran to Formula Two rules in 1952–53 while new 2.5-litre regulations were prepared for 1954. Circuits were open public roads or former airfields with straw bales and trees at the edge. Fatal accidents were common, and safety was mostly left to the drivers.

## The British arrive
Vanwall won the first Constructors' Championship in 1958, and the small Cooper team's mid-engined cars won in 1959 and 1960. Those Cooper wins effectively ended the front-engine era.`,
  },
  {
    slug: "the-garagistes",
    name: "The garagistes",
    startYear: 1961,
    endYear: 1967,
    tagline: "Small British teams, big ideas: the rear-engine revolution",
    summary:
      "Enzo Ferrari dismissed the British specialists as 'garagistes', but Cooper, Lotus, BRM and Brabham rewrote car design. The 1.5-litre formula gives way to 3-litre engines in 1966.",
    body: `## The 1.5-litre formula
New rules for 1961 cut engines to 1.5 litres. Ferrari arrived ready with the "sharknose" 156, and Phil Hill became America's first World Champion.

## Monocoque and mastery
Colin Chapman's Lotus 25 of 1962 used a stressed monocoque chassis in place of a spaceframe. Jim Clark won seven of ten races with it in 1963 and became the era's reference driver.

## The return to power
The 3-litre formula arrived in 1966. Jack Brabham became the only driver to win a title in a car bearing his own name. The Ford-Cosworth DFV, first raced in the Lotus 49 at Zandvoort in 1967, would become the most successful engine in F1 history.`,
  },
  {
    slug: "wings-and-sponsorship",
    name: "Wings & sponsorship",
    startYear: 1968,
    endYear: 1976,
    tagline: "Aerodynamics, commercial liveries and the fight for safety",
    summary:
      "Gold Leaf colours on the Lotus 49 open the sponsorship age, wings sprout from cars, and drivers led by Jackie Stewart campaign for safer circuits.",
    body: `## Colour and commerce
In 1968 the governing body allowed unrestricted sponsorship, and Lotus raced in Gold Leaf cigarette colours. From then on, commercial liveries replaced national racing colours.

## Wings take flight
High-mounted wings appeared in 1968 and were quickly restricted after failures. Downforce had become a central design concern.

## The kit-car era
The DFV was available to any team that could pay for it. Tyrrell, McLaren, March, Brabham and Lotus could all win with it, and grids grew larger and more competitive.

## Safety becomes a cause
Jackie Stewart campaigned for barriers, medical facilities and circuit changes, and some venues fell off the calendar as a result. The 1976 season brought Niki Lauda's near-fatal Nürburgring crash and his title fight with James Hunt.`,
  },
  {
    slug: "ground-effect-and-turbo",
    name: "Ground effect & turbo",
    startYear: 1977,
    endYear: 1988,
    tagline: "Wing cars, 1,000-horsepower turbos and the FISA–FOCA war",
    summary:
      "Lotus harnesses ground effect, Renault brings turbocharging, and power outputs soar before turbos are banned at the end of 1988.",
    body: `## Wing cars
The Lotus 78 and 79 shaped the car's underside to work like an inverted wing. Mario Andretti won the 1978 title in the Type 79. Sliding skirts and enormous cornering speeds followed until flat bottoms were mandated in 1983.

## The turbo age
Renault introduced a turbocharged engine in 1977. By the mid-1980s qualifying engines were said to produce well over 1,000 horsepower. Nelson Piquet won the first turbo-powered title for Brabham-BMW in 1983.

## Politics
The FISA–FOCA conflict over control of the sport's rules and money ended with the first Concorde Agreement in 1981.

## McLaren-Honda
In 1988, the last turbo year, Ayrton Senna and Alain Prost won 15 of 16 races for McLaren-Honda in the MP4/4.`,
  },
  {
    slug: "electronic-era",
    name: "The electronic era",
    startYear: 1989,
    endYear: 1993,
    tagline: "Naturally aspirated V10s, active suspension and Senna–Prost",
    summary:
      "3.5-litre naturally aspirated engines arrive, the Senna–Prost rivalry peaks, and Williams' active-suspension cars bring computer control to the sport.",
    body: `## Senna versus Prost
The two McLaren team-mates collided at Suzuka in 1989 and again in 1990, and both times the collision decided the championship.

## Driver aids
Semi-automatic gearboxes, traction control and active suspension spread through the grid. Williams' FW14B and FW15C were technically dominant, and Nigel Mansell (1992) and Alain Prost (1993) won titles with them.

## The ban
Most electronic driver aids were banned for 1994.`,
  },
  {
    slug: "safety-and-schumacher",
    name: "Safety & Schumacher",
    startYear: 1994,
    endYear: 2005,
    tagline: "Imola 1994, a safety revolution and Ferrari's red era",
    summary:
      "The deaths of Roland Ratzenberger and Ayrton Senna at Imola trigger sweeping safety reform. Michael Schumacher wins seven titles, five in a row with Ferrari.",
    body: `## Imola 1994
Roland Ratzenberger and Ayrton Senna were killed on consecutive days at the 1994 San Marino Grand Prix. Crash tests, higher cockpit sides, circuit changes and later the HANS device followed.

## Schumacher
Michael Schumacher won titles with Benetton in 1994 and 1995, then joined Ferrari. With Jean Todt, Ross Brawn and Rory Byrne he won five consecutive titles from 2000 to 2004.

## New manufacturers
Mercedes, BMW, Toyota, Honda, Renault and Ford-owned Jaguar raised budgets to new levels. Fernando Alonso and Renault ended Ferrari's run in 2005.`,
  },
  {
    slug: "v8-era",
    name: "The V8 era",
    startYear: 2006,
    endYear: 2013,
    tagline: "2.4-litre V8s, Brawn's fairy tale and Red Bull's rise",
    summary:
      "V8 engines replace V10s, KERS and DRS arrive, Brawn GP wins in its only season, and Sebastian Vettel takes four straight titles with Red Bull.",
    body: `## Close-fought titles
Kimi Räikkönen won the 2007 title by one point, and Lewis Hamilton won his first title on the final corner of the 2008 season.

## Brawn GP
Honda withdrew at the end of 2008. Ross Brawn bought the team for a nominal sum and won both 2009 titles with Jenson Button. Mercedes then bought the team.

## Red Bull
Adrian Newey's exhaust-blown Red Bulls carried Sebastian Vettel to four consecutive titles from 2010 to 2013. KERS (2009, 2011–13) and DRS (2011) were introduced to help overtaking.`,
  },
  {
    slug: "hybrid-era",
    name: "The hybrid era",
    startYear: 2014,
    endYear: 2021,
    tagline: "1.6-litre turbo-hybrids and the Mercedes dynasty",
    summary:
      "Turbo-hybrid power units arrive and Mercedes wins eight consecutive Constructors' titles. The era ends with the bitterly contested 2021 finale.",
    body: `## Power units
From 2014 cars used a 1.6-litre V6 turbo with energy recovery from braking (MGU-K) and from exhaust heat (MGU-H). Mercedes arrived best prepared.

## The Mercedes dynasty
Lewis Hamilton won six titles in this era and Nico Rosberg won in 2016. Mercedes took every Constructors' Championship from 2014 to 2021.

## Safety and spectacle
The halo became mandatory in 2018. The 2021 title was decided on the final lap in Abu Dhabi between Max Verstappen and Lewis Hamilton, after a contested safety-car restart.`,
  },
  {
    slug: "ground-effect-return",
    name: "Ground-effect return",
    startYear: 2022,
    endYear: 2025,
    tagline: "Venturi tunnels, a cost cap and Verstappen's record run",
    summary:
      "Ground-effect regulations and a budget cap reshape the grid. Red Bull dominates 2022–23 before McLaren rises to win the 2024 and 2025 Constructors' titles.",
    body: `## Venturi floors
The 2022 regulations returned to ground-effect underbodies to reduce turbulent wake and help cars follow each other. Teams soon had to deal with "porpoising", the bouncing caused by unstable underbody downforce.

## A record season
Max Verstappen won 19 of 22 races in 2023, and Red Bull won 21 of 22.

## Competition returns
McLaren, Ferrari and Mercedes all became winners again. McLaren won the 2024 and 2025 Constructors' titles, and Lando Norris won the 2025 drivers' title.`,
  },
  {
    slug: "new-regulations",
    name: "New regulations",
    startYear: 2026,
    endYear: null,
    tagline: "Active aero, 50/50 hybrid power and new manufacturers",
    summary:
      "The 2026 rules bring smaller, lighter cars with movable aerodynamics and power units that draw roughly half their output from electrical energy, running on sustainable fuels.",
    body: `## A new rulebook
2026 cars are narrower and lighter. Movable front and rear wings replace DRS.

## Power units
The MGU-H is gone, electrical output rises sharply and the fuel is fully sustainable. New and returning manufacturers include Audi and Cadillac, Honda in partnership with Aston Martin, and Red Bull's own power-unit project with Ford.`,
  },
];

export function eraForYear(year: number): string {
  return ERAS.find((e) => year >= e.startYear && (e.endYear === null || year <= e.endYear))!.slug;
}
