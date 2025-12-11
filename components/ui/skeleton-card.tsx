// components/ui/skeleton-card.tsx
// Skeleton loader for KPI cards during loading

import { cn } from '@/lib/utils'

interface SkeletonCardProps {
    className?: string
}

export function SkeletonCard({ className }: SkeletonCardProps) {
    return (
        <div className={cn(
            "relative overflow-hidden rounded-xl bg-white border border-gray-200 h-full p-6 space-y-4",
            className
        )}>
            {/* Icon and Title skeleton */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                    {/* Icon skeleton */}
                    <div className="w-10 h-10 rounded-lg bg-gray-200 animate-pulse" />

                    {/* Title skeleton */}
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                    </div>
                </div>

                {/* Badge skeleton */}
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
            </div>

            {/* Value skeleton */}
            <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded animate-pulse w-2/3" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
            </div>

            {/* Footer skeleton */}
            <div className="flex items-center gap-2 pt-2">
                <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-24" />
            </div>

            {/* Shimmer effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
    )
}

// Shimmer animation for skeleton
// Add this to your globals.css:
/*
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
*/
