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

interface Beneficiary {
  id: string;
  profile_id: string | null;
  dependent_id: string | null;
  label: string;
  sublabel: string;
}

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  plan: Plan | null;
}

function formatCLP(amount: number) {
  return "$" + amount.toLocaleString("es-CL");
}

export default function CheckoutModal({
  open,
  onClose,
  plan,
}: CheckoutModalProps) {
  const { user } = useSession();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setSelectedId("");
    setError(null);
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
    const supabase = createClient();

    (async () => {
      const [ownBenRes, depsRes] = await Promise.all([
        supabase
          .from("beneficiaries")
          .select("id, profile_id, dependent_id")
          .eq("profile_id", user.id)
          .single(),
        supabase
          .from("dependents")
          .select("id, full_name, category")
          .eq("tutor_id", user.id),
      ]);

      const list: Beneficiary[] = [];

      if (ownBenRes.data) {
        list.push({
          id: ownBenRes.data.id,
          profile_id: ownBenRes.data.profile_id,
          dependent_id: ownBenRes.data.dependent_id,
          label: "Yo",
          sublabel: user.email || "",
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
            list.push({
              id: ben.id,
              profile_id: ben.profile_id,
              dependent_id: ben.dependent_id,
              label: dep.full_name,
              sublabel: `Carga · ${dep.category === "nino" ? "Niño" : "Adulto"}`,
            });
          }
        }
      }

      setBeneficiaries(list);
      if (list.length === 1) setSelectedId(list[0].id);
      setLoadingBeneficiaries(false);
    })();
  }, [open, user]);

  if (!open || !plan) return null;

  const handlePay = async () => {
    if (!selectedId || !plan) return;
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/flow/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, beneficiaryId: selectedId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al procesar pago");
        setProcessing(false);
        return;
      }

      window.location.href = `${data.url}?token=${data.token}`;
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setProcessing(false);
    }
  };

  const selectedBeneficiary = beneficiaries.find((b) => b.id === selectedId);

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
            Comprar Membresía
          </h2>
          <button
            onClick={handleClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
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

          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-2">
              ¿Para quién es la membresía? *
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
                    <div>
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

          <div className="bg-surface-container rounded-xl p-4 border border-on-surface/5 space-y-2">
            <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
              <span className="text-on-surface-variant">Plan</span>
              <span className="text-on-surface">{plan.name}</span>
            </div>
            <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
              <span className="text-on-surface-variant">Beneficiario</span>
              <span className="text-on-surface">
                {selectedBeneficiary?.label || "—"}
              </span>
            </div>
            <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
              <span className="text-on-surface-variant">Duración</span>
              <span className="text-on-surface">{plan.duration_days} días</span>
            </div>
            <div className="border-t border-on-surface/5 pt-2 flex justify-between font-[family-name:var(--font-headline-md)] text-[15px]">
              <span className="text-on-surface">Total</span>
              <span className="text-primary">{formatCLP(plan.price)}</span>
            </div>
          </div>

          {error && (
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-red-400 text-center">
              {error}
            </p>
          )}

          <button
            onClick={handlePay}
            disabled={!selectedId || processing}
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
                Pagar con Webpay
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
