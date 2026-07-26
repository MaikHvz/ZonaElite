"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useSession } from "@/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  category: string;
  benefits: string[];
}

export interface EnrollmentPlan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

interface Beneficiary {
  id: string;
  profile_id: string | null;
  dependent_id: string | null;
  label: string;
  sublabel: string;
  hasActiveEnrollment: boolean;
  enrollmentEndDate: string | null;
  enrollmentPlanName: string | null;
}

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  plan: Plan | null;
  mode?: "membership" | "enrollment-only";
}

function formatCLP(amount: number) {
  return "$" + amount.toLocaleString("es-CL");
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function CheckoutModal({
  open,
  onClose,
  plan,
  mode = "membership",
}: CheckoutModalProps) {
  const { user } = useSession();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enrollmentPlans, setEnrollmentPlans] = useState<EnrollmentPlan[]>([]);
  const [includeEnrollment, setIncludeEnrollment] = useState(false);
  const [selectedEnrollmentPlanId, setSelectedEnrollmentPlanId] = useState("");

  const handleClose = useCallback(() => {
    setSelectedId("");
    setError(null);
    setIncludeEnrollment(false);
    setSelectedEnrollmentPlanId("");
    onClose();
  }, [onClose]);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    },
    [handleClose]
  );

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEsc);
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open, handleEsc]);

  useEffect(() => {
    if (!open || !user) return;

    setLoadingBeneficiaries(true);
    setIncludeEnrollment(false);
    setSelectedEnrollmentPlanId("");
    const supabase = createClient();

    (async () => {
      try {
        const [ownBenRes, depsRes, enrollPlansRes] = await Promise.all([
        supabase
          .from("beneficiaries")
          .select("id, profile_id, dependent_id")
          .eq("profile_id", user.id)
          .single(),
        supabase
          .from("dependents")
          .select("id, full_name, category")
          .eq("tutor_id", user.id),
        supabase
          .from("enrollment_plans")
          .select("id, name, price, duration_days")
          .eq("active", true)
          .order("sort_order"),
      ]);

      setEnrollmentPlans((enrollPlansRes.data as EnrollmentPlan[]) || []);

      const list: Beneficiary[] = [];

      if (ownBenRes.data) {
        const { data: enroll } = await supabase
          .from("academy_enrollments")
          .select("end_date, enrollment_plans(name)")
          .eq("beneficiary_id", ownBenRes.data.id)
          .eq("status", "activa")
          .gte("end_date", new Date().toISOString().split("T")[0])
          .maybeSingle();

        const hasActive = !!enroll;
        const e = enroll as { end_date: string; enrollment_plans?: { name: string } } | null;

        list.push({
          id: ownBenRes.data.id,
          profile_id: ownBenRes.data.profile_id,
          dependent_id: ownBenRes.data.dependent_id,
          label: "Yo",
          sublabel: user.email || "",
          hasActiveEnrollment: hasActive,
          enrollmentEndDate: hasActive ? e?.end_date || null : null,
          enrollmentPlanName: hasActive ? e?.enrollment_plans?.name || null : null,
        });
      }

      if (depsRes.data && depsRes.data.length > 0) {
        const depIds = depsRes.data.map((d) => d.id);
        const { data: depBeneficiaries } = await supabase
          .from("beneficiaries")
          .select("id, profile_id, dependent_id")
          .in("dependent_id", depIds);

        for (const dep of depsRes.data) {
          const ben = depBeneficiaries?.find(
            (b) => b.dependent_id === dep.id
          );
          if (ben) {
            const { data: enroll } = await supabase
              .from("academy_enrollments")
              .select("end_date, enrollment_plans(name)")
              .eq("beneficiary_id", ben.id)
              .eq("status", "activa")
              .gte("end_date", new Date().toISOString().split("T")[0])
              .maybeSingle();

            const hasActive = !!enroll;
            const e = enroll as { end_date: string; enrollment_plans?: { name: string } } | null;

            list.push({
              id: ben.id,
              profile_id: ben.profile_id,
              dependent_id: ben.dependent_id,
              label: dep.full_name,
              sublabel: `Carga · ${dep.category === "nino" ? "Niño" : "Adulto"}`,
              hasActiveEnrollment: hasActive,
              enrollmentEndDate: hasActive ? e?.end_date || null : null,
              enrollmentPlanName: hasActive ? e?.enrollment_plans?.name || null : null,
            });
          }
        }
      }

      setBeneficiaries(list);
      if (list.length === 1) setSelectedId(list[0].id);
      } catch {
        setError("Error al cargar datos. Intenta de nuevo.");
      } finally {
        setLoadingBeneficiaries(false);
      }
    })();
  }, [open, user]);

  useEffect(() => {
    if (!includeEnrollment && enrollmentPlans.length > 0 && !selectedEnrollmentPlanId) {
      setSelectedEnrollmentPlanId(enrollmentPlans[0].id);
    }
  }, [includeEnrollment, enrollmentPlans, selectedEnrollmentPlanId]);

  // Force enrollment when selected beneficiary has no active enrollment
  useEffect(() => {
    const ben = beneficiaries.find((b) => b.id === selectedId);
    if (ben && !ben.hasActiveEnrollment && mode === "membership") {
      setIncludeEnrollment(true);
      if (enrollmentPlans.length > 0 && !selectedEnrollmentPlanId) {
        setSelectedEnrollmentPlanId(enrollmentPlans[0].id);
      }
    }
  }, [selectedId, beneficiaries, mode, enrollmentPlans, selectedEnrollmentPlanId]);

  if (!open || (!plan && mode === "membership")) return null;
  if (!open && mode === "enrollment-only") return null;

  const selectedBeneficiary = beneficiaries.find((b) => b.id === selectedId);
  const selectedEnrollmentPlan = enrollmentPlans.find((p) => p.id === selectedEnrollmentPlanId);
  const showEnrollmentSection = mode === "enrollment-only" || (mode === "membership" && includeEnrollment);
  const beneficiaryNeedsEnrollment = selectedBeneficiary && !selectedBeneficiary.hasActiveEnrollment;

  const totalAmount = (mode === "membership" && plan ? plan.price : 0) +
    (showEnrollmentSection && selectedEnrollmentPlan ? selectedEnrollmentPlan.price : 0);

  const handlePay = async () => {
    if (!selectedId) return;
    if (mode === "membership" && !plan) return;
    if (mode === "enrollment-only" && !selectedEnrollmentPlanId) return;
    setProcessing(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        beneficiaryId: selectedId,
      };

      if (mode === "membership" && plan) {
        body.planId = plan.id;
      }

      if (showEnrollmentSection && selectedEnrollmentPlan) {
        body.includeEnrollment = true;
        body.enrollmentPlanId = selectedEnrollmentPlan.id;
      }

      const res = await fetch("/api/flow/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al procesar pago");
        setProcessing(false);
        return;
      }

      const flowUrl = new URL(data.url);
      flowUrl.searchParams.set("token", data.token);
      window.location.href = flowUrl.toString();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setProcessing(false);
    }
  };

  const getEnrollmentLabel = () => {
    if (!selectedBeneficiary) return "";
    if (selectedBeneficiary.hasActiveEnrollment) {
      return `Vigente hasta ${formatDate(selectedBeneficiary.enrollmentEndDate || "")}`;
    }
    if (selectedEnrollmentPlan) {
      const baseDate = selectedBeneficiary.enrollmentEndDate || new Date().toISOString().split("T")[0];
      const newEnd = addDays(baseDate, selectedEnrollmentPlan.duration_days);
      return `Vigente hasta ${formatDate(newEnd)}`;
    }
    return "";
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-on-surface/5">
          <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase">
            {mode === "enrollment-only" ? "Comprar Inscripción" : "Comprar Membresía"}
          </h2>
          <button
            onClick={handleClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Plan card (membership) */}
          {mode === "membership" && plan && (
            <div className="bg-surface-container rounded-xl p-4 border border-on-surface/5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">
                  {plan.name}
                </h3>
                <span className="font-[family-name:var(--font-headline-md)] text-[18px] text-primary">
                  {formatCLP(plan.price)}
                </span>
              </div>
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                {plan.duration_days} días ·{" "}
                {plan.category === "nino" ? "Niños" : "Adultos"}
              </p>
              {plan.benefits && plan.benefits.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {plan.benefits.slice(0, 3).map((b: string) => (
                    <li
                      key={b}
                      className="flex items-center gap-2 font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined text-primary text-[14px]">
                        check_circle
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Beneficiary selection */}
          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-2">
              {mode === "enrollment-only" ? "¿Para quién es la inscripción?" : "¿Para quién es la membresía?"} *
            </label>
            {loadingBeneficiaries ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-lg bg-surface-container animate-pulse"
                  />
                ))}
              </div>
            ) : beneficiaries.length === 0 ? (
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                No se encontró tu perfil de beneficiario.
              </p>
            ) : (
              <div className="space-y-2">
                {beneficiaries.map((b) => (
                  <label
                    key={b.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedId === b.id
                        ? "border-primary bg-primary/5"
                        : "border-on-surface/10 hover:border-on-surface/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="checkout-beneficiary"
                      checked={selectedId === b.id}
                      onChange={() => setSelectedId(b.id)}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
                        {b.label}
                      </p>
                      <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                        {b.sublabel}
                      </p>
                    </div>
                    {b.hasActiveEnrollment ? (
                      <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-green-400 flex items-center gap-1 flex-shrink-0">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Inscrito
                      </span>
                    ) : (
                      <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-red-400 flex items-center gap-1 flex-shrink-0">
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        Sin inscripción
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Enrollment section */}
          {selectedId && enrollmentPlans.length > 0 && (
            <div className={`rounded-xl p-4 border space-y-3 ${
              selectedBeneficiary?.hasActiveEnrollment
                ? "bg-green-500/5 border-green-500/20"
                : "bg-surface-container border-on-surface/5"
            }`}>
              {selectedBeneficiary?.hasActiveEnrollment ? (
                /* === ACTIVE ENROLLMENT: positive feedback === */
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-green-400 text-[24px]">check_circle</span>
                  <div>
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-green-400 font-medium">
                      Inscripción activa
                    </p>
                    <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                      Vigente hasta <strong className="text-on-surface">{formatDate(selectedBeneficiary.enrollmentEndDate || "")}</strong>
                      {selectedBeneficiary.enrollmentPlanName && ` — ${selectedBeneficiary.enrollmentPlanName}`}
                    </p>
                  </div>
                </div>
              ) : (
                /* === NO ENROLLMENT: mandatory purchase === */
                <>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-400 text-[20px]">warning</span>
                    <h4 className="font-[family-name:var(--font-headline-md)] text-[14px] text-on-surface uppercase">
                      Sin inscripción a la academia
                    </h4>
                  </div>
                  <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                    <strong className="text-red-400">{selectedBeneficiary?.label}</strong> no tiene una inscripción vigente. Debes incluirla para poder comprar la membresía.
                  </p>

                  <div className="space-y-2">
                    <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block">
                      Seleccionar plan de inscripción
                    </label>
                    <div className="space-y-1">
                      {enrollmentPlans.map((ep) => (
                        <label
                          key={ep.id}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedEnrollmentPlanId === ep.id
                              ? "border-primary bg-primary/5"
                              : "border-on-surface/10 hover:border-on-surface/20"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="enrollment-plan"
                              checked={selectedEnrollmentPlanId === ep.id}
                              onChange={() => setSelectedEnrollmentPlanId(ep.id)}
                              className="accent-primary"
                            />
                            <div>
                              <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{ep.name}</p>
                              <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">{ep.duration_days} días</p>
                            </div>
                          </div>
                          <span className="font-[family-name:var(--font-headline-md)] text-[15px] text-primary">
                            {formatCLP(ep.price)}
                          </span>
                        </label>
                      ))}
                    </div>
                    {selectedEnrollmentPlan && (
                      <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant/60">
                        {getEnrollmentLabel()}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Payment summary */}
          <div className="bg-surface-container rounded-xl p-4 border border-on-surface/5 space-y-2">
            {mode === "membership" && plan && (
              <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                <span className="text-on-surface-variant">Membresía {plan.name}</span>
                <span className="text-on-surface">{formatCLP(plan.price)}</span>
              </div>
            )}
            {showEnrollmentSection && selectedEnrollmentPlan && !selectedBeneficiary?.hasActiveEnrollment && (
              <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                <span className="text-on-surface-variant">Inscripción {selectedEnrollmentPlan.name}</span>
                <span className="text-on-surface">{formatCLP(selectedEnrollmentPlan.price)}</span>
              </div>
            )}
            <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
              <span className="text-on-surface-variant">Beneficiario</span>
              <span className="text-on-surface">
                {selectedBeneficiary?.label || "—"}
              </span>
            </div>
            {mode === "membership" && plan && (
              <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                <span className="text-on-surface-variant">Duración membresía</span>
                <span className="text-on-surface">{plan.duration_days} días</span>
              </div>
            )}
            <div className="border-t border-on-surface/5 pt-2 flex justify-between font-[family-name:var(--font-headline-md)] text-[15px]">
              <span className="text-on-surface">Total</span>
              <span className="text-primary">{formatCLP(totalAmount)}</span>
            </div>
          </div>

          {error && (
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-red-400 text-center">
              {error}
            </p>
          )}

          <button
            onClick={handlePay}
            disabled={!selectedId || processing || (showEnrollmentSection && !selectedEnrollmentPlanId && !selectedBeneficiary?.hasActiveEnrollment) || (mode === "enrollment-only" && !!selectedBeneficiary?.hasActiveEnrollment) || (mode === "membership" && !selectedBeneficiary?.hasActiveEnrollment && !selectedEnrollmentPlanId)}
            className="w-full btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider py-3 rounded-lg transition-opacity disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Procesando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">
                  credit_card
                </span>
                Pagar con Flow
              </>
            )}
          </button>

          <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant/50 text-center">
            Serás redirigido a Flow para completar el pago de forma segura.
          </p>
        </div>
      </div>
    </div>
  );
}
