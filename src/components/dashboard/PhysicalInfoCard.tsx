"use client";

import { useState } from "react";
import { parseMedida, isValidPeso, isValidAltura, isValidDominantHand } from "@/lib/medidas";

interface PhysicalInfoCardProps {
  weight: number | null;
  height: number | null;
  dominantHand: string | null;
  onSave: (data: {
    weight: number | null;
    height: number | null;
    dominant_hand: string | null;
  }) => Promise<{ error: string | null }>;
}

export default function PhysicalInfoCard({
  weight,
  height,
  dominantHand,
  onSave,
}: PhysicalInfoCardProps) {
  const [editing, setEditing] = useState(false);
  const [peso, setPeso] = useState(weight != null ? String(weight) : "");
  const [altura, setAltura] = useState(height != null ? String(height) : "");
  const [mano, setMano] = useState(dominantHand || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const hasData = weight != null || height != null || dominantHand != null;

  const handleSave = async () => {
    if (peso.trim() && !isValidPeso(peso)) {
      setMsg("El peso debe ser mayor a 0 y hasta 300 kg.");
      return;
    }
    if (altura.trim() && !isValidAltura(altura)) {
      setMsg("La altura debe ser mayor a 0 y hasta 250 cm.");
      return;
    }
    if (mano && !isValidDominantHand(mano)) {
      setMsg("La mano dominante debe ser diestro o zurdo.");
      return;
    }
    setSaving(true);
    setMsg(null);
    const { error } = await onSave({
      weight: peso.trim() ? parseMedida(peso) : null,
      height: altura.trim() ? parseMedida(altura) : null,
      dominant_hand: mano || null,
    });
    if (error) setMsg(error);
    else {
      setMsg("Guardado correctamente");
      setEditing(false);
    }
    setSaving(false);
  };

  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-green-400 text-[20px]">
              monitoring
            </span>
          </div>
          <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">
            Datos Físicos
          </h3>
        </div>
        {!editing && (
          <button
            onClick={() => {
              setEditing(true);
              setMsg(null);
            }}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-4 py-1.5 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
          >
            {hasData ? "Editar" : "Agregar"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Peso (kg)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="Ej: 70.5"
                className="w-full bg-background border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Altura (cm)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                placeholder="Ej: 170"
                className="w-full bg-background border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Mano dominante
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["diestro", "zurdo"] as const).map((hand) => (
                <button
                  key={hand}
                  type="button"
                  onClick={() => setMano(mano === hand ? "" : hand)}
                  className={`py-2.5 rounded-lg border font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider transition-colors cursor-pointer ${
                    mano === hand
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-background border-on-surface/10 text-on-surface-variant hover:border-on-surface/20"
                  }`}
                >
                  {hand === "diestro" ? "Diestro" : "Zurdo"}
                </button>
              ))}
            </div>
          </div>

          {msg && (
            <p
              className={`font-[family-name:var(--font-body-md)] text-[13px] ${
                msg.includes("Guardado") ? "text-green-400" : "text-red-400"
              }`}
            >
              {msg}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-5 py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setMsg(null);
                setPeso(weight != null ? String(weight) : "");
                setAltura(height != null ? String(height) : "");
                setMano(dominantHand || "");
              }}
              className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant border border-on-surface/10 px-5 py-2 rounded-lg hover:bg-on-surface/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : hasData ? (
        <div className="space-y-2">
          {weight != null && (
            <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
              <span className="text-on-surface-variant">Peso</span>
              <span className="text-on-surface">{weight} kg</span>
            </div>
          )}
          {height != null && (
            <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
              <span className="text-on-surface-variant">Altura</span>
              <span className="text-on-surface">{height} cm</span>
            </div>
          )}
          {dominantHand && (
            <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
              <span className="text-on-surface-variant">Mano dominante</span>
              <span className="text-on-surface">
                {dominantHand === "zurdo" ? "Zurdo" : "Diestro"}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/50 text-center py-4">
          No hay datos físicos registrados
        </p>
      )}
    </div>
  );
}
