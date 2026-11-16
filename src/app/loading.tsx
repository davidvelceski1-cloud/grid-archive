/** Skeleton shown while archive pages stream in. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton h-[460px] w-full sm:h-[540px]" />
      <div className="shell grid grid-cols-2 gap-4 py-8 sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-16" />)}
      </div>
      <div className="shell space-y-3 py-8">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    </div>
  );
}
