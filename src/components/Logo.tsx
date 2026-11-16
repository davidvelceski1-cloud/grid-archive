/** GRID ARCHIVE mark: a 3×3 chequer grid crossed by a single red racing line. */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" fill="#000" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) =>
          (r + c) % 2 === 0 ? <rect key={`${r}${c}`} x={4 + c * 8} y={4 + r * 8} width="8" height="8" fill="#fff" /> : null,
        ),
      )}
      <path d="M2 26 C 10 26, 12 14, 18 12 S 28 8, 30 4" fill="none" stroke="#E4002B" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={compact ? 28 : 32} />
      <span className="font-display text-[1.05rem] font-extrabold leading-none tracking-[0.08em] text-white">
        GRID<span className="font-medium text-mist">ARCHIVE</span>
      </span>
    </span>
  );
}
