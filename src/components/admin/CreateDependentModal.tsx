"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";
import { isValidRut } from "@/lib/rut";
import { parseMedida, isValidPeso, isValidAltura, isValidDominantHand } from "@/lib/medidas";

interface TutorOption {
  id: string;
  full_name: string;
  email: string | null;
  address?: string | null;
}

interface CreateDependentModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  tutors: TutorOption[];
  editingDependent?: {
    id: string;
    full_name: string;
    rut: string | null;
    birth_date: string | null;
    category: string;
    tutor_id: string;
    address: string | null;
    weight: number | null;
    height: number | null;
    dominant_hand: string | null;
  } | null;
}

export default function CreateDependentModal({
  open,
  onClose,
  onSaved,
  tutors,
  editingDependent,
}: CreateDependentModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [tutorId, setTutorId] = useState("");
  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [category, setCategory] = useState<"nino" | "adulto">("nino");
  const [address, setAddress] = useState("");
  const [sameAddress, setSameAddress] = useState(false);
  const [tutorAddress, setTutorAddress] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [dominantHand, setDominantHand] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingDependent) {
        setTutorId(editingDependent.tutor_id);
        setFullName(editingDependent.full_name);
        setRut(editingDependent.rut || "");
        setBirthDate(editingDependent.birth_date || "");
        setCategory(editingDependent.category === "adulto" ? "adulto" : "nino");
        setAddress(editingDependent.address || "");
        setWeight(editingDependent.weight != null ? String(editingDependent.weight) : "");
        setHeight(editingDependent.height != null ? String(editingDependent.height) : "");
        setDominantHand(editingDependent.dominant_hand || "");
      } else {
        setTutorId(tutors[0]?.id || "");
        setFullName("");
        setRut("");
        setBirthDate("");
        setCategory("nino");
        setAddress("");
        setWeight("");
        setHeight("");
        setDominantHand("");
      }
      setSameAddress(false);
      setTutorAddress("");
      setError(null);
    }
  }, [open, editingDependent, tutors]);

  useEffect(() => {
    if (open && tutorId) {
      const tutor = tutors.find((t) => t.id === tutorId);
      setTutorAddress(tutor?.address || "");
    }
  }, [open, tutorId, tutors]);

  const handleEsc = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") handleEsc();
      });
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", (e) => {
        if (e.key === "Escape") handleEsc();
      });
    };
  }, [open, handleEsc]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !birthDate) {
      setError("Nombre y fecha de nacimiento son obligatorios.");
      return;
    }
    if (!editingDependent && !tutorId) {
      setError("Debes seleccionar el usuario al que se asignará la carga.");
      return;
    }

    const rutTrimmed = rut.trim();
    if (rutTrimmed && !isValidRut(rutTrimmed)) {
      setError("El RUT no es válido. Usa el formato 12.345.678-9.");
      return;
    }

    if (weight.trim() && !isValidPeso(weight)) {
      setError("El peso debe ser mayor a 0 y hasta 300 kg.");
      return;
    }
    if (height.trim() && !isValidAltura(height)) {
      setError("La altura debe ser mayor a 0 y hasta 250 cm.");
      return;
    }
    if (dominantHand && !isValidDominantHand(dominantHand)) {
      setError("La mano dominante debe ser diestro o zurdo.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingDependent ? "/api/admin/update-dependent" : "/api/admin/create-dependent";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingDependent ? { dependent_id: editingDependent.id } : { tutor_id: tutorId }),
          full_name: fullName.trim(),
          rut: rutTrimmed || null,
          birth_date: birthDate,
          category,
          address: address.trim() || null,
          weight: weight.trim() ? parseMedida(weight) : null,
          height: height.trim() ? parseMedida(height) : null,
          dominant_hand: dominantHand || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al guardar la carga.");
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(getSupabaseErrorMessage(err, "guardar la carga"));
    } finally {
      setSaving(false);
    }
  };

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
            {editingDependent ? "Editar Carga" : "Crear y Asignar Carga"}
          </h2>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {!editingDependent && (
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Usuario tutor (padre/madre) *
              </label>
              <select
                value={tutorId}
                onChange={(e) => setTutorId(e.target.value)}
                className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface focus:outline-none focus:border-primary/50 transition-colors cursor-pointer"
              >
                {tutors.length === 0 && <option value="">No hay usuarios disponibles</option>}
                {tutors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}{t.email ? ` — ${t.email}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Dirección
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, número, comuna"
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50 transition-colors"
            />
            {tutorAddress && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameAddress}
                  onChange={(e) => {
                    setSameAddress(e.target.checked);
                    setAddress(e.target.checked ? tutorAddress : "");
                  }}
                  className="accent-primary w-4 h-4"
                />
                <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                  Usar la misma dirección que el tutor
                </span>
              </label>
            )}
          </div>

          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Datos físicos
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Peso (kg)"
                  className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Altura (cm)"
                  className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {(["diestro", "zurdo"] as const).map((hand) => (
                <button
                  key={hand}
                  type="button"
                  onClick={() => setDominantHand(dominantHand === hand ? "" : hand)}
                  className={`py-2.5 rounded-lg border font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider transition-colors cursor-pointer ${
                    dominantHand === hand
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-surface-container border-on-surface/10 text-on-surface-variant hover:border-on-surface/20"
                  }`}
                >
                  {hand === "diestro" ? "Diestro" : "Zurdo"}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Guardando..." : editingDependent ? "Guardar Cambios" : "Crear Carga"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
