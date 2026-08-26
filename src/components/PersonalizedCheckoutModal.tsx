"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useSession } from "@/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import type { PersonalizedPlanData } from "@/lib/supabase/dashboard";
import { getPaymentSettings, type BankAccount } from "@/lib/payment-settings";
import TransferPaymentStep from "@/components/TransferPaymentStep";

interface BeneficiaryOption {
  id: string;
  label: string;
  sublabel: string;
}

interface PersonalizedCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  defaultBeneficiaryId?: string | null;
}

function formatCLP(amount: number) {
  return "$" + amount.toLocaleString("es-CL");
}

export default function PersonalizedCheckoutModal({
  open,
  onClose,
  defaultBeneficiaryId = null,
}: PersonalizedCheckoutModalProps) {
  const { user } = useSession();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState("");
  const [plans, setPlans] = useState<PersonalizedPlanData[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [bank, setBank] = useState<BankAccount | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);

  const handleClose = useCallback(() => {
    setSelectedBeneficiaryId("");
    setError(null);
    setShowTransfer(false);
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

    setLoading(true);
    setError(null);
    const supabase = createClient();

    getPaymentSettings(supabase).then((settings) => {
      setManualMode(settings.personalized === "manual");
      setBank(settings.bank);
    });

    (async () => {
      try {
        const [ownBenRes, depsRes, plansRes] = await Promise.all([
          supabase
            .from("beneficiaries")
            .select("id")
            .eq("profile_id", user.id)
            .maybeSingle(),
          supabase
            .from("dependents")
            .select("id, full_name, category, beneficiaries(id)")
            .eq("tutor_id", user.id),
          supabase
            .from("personalized_plans")
            .select("id, name, price, total_classes, validity_days, features")
            .eq("active", true)
            .order("price"),
        ]);

        setPlans((plansRes.data as PersonalizedPlanData[]) || []);

        const list: BeneficiaryOption[] = [];

        if (ownBenRes.data) {
          list.push({
            id: ownBenRes.data.id,
            label: "Yo",
            sublabel: user.email || "Titular",
          });
        }

        for (const dep of depsRes.data || []) {
          const bRaw = (dep as unknown as { beneficiaries: unknown }).beneficiaries;
          const bId = Array.isArray(bRaw) ? (bRaw[0] as { id: string })?.id : (bRaw as { id: string } | null)?.id;
          if (bId) {
            list.push({
              id: bId,
              label: dep.full_name,
              sublabel: `Carga · ${dep.category === "nino" ? "Niño" : dep.category === "juvenil" ? "Juvenil" : "Adulto"}`,
            });
          }
        }

        setBeneficiaries(list);

        if (defaultBeneficiaryId && list.some((b) => b.id === defaultBeneficiaryId)) {
          setSelectedBeneficiaryId(defaultBeneficiaryId);
        } else if (list.length === 1) {
          setSelectedBeneficiaryId(list[0].id);
        }
      } catch {
        setError("Error al cargar datos. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user, defaultBeneficiaryId]);

  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  if (!open) return null;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const selectedBeneficiary = beneficiaries.find((b) => b.id === selectedBeneficiaryId);
  const totalAmount = selectedPlan?.price || 0;

  const doCreateOrder = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch("/api/flow/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: selectedBeneficiaryId,
          personalizedPlanId: selectedPlanId,
        }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setError("Tu sesión expiró. Inicia sesión nuevamente para pagar.");
        } else {
          setError(data.error || "Error al procesar pago");
        }
        return;
      }

      if (data.status === "already_paid") {
        window.location.href = `/dashboard/pagos?token=${encodeURIComponent(data.token)}`;
        return;
      }

      const flowUrl = new URL(data.url);
      flowUrl.searchParams.set("token", data.token);
      window.location.href = flowUrl.toString();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("El pago tardó demasiado. Intenta de nuevo.");
      } else {
        setError("Error de conexión. Intenta de nuevo.");
      }
    } finally {
      clearTimeout(timeoutId);
      setProcessing(false);
    }
  };

  const handlePay = async () => {
    if (!selectedBeneficiaryId || !selectedPlanId) return;
    if (manualMode) {
      setShowTransfer(true);
      setError(null);
      return;
    }
    setProcessing(true);
    setError(null);
    await doCreateOrder();
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
            Comprar Clases Personalizadas
          </h2>
          <button
            onClick={handleClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-surface-container animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Beneficiary selection */}
              <div>
                <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-2">
                  ¿Para quién es el pack? *
                </label>
                {beneficiaries.length === 0 ? (
                  <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                    No se encontró tu perfil de beneficiario.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {beneficiaries.map((b) => (
                      <label
                        key={b.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedBeneficiaryId === b.id
                            ? "border-primary bg-primary/5"
                            : "border-on-surface/10 hover:border-on-surface/20"
                        }`}
                      >
                        <input
                          type="radio"
                          name="personalized-beneficiary"
                          checked={selectedBeneficiaryId === b.id}
                          onChange={() => setSelectedBeneficiaryId(b.id)}
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
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Plan selection */}
              {plans.length > 0 && (
                <div>
                  <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-2">
                    Selecciona un plan *
                  </label>
                  <div className="space-y-2">
                    {plans.map((p) => (
                      <label
                        key={p.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPlanId === p.id
                            ? "border-primary bg-primary/5"
                            : "border-on-surface/10 hover:border-on-surface/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="personalized-plan"
                            checked={selectedPlanId === p.id}
                            onChange={() => setSelectedPlanId(p.id)}
                            className="accent-primary"
                          />
                          <div>
                            <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
                              {p.name}
                            </p>
                            <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">
                              {p.total_classes} {p.total_classes === 1 ? "clase" : "clases"} · vigencia {p.validity_days} días
                            </p>
                          </div>
                        </div>
                        <span className="font-[family-name:var(--font-headline-md)] text-[15px] text-primary">
                          {formatCLP(p.price)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {plans.length === 0 && (
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant text-center">
                  No hay planes de clases personalizadas disponibles por ahora.
                </p>
              )}

              {/* Payment summary */}
              {selectedPlan && (
                <div className="bg-surface-container rounded-xl p-4 border border-on-surface/5 space-y-2">
                  <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                    <span className="text-on-surface-variant">Pack {selectedPlan.name}</span>
                    <span className="text-on-surface">{formatCLP(selectedPlan.price)}</span>
                  </div>
                  <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                    <span className="text-on-surface-variant">Beneficiario</span>
                    <span className="text-on-surface">{selectedBeneficiary?.label || "—"}</span>
                  </div>
                  <div className="border-t border-on-surface/5 pt-2 flex justify-between font-[family-name:var(--font-headline-md)] text-[15px]">
                    <span className="text-on-surface">Total</span>
                    <span className="text-primary">{formatCLP(totalAmount)}</span>
                  </div>
                </div>
              )}

              {error && (
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-red-400 text-center">
                  {error}
                </p>
              )}

              {manualMode && showTransfer && selectedBeneficiaryId && selectedPlanId && bank ? (
                <TransferPaymentStep
                  productType="personalized"
                  amount={totalAmount}
                  bank={bank}
                  beneficiaryId={selectedBeneficiaryId}
                  planId={selectedPlanId}
                />
              ) : (
                <>
                  {manualMode && !bank && (
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-red-400 text-center">
                      La academia aún no configura el pago por transferencia. Intenta más tarde.
                    </p>
                  )}

                  <button
                    onClick={handlePay}
                    disabled={!selectedBeneficiaryId || !selectedPlanId || processing || (manualMode && !bank)}
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
                          {manualMode ? "account_balance" : "credit_card"}
                        </span>
                        {manualMode ? "Pagar por transferencia" : "Pagar con Flow"}
                      </>
                    )}
                  </button>

                  <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant/50 text-center">
                    {manualMode
                      ? "Selecciona el botón para ver los datos bancarios y enviar tu comprobante."
                      : "Serás redirigido a Flow para completar el pago de forma segura."}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
