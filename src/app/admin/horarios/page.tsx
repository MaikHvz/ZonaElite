"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";

interface Schedule {
  id: string;
  discipline_id: string;
  professor_id: string;
  room: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  disciplines?: { name: string; color_hex: string };
  profiles?: { full_name: string };
}

interface Discipline { id: string; name: string; }
interface Profile { id: string; full_name: string; }

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const emptyForm = { discipline_id: "", professor_id: "", room: "", day_of_week: 1, start_time: "08:00", end_time: "09:00", capacity: 20 };

export default function AdminHorariosPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [professors, setProfessors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const [sRes, dRes, pRes] = await Promise.all([
      supabase.from("schedules").select("*, disciplines(name, color_hex), profiles(full_name)").order("day_of_week"),
      supabase.from("disciplines").select("id, name").order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]);
    setSchedules((sRes.data as Schedule[]) || []);
    setDisciplines((dRes.data as Discipline[]) || []);
    setProfessors((pRes.data as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (s: Schedule) => { setEditing(s); setForm({ discipline_id: s.discipline_id, professor_id: s.professor_id, room: s.room || "", day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, capacity: s.capacity }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, room: form.room || null };
    if (editing) {
      await supabase.from("schedules").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("schedules").insert(payload);
    }
    setModalOpen(false);
    setSaving(false);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("schedules").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">Horarios</h1>
        <button onClick={openCreate} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo Horario
        </button>
      </div>

      <DataTable
        columns={[
          { key: "day_of_week", label: "Día", render: (s) => DAYS[s.day_of_week] },
          { key: "start_time", label: "Hora", render: (s) => `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}` },
          { key: "discipline_id", label: "Disciplina", render: (s) => s.disciplines?.name || "—" },
          { key: "professor_id", label: "Instructor", render: (s) => s.profiles?.full_name || "—" },
          { key: "room", label: "Sala", render: (s) => s.room || "—" },
          { key: "capacity", label: "Cupos", render: (s) => String(s.capacity) },
        ]}
        data={schedules}
        loading={loading}
        emptyMessage="No hay horarios creados"
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      <FormModal open={modalOpen} title={editing ? "Editar Horario" : "Nuevo Horario"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Disciplina *</label>
            <select value={form.discipline_id} onChange={(e) => setForm({ ...form, discipline_id: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              <option value="">Seleccionar...</option>
              {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Instructor *</label>
            <select value={form.professor_id} onChange={(e) => setForm({ ...form, professor_id: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              <option value="">Seleccionar...</option>
              {professors.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Día *</label>
            <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Inicio *</label>
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Fin *</label>
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Sala</label>
              <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Cupos *</label>
              <input inputMode="numeric" value={form.capacity || ""} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={!form.discipline_id || !form.professor_id || saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Horario"}</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm open={!!deleteTarget} title="Eliminar Horario" message="¿Estás seguro de eliminar este horario? Esta acción no se puede deshacer." onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
