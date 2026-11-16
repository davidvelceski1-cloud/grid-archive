import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, light = false }: { items: Crumb[]; light?: boolean }) {
  const all = [{ label: "Archive", href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${c.href}` } : {}),
    })),
  };
  return (
    <nav aria-label="Breadcrumb" className="text-xs">
      <ol className={`flex flex-wrap items-center gap-x-2 gap-y-1 uppercase tracking-[0.14em] ${light ? "text-steel" : "text-mist"}`}>
        {all.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href && i < all.length - 1 ? (
              <Link href={c.href} className={light ? "hover:text-ink" : "hover:text-white"}>
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className={light ? "text-ink" : "text-white"}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </nav>
  );
}
