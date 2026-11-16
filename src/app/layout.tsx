import type { Metadata, Viewport } from "next";
import { Inter, Public_Sans } from "next/font/google";
import { SiteHeader, type NavData } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { getNavData } from "@/lib/queries";
import "./globals.css";

const sans = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
const display = Public_Sans({ subsets: ["latin", "latin-ext"], weight: ["600", "700", "800", "900"], variable: "--font-display", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "GRID ARCHIVE — The Formula 1 history archive", template: "%s · GRID ARCHIVE" },
  description:
    "An encyclopedic, year-by-year archive of Formula 1 history from 1950 to today: every season, team, driver and circuit, with an AI research assistant.",
  applicationName: "GRID ARCHIVE",
  openGraph: { type: "website", siteName: "GRID ARCHIVE", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

const EMPTY_NAV: NavData = { seasons: [], teams: [], drivers: [], circuits: [], eras: [] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let nav = EMPTY_NAV;
  try {
    nav = await getNavData();
  } catch (e) {
    console.error("nav data unavailable", e);
  }
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "GRID ARCHIVE",
    url: SITE,
    potentialAction: { "@type": "SearchAction", target: `${SITE}/search?q={query}`, "query-input": "required name=query" },
  };
  return (
    <html lang="en-GB" className={`${sans.variable} ${display.variable}`}>
      <body>
        <SiteHeader nav={nav} />
        <main id="main" tabIndex={-1} className="min-h-[60vh] focus:outline-none">
          {children}
        </main>
        <SiteFooter />
        <ChatWidget />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      </body>
    </html>
  );
}
