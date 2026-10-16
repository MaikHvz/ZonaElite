"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { getChileToday } from "@/lib/dates";
import { effectiveMembershipStatus, daysRemaining } from "@/lib/membership-status";
import { categoryFromBirth, categoryLabel } from "@/lib/category";
import { formatRut } from "@/lib/rut";
import FormModal from "@/components/admin/FormModal";
import StatusBadge from "@/components/admin/StatusBadge";
import AssignMembershipModal, { type AssignMembershipPrefill } from "@/components/admin/AssignMembershipModal";

// Ficha rápida de un alumno en el panel admin (v1.14.0): cualquier nombre
// envuelto en <UserNameButton> abre este popup con sus datos, su membresía
// activa (o la última vencida, con "Renovar") y sus otros beneficios.
// Las páginas que muestran datos de membresías escuchan ADMIN_DATA_CHANGED
// para recargar cuando se renueva desde aquí.

export const ADMIN_DATA_CHANGED = "zonaelite:admin-data-changed";

export type UserQuickViewTarget = { profileId: string } | { beneficiaryId: string };

interface QuickViewContextValue {
  openUser: (target: UserQuickViewTarget) => void;
}

const QuickViewContext = createContext<QuickViewContextValue>({ openUser: () => {} });

export function useUserQuickView() {
  return useContext(QuickViewContext);
}

const ROLE_LABELS: Record<number, string> = { 1: "Administrador", 2: "Instructor", 3: "Recepción", 4: "Alumno" };

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  rut: string | null;
  birth_date: string | null;
  address: string | null;
  role_id: number;
  active: boolean;
  created_at: string;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;
}

interface MembershipRow {
  id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  status: string;
  membership_plans: { name: string; tokens: number | null } | null;
}

interface QuickViewData {
  profile: ProfileRow | null;
  legacyName: string | null;
  beneficiaryId: string | null;
  active: MembershipRow | null;
  last: MembershipRow | null;
  tokens: { remaining: number | null; total: number | null; isUnlimited: boolean } | null;
  enrollment: { end_date: string; name: string } | null;
  packs: { name: string; remaining: number; end_date: string }[];
  renewal: { created_at: string; note: string | null } | null;
}

async function loadQuickView(target: UserQuickViewTarget): Promise<QuickViewData> {
  const supabase = createClient();
  const today = getChileToday();

  let profileId: string | null = "profileId" in target ? target.profileId : null;
  let beneficiaryId: string | null = "beneficiaryId" in target ? target.beneficiaryId : null;
  let legacyName: string | null = null;

  if (beneficiaryId) {
    const { data: ben } = await supabase
      .from("beneficiaries")
      .select("id, profile_id, dependents(full_name)")
      .eq("id", beneficiaryId)
      .maybeSingle();
    profileId = (ben?.profile_id as string | null) ?? null;
    // Carga aún sin migrar: solo hay nombre (legado de cargas).
    legacyName = (ben?.dependents as unknown as { full_name?: string } | null)?.full_name ?? null;
  } else if (profileId) {
    const { data: ben } = await supabase.from("beneficiaries").select("id").eq("profile_id", profileId).maybeSingle();
    beneficiaryId = ben?.id ?? null;
  }

  const { data: profile } = profileId
    ? await supabase.from("profiles").select("*").eq("id", profileId).maybeSingle()
    : { data: null };

  if (!beneficiaryId) {
    return { profile: profile as ProfileRow | null, legacyName, beneficiaryId: null, active: null, last: null, tokens: null, enrollment: null, packs: [], renewal: null };
  }

  const [memRes, enrollRes, packsRes, renewalRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, plan_id, start_date, end_date, status, membership_plans(name, tokens)")
      .eq("beneficiary_id", beneficiaryId)
      .order("end_date", { ascending: false })
      .limit(5),
    supabase
      .from("academy_enrollments")
      .select("end_date, enrollment_plans(name)")
      .eq("beneficiary_id", beneficiaryId)
      .eq("status", "activa")
      .gte("end_date", today)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("personalized_packs")
      .select("end_date, total_classes, used_classes, personalized_plans(name)")
      .eq("beneficiary_id", beneficiaryId)
      .eq("status", "activa")
      .gte("end_date", today),
    supabase
      .from("membership_renewal_requests")
      .select("created_at, note")
      .eq("beneficiary_id", beneficiaryId)
      .eq("status", "pendiente")
      .maybeSingle(),
  ]);

  const memberships = (memRes.data || []) as unknown as MembershipRow[];
  const active = memberships.find((m) => effectiveMembershipStatus(m.status, m.end_date, today) === "activa") || null;
  const last = memberships.find((m) => m.status !== "cancelada") || memberships[0] || null;

  let tokens: QuickViewData["tokens"] = null;
  if (active) {
    if (active.membership_plans?.tokens == null) {
      tokens = { remaining: null, total: null, isUnlimited: true };
    } else {
      const { data: t } = await supabase.rpc("get_remaining_tokens", {
        p_beneficiary_id: beneficiaryId,
        p_membership_id: active.id,
      });
      const row = Array.isArray(t) ? t[0] : null;
      tokens = row
        ? { remaining: row.remaining, total: row.total, isUnlimited: row.is_unlimited }
        : { remaining: null, total: active.membership_plans?.tokens ?? null, isUnlimited: false };
    }
  }

  const enroll = enrollRes.data as unknown as { end_date: string; enrollment_plans: { name: string } | null } | null;

  return {
    profile: profile as ProfileRow | null,
    legacyName,
    beneficiaryId,
    active,
    last,
    tokens,
    enrollment: enroll ? { end_date: enroll.end_date, name: enroll.enrollment_plans?.name || "Matrícula" } : null,
    packs: ((packsRes.data || []) as unknown as { end_date: string; total_classes: number; used_classes: number; personalized_plans: { name: string } | null }[])
      .filter((p) => p.used_classes < p.total_classes)
      .map((p) => ({ name: p.personalized_plans?.name || "Pack", remaining: p.total_classes - p.used_classes, end_date: p.end_date })),
    renewal: (renewalRes.data as { created_at: string; note: string | null } | null) || null,
  };
}

