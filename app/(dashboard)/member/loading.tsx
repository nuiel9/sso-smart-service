/**
 * Skeleton loading state สำหรับ Member Dashboard
 * แสดงอัตโนมัติโดย Next.js ในระหว่าง async data fetching ของ page.tsx
 */

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />
  )
}

export default function MemberDashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-[#1e3a5f] h-14" />

      <main className="container mx-auto px-4 py-5 space-y-6 max-w-4xl">
        {/* Welcome card skeleton */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="w-12 h-12 rounded-full" />
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-8 w-8 mx-auto rounded" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Section label skeleton */}
        <Skeleton className="h-5 w-24" />

        {/* Quick actions skeleton — 2×2 grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center gap-2.5 rounded-xl p-4 min-h-[88px] bg-white shadow-sm"
            >
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>

        {/* Section label skeleton */}
        <Skeleton className="h-5 w-40" />

        {/* Benefits grid skeleton — 3-col on desktop */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>

        {/* Recent activity skeleton */}
        <Skeleton className="h-5 w-32" />
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
