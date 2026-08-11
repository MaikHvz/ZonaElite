"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "./ImageUpload";
import {
  PODIUM_POSITIONS,
  SUGGESTED_CATEGORIES,
} from "@/lib/sport-profile";
import type { SportPodiumData } from "@/lib/sport-profile";

export interface PodiumFormState {
  id?: string;
  tournament: string;
  event_date: string;
  discipline_id: string;
  category: string;
  position: string;
  description: string;
  image_url: string | null;
}

interface PodiumFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  beneficiaryId: string;
  podium?: SportPodiumData | null;
  disciplines: { id: string; name: string }[];
}

export default function PodiumFormModal({
  open,
  onClose,
  onSaved,
  beneficiaryId,
  podium,
  disciplines,
}: PodiumFormModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<PodiumFormState>({
    tournament: "",
    event_date: "",
    discipline_id: "",
    category: "",
    position: "1",
    description: "",
    image_url: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    },
    [onClose, saving]
  );

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  useEffect(() => {
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, handleEsc]);

  useEffect(() => {
    if (open) {
      setError(null);
      setForm(
        podium
          ? {
              id: podium.id,
              tournament: podium.tournament,
              event_date: podium.event_date,
              discipline_id: podium.discipline_id || "",
              category: podium.category || "",
              position: podium.position,
              description: podium.description || "",
              image_url: podium.image_url,
            }
          : {
              tournament: "",
              event_date: "",
              discipline_id: disciplines[0]?.id || "",
              category: "",
              position: "1",
              description: "",
              image_url: null,
            }
      );
    }
  }, [open, podium, disciplines]);

  if (!open) return null;

  const validate = () => {
    if (!form.tournament.trim()) return "El torneo es obligatorio";
    if (!form.event_date) return "La fecha es obligatoria";
    if (!form.discipline_id) return "Selecciona la disciplina";
    return null;
  };

  const handleSave = async () => {
    const vError = validate();
    if (vError) {
      setError(vError);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const supabase = createClient();
      const payload = {
        beneficiary_id: beneficiaryId,
        tournament: form.tournament.trim(),
        event_date: form.event_date,
        discipline_id: form.discipline_id,
        category: form.category.trim() || null,
        position: form.position,
        description: form.description.trim() || null,
        image_url: form.image_url,
      };
      const { error: dbError } = form.id
        ? await supabase.from("sports_podiums").update(payload).eq("id", form.id)
        : await supabase.from("sports_podiums").insert(payload);
      if (dbError) throw dbError;
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el podio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current && !saving) onClose();
      }}
    >
      <div className="modal-panel modal-panel-md">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-[family-name:var(--font-headline-md)] uppercase tracking-wide text-on-surface">
            {form.id ? "Editar podio" : "Nuevo podio"}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
              Torneo / Competencia *
            </label>
            <input
              type="text"
              value={form.tournament}
              onChange={(e) => setForm({ ...form, tournament: e.target.value })}
              placeholder="Ej. Torneo Nacional de Kempo 2026"
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 placeholder:text-on-surface/30"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
                Fecha *
              </label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
                Disciplina *
              </label>
              <select
                value={form.discipline_id}
                onChange={(e) => setForm({ ...form, discipline_id: e.target.value })}
                className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                {disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
                Resultado *
              </label>
              <select
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                {PODIUM_POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.emoji} {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
                Categoría
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ej. Juvenil, -60 kg, Kata"
                list="podium-categories"
                className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 placeholder:text-on-surface/30"
              />
              <datalist id="podium-categories">
                {SUGGESTED_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Detalle opcional del torneo o desempeño"
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 placeholder:text-on-surface/30 resize-none"
            />
          </div>

          <ImageUpload
            value={form.image_url}
            onChange={(url) => setForm({ ...form, image_url: url })}
            folder="podiums"
            label="Foto del podio"
          />

          {error && <p className="text-red-400 text-[13px]">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Guardar podio"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
