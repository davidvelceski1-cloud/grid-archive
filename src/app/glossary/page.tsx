import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GlossaryList } from "@/components/GlossaryList";

export const revalidate = 86400;
export const metadata: Metadata = { title: "Glossary", description: "Formula 1 terms explained, from DRS and ground effect to parc fermé, with a beginner-friendly mode." };

export default async function GlossaryPage() {
  const terms = await prisma.glossaryTerm.findMany({ orderBy: { term: "asc" } });
  const ld = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "GRID ARCHIVE Formula 1 glossary",
    hasDefinedTerm: terms.map((t) => ({ "@type": "DefinedTerm", name: t.term, description: t.short })),
  };
  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "Glossary" }]} />
      <p className="eyebrow-accent mt-10">Reference</p>
      <h1 className="mt-3 text-display-xl">Glossary</h1>
      <p className="mb-10 mt-5 max-w-2xl text-lg text-white/80">The language of Formula 1. Switch on beginner mode for plain-English explanations, or ask for any term not listed.</p>
      <GlossaryList terms={terms} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </div>
  );
}
