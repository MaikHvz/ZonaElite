"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";

interface Plan { id: string; name: string; price: number; duration_days: number; category: string; active: boolean; }
interface Membership { id: string; beneficiary_id: string; plan_id: string; purchased_by: string; start_date: string; end_date: string; status: string; membership_plans?: { name: string }; profiles?: { full_name: string }; }

const emptyPlan = { name: "", price: 0, duration_days: 30, category: "adulto", active: true };

export default function AdminMembresiasPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"planes" | "membresias">("planes");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const [pRes, mRes] = await Promise.all([
      supabase.from("membership_plans").select("*").order("price"),
      supabase.from("memberships").select("*, membership_plans(name), profiles:purchased_by(full_name)").order("created_at", { ascending: false }),
    ]);
    setPlans((pRes.data as Plan[]) || []);
    setMemberships((mRes.data as Membership[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyPlan); setModalOpen(true); };
  const openEdit = (p: Plan) => { setEditing(p); setForm({ name: p.name, price: p.price, duration_days: p.duration_days, category: p.category, active: p.active }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    if (editing) {
      await supabase.from("membership_plans").update(form).eq("id", editing.id);
    } else {
      await supabase.from("membership_plans").insert(form);
    }
    setModalOpen(false);
    setSaving(false);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("membership_plans").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">Membresías</h1>
        {tab === "planes" && (
          <button onClick={openCreate} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nuevo Plan
          </button>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        {(["planes", "membresias"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`font-[family-name:var(--font-headline-md)] text-[13px] uppercase tracking-wider px-4 py-2 rounded-lg transition-colors cursor-pointer ${tab === t ? "btn-primary-gradient text-white" : "border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"}`}>
            {t === "planes" ? "Planes" : "Membresías"}
          </button>
        ))}
      </div>

      {tab === "planes" ? (
        <DataTable
          columns={[
            { key: "name", label: "Nombre" },
            { key: "price", label: "Precio", render: (p) => `$${p.price.toLocaleString("es-CL")}` },
            { key: "duration_days", label: "Duración", render: (p) => `${p.duration_days} días` },
            { key: "category", label: "Categoría", render: (p) => p.category.charAt(0).toUpperCase() + p.category.slice(1) },
            { key: "active", label: "Estado", render: (p) => <StatusBadge status={p.active ? "activo" : "cancelado"} /> },
          ]}
          data={plans}
          loading={loading}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          emptyMessage="No hay planes creados"
        />
      ) : (
        <DataTable
          columns={[
            { key: "id", label: "Beneficiario", render: (m) => m.profiles?.full_name || "—" },
            { key: "plan_id", label: "Plan", render: (m) => m.membership_plans?.name || "—" },
            { key: "start_date", label: "Inicio", render: (m) => new Date(m.start_date).toLocaleDateString("es-CL") },
            { key: "end_date", label: "Fin", render: (m) => new Date(m.end_date).toLocaleDateString("es-CL") },
            { key: "status", label: "Estado", render: (m) => <StatusBadge status={m.status} /> },
          ]}
          data={memberships}
          loading={loading}
          emptyMessage="No hay membresías registradas"
        />
      )}

      <FormModal open={modalOpen} title={editing ? "Editar Plan" : "Nuevo Plan"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Nombre *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Precio ($) *</label>
              <input inputMode="numeric" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Duración (días) *</label>
              <input inputMode="numeric" value={form.duration_days || ""} onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Categoría *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              <option value="adulto">Adulto</option>
              <option value="nino">Niño</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">Activo</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={!form.name || saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Plan"}</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm open={!!deleteTarget} title="Eliminar Plan" message={`¿Estás seguro de eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
