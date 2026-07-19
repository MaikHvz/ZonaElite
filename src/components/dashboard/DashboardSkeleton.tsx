export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="glass-card !rounded-xl border-l-[3px] border-l-on-surface/10 p-4 md:p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg skeleton-shimmer" />
            <div className="w-24 h-3 rounded skeleton-shimmer" />
          </div>
          <div className="w-20 h-8 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

export function MembershipCardSkeleton() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
          <div>
            <div className="w-32 h-5 rounded skeleton-shimmer mb-2" />
            <div className="w-20 h-3 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="w-16 h-5 rounded-full skeleton-shimmer" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <div className="w-12 h-3 rounded skeleton-shimmer" />
          <div className="w-24 h-3 rounded skeleton-shimmer" />
        </div>
        <div className="flex justify-between">
          <div className="w-12 h-3 rounded skeleton-shimmer" />
          <div className="w-24 h-3 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="h-1.5 rounded-full skeleton-shimmer" />
    </div>
  );
}

export function PaymentRowSkeleton() {
  return (
    <div className="flex items-center gap-3 md:gap-4 py-3.5 border-b border-on-surface/5">
      <div className="w-14 h-4 rounded skeleton-shimmer" />
      <div className="w-8 h-8 rounded-lg skeleton-shimmer" />
      <div className="flex-1">
        <div className="h-4 rounded skeleton-shimmer mb-1" />
        <div className="w-16 h-3 rounded skeleton-shimmer" />
      </div>
      <div className="w-20 h-4 rounded skeleton-shimmer" />
      <div className="w-16 h-5 rounded-full skeleton-shimmer" />
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="py-4 border-b border-on-surface/5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg skeleton-shimmer shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full skeleton-shimmer" />
            <div className="w-16 h-3 rounded skeleton-shimmer" />
          </div>
          <div className="w-3/4 h-4 rounded skeleton-shimmer mb-1" />
          <div className="w-full h-3 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="glass-card bg-gradient-to-br from-primary-container/8 to-transparent p-6 md:p-8">
      <div className="flex items-center gap-4 md:gap-5">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl skeleton-shimmer" />
        <div>
          <div className="w-48 h-8 rounded skeleton-shimmer mb-2" />
          <div className="w-32 h-4 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
