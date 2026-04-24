import { Skeleton } from "@/components/ui/skeleton";

/** Generic page-level skeleton — used by loading.tsx files */
export function PageSkeleton({
  rows = 3,
  hasHeader = true,
}: {
  rows?: number;
  hasHeader?: boolean;
}) {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      {hasHeader && (
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Stat-card row skeleton */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-4 grid-cols-2 lg:grid-cols-${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

/** Full analytics page skeleton */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-8 w-12 rounded-md" />
        <Skeleton className="h-8 w-12 rounded-md" />
        <Skeleton className="h-8 w-14 rounded-md" />
      </div>
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-60 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    </div>
  );
}

/** Conversation page skeleton */
export function ConversationsSkeleton() {
  return (
    <div className="flex gap-0 h-[calc(100dvh-7rem)] sm:h-[calc(100vh-8rem)] animate-in fade-in-0 duration-300">
      <div className="w-full md:w-80 border-r border-border p-3 space-y-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Skeleton key={n} className="h-16 w-full rounded-lg" />
        ))}
      </div>
      <div className="hidden md:flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a conversation</p>
      </div>
    </div>
  );
}

/** Campaign detail skeleton */
export function CampaignDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in-0 duration-300">
      <Skeleton className="h-5 w-28 rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-24 rounded-md" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/** Client detail skeleton */
export function ClientDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in-0 duration-300">
      <Skeleton className="h-5 w-24 rounded-md" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-[500px] rounded-xl" />
    </div>
  );
}