function fmtDate(d: string | null | undefined) {
  return d ? new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("es-CL") : "—";
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 font-[family-name:var(--font-body-md)] text-[13px]">
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span className="text-on-surface text-right break-all">{value}</span>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant mb-2">
      <span className="material-symbols-outlined text-[14px] text-primary">{icon}</span>
      {children}
    </p>
  );
}

export function UserQuickViewProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<UserQuickViewTarget | null>(null);
  const [data, setData] = useState<QuickViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignPrefill, setAssignPrefill] = useState<AssignMembershipPrefill | null>(null);

  const refresh = useCallback(async (t: UserQuickViewTarget) => {
    setLoading(true);
    try {
      setData(await loadQuickView(t));
    } finally {
      setLoading(false);
    }
  }, []);

  const openUser = useCallback((t: UserQuickViewTarget) => {
    setTarget(t);
    setData(null);
    refresh(t);
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => { if (target) refresh(target); };
    window.addEventListener(ADMIN_DATA_CHANGED, onChanged);
    return () => window.removeEventListener(ADMIN_DATA_CHANGED, onChanged);
  }, [target, refresh]);

  const today = getChileToday();
  const profile = data?.profile ?? null;
  const name = profile?.full_name || data?.legacyName || "Alumno";
  const isLegacy = !profile && !!data?.legacyName;
  const expiredLast = data?.last && !data.active ? data.last : null;

  return (
    <QuickViewContext.Provider value={{ openUser }}>
      {children}

      <FormModal open={!!target} title={loading && !data ? "Cargando..." : name} onClose={() => setTarget(null)}>
        {loading && !data ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : data ? (
          <div className="space-y-5">
            {profile && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{ROLE_LABELS[profile.role_id] || "Usuario"}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-on-surface/5 text-on-surface-variant">{categoryLabel(categoryFromBirth(profile.birth_date))}</span>
                <StatusBadge status={profile.active ? "activo" : "cancelado"} />
              </div>
            )}
            {isLegacy && (
              <p className="text-[12px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                Carga aún sin migrar a cuenta propia. Migrala en &quot;Migración de cargas&quot; para ver sus datos completos.
              </p>
            )}

            {/* Membresía */}
            <div className="p-4 rounded-xl bg-on-surface/5">
              <SectionTitle icon="card_membership">Membresía</SectionTitle>
              {data.active ? (
                <div className="space-y-1.5">
                  <InfoRow label="Plan" value={<span className="text-green-400 font-medium">{data.active.membership_plans?.name || "Plan"}</span>} />
                  <InfoRow label="Vigencia" value={`${fmtDate(data.active.start_date)} → ${fmtDate(data.active.end_date)}`} />
                  <InfoRow label="Días restantes" value={daysRemaining(data.active.end_date, today)} />
                  {data.tokens && (
                    <InfoRow
                      label="Clases"
                      value={data.tokens.isUnlimited ? "Ilimitadas" : `${data.tokens.remaining ?? "—"} de ${data.tokens.total ?? "—"} disponibles`}
                    />
                  )}
                </div>
              ) : expiredLast ? (
                <div className="space-y-1.5">
                  <InfoRow label="Última" value={expiredLast.membership_plans?.name || "Plan"} />
                  <InfoRow label="Venció" value={<span className="text-red-400">{fmtDate(expiredLast.end_date)}</span>} />
                </div>
              ) : (
                <p className="text-[13px] text-on-surface-variant">Sin membresías registradas.</p>
              )}

              {data.renewal && (
                <p className="mt-3 text-[12px] text-amber-300">
                  Pidió renovar el {fmtDate(data.renewal.created_at)}{data.renewal.note ? `: "${data.renewal.note}"` : ""}
                </p>
              )}

              {profile && !data.active && (
                <button
                  onClick={() => setAssignPrefill({ profileId: profile.id, planId: expiredLast?.plan_id ?? null, renewal: !!expiredLast })}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[13px] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">{expiredLast ? "autorenew" : "add"}</span>
                  {expiredLast ? "Renovar membresía" : "Asignar membresía"}
                </button>
              )}
            </div>

            {/* Otros beneficios */}
            <div className="p-4 rounded-xl bg-on-surface/5 space-y-1.5">
              <SectionTitle icon="badge">Matrícula y packs</SectionTitle>
              <InfoRow
                label="Matrícula"
                value={data.enrollment ? `${data.enrollment.name} · hasta ${fmtDate(data.enrollment.end_date)}` : <span className="text-red-400">Sin matrícula vigente</span>}
              />
              {data.packs.map((p, i) => (
                <InfoRow key={i} label="Pack personalizado" value={`${p.name} · ${p.remaining} clases · hasta ${fmtDate(p.end_date)}`} />
              ))}
            </div>

            {/* Datos personales */}
            {profile && (
              <div className="p-4 rounded-xl bg-on-surface/5 space-y-1.5">
                <SectionTitle icon="person">Datos</SectionTitle>
                <InfoRow label="Correo" value={profile.email} />
                <InfoRow label="Teléfono" value={profile.phone || "—"} />
                <InfoRow label="RUT" value={profile.rut ? formatRut(profile.rut) : "—"} />
                <InfoRow label="Nacimiento" value={fmtDate(profile.birth_date)} />
                <InfoRow label="Dirección" value={profile.address || "—"} />
                <InfoRow label="Registro" value={fmtDate(profile.created_at)} />
                {(profile.guardian_name || profile.guardian_phone || profile.guardian_email) && (
                  <InfoRow
                    label="Apoderado"
                    value={[profile.guardian_name, profile.guardian_phone, profile.guardian_email].filter(Boolean).join(" · ")}
                  />
                )}
              </div>
            )}
          </div>
        ) : null}
      </FormModal>

      <AssignMembershipModal
        open={!!assignPrefill}
        prefill={assignPrefill}
        onClose={() => setAssignPrefill(null)}
        onSaved={() => {
          window.dispatchEvent(new Event(ADMIN_DATA_CHANGED));
        }}
      />
    </QuickViewContext.Provider>
  );
}

/** Nombre clickeable que abre la ficha rápida del alumno. */
export function UserNameButton({
  profileId,
  beneficiaryId,
  children,
  className = "",
}: {
  profileId?: string | null;
  beneficiaryId?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const { openUser } = useUserQuickView();
  if (!profileId && !beneficiaryId) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openUser(profileId ? { profileId } : { beneficiaryId: beneficiaryId as string });
      }}
      className={`text-left hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer ${className}`}
      title="Ver ficha del alumno"
    >
      {children}
    </button>
  );
}
