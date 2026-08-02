"use client";

import React from "react";
import Link from "next/navigation";

export interface PaymentSuccessDetails {
  concept: string;
  amount: number;
  orderId?: string;
  paidAt?: string;
  beneficiaryName?: string;
}

interface PaymentSuccessModalProps {
  open: boolean;
  onClose: () => void;
  details: PaymentSuccessDetails | null;
}

export default function PaymentSuccessModal({
  open,
  onClose,
  details,
}: PaymentSuccessModalProps) {
  if (!open) return null;

  const concept = details?.concept || "Membresía / Plan Adquirido";
  const amountFormatted = details?.amount
    ? `$${details.amount.toLocaleString("es-CL")}`
    : null;
  const beneficiary = details?.beneficiaryName || "Titular";
  const orderId = details?.orderId || "—";
  const fecha = details?.paidAt
    ? new Date(details.paidAt).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-surface-container-lowest border border-green-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(34,197,94,0.15)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fondo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Ícono animado */}
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 p-0.5 shadow-lg shadow-green-500/30 mb-4 animate-bounce-short">
            <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center">
              <span className="material-symbols-outlined text-[44px] text-green-400">
                task_alt
              </span>
            </div>
          </div>

          <h2 className="font-[family-name:var(--font-headline-lg)] text-[24px] sm:text-[28px] text-on-surface uppercase tracking-tight font-bold">
            ¡Pago <span className="text-green-400">Exitoso</span>!
          </h2>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] sm:text-[14px] text-on-surface-variant mt-1">
            Tu transacción fue procesada correctamente.
          </p>

          {/* Tarjeta de Resumen de Compra */}
          <div className="w-full mt-6 bg-surface-container/60 border border-on-surface/10 rounded-2xl p-4 sm:p-5 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-on-surface/10 pb-3">
              <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                Resumen de Compra
              </span>
              <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-semibold">
                Confirmado
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">
                  Ítem / Concepto
                </p>
                <p className="font-[family-name:var(--font-headline-md)] text-[14px] text-on-surface font-semibold mt-0.5">
                  {concept}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">
                    Beneficiario
                  </p>
                  <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface mt-0.5 truncate">
                    {beneficiary}
                  </p>
                </div>
                {amountFormatted && (
                  <div>
                    <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">
                      Monto Pagado
                    </p>
                    <p className="font-[family-name:var(--font-headline-md)] text-[14px] text-green-400 font-bold mt-0.5">
                      {amountFormatted}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-on-surface/5">
                <div>
                  <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">
                    Fecha
                  </p>
                  <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant/80 mt-0.5">
                    {fecha}
                  </p>
                </div>
                <div>
                  <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">
                    N° Orden
                  </p>
                  <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant/80 mt-0.5 font-mono">
                    #{orderId}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="w-full flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-[family-name:var(--font-headline-md)] text-[12px] uppercase tracking-wider text-center font-bold shadow-lg shadow-green-500/20 hover:brightness-110 transition-all cursor-pointer"
            >
              OK
            </button>
            <a
              href="/dashboard/membresias"
              className="py-3 px-5 rounded-xl border border-on-surface/15 text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 font-[family-name:var(--font-headline-md)] text-[12px] uppercase tracking-wider text-center transition-colors cursor-pointer"
            >
              Ver Membresías
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
