import { SkeletonCard } from '@/components/ui/skeleton-card'

export default function DashboardLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="container mx-auto px-3 py-4 max-w-[1920px]">
                {/* Header skeleton */}
                <div className="mb-6">
                    <div className="h-8 bg-gray-200 rounded animate-pulse w-48 mb-2" />
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-72" />
                </div>

                {/* KPI cards grid skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            </div>
        </div>
    )
}
