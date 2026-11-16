/**
 * Image with responsive srcset, lazy loading, a Wikimedia credit line and an
 * elegant fallback (team colour / initials / track outline) when no free image exists.
 */
import { initials } from "@/lib/text";

export interface ImageData {
  path: string;
  srcset?: unknown;
  width?: number | null;
  height?: number | null;
  alt: string;
  author: string;
  license: string;
  licenseUrl?: string | null;
  sourceUrl: string;
}

type Fallback =
  | { kind: "initials"; name: string; color?: string }
  | { kind: "team"; name: string; color: string }
  | { kind: "track"; name: string }
  | { kind: "season"; label: string };

interface Props {
  image?: ImageData | null;
  fallback: Fallback;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  credit?: "overlay" | "below" | "none";
  priority?: boolean;
}

export function srcSetOf(image: ImageData): string | undefined {
  const set = Array.isArray(image.srcset) ? (image.srcset as { w: number; path: string }[]) : null;
  return set?.length ? set.map((s) => `${s.path} ${s.w}w`).join(", ") : undefined;
}

export function Credit({ image, className = "" }: { image: ImageData; className?: string }) {
  return (
    <span className={`block text-[0.68rem] leading-snug text-mist ${className}`}>
      Photo: {image.author} /{" "}
      {image.licenseUrl ? (
        <a href={image.licenseUrl} className="underline-offset-2 hover:underline" rel="license noopener" target="_blank">
          {image.license}
        </a>
      ) : (
        image.license
      )}{" "}
      /{" "}
      <a href={image.sourceUrl} className="underline-offset-2 hover:underline" rel="noopener" target="_blank">
        Wikimedia Commons
      </a>
    </span>
  );
}

export function Placeholder({ fallback, className = "" }: { fallback: Fallback; className?: string }) {
  if (fallback.kind === "team") {
    return (
      <div className={`relative flex h-full w-full items-end overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${fallback.color} 0%, #0b0d10 85%)` }} role="img" aria-label={`${fallback.name} — no photo available`}>
        <div className="checker absolute -right-6 -top-6 h-28 w-28 rotate-12 opacity-[0.07]" />
        <span className="p-4 font-display text-2xl font-extrabold uppercase tracking-tight text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{fallback.name}</span>
      </div>
    );
  }
  if (fallback.kind === "track") {
    return (
      <div className={`relative flex h-full w-full items-center justify-center bg-graphite ${className}`} role="img" aria-label={`${fallback.name} — no photo available`}>
        <svg viewBox="0 0 200 120" className="h-2/3 w-2/3 opacity-60" aria-hidden="true">
          <path d="M30 90 C 10 60, 40 20, 80 30 S 120 70, 150 40 S 195 50, 175 85 S 110 105, 80 95 S 45 110, 30 90 Z" fill="none" stroke="#E4002B" strokeWidth="5" strokeLinejoin="round" />
          <rect x="74" y="88" width="10" height="14" className="checker" fill="#fff" />
        </svg>
      </div>
    );
  }
  if (fallback.kind === "season") {
    return (
      <div className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-graphite ${className}`} role="img" aria-label={fallback.label}>
        <span className="font-display text-7xl font-extrabold tracking-tighter text-white/10">{fallback.label}</span>
      </div>
    );
  }
  return (
    <div className={`relative flex h-full w-full items-center justify-center bg-graphite ${className}`} role="img" aria-label={`${fallback.name} — no photo available`} style={fallback.color ? { background: `linear-gradient(160deg, ${fallback.color}55, #15181d 70%)` } : undefined}>
      <span className="font-display text-5xl font-extrabold tracking-tight text-white/70">{initials(fallback.name)}</span>
    </div>
  );
}

export function ArchiveImage({ image, fallback, sizes = "100vw", className = "", imgClassName = "", credit = "none", priority = false }: Props) {
  if (!image) {
    return (
      <div className={`overflow-hidden ${className}`}>
        <Placeholder fallback={fallback} />
      </div>
    );
  }
  const isSvg = image.path.endsWith(".svg");
  return (
    <figure className={`relative overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.path}
        srcSet={isSvg ? undefined : srcSetOf(image)}
        sizes={isSvg ? undefined : sizes}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        alt={image.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
      {credit === "overlay" && (
        <figcaption className="absolute bottom-0 right-0 max-w-[80%] bg-black/60 px-2 py-1 text-right">
          <Credit image={image} />
        </figcaption>
      )}
      {credit === "below" && (
        <figcaption className="pt-2">
          <Credit image={image} />
        </figcaption>
      )}
    </figure>
  );
}
