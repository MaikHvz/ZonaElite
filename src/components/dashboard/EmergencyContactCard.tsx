"use client";

import { useState } from "react";
import type { MedicalRecord } from "@/lib/supabase/dashboard";

interface EmergencyContactCardProps {
  record: MedicalRecord | null;
  beneficiaryId: string;
  onSave: (data: {
    contacto_emergencia_nombre: string;
    contacto_emergencia_telefono: string;
  }) => Promise<{ error: string | null }>;
}

export default function EmergencyContactCard({
  record,
  beneficiaryId,
  onSave,
}: EmergencyContactCardProps) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(
    record?.contacto_emergencia_nombre || ""
  );
  const [telefono, setTelefono] = useState(
    record?.contacto_emergencia_telefono || ""
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const hasData = record?.contacto_emergencia_nombre;

  const handleSave = async () => {
    if (!nombre.trim()) {
      setMsg("El nombre del contacto es obligatorio");
      return;
    }
    setSaving(true);
    setMsg(null);
    const { error } = await onSave({
      contacto_emergencia_nombre: nombre,
      contacto_emergencia_telefono: telefono,
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
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-400 text-[20px]">
              emergency
            </span>
          </div>
          <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">
            Contacto de Emergencia
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
          <div>
            <label className="flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
              <span className="material-symbols-outlined text-[14px]">person</span>
              Nombre completo
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del contacto"
              className="w-full bg-background border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
              <span className="material-symbols-outlined text-[14px]">call</span>
              Teléfono
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+56 9 XXXX XXXX"
              className="w-full bg-background border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
            />
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
                setNombre(record?.contacto_emergencia_nombre || "");
                setTelefono(record?.contacto_emergencia_telefono || "");
              }}
              className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant border border-on-surface/10 px-5 py-2 rounded-lg hover:bg-on-surface/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : hasData ? (
        <div className="space-y-3">
          <div>
            <span className="flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">
              <span className="material-symbols-outlined text-[12px]">person</span>
              Nombre
            </span>
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface pl-5">
              {record!.contacto_emergencia_nombre}
            </p>
          </div>
          {record!.contacto_emergencia_telefono && (
            <div>
              <span className="flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">
                <span className="material-symbols-outlined text-[12px]">call</span>
                Teléfono
              </span>
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface pl-5">
                {record!.contacto_emergencia_telefono}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/50 text-center py-4">
          No hay contacto de emergencia registrado
        </p>
      )}
    </div>
  );
}
