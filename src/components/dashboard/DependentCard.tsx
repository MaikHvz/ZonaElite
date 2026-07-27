import type { DependentData } from "@/lib/supabase/dashboard";
import Link from "next/link";
import { getChileToday } from "@/lib/dates";

function calcAge(birthDate: string) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DependentCard({
  dependent,
}: {
  dependent: DependentData;
}) {
  const age = calcAge(dependent.birth_date);
  const beneficiaryList = Array.isArray(dependent.beneficiaries)
    ? dependent.beneficiaries
    : dependent.beneficiaries
      ? [dependent.beneficiaries]
      : [];
  const activeMembership = beneficiaryList
    .flatMap((b) => b.memberships || [])
    .find((m) => m.status === "activa");

  const activeEnrollment = beneficiaryList
    .flatMap((b) => b.academy_enrollments || [])
    .find((e) => e.status === "activa" && e.end_date >= getChileToday());

  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full btn-primary-gradient flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-[20px]">
            person
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase truncate">
            {dependent.full_name}
          </h3>
          <span
            className={`inline-block font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              dependent.category === "nino"
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : "bg-green-500/10 text-green-400 border-green-500/20"
            }`}
          >
            {dependent.category === "nino" ? "Niño" : "Adulto"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
          <span className="text-on-surface-variant">Nacimiento</span>
          <span className="text-on-surface">
            {formatDate(dependent.birth_date)} ({age} años)
          </span>
        </div>

        {dependent.rut && (
          <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
            <span className="text-on-surface-variant">RUT</span>
            <span className="text-on-surface">{dependent.rut}</span>
          </div>
        )}

        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
          <span className="text-on-surface-variant">Inscripción</span>
          {activeEnrollment ? (
            <span className="text-green-400">
              {activeEnrollment.enrollment_plans?.name || "Activa"} — vence {new Date(activeEnrollment.end_date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          ) : (
            <span className="text-amber-400">Sin inscripción</span>
          )}
        </div>

        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px] pt-2 border-t border-on-surface/5">
          <span className="text-on-surface-variant">Membresía</span>
          {activeMembership ? (
            <span className="text-green-400">
              {activeMembership.plan?.name || "Activa"}
            </span>
          ) : (
            <span className="text-yellow-400">Sin membresía activa</span>
          )}
        </div>
      </div>

      <Link
        href={`/dashboard/cargas/${dependent.id}/medico`}
        className="mt-4 flex items-center justify-center gap-2 w-full font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant border border-on-surface/10 px-4 py-2 rounded-lg hover:bg-on-surface/5 hover:text-primary hover:border-primary/20 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">medical_information</span>
        Ver ficha médica
      </Link>
    </div>
  );
}
