"use client";

import { useState } from "react";
import type { MedicalRecord } from "@/lib/supabase/dashboard";

interface MedicalInfoCardProps {
  record: MedicalRecord | null;
  beneficiaryId: string;
  onSave: (data: {
    enfermedades: string;
    lesiones: string;
    medicamentos: string;
    alergias: string;
  }) => Promise<{ error: string | null }>;
}

export default function MedicalInfoCard({
  record,
  beneficiaryId,
  onSave,
}: MedicalInfoCardProps) {
  const [editing, setEditing] = useState(false);
  const [enfermedades, setEnfermedades] = useState(
    record?.enfermedades || ""
  );
  const [lesiones, setLesiones] = useState(record?.lesiones || "");
  const [medicamentos, setMedicamentos] = useState(
    record?.medicamentos || ""
  );
  const [alergias, setAlergias] = useState(record?.alergias || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const hasData = record?.enfermedades || record?.lesiones || record?.medicamentos || record?.alergias;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const { error } = await onSave({
      enfermedades,
      lesiones,
      medicamentos,
      alergias,
    });
    if (error) setMsg(error);
    else {
      setMsg("Guardado correctamente");
      setEditing(false);
    }
    setSaving(false);
  };

  const fields = [
    { label: "Enfermedades", value: enfermedades, set: setEnfermedades, icon: "medical_services" },
    { label: "Lesiones", value: lesiones, set: setLesiones, icon: "healing" },
    { label: "Medicamentos", value: medicamentos, set: setMedicamentos, icon: "medication" },
    { label: "Alergias", value: alergias, set: setAlergias, icon: "warning" },
  ];

  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-400 text-[20px]">
              medical_information
            </span>
          </div>
          <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">
            Ficha Médica
          </h3>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-4 py-1.5 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
          >
            {hasData ? "Editar" : "Agregar"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.label}>
              <label className="flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
                <span className="material-symbols-outlined text-[14px]">
                  {f.icon}
                </span>
                {f.label}
              </label>
              <textarea
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                rows={2}
                placeholder={`Información sobre ${f.label.toLowerCase()}...`}
                className="w-full bg-background border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 resize-none"
              />
            </div>
          ))}

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
                setEnfermedades(record?.enfermedades || "");
                setLesiones(record?.lesiones || "");
                setMedicamentos(record?.medicamentos || "");
                setAlergias(record?.alergias || "");
              }}
              className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant border border-on-surface/10 px-5 py-2 rounded-lg hover:bg-on-surface/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : hasData ? (
        <div className="space-y-3">
          {fields.map((f) =>
            f.value ? (
              <div key={f.label}>
                <span className="flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">
                  <span className="material-symbols-outlined text-[12px]">
                    {f.icon}
                  </span>
                  {f.label}
                </span>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface pl-5">
                  {f.value}
                </p>
              </div>
            ) : null
          )}
        </div>
      ) : (
        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/50 text-center py-4">
          No hay información médica registrada
        </p>
      )}
    </div>
  );
}
