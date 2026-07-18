export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-surface-container border border-on-surface/5 rounded-2xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 rounded bg-on-surface/10 animate-pulse" />
            <div className="w-24 h-3 rounded bg-on-surface/10 animate-pulse" />
          </div>
          <div className="w-20 h-8 rounded bg-on-surface/10 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function MembershipCardSkeleton() {
  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="w-32 h-5 rounded bg-on-surface/10 animate-pulse mb-2" />
          <div className="w-20 h-3 rounded bg-on-surface/10 animate-pulse" />
        </div>
        <div className="w-16 h-5 rounded-full bg-on-surface/10 animate-pulse" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <div className="w-12 h-3 rounded bg-on-surface/10 animate-pulse" />
          <div className="w-24 h-3 rounded bg-on-surface/10 animate-pulse" />
        </div>
        <div className="flex justify-between">
          <div className="w-12 h-3 rounded bg-on-surface/10 animate-pulse" />
          <div className="w-24 h-3 rounded bg-on-surface/10 animate-pulse" />
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-on-surface/10 animate-pulse" />
    </div>
  );
}

export function PaymentRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-on-surface/5">
      <div className="w-20 h-4 rounded bg-on-surface/10 animate-pulse" />
      <div className="flex-1 h-4 rounded bg-on-surface/10 animate-pulse" />
      <div className="w-20 h-4 rounded bg-on-surface/10 animate-pulse" />
      <div className="w-16 h-5 rounded-full bg-on-surface/10 animate-pulse" />
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="py-4 border-b border-on-surface/5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded bg-on-surface/10 animate-pulse" />
        <div className="w-40 h-4 rounded bg-on-surface/10 animate-pulse" />
      </div>
      <div className="w-full h-3 rounded bg-on-surface/10 animate-pulse mb-1" />
      <div className="w-3/4 h-3 rounded bg-on-surface/10 animate-pulse" />
    </div>
  );
}
