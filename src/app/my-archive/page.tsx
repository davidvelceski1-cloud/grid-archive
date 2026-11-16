import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MyArchiveList } from "@/components/MyArchiveList";

export const metadata: Metadata = { title: "My Archive", robots: { index: false } };

export default function MyArchivePage() {
  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "My Archive" }]} />
      <p className="eyebrow-accent mt-10">Your bookmarks</p>
      <h1 className="mt-3 text-display-lg">My Archive</h1>
      <p className="mb-10 mt-4 max-w-2xl text-lg text-white/80">Pages you save are kept in this browser only. No account needed, and nothing is sent to a server.</p>
      <MyArchiveList />
    </div>
  );
}
