"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";
import { exportMultipleSheetsToExcel, exportToExcel, type ExcelSheetData } from "@/lib/excel";

interface Schedule {
  id: string;
  discipline_id: string;
  professor_id: string;
  room: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  category: string;
  active: boolean;
  description: string | null;
  disciplines?: { name: string; color_hex: string };
  profiles?: { full_name: string };
  class_plans?: { plan_id: string; membership_plans?: { name: string } }[];
}

interface Discipline { id: string; name: string; color_hex: string; active: boolean; }
interface Profile { id: string; full_name: string; }
interface Plan { id: string; name: string; active: boolean; }

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const CATEGORIES = [
  { value: "ambos", label: "Ambos" },
  { value: "ninos", label: "Niños" },
  { value: "adultos", label: "Adultos" },
];
const emptyForm = {
  discipline_id: "", professor_id: "", room: "", day_of_week: 1,
  start_time: "08:00", end_time: "09:00", capacity: 20,
  category: "ambos", active: true, description: "",
};

export default function AdminHorariosPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [professors, setProfessors] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    const supabase = createClient();
    const [sRes, dRes, pRes, plRes] = await Promise.all([
      supabase.from("schedules").select("*, disciplines(name, color_hex), profiles(full_name), class_plans(plan_id, membership_plans(name))").order("day_of_week"),
      supabase.from("disciplines").select("id, name, color_hex, active").order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("membership_plans").select("id, name, active").eq("active", true).order("name"),
    ]);
    setSchedules((sRes.data as Schedule[]) || []);
    setDisciplines((dRes.data as Discipline[]) || []);
    setProfessors((pRes.data as Profile[]) || []);
    setPlans((plRes.data as Plan[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSelectedPlans([]);
    setModalOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    setForm({
      discipline_id: s.discipline_id,
      professor_id: s.professor_id,
      room: s.room || "",
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      capacity: s.capacity,
      category: s.category,
      active: s.active,
      description: s.description || "",
    });
    setSelectedPlans(s.class_plans?.map((cp) => cp.plan_id) || []);
    setModalOpen(true);
  };

  const togglePlan = (planId: string) => {
    setSelectedPlans((prev) => prev.includes(planId) ? prev.filter((p) => p !== planId) : [...prev, planId]);
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

      const { error: delError } = await supabase.from("class_plans").delete().eq("schedule_id", scheduleId);
      if (delError) { setToast({ msg: getSupabaseErrorMessage(delError), type: "error" }); setSaving(false); return; }

      if (selectedPlans.length > 0) {
        const { error: insError } = await supabase.from("class_plans").insert(selectedPlans.map((plan_id) => ({ schedule_id: scheduleId, plan_id })));
        if (insError) { setToast({ msg: getSupabaseErrorMessage(insError), type: "error" }); setSaving(false); return; }
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

  const handleExportHorario = () => {
    // Build a visual calendar grid: rows = time slots, cols = days
    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const dayIndexes = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 ... Sun=0

    // Collect all unique time slots
    const timeSlots = Array.from(
      new Set(schedules.map(s => `${s.start_time.slice(0,5)} - ${s.end_time.slice(0,5)}`))  
    ).sort();

    // Build grid matrix
    const header = ["Horario", ...days];
    const rows: any[][] = [header];

    timeSlots.forEach(slot => {
      const [start, end] = slot.split(" - ");
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

    // Sheet 2: Flat list with all details
    const flatData = schedules.map(s => ({
      "Día": DAYS[s.day_of_week],
      "Hora Inicio": s.start_time.slice(0, 5),
      "Hora Fin": s.end_time.slice(0, 5),
      "Disciplina": s.disciplines?.name || "—",
      "Instructor": s.profiles?.full_name || "—",
      "Categoría": ({ ninos: "Niños", adultos: "Adultos", ambos: "Ambos" }[s.category] || s.category),
      "Cupos": s.capacity,
      "Sala": s.room || "—",
      "Activo": s.active ? "Sí" : "No",
      "Descripción": s.description || "",
    }));

    const sheets: ExcelSheetData[] = [
      { sheetName: "Grilla Semanal", data: rows },
      { sheetName: "Detalle Clases", data: flatData },
    ];

    exportMultipleSheetsToExcel(sheets, "Horario_Semanal_ZonaElite");
  };

  const categoryLabel = (c: string) => ({ ninos: "Niños", adultos: "Adultos", ambos: "Ambos" }[c] || c);
  const activeDisciplines = disciplines.filter((d) => d.active);

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
          <button onClick={openCreate} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nueva Clase
          </button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "day_of_week", label: "Día", render: (s) => DAYS[s.day_of_week] },
          { key: "start_time", label: "Horario", render: (s) => `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}` },
          { key: "discipline_id", label: "Tipo", render: (s) => (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.disciplines?.color_hex }} />
              <span>{s.disciplines?.name || "—"}</span>
            </div>
          )},
          { key: "professor_id", label: "Instructor", render: (s) => s.profiles?.full_name || "—" },
          { key: "category", label: "Categoría", render: (s) => <StatusBadge status={s.category === "ninos" ? "publicado" : s.category === "adultos" ? "programado" : "borrador"} /> },
          { key: "capacity", label: "Cupos", render: (s) => String(s.capacity) },
          { key: "active", label: "Estado", render: (s) => <StatusBadge status={s.active ? "activo" : "cancelado"} /> },
        ]}
        data={schedules}
        loading={loading}
        searchKey="room"
        searchPlaceholder="Buscar clase..."
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        emptyMessage="No hay clases creadas"
      />

      <FormModal open={modalOpen} title={editing ? "Editar Clase" : "Nueva Clase"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
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
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Categoría *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
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
            <p className="text-[11px] text-on-surface-variant/50 mb-2">Selecciona qué planes pueden inscribirse a esta clase. Si no seleccionas ninguno, todos pueden inscribirse.</p>
            <div className="flex flex-wrap gap-2">
              {plans.map((p) => (
                <button key={p.id} type="button" onClick={() => togglePlan(p.id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-[family-name:var(--font-label-sm)] uppercase tracking-wider transition-colors cursor-pointer ${selectedPlans.includes(p.id) ? "btn-primary-gradient text-white" : "border border-on-surface/10 text-on-surface-variant hover:border-primary/30"}`}>
                  {p.name}
                </button>
              ))}
            </div>
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
