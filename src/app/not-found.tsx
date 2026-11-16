import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell flex min-h-[70vh] flex-col justify-center py-20">
      <p className="eyebrow-accent">Error 404 · Retired</p>
      <h1 className="mt-4 text-display-xl">Off the track.</h1>
      <p className="mt-5 max-w-xl text-lg text-white/80">This page isn&apos;t in the archive. It may have been renamed, or it never started the race.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn">Back to the archive</Link>
        <Link href="/search" className="btn-ghost">Search</Link>
        <Link href="/ask" className="btn-ghost">Ask the Archive</Link>
      </div>
    </div>
  );
}
