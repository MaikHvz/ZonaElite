"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";
import { exportProfessionalExcel, type ProfessionalSheetConfig } from "@/lib/excel";

interface Schedule {
  id: string;
  discipline_id: string;
  professor_id: string;
  room: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  category: string[];
  active: boolean;
  description: string | null;
  mode: string;
  disciplines?: { name: string; color_hex: string };
  profiles?: { full_name: string };
  class_plans?: { plan_id: string; membership_plans?: { name: string } }[];
  personalized_schedule_plans?: { plan_id: string }[];
}

interface Discipline { id: string; name: string; color_hex: string; active: boolean; }
interface Profile { id: string; full_name: string; }
interface Plan { id: string; name: string; active: boolean; }

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const CATEGORY_OPTIONS = [
  { value: "ninos", label: "Niños" },
  { value: "juveniles", label: "Juveniles" },
  { value: "adultos", label: "Adultos" },
];
const MODE_FILTERS = [
  { value: "todas", label: "Todas" },
  { value: "normal", label: "Membresías" },
  { value: "personalizado", label: "Personalizadas" },
];
const emptyForm = {
  discipline_id: "", professor_id: "", room: "", day_of_week: 1,
  start_time: "08:00", end_time: "09:00", capacity: 20,
  category: ["ninos", "juveniles", "adultos"] as string[], active: true, description: "",
  mode: "normal",
};

