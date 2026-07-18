import StatusBadge from "@/components/admin/StatusBadge";
import type { MembershipData } from "@/lib/supabase/dashboard";

function getProgress(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now >= e) return 100;
  if (now <= s) return 0;
  return Math.round(((now - s) / (e - s)) * 100);
}

function getDaysRemaining(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function MembershipCard({
  membership,
}: {
  membership: MembershipData;
}) {
  const progress = getProgress(membership.start_date, membership.end_date);
  const daysRemaining = getDaysRemaining(membership.end_date);
  const isExpired = membership.status === "vencida";
  const isWarning = daysRemaining <= 7 && membership.status === "activa";
  const beneficiaryName = membership.beneficiary?.dependent
    ? membership.beneficiary.dependent.full_name
    : null;

  return (
    <div
      className={`bg-surface-container border rounded-2xl p-5 transition-colors ${
        isExpired
          ? "border-red-500/20 opacity-60"
          : isWarning
          ? "border-yellow-500/30"
          : "border-on-surface/5 hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase">
            {membership.plan?.name || "Plan"}
          </h3>
          {beneficiaryName && (
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mt-0.5">
              {beneficiaryName}
              {membership.beneficiary?.dependent?.category === "nino" &&
                " (carga)"}
            </p>
          )}
        </div>
        <StatusBadge status={membership.status} />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
          <span className="text-on-surface-variant">Inicio</span>
          <span className="text-on-surface">{formatDate(membership.start_date)}</span>
        </div>
        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
          <span className="text-on-surface-variant">Vence</span>
          <span className="text-on-surface">{formatDate(membership.end_date)}</span>
        </div>
        {membership.status === "activa" && (
          <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
            <span className="text-on-surface-variant">Días restantes</span>
            <span
              className={
                daysRemaining <= 7 ? "text-yellow-400" : "text-on-surface"
              }
            >
              {daysRemaining} días
            </span>
          </div>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-600"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #ff544c, #d32f2f)",
          }}
        />
      </div>

      {membership.plan?.benefits &&
        membership.plan.benefits.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {membership.plan.benefits.map((b: string, i: number) => (
              <span
                key={i}
                className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-primary/70 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10"
              >
                {b}
              </span>
            ))}
          </div>
        )}
    </div>
  );
}
