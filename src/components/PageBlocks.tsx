import Link from "next/link";
import type { ReactNode } from "react";
import { ArchiveImage, Credit, type ImageData } from "./ArchiveImage";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { Markdown, chaptersOf } from "./Markdown";
import type { SourceRef } from "@/lib/queries";
import { formatDate } from "@/lib/text";

type Fallback = Parameters<typeof ArchiveImage>[0]["fallback"];

/** Full-bleed hero with gradient overlay and huge headline. */
export function PageHero({
  eyebrow, title, subtitle, crumbs, image, fallback, actions, children, accent,
}: {
  eyebrow: string; title: string; subtitle?: ReactNode; crumbs: Crumb[]; image?: ImageData | null; fallback: Fallback;
  actions?: ReactNode; children?: ReactNode; accent?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink">
      <div className="absolute inset-0 -z-10">
        <ArchiveImage image={image} fallback={fallback} className="h-full w-full" imgClassName="animate-kenburns opacity-70" priority sizes="100vw" />
        <div className="hero-gradient absolute inset-0" />
        <div className="side-gradient absolute inset-0" />
      </div>
      {accent && <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} aria-hidden="true" />}
      <div className="shell flex min-h-[460px] flex-col justify-between gap-10 pb-10 pt-8 sm:min-h-[540px] lg:min-h-[600px]">
        <Breadcrumbs items={crumbs} />
        <div className="max-w-5xl animate-fade-up">
          <p className="eyebrow-accent">{eyebrow}</p>
          <h1 className="mt-4 text-display-xl text-white">{title}</h1>
          {subtitle && <div className="mt-5 max-w-3xl text-lg leading-relaxed text-white/85 sm:text-xl">{subtitle}</div>}
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
          {children}
        </div>
      </div>
      {image && (
        <div className="absolute bottom-2 right-3 max-w-[60%] text-right">
          <Credit image={image} />
        </div>
      )}
    </section>
  );
}

/** Scannable key-facts strip shown directly below a hero. */
export function FactStrip({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  return (
    <section aria-label="Key facts" className="border-b border-rule bg-carbon">
      <dl className="shell grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((f) => (
          <div key={f.label} className="bg-carbon px-1 py-5 sm:px-4">
            <dt className="eyebrow">{f.label}</dt>
            <dd className="stat-num mt-2 text-2xl text-white sm:text-3xl">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, action, light = false, id }: { eyebrow?: string; title: string; action?: { href: string; label: string }; light?: boolean; id?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className={light ? "eyebrow-accent" : "eyebrow-accent"}>{eyebrow}</p>}
        <h2 id={id} className={`mt-2 text-display-md ${light ? "text-ink" : "text-white"}`}>{title}</h2>
      </div>
      {action && (
        <Link href={action.href} className={`group inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] ${light ? "text-ink hover:text-signal-deep" : "text-white hover:text-signal-bright"}`}>
          {action.label} <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </div>
  );
}

/** Light-theme long-form article with chapter navigation and provenance. */
export function ArticleSection({
  article, eyebrow = "The story", aside,
}: {
  article: { title: string; body: string; aiGenerated: boolean; lastEdited: Date; sources: SourceRef[]; model?: string | null } | null;
  eyebrow?: string;
  aside?: ReactNode;
}) {
  if (!article) return null;
  const chapters = chaptersOf(article.body);
  return (
    <section className="light" aria-labelledby="article-heading">
      <div className="shell grid-12 py-16 lg:py-24">
        <aside className="col-span-4 mb-10 sm:col-span-8 lg:col-span-3 lg:mb-0">
          <div className="lg:sticky lg:top-24">
            <p className="eyebrow-accent">{eyebrow}</p>
            <h2 id="article-heading" className="mt-2 text-3xl font-extrabold tracking-tight">{article.title}</h2>
            {chapters.length > 1 && (
              <nav aria-label="Chapters" className="mt-6">
                <ol className="space-y-2 border-l border-mist pl-4 text-sm">
                  {chapters.map((c, i) => (
                    <li key={c.id}>
                      <a href={`#${c.id}`} className="text-steel hover:text-ink">
                        <span className="mr-2 font-bold tabular-nums text-signal-deep">{String(i + 1).padStart(2, "0")}</span>
                        {c.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <div className="mt-6 space-y-2 text-xs text-steel">
              {article.aiGenerated && (
                <p className="inline-flex items-center gap-2 border border-ink/20 px-2 py-1 font-bold uppercase tracking-[0.12em] text-ink">
                  <span aria-hidden="true" className="h-1.5 w-1.5 bg-signal" /> AI-assisted
                </p>
              )}
              <p>Last edited {formatDate(article.lastEdited)}</p>
            </div>
            {aside}
          </div>
        </aside>
        <div className="col-span-4 sm:col-span-8 lg:col-span-8 lg:col-start-5">
          <Markdown source={article.body} className="prose-archive" />
          <footer className="mt-12 max-w-prose border-t border-mist pt-6 text-sm text-steel">
            <p className="eyebrow mb-2">Sources & provenance</p>
            {article.aiGenerated && (
              <p className="mb-3">
                This article was drafted with AI{article.model ? ` (${article.model})` : ""} strictly from the archive&apos;s structured data and the Wikipedia lead section below, then stored for editorial review. Statistics come from the results database.
              </p>
            )}
            <ul className="space-y-1">
              {article.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} className="link" rel="noopener" target={s.url.startsWith("http") ? "_blank" : undefined}>{s.title}</a>
                  {s.license && <span> — {s.license}</span>}
                </li>
              ))}
            </ul>
          </footer>
        </div>
      </div>
    </section>
  );
}

export function EntityCard({
  href, title, meta, eyebrow, image, fallback, aspect = "aspect-[4/3]", badge,
}: {
  href: string; title: string; meta?: ReactNode; eyebrow?: string; image?: ImageData | null; fallback: Fallback; aspect?: string; badge?: string;
}) {
  return (
    <Link href={href} className="card-zoom group block focus:outline-none">
      <div className={`relative overflow-hidden bg-graphite ${aspect}`}>
        <ArchiveImage image={image} fallback={fallback} className="h-full w-full" sizes="(min-width: 1024px) 25vw, 50vw" />
        {badge && <span className="absolute left-0 top-0 bg-signal px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white">{badge}</span>}
      </div>
      <div className="border-b border-rule py-3 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-signal-bright">
        {eyebrow && <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-mist">{eyebrow}</p>}
        <p className="mt-1 font-display text-lg font-bold leading-tight text-white group-hover:text-signal-bright">{title}</p>
        {meta && <div className="mt-1 text-sm text-mist">{meta}</div>}
      </div>
    </Link>
  );
}

export function NationalityBadge({ iso, label }: { iso: string | null; label?: string | null }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {iso && <span className="border border-current px-1 text-[0.6rem] font-bold leading-tight tracking-wider" aria-hidden="true">{iso}</span>}
      {label}
    </span>
  );
}
