/**
 * Loading skeleton for the Attribution workspace.
 * Matches the page structure: top-bar, lede card, journey band, money band, channel rows.
 */

function SkeletonRect({ className }: { className?: string }) {
  return (
    <div
      className={`bg-slate-200 rounded animate-pulse ${className ?? ''}`}
      aria-hidden="true"
    />
  );
}

export function AttributionSkeleton() {
  return (
    <div
      className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-4"
      role="status"
      aria-label="Loading attribution data"
    >
      {/* Top bar skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <SkeletonRect className="h-3 w-48" />
          <SkeletonRect className="h-6 w-32" />
        </div>
        <div className="flex gap-3">
          <SkeletonRect className="h-9 w-36 rounded-full" />
          <SkeletonRect className="h-9 w-32 rounded-full" />
        </div>
      </div>

      {/* Ecosystem lede skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <SkeletonRect className="h-5 w-64 mb-4" />
        <div className="grid grid-cols-2 gap-8">
          <SkeletonRect className="h-56 w-56 rounded-full mx-auto" />
          <div className="flex flex-col gap-3 py-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <SkeletonRect className="h-4 w-36" />
                <SkeletonRect className="h-4 w-12" />
                <SkeletonRect className="h-4 w-12" />
                <SkeletonRect className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
        <SkeletonRect className="h-14 w-full mt-4 rounded-xl" />
      </div>

      {/* Journey band skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <SkeletonRect className="h-5 w-40 mb-4" />
        <div className="flex gap-3 flex-wrap">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonRect key={i} className="h-16 w-28 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Money band skeleton */}
      <div className="rounded-2xl overflow-hidden">
        <div className="bg-slate-800 p-6 flex gap-0 flex-wrap">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 min-w-52 px-6 py-2">
              <SkeletonRect className="h-3 w-36 bg-slate-700 mb-3" />
              <SkeletonRect className="h-10 w-24 bg-slate-700 mb-2" />
              <SkeletonRect className="h-4 w-full bg-slate-700" />
            </div>
          ))}
        </div>
      </div>

      {/* Channel row skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <SkeletonRect className="h-10 w-10 rounded-xl flex-none" />
            <div className="flex-1 flex flex-col gap-2">
              <SkeletonRect className="h-5 w-40" />
              <SkeletonRect className="h-3 w-56" />
            </div>
            <div className="flex gap-6">
              <SkeletonRect className="h-10 w-20" />
              <SkeletonRect className="h-10 w-20" />
              <SkeletonRect className="h-10 w-20" />
            </div>
          </div>
          <SkeletonRect className="h-1 w-full mt-4 rounded-full" />
        </div>
      ))}
    </div>
  );
}
