import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { aiEnabled } from "@/lib/ai/claude";

export const metadata: Metadata = {
  title: "Ask the Archive",
  description: "Ask questions about Formula 1 history in plain language. Answers come from the archive's own database and cite their sources.",
};

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="shell pb-16 pt-10">
      <Breadcrumbs items={[{ label: "Ask the Archive" }]} />
      <div className="grid-12 mt-10 gap-y-8">
        <div className="col-span-4 sm:col-span-8 lg:col-span-4">
          <p className="eyebrow-accent">AI research assistant</p>
          <h1 className="mt-3 text-display-lg">Ask the Archive</h1>
          <p className="mt-5 text-lg text-white/80">
            Questions are answered using retrieval-augmented generation over GRID ARCHIVE&apos;s own database: results, standings, team lineages and the archive&apos;s articles.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-mist">
            <li className="border-l-2 border-signal pl-3">Every claim cites the archive pages it came from.</li>
            <li className="border-l-2 border-signal pl-3">If the archive doesn&apos;t hold the answer, the assistant says so rather than guessing.</li>
            <li className="border-l-2 border-signal pl-3">Tick “Explain like I&apos;m new to F1” for jargon-free answers.</li>
          </ul>
          {!aiEnabled() && (
            <p className="mt-6 border border-rule p-3 text-xs text-mist">
              This deployment has no AI key configured, so the assistant returns the most relevant archive passages instead of a written answer.
            </p>
          )}
        </div>
        <div className="col-span-4 h-[72vh] min-h-[520px] sm:col-span-8 lg:col-span-8">
          <ChatPanel initialQuestion={q} />
        </div>
      </div>
    </div>
  );
}
