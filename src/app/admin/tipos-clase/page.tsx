"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";

interface ClassType {
  id: string;
  name: string;
  color_hex: string;
  icon: string;
  description: string | null;
  active: boolean;
}

const ICONS = [
  "sports_martial_arts", "sports_kabaddi", "fitness_center", "hardware",
  "self_improvement", "sports_gymnastics", "monitor_heart", "directions_run",
  "sports_motorsports", "boxing", "sports", "emoji_events",
];

const COLORS = [
  "#E53935", "#1E88E5", "#43A047", "#8E24AA",
  "#F4511E", "#00ACC1", "#FDD835", "#6D4C41",
  "#546E7A", "#D81B60", "#3949AB", "#00897B",
];

const emptyForm = { name: "", color_hex: "#E53935", icon: "sports_martial_arts", description: "", active: true };

export default function AdminTiposClasePage() {
  const [types, setTypes] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassType | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("disciplines").select("*").order("name");
    setTypes((data as ClassType[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (t: ClassType) => {
    setEditing(t);
    setForm({ name: t.name, color_hex: t.color_hex, icon: t.icon, description: t.description || "", active: t.active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = { name: form.name, color_hex: form.color_hex, icon: form.icon, description: form.description || null, active: form.active };
    if (editing) {
      await supabase.from("disciplines").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("disciplines").insert(payload);
    }
    setModalOpen(false);
    setSaving(false);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("disciplines").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">Tipos de Clase</h1>
        <button onClick={openCreate} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo Tipo
        </button>
      </div>

      <DataTable
        columns={[
          { key: "name", label: "Nombre", render: (t) => (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color_hex }} />
              <span className="material-symbols-outlined text-[18px]" style={{ color: t.color_hex }}>{t.icon}</span>
              <span>{t.name}</span>
            </div>
          )},
          { key: "color_hex", label: "Color", render: (t) => <span className="font-mono text-[12px] text-on-surface-variant">{t.color_hex}</span> },
          { key: "description", label: "Descripción", render: (t) => <span className="text-[13px] text-on-surface-variant line-clamp-1">{t.description || "—"}</span> },
          { key: "active", label: "Estado", render: (t) => <StatusBadge status={t.active ? "activo" : "cancelado"} /> },
        ]}
        data={types}
        loading={loading}
        searchKey="name"
        searchPlaceholder="Buscar tipo..."
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        emptyMessage="No hay tipos de clase creados"
      />

      <FormModal open={modalOpen} title={editing ? "Editar Tipo" : "Nuevo Tipo"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Nombre *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color_hex: c })} className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${form.color_hex === c ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
              ))}
              <div className="relative">
                <input type="color" value={form.color_hex} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer" />
                <div className="w-8 h-8 rounded-full border border-on-surface/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">colorize</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Ícono</label>
            <div className="grid grid-cols-6 gap-2">
              {ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setForm({ ...form, icon: ic })} className={`p-2 rounded-lg border transition-all cursor-pointer ${form.icon === ic ? "border-primary bg-primary/10 text-primary" : "border-on-surface/10 text-on-surface-variant hover:border-primary/30"}`}>
                  <span className="material-symbols-outlined text-[20px]">{ic}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">Activo</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={!form.name || saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Tipo"}</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm open={!!deleteTarget} title="Eliminar Tipo" message={`¿Estás seguro de eliminar "${deleteTarget?.name}"? Se eliminarán también los horarios asociados.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
