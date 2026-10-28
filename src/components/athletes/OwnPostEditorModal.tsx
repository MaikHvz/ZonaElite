"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getChileToday } from "@/lib/dates";
import { PODIUM_POSITIONS } from "@/lib/sport-profile";
import {
  OWN_POST_KINDS,
  validateOwnPost,
  type AthleteOwnPost,
  type OwnPostDraft,
} from "@/lib/athlete-profile";

const BELT_COLORS = [
  { label: "Blanco", value: "#f5f5f5" },
  { label: "Amarillo", value: "#f5c518" },
  { label: "Naranja", value: "#f28c28" },
  { label: "Verde", value: "#2e9e4f" },
  { label: "Azul", value: "#2563eb" },
  { label: "Morado", value: "#7c3aed" },
  { label: "Café", value: "#7a4a22" },
  { label: "Rojo", value: "#d32f2f" },
  { label: "Negro", value: "#111111" },
];

// "Nueva publicación" / "Editar publicación": el alumno publica por su
// cuenta (athlete_posts, RLS del dueño). Sin imágenes.
export default function OwnPostEditorModal({
  profileId,
  editing,
  disciplineSuggestions,
  onClose,
  onSaved,
}: {
  profileId: string;
  editing: AthleteOwnPost | null;
  disciplineSuggestions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<OwnPostDraft>(() => ({
    kind: editing?.kind ?? "publicacion",
    title: editing?.title ?? "",
    body: editing?.body ?? "",
    event_date: editing?.event_date ?? getChileToday(),
    position: editing?.position ?? "1",
    discipline: editing?.discipline ?? "",
    color: editing?.color ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "auto";
    };
  }, [saving, onClose]);

  const set = <K extends keyof OwnPostDraft>(key: K, value: OwnPostDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    const invalid = validateOwnPost(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const row = {
      kind: draft.kind,
      title: draft.title.trim() || null,
      body: draft.body.trim() || null,
      event_date: draft.event_date,
      position: draft.kind === "torneo" ? draft.position : null,
      discipline: draft.kind === "publicacion" ? null : draft.discipline.trim() || null,
      color: draft.kind === "cinturon" ? draft.color || null : null,
    };
    const supabase = createClient();
    const { error: dbError } = editing
      ? await supabase.from("athlete_posts").update(row).eq("id", editing.id)
      : await supabase.from("athlete_posts").insert({ ...row, profile_id: profileId });
    setSaving(false);
    if (dbError) {
      setError("No se pudo guardar la publicación. Inténtalo de nuevo.");
      return;
    }
    onSaved();
  };

  const kindMeta = OWN_POST_KINDS.find((k) => k.value === draft.kind)!;
  const labelCls =
    "block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5";
  const inputCls =
    "w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-gold/60";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center justify-center md:p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Editar publicación" : "Nueva publicación"}
    >
      <div className="w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-surface-container-lowest border border-on-surface/10 rounded-t-2xl md:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-surface-container-lowest border-b border-on-surface/10">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-[14px] text-on-surface-variant hover:text-on-surface cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>
          <h2 className="font-[family-name:var(--font-headline-md)] text-[16px] uppercase text-on-surface">
            {editing ? "Editar publicación" : "Nueva publicación"}
          </h2>
          <button
            onClick={save}
            disabled={saving}
            className="text-[14px] font-semibold text-gold hover:text-gold-light cursor-pointer disabled:opacity-40"
          >
            {saving ? "Publicando..." : editing ? "Guardar" : "Publicar"}
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {!editing && (
            <div>
              <span className={labelCls}>¿Qué quieres publicar?</span>
              <div className="grid grid-cols-5 gap-2">
                {OWN_POST_KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => set("kind", k.value)}
                    aria-pressed={draft.kind === k.value}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                      draft.kind === k.value ? "border-gold/60 bg-gold/10" : "border-on-surface/10 hover:border-on-surface/20"
                    }`}
                  >
                    <span className="text-[22px] leading-none">{k.emoji}</span>
                    <span className="text-[11px] text-on-surface">{k.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-on-surface-variant">{kindMeta.hint}</p>
            </div>
          )}

          {draft.kind !== "publicacion" && (
            <div>
              <label htmlFor="post-title" className={labelCls}>
                {draft.kind === "torneo" ? "Torneo" : draft.kind === "cinturon" ? "Grado" : "Título"}
              </label>
              <input
                id="post-title"
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={80}
                placeholder={
                  draft.kind === "torneo"
                    ? "Ej: Copa Regional de Kenpo"
                    : draft.kind === "cinturon"
                      ? "Ej: Cinturón negro 1er dan"
                      : draft.kind === "trofeo"
                        ? "Ej: Mejor competidor juvenil"
                        : "Ej: Seminario internacional de defensa personal"
                }
                className={inputCls}
              />
            </div>
          )}

          {draft.kind === "torneo" && (
            <div>
              <span className={labelCls}>Resultado</span>
              <div className="grid grid-cols-4 gap-2">
                {PODIUM_POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => set("position", p.value)}
                    aria-pressed={draft.position === p.value}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl border cursor-pointer transition-colors ${
                      draft.position === p.value ? "border-gold/60 bg-gold/10" : "border-on-surface/10 hover:border-on-surface/20"
                    }`}
                  >
                    <span className="text-[22px] leading-none">{p.emoji}</span>
                    <span className="text-[11px] text-on-surface">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {draft.kind === "cinturon" && (
            <div>
              <span className={labelCls}>Color del cinturón</span>
              <div className="flex flex-wrap gap-2">
                {BELT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => set("color", c.value)}
                    aria-pressed={draft.color === c.value}
                    title={c.label}
                    aria-label={c.label}
                    className={`w-9 h-9 rounded-full border-2 cursor-pointer ${draft.color === c.value ? "border-gold scale-110" : "border-on-surface/20"}`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="post-body" className={labelCls}>
              {draft.kind === "publicacion" ? "Texto" : "Descripción (opcional)"}
            </label>
            <textarea
              id="post-body"
              value={draft.body}
              onChange={(e) => set("body", e.target.value)}
              maxLength={1000}
              rows={draft.kind === "publicacion" ? 6 : 3}
              placeholder={draft.kind === "publicacion" ? "¿Qué quieres contarle a la comunidad?" : "Cuéntanos más"}
              className={`${inputCls} resize-none`}
            />
            <p className="mt-1 text-right text-[11px] text-on-surface-variant">{draft.body.length}/1000</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="post-date" className={labelCls}>Fecha</label>
              <input
                id="post-date"
                type="date"
                value={draft.event_date}
                max={getChileToday()}
                onChange={(e) => set("event_date", e.target.value)}
                className={inputCls}
              />
            </div>
            {draft.kind !== "publicacion" && (
              <div>
                <label htmlFor="post-discipline" className={labelCls}>Disciplina</label>
                <input
                  id="post-discipline"
                  value={draft.discipline}
                  onChange={(e) => set("discipline", e.target.value)}
                  maxLength={60}
                  list="post-discipline-options"
                  placeholder="Opcional"
                  className={inputCls}
                />
                <datalist id="post-discipline-options">
                  {disciplineSuggestions.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          {error && (
            <p className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-300">{error}</p>
          )}

          {draft.kind !== "publicacion" && (
            <p className="text-[11px] text-on-surface-variant">
              Se publica al instante como &quot;Publicado por el atleta&quot;. Los logros que registra la academia llevan la
              insignia ✔ Verificado por ZonaElite.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
