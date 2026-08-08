"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isValidRut } from "@/lib/rut";

interface AddDependentModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  tutorId: string;
}

export default function AddDependentModal({
  open,
  onClose,
  onAdded,
  tutorId,
}: AddDependentModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [category, setCategory] = useState<"nino" | "adulto">("nino");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFullName("");
    setRut("");
    setBirthDate("");
    setCategory("nino");
    setError(null);
  };

  const handleClose = useCallback(() => {
    reset();
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

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !birthDate) {
      setError("Nombre y fecha de nacimiento son obligatorios.");
      return;
    }

    const rutTrimmed = rut.trim();
    if (rutTrimmed && !isValidRut(rutTrimmed)) {
      setError("El RUT no es válido. Usa el formato 12.345.678-9.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("dependents").insert({
      tutor_id: tutorId,
      full_name: fullName.trim(),
      rut: rutTrimmed || null,
      birth_date: birthDate,
      category,
    });

    setSaving(false);

    if (insertError) {
      setError("Error al guardar. Intenta de nuevo.");
      console.error(insertError);
      return;
    }

    reset();
    onAdded();
    onClose();
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
            Agregar Carga
          </h2>
          <button
            onClick={handleClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Nombre completo *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              RUT (opcional)
            </label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="Ej: 12.345.678-9"
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Fecha de nacimiento *
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Categoría *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["nino", "adulto"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-2.5 rounded-lg border font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider transition-colors cursor-pointer ${
                    category === cat
                      ? cat === "nino"
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                        : "bg-green-500/15 border-green-500/40 text-green-400"
                      : "bg-surface-container border-on-surface/10 text-on-surface-variant hover:border-on-surface/20"
                  }`}
                >
                  {cat === "nino" ? "Niño" : "Adulto"}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider py-3 rounded-lg transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Guardando..." : "Agregar carga"}
          </button>
        </form>
      </div>
    </div>
  );
}
