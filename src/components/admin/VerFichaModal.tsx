"use client";

import { useEffect, useRef, useCallback } from "react";

interface VerFichaModalProps {
  open: boolean;
  onClose: () => void;
  dependent: {
    full_name: string;
    category: string;
    rut?: string | null;
    address?: string | null;
    birth_date?: string | null;
    weight?: number | null;
    height?: number | null;
    dominant_hand?: string | null;
  } | null;
}

export default function VerFichaModal({ open, onClose, dependent }: VerFichaModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [open]);

  useEffect(() => {
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, handleEsc]);

  if (!open || !dependent) return null;

  const rows: { label: string; value: string }[] = [
    { label: "Nombre", value: dependent.full_name },
    {
      label: "Tipo",
      value: dependent.category === "nino" ? "Niño" : dependent.category === "juvenil" ? "Juvenil" : "Adulto",
    },
    {
      label: "Fecha de nacimiento",
      value: dependent.birth_date
        ? new Date(dependent.birth_date + "T12:00:00").toLocaleDateString("es-CL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "—",
    },
    { label: "RUT", value: dependent.rut || "—" },
    { label: "Dirección", value: dependent.address || "—" },
    {
      label: "Peso",
      value: dependent.weight != null ? `${dependent.weight} kg` : "—",
    },
    {
      label: "Altura",
      value: dependent.height != null ? `${dependent.height} cm` : "—",
    },
    {
      label: "Mano dominante",
      value:
        dependent.dominant_hand === "zurdo"
          ? "Zurdo"
          : dependent.dominant_hand === "diestro"
            ? "Diestro"
            : "—",
    },
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-on-surface/5">
          <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase">
            Ver Ficha
          </h2>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-full btn-primary-gradient flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-[20px]">child_care</span>
            </div>
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase truncate">
                {dependent.full_name}
              </p>
              <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                Carga de alumno
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex justify-between gap-4 font-[family-name:var(--font-body-md)] text-[13px]"
              >
                <span className="text-on-surface-variant shrink-0">{r.label}</span>
                <span className="text-on-surface text-right">{r.value}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-5 border-t border-on-surface/5 mt-5">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
