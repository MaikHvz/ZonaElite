"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteImage } from "@/lib/supabase/storage";
import BeltBanner from "@/components/dashboard/BeltBanner";
import PodiumFormModal from "./PodiumFormModal";
import {
  computePodiumStats,
  formatPodiumDate,
  podiumPositionMeta,
  sortPodiumsByDateDesc,
} from "@/lib/sport-profile";
import type {
  BeltGradeRef,
  DisciplineRef,
  SportPodiumData,
  SportProfileData,
} from "@/lib/sport-profile";

interface SportProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  beneficiaryId: string | null;
  studentName: string;
}

interface GradeRow {
  id: string;
  discipline_id: string;
  name: string;
  color: string;
  position: number;
}

export default function SportProfileModal({
  open,
  onClose,
  onSaved,
  beneficiaryId,
  studentName,
}: SportProfileModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [disciplines, setDisciplines] = useState<DisciplineRef[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [profiles, setProfiles] = useState<SportProfileData[]>([]);
  const [podiums, setPodiums] = useState<SportPodiumData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor de disciplina + grado (add/update)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formDisciplineId, setFormDisciplineId] = useState<string>("");
  const [formGradeId, setFormGradeId] = useState<string>("");

  const [podiumModalOpen, setPodiumModalOpen] = useState(false);
  const [editingPodium, setEditingPodium] = useState<SportPodiumData | null>(null);

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

  const load = useCallback(async () => {
    if (!beneficiaryId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [discRes, gradesRes, profilesRes, podiumsRes] = await Promise.all([
        supabase
          .from("disciplines")
          .select("id, name, color_hex")
          .eq("active", true)
          .order("name"),
        supabase
          .from("belt_grades")
          .select("id, discipline_id, name, color, position")
          .eq("active", true)
          .order("position"),
        supabase
          .from("sport_profiles")
          .select(
            "id, beneficiary_id, discipline_id, grade_id, disciplines(id, name, color_hex), belt_grades(id, name, color, position)"
          )
          .eq("beneficiary_id", beneficiaryId),
        supabase
          .from("sports_podiums")
          .select(
            "id, beneficiary_id, tournament, event_date, discipline_id, category, position, description, image_url, disciplines(id, name)"
          )
          .eq("beneficiary_id", beneficiaryId)
          .order("event_date", { ascending: false }),
      ]);

      if (discRes.error || gradesRes.error || profilesRes.error || podiumsRes.error) {
        throw new Error("Error al cargar el perfil deportivo");
      }

      setDisciplines((discRes.data || []) as DisciplineRef[]);
      setGrades((gradesRes.data || []) as GradeRow[]);
      const rawProfiles = (profilesRes.data || []) as Array<{
        id: string;
        beneficiary_id: string;
        discipline_id: string | null;
        grade_id: string | null;
        disciplines: unknown;
        belt_grades: unknown;
      }>;
      setProfiles(
        rawProfiles.map((p) => {
          const disc = Array.isArray(p.disciplines) ? p.disciplines[0] : p.disciplines;
          const grade = Array.isArray(p.belt_grades) ? p.belt_grades[0] : p.belt_grades;
          return {
            ...p,
            disciplines:
              (disc as DisciplineRef | null | undefined) ?? null,
            belt_grades:
              (grade as BeltGradeRef | null | undefined) ?? null,
          } as SportProfileData;
        })
      );
      const rawPodiums = (podiumsRes.data || []) as Array<{
        id: string;
        beneficiary_id: string;
        tournament: string;
        event_date: string;
        discipline_id: string | null;
        category: string | null;
        position: string;
        description: string | null;
        image_url: string | null;
        disciplines: unknown;
      }>;
      setPodiums(
        rawPodiums.map((p) => {
          const disc = Array.isArray(p.disciplines) ? p.disciplines[0] : p.disciplines;
          return {
            ...p,
            disciplines:
              (disc as { id: string; name: string } | null | undefined) ?? null,
          } as SportPodiumData;
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el perfil deportivo");
    } finally {
      setLoading(false);
    }
  }, [beneficiaryId]);

  useEffect(() => {
    if (open && beneficiaryId) {
      load();
      setEditorOpen(false);
      setEditingId(null);
    }
  }, [open, beneficiaryId, load]);

  const openAddEditor = () => {
    setError(null);
    setEditingId(null);
    setFormDisciplineId("");
    setFormGradeId("");
    setEditorOpen(true);
  };

  const openEditEditor = (profile: SportProfileData) => {
    setError(null);
    setEditingId(profile.id);
    setFormDisciplineId(profile.discipline_id || "");
    setFormGradeId(profile.grade_id || "");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setError(null);
  };

  const handleDisciplineChange = (id: string) => {
    setFormDisciplineId(id);
    setFormGradeId("");
  };

  const saveProfile = async () => {
    if (!beneficiaryId || !formDisciplineId) {
      setError("Selecciona una disciplina");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const supabase = createClient();
      const payload = {
        id: editingId ?? undefined,
        beneficiary_id: beneficiaryId,
        discipline_id: formDisciplineId,
        grade_id: formGradeId || null,
      };
      const { error: dbError } = await supabase
        .from("sport_profiles")
        .upsert(payload, { onConflict: "beneficiary_id,discipline_id" });
      if (dbError) throw dbError;
      closeEditor();
      onSaved();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar la disciplina");
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (profile: SportProfileData) => {
    if (!window.confirm(`¿Quitar ${profile.disciplines?.name || "esta disciplina"} del perfil deportivo?`)) return;
    try {
      setError(null);
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("sport_profiles")
        .delete()
        .eq("id", profile.id);
      if (dbError) throw dbError;
      onSaved();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al quitar la disciplina");
    }
  };

  const handlePodiumSaved = async () => {
    await load();
  };

  const handleDeletePodium = async (podium: SportPodiumData) => {
    if (!window.confirm("¿Eliminar este podio?")) return;
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("sports_podiums")
        .delete()
        .eq("id", podium.id);
      if (dbError) throw dbError;
      if (podium.image_url) {
        try {
          await deleteImage(podium.image_url);
        } catch {
          // best-effort: si no se puede borrar la imagen, el podio ya se eliminó.
        }
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar el podio");
    }
  };

  if (!open) return null;

  const editingProfile =
    profiles.find((p) => p.id === editingId) || null;
  const currentDiscipline =
    disciplines.find((d) => d.id === formDisciplineId) ||
    editingProfile?.disciplines ||
    null;
  const currentGrade =
    grades.find((g) => g.id === formGradeId) ||
    editingProfile?.belt_grades ||
    profiles[0]?.belt_grades ||
    null;
  const stats = computePodiumStats(podiums);
  const sortedPodiums = sortPodiumsByDateDesc(podiums);

  // Disciplinas disponibles para el editor (no repetir las ya asignadas).
  const usedDisciplineIds = new Set(
    profiles.map((p) => p.discipline_id).filter(Boolean)
  );
  const availableDisciplines = editorOpen
    ? editingProfile
      ? disciplines.filter(
          (d) => !usedDisciplineIds.has(d.id) || d.id === editingProfile.discipline_id
        )
      : disciplines.filter((d) => !usedDisciplineIds.has(d.id))
    : [];

  // Podios agrupados por disciplina.
  const podiumGroups: { label: string; items: SportPodiumData[] }[] = [];
  const groupMap = new Map<string, SportPodiumData[]>();
  for (const p of sortedPodiums) {
    const key = p.disciplines?.name || "Otras disciplinas";
    const arr = groupMap.get(key) || [];
    arr.push(p);
    groupMap.set(key, arr);
  }
  for (const [label, items] of groupMap) podiumGroups.push({ label, items });

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current && !saving) onClose();
      }}
    >
      <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-[family-name:var(--font-headline-md)] uppercase tracking-wide text-on-surface">
              Perfil deportivo
            </h2>
            <p className="mt-1 text-[13px] font-[family-name:var(--font-body-md)] font-normal normal-case tracking-normal text-on-surface-variant">
              {studentName}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Preview cinturón */}
            <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5 relative overflow-hidden">
              {currentGrade && <BeltBanner color={currentGrade.color} />}
              <div className="relative z-10">
                <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-2">
                  Vista previa
                </p>
                <p className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase">
                  {currentDiscipline?.name || "Sin disciplina"}
                </p>
                {currentGrade && (
                  <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mt-0.5 flex items-center gap-1.5">
                    <span
                      className="inline-block w-3 h-3 rounded-full border border-on-surface/20"
                      style={{ backgroundColor: currentGrade.color }}
                    />
                    {currentGrade.name}
                  </p>
                )}
              </div>
            </div>

            {/* Disciplinas entrenadas */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">
                    Disciplinas
                  </h3>
                  <p className="text-[12px] text-on-surface-variant mt-0.5">
                    {profiles.length > 0
                      ? `${profiles.length} disciplina${profiles.length === 1 ? "" : "s"} con cinturón asignado`
                      : "Sin disciplinas asignadas"}
                  </p>
                </div>
                {!editorOpen && (
                  <button
                    onClick={openAddEditor}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-[12px] font-[family-name:var(--font-headline-md)] uppercase cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Agregar disciplina
                  </button>
                )}
              </div>

              {profiles.length > 0 && (
                <div className="space-y-2 mb-3">
                  {profiles.map((p) => {
                    const grade = p.belt_grades ?? null;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 bg-surface-container border border-on-surface/5 rounded-xl p-3"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[16px]"
                          style={{
                            backgroundColor: grade?.color ? `${grade.color}26` : "var(--color-surface-container-high)",
                            color: grade?.color || "var(--color-on-surface-variant)",
                          }}
                        >
                          <span className="material-symbols-outlined">sports_martial_arts</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface truncate">
                            {p.disciplines?.name || "Sin disciplina"}
                          </p>
                          <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant truncate flex items-center gap-1.5">
                            {grade ? (
                              <>
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full border border-on-surface/20"
                                  style={{ backgroundColor: grade.color }}
                                />
                                {grade.name}
                              </>
                            ) : (
                              "Sin grado"
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditEditor(p)}
                            className="p-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                            title="Editar disciplina"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => deleteProfile(p)}
                            className="p-2 rounded-lg text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer"
                            title="Quitar disciplina"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {editorOpen && (
                <div className="bg-surface-container border border-primary/20 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
                        Disciplina
                      </label>
                      <select
                        value={formDisciplineId}
                        onChange={(e) => handleDisciplineChange(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
                      >
                        <option value="">Selecciona...</option>
                        {availableDisciplines.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
                        Grado / Cinturón
                      </label>
                      <select
                        value={formGradeId}
                        onChange={(e) => setFormGradeId(e.target.value)}
                        disabled={!formDisciplineId}
                        className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer disabled:opacity-40"
                      >
                        <option value="">Sin grado</option>
                        {grades
                          .filter((g) => g.discipline_id === formDisciplineId)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeEditor}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[13px] cursor-pointer disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveProfile}
                      disabled={saving || !formDisciplineId}
                      className="px-4 py-2 rounded-lg btn-primary-gradient text-white text-[13px] disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Agregar"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-[13px]">{error}</p>}

            {/* Podios */}
            <div className="pt-2 border-t border-on-surface/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">
                    Podios
                  </h3>
                  <p className="text-[12px] text-on-surface-variant mt-0.5">
                    {podiums.length > 0
                      ? `${stats.total} registros · 🥇 ${stats.first} · 🥈 ${stats.second} · 🥉 ${stats.third} · 🎖️ ${stats.participations}`
                      : "Sin podios registrados"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingPodium(null);
                    setPodiumModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-[12px] font-[family-name:var(--font-headline-md)] uppercase cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Agregar
                </button>
              </div>

              {podiumGroups.length > 0 && (
                <div className="space-y-4">
                  {podiumGroups.map((group) => (
                    <div key={group.label}>
                      <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-primary mb-2">
                        {group.label}
                      </p>
                      <div className="space-y-2">
                        {group.items.map((podium) => {
                          const meta = podiumPositionMeta(podium.position);
                          return (
                            <div
                              key={podium.id}
                              className="flex items-center gap-3 bg-surface-container border border-on-surface/5 rounded-xl p-3"
                            >
                              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 text-[18px]">
                                {meta.emoji}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface truncate">
                                  {podium.tournament}
                                </p>
                                <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant truncate">
                                  {formatPodiumDate(podium.event_date)}
                                  {podium.disciplines?.name ? ` · ${podium.disciplines.name}` : ""}
                                  {podium.category ? ` · ${podium.category}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingPodium(podium);
                                    setPodiumModalOpen(true);
                                  }}
                                  className="p-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                                  title="Editar podio"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeletePodium(podium)}
                                  className="p-2 rounded-lg text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer"
                                  title="Eliminar podio"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {beneficiaryId && (
        <PodiumFormModal
          open={podiumModalOpen}
          onClose={() => setPodiumModalOpen(false)}
          onSaved={handlePodiumSaved}
          beneficiaryId={beneficiaryId}
          podium={editingPodium}
          disciplines={disciplines.map((d) => ({ id: d.id, name: d.name }))}
        />
      )}
    </div>
  );
}