export default function AdminHorariosPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [professors, setProfessors] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [personalizedPlans, setPersonalizedPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modeFilter, setModeFilter] = useState<string>("todas");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    const supabase = createClient();
    const [sRes, dRes, pRes, plRes, ppRes] = await Promise.all([
      supabase.from("schedules").select("*, disciplines(name, color_hex), profiles(full_name), class_plans(plan_id, membership_plans(name)), personalized_schedule_plans(plan_id)").order("day_of_week"),
      supabase.from("disciplines").select("id, name, color_hex, active").order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("membership_plans").select("id, name, active").eq("active", true).order("name"),
      supabase.from("personalized_plans").select("id, name, active").eq("active", true).order("name"),
    ]);
    const schedList = ((sRes.data as Schedule[]) || []).map((s) => ({ ...s, mode: s.mode || "normal" }));
    setSchedules(schedList);
    setDisciplines((dRes.data as Discipline[]) || []);
    setProfessors((pRes.data as Profile[]) || []);
    setPlans((plRes.data as Plan[]) || []);
    setPersonalizedPlans((ppRes.data as Plan[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = (mode: "normal" | "personalizado") => {
    setEditing(null);
    setForm({ ...emptyForm, mode });
    setSelectedPlans([]);
    setModalOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    const scheduleCategory = Array.isArray(s.category) ? s.category : [s.category];
    const sMode = s.mode || "normal";
    setForm({
      discipline_id: s.discipline_id,
      professor_id: s.professor_id,
      room: s.room || "",
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      capacity: s.capacity,
      category: scheduleCategory,
      active: s.active,
      description: s.description || "",
      mode: sMode,
    });
    setSelectedPlans(
      s.mode === "personalizado"
        ? s.personalized_schedule_plans?.map((cp) => cp.plan_id) || []
        : s.class_plans?.map((cp) => cp.plan_id) || []
    );
    setModalOpen(true);
  };

  const togglePlan = (planId: string) => {
    setSelectedPlans((prev) => prev.includes(planId) ? prev.filter((p) => p !== planId) : [...prev, planId]);
  };

  const toggleCategory = (cat: string) => {
    setForm((prev) => {
      const current = prev.category;
      const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
      return { ...prev, category: next.length > 0 ? next : current };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        discipline_id: form.discipline_id,
        professor_id: form.professor_id,
        room: form.room || null,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        capacity: form.capacity,
        category: form.category,
        active: form.active,
        description: form.description || null,
        mode: form.mode,
      };

      let scheduleId: string;

      if (editing) {
        const { error } = await supabase.from("schedules").update(payload).eq("id", editing.id);
        if (error) { setToast({ msg: getSupabaseErrorMessage(error), type: "error" }); setSaving(false); return; }
        scheduleId = editing.id;
      } else {
        const { data, error } = await supabase.from("schedules").insert(payload).select("id").single();
        if (error || !data) { setToast({ msg: getSupabaseErrorMessage(error), type: "error" }); setSaving(false); return; }
        scheduleId = data.id;
      }

      if (form.mode === "personalizado") {
        const { error: delError } = await supabase.from("personalized_schedule_plans").delete().eq("schedule_id", scheduleId);
        if (delError) { setToast({ msg: getSupabaseErrorMessage(delError), type: "error" }); setSaving(false); return; }

        if (selectedPlans.length > 0) {
          const { error: insError } = await supabase.from("personalized_schedule_plans").insert(selectedPlans.map((plan_id) => ({ schedule_id: scheduleId, plan_id })));
          if (insError) { setToast({ msg: getSupabaseErrorMessage(insError), type: "error" }); setSaving(false); return; }
        }
      } else {
        const { error: delError } = await supabase.from("class_plans").delete().eq("schedule_id", scheduleId);
        if (delError) { setToast({ msg: getSupabaseErrorMessage(delError), type: "error" }); setSaving(false); return; }

        if (selectedPlans.length > 0) {
          const { error: insError } = await supabase.from("class_plans").insert(selectedPlans.map((plan_id) => ({ schedule_id: scheduleId, plan_id })));
          if (insError) { setToast({ msg: getSupabaseErrorMessage(insError), type: "error" }); setSaving(false); return; }
        }
      }

      setModalOpen(false);
      setToast({ msg: editing ? "Clase actualizada" : "Clase creada", type: "success" });
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      if (deleteTarget.mode === "personalizado") {
        await supabase.from("personalized_schedule_plans").delete().eq("schedule_id", deleteTarget.id);
      }
      const { error } = await supabase.from("schedules").delete().eq("id", deleteTarget.id);
      if (error) { setToast({ msg: getSupabaseErrorMessage(error), type: "error" }); setDeleting(false); return; }
      setDeleteTarget(null);
      setToast({ msg: "Clase eliminada", type: "success" });
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e), type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportHorario = async () => {
    const now = new Date();
    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const dayIndexes = [1, 2, 3, 4, 5, 6, 0];

    const timeSlots = Array.from(
      new Set(schedules.map(s => `${s.start_time.slice(0,5)} - ${s.end_time.slice(0,5)}`))
    ).sort();

    // Build grid matrix
    const header = ["Horario", ...days];
    const rows: any[][] = [header];

    timeSlots.forEach(slot => {
      const [start] = slot.split(" - ");
      const row: any[] = [slot];
      dayIndexes.forEach(dayNum => {
        const classesInSlot = schedules.filter(s =>
          s.day_of_week === dayNum &&
          s.start_time.slice(0,5) === start
        );
        if (classesInSlot.length === 0) {
          row.push("");
        } else {
          row.push(
            classesInSlot.map(s =>
              `${s.disciplines?.name || "Clase"} | ${s.profiles?.full_name || ""} | Cupos: ${s.capacity}`
            ).join("\n")
          );
        }
      });
      rows.push(row);
    });

    const flatData = schedules.map(s => ({
      "Día": DAYS[s.day_of_week],
      "Hora Inicio": s.start_time.slice(0, 5),
      "Hora Fin": s.end_time.slice(0, 5),
      "Disciplina": s.disciplines?.name || "—",
      "Instructor": s.profiles?.full_name || "—",
      "Modalidad": s.mode === "personalizado" ? "Personalizada" : "Membresías",
      "Categoría": (Array.isArray(s.category) ? s.category : [s.category]).map(c => ({ ninos: "Niños", juveniles: "Juveniles", adultos: "Adultos" }[c] || c)).join(", "),
      "Cupos": s.capacity,
      "Sala": s.room || "—",
      "Activo": s.active ? "Sí" : "No",
      "Descripción": s.description || "",
    }));

    const totalClases = schedules.length;
    const totalActivas = schedules.filter(s => s.active).length;
    const disciplinaCounts: Record<string, number> = {};
    schedules.forEach(s => {
      const disc = s.disciplines?.name || "Sin disciplina";
      disciplinaCounts[disc] = (disciplinaCounts[disc] || 0) + 1;
    });

    const gridSheet: ProfessionalSheetConfig = {
      sheetName: "Grilla Semanal",
      reportTitle: "Grilla de Horarios Semanal",
      subtitle: `Generado el ${now.toLocaleDateString("es-CL", { dateStyle: "full" })}`,
      kpiBlocks: [
        {
          title: "RESUMEN DE HORARIOS",
          rows: [
            ["Total Bloques Horarios", totalClases],
            ["Bloques Activos", totalActivas, true],
            ["Bloques Inactivos", totalClases - totalActivas, totalClases - totalActivas === 0],
            ...Object.entries(disciplinaCounts).map(([disc, count]) => [
              `Clases de ${disc}`, count
            ] as [string, number]),
          ],
        },
      ],
      matrixData: rows,
    };

    const detalleSheet: ProfessionalSheetConfig = {
      sheetName: "Detalle Clases",
      reportTitle: "Detalle de Todas las Clases",
      subtitle: `${totalActivas} clases activas de ${totalClases} bloques totales`,
      tableData: flatData,
    };

    await exportProfessionalExcel(
      [gridSheet, detalleSheet],
      `Horario_Semanal_ZonaElite_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const categoryLabel = (c: string) => ({ ninos: "Niños", juveniles: "Juveniles", adultos: "Adultos" }[c] || c);
  const activeDisciplines = disciplines.filter((d) => d.active);

  const filteredSchedules = schedules.filter((s) => modeFilter === "todas" || s.mode === modeFilter);

  const renderModeBadge = (m: string | null | undefined) =>
    (m || "normal") === "personalizado" ? (
      <span className="inline-flex items-center gap-1 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
        Personalizada
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        Normal
      </span>
    );

  const allowedPlans = form.mode === "personalizado" ? personalizedPlans : plans;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">Horarios</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportHorario}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/10 text-green-500 border border-green-500/20 hover:bg-green-600/20 transition-colors text-[13px] font-[family-name:var(--font-headline-md)] uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Excel
          </button>
          <button onClick={() => openCreate("normal")} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nueva Clase Normal
          </button>
          <button onClick={() => openCreate("personalizado")} className="flex items-center gap-2 bg-purple-600/15 text-purple-300 border border-purple-500/30 font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:bg-purple-600/25 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nueva Clase Personalizada
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {MODE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setModeFilter(f.value)}
            className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-4 py-1.5 rounded-full border transition-colors cursor-pointer ${
              modeFilter === f.value
                ? "btn-primary-gradient text-white border-transparent"
                : "border-on-surface/20 text-on-surface-variant hover:border-primary/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: "day_of_week", label: "Día", render: (s) => DAYS[s.day_of_week] },
          { key: "start_time", label: "Horario", render: (s) => `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}` },
          { key: "mode", label: "Modalidad", render: (s) => renderModeBadge(s.mode) },
          { key: "discipline_id", label: "Tipo", render: (s) => (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.disciplines?.color_hex }} />
              <span>{s.disciplines?.name || "—"}</span>
            </div>
          )},
          { key: "professor_id", label: "Instructor", render: (s) => s.profiles?.full_name || "—" },
          { key: "category", label: "Categoría", render: (s) => {
            const cats = Array.isArray(s.category) ? s.category : [s.category];
            return (
              <div className="flex flex-wrap gap-1">
                {cats.map((c) => (
                  <span key={c} className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    c === "ninos" ? "bg-blue-500/10 text-blue-400" : c === "juveniles" ? "bg-amber-500/10 text-amber-400" : "bg-green-500/10 text-green-400"
                  }`}>
                    {categoryLabel(c)}
                  </span>
                ))}
              </div>
            );
          } },
          { key: "capacity", label: "Cupos", render: (s) => String(s.capacity) },
          { key: "active", label: "Estado", render: (s) => <StatusBadge status={s.active ? "activo" : "cancelado"} /> },
        ]}
        data={filteredSchedules}
        loading={loading}
        searchKey="room"
        searchPlaceholder="Buscar clase..."
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        emptyMessage="No hay clases creadas"
      />

      <FormModal open={modalOpen} title={editing ? "Editar Clase" : form.mode === "personalizado" ? "Nueva Clase Personalizada" : "Nueva Clase Normal"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Modalidad *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (form.mode !== "normal") {
                    setForm({ ...form, mode: "normal" });
                    setSelectedPlans([]);
                  }
                }}
                className={`py-2 px-3 rounded-lg text-[13px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider border transition-colors cursor-pointer text-center ${
                  form.mode === "normal"
                    ? "btn-primary-gradient text-white border-transparent"
                    : "border-on-surface/10 text-on-surface-variant hover:border-primary/40 bg-surface-container"
                }`}
              >
                Normal (Membresías)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (form.mode !== "personalizado") {
                    setForm({ ...form, mode: "personalizado" });
                    setSelectedPlans([]);
                  }
                }}
                className={`py-2 px-3 rounded-lg text-[13px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider border transition-colors cursor-pointer text-center ${
                  form.mode === "personalizado"
                    ? "bg-purple-600/30 text-purple-200 border-purple-500/50 font-bold"
                    : "border-on-surface/10 text-on-surface-variant hover:border-purple-500/30 bg-surface-container"
                }`}
              >
                Personalizada
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant/60 mt-1.5">
              {form.mode === "personalizado"
                ? "Solo acepta planes personalizados y alumnos con pack."
                : "Clase grupal regular accesible para alumnos con membresía."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Tipo de clase *</label>
              <select value={form.discipline_id} onChange={(e) => setForm({ ...form, discipline_id: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
                <option value="">Seleccionar...</option>
                {activeDisciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Instructor *</label>
              <select value={form.professor_id} onChange={(e) => setForm({ ...form, professor_id: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
                <option value="">Seleccionar...</option>
                {professors.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Día *</label>
            <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Hora inicio *</label>
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Hora fin *</label>
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Cupos *</label>
              <input inputMode="numeric" value={form.capacity || ""} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Categorías permitidas *</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => toggleCategory(cat.value)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-[family-name:var(--font-label-sm)] uppercase tracking-wider transition-colors cursor-pointer ${
                      form.category.includes(cat.value)
                        ? cat.value === "ninos"
                          ? "bg-blue-500/15 border border-blue-500/40 text-blue-400"
                          : cat.value === "juveniles"
                          ? "bg-amber-500/15 border border-amber-500/40 text-amber-400"
                          : "bg-green-500/15 border border-green-500/40 text-green-400"
                        : "border border-on-surface/10 text-on-surface-variant hover:border-on-surface/20"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-on-surface-variant/50 mt-1">Selecciona qué categorías pueden asistir a esta clase</p>
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Sala</label>
              <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Opcional" className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 resize-none" placeholder="Descripción opcional de la clase" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Planes permitidos</label>
            <p className="text-[11px] text-on-surface-variant/50 mb-2">
              {form.mode === "personalizado"
                ? "Selecciona qué planes personalizados pueden inscribirse a esta clase. Si no seleccionas ninguno, todos los planes personalizados pueden inscribirse."
                : "Selecciona qué planes pueden inscribirse a esta clase. Si no seleccionas ninguno, todos pueden inscribirse."}
            </p>
            {allowedPlans.length === 0 ? (
              <p className="text-[12px] text-on-surface-variant/60">
                {form.mode === "personalizado"
                  ? "Aún no hay planes personalizados activos. Créalos en el panel de membresías."
                  : "Aún no hay planes de membresía activos."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allowedPlans.map((p) => (
                  <button key={p.id} type="button" onClick={() => togglePlan(p.id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-[family-name:var(--font-label-sm)] uppercase tracking-wider transition-colors cursor-pointer ${selectedPlans.includes(p.id) ? "btn-primary-gradient text-white" : "border border-on-surface/10 text-on-surface-variant hover:border-primary/30"}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">Clase activa</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={!form.discipline_id || !form.professor_id || saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Clase"}</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm open={!!deleteTarget} title="Eliminar Clase" message="¿Estás seguro de eliminar esta clase? Se eliminarán también las inscripciones y sesiones asociadas." onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
