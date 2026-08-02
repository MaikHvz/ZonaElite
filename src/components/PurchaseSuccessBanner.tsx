"use client";

import { useState } from "react";

export default function PurchaseSuccessBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="glass-panel rounded-xl p-4 border-l-4 border-green-500 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-green-400 text-[22px]">
          check_circle
        </span>
        <div>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            ¡Pago exitoso! Tu membresía ha sido activada.
          </p>
          <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant mt-0.5">
            Revisa tu historial de pagos y el estado de tu membresía.
          </p>
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  );
}

export function PurchaseFailedBanner({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="glass-panel rounded-xl p-4 border-l-4 border-red-500 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-red-400 text-[22px]">
          error
        </span>
        <div>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            {title || "El pago no pudo ser procesado."}
          </p>
          <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant mt-0.5">
            {description ||
              "Si el problema persiste, contacta a la academia."}
          </p>
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  );
}

export function PurchasePendingBanner({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="glass-panel rounded-xl p-4 border-l-4 border-amber-400 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-amber-400 text-[22px]">
          schedule
        </span>
        <div>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            {title || "Tu pago está pendiente de confirmación."}
          </p>
          <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant mt-0.5">
            {description ||
              "Se confirmará automáticamente cuando Flow procese el pago."}
          </p>
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  );
}
