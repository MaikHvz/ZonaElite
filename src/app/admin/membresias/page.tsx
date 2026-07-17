"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";
import AssignMembershipModal from "@/components/admin/AssignMembershipModal";
import MembershipReceipt from "@/components/admin/MembershipReceipt";
import type { ReceiptData } from "@/components/admin/MembershipReceipt";

interface Plan { id: string; name: string; price: number; duration_days: number; category: string; benefits: string[]; active: boolean; }
interface Membership { id: string; beneficiary_id: string; plan_id: string; purchased_by: string; start_date: string; end_date: string; status: string; created_at: string; membership_plans?: { name: string }; profiles?: { full_name: string }; beneficiaries?: { dependents?: { full_name: string; profiles?: { full_name: string } | null } | null; profiles?: { full_name: string } | null }; }

const emptyPlan = { name: "", price: 0, duration_days: 30, category: "adulto", benefits: [] as string[], active: true };

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
  const [newBenefit, setNewBenefit] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [editMembership, setEditMembership] = useState<Membership | null>(null);
  const [editForm, setEditForm] = useState({ endDate: "", status: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Membership | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const [pRes, mRes] = await Promise.all([
      supabase.from("membership_plans").select("*").order("price"),
      supabase.from("memberships").select("*, membership_plans(name), profiles:purchased_by(full_name), beneficiaries!inner(dependents(full_name, profiles!tutor_id(full_name)), profiles(full_name))").order("created_at", { ascending: false }),
    ]);
    setPlans((pRes.data as Plan[]) || []);
    setMemberships((mRes.data as Membership[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyPlan); setNewBenefit(""); setModalOpen(true); };
  const openEdit = (p: Plan) => { setEditing(p); setForm({ name: p.name, price: p.price, duration_days: p.duration_days, category: p.category, benefits: Array.isArray(p.benefits) ? p.benefits : [], active: p.active }); setNewBenefit(""); setModalOpen(true); };

  const addBenefit = () => {
    const text = newBenefit.trim();
    if (!text || form.benefits.includes(text)) return;
    setForm({ ...form, benefits: [...form.benefits, text] });
    setNewBenefit("");
  };

  const removeBenefit = (idx: number) => {
    setForm({ ...form, benefits: form.benefits.filter((_, i) => i !== idx) });
  };

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

  const openEditMembership = (m: Membership) => {
    setEditMembership(m);
    setEditForm({ endDate: m.end_date, status: m.status });
  };

  const handleSaveMembership = async () => {
    if (!editMembership) return;
    setEditSaving(true);
    const supabase = createClient();
    await supabase.from("memberships").update({ end_date: editForm.endDate, status: editForm.status }).eq("id", editMembership.id);
    setEditSaving(false);
    setEditMembership(null);
    await load();
  };

  const handleCancelMembership = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const supabase = createClient();
    await supabase.from("memberships").update({ status: "cancelada" }).eq("id", cancelTarget.id);
    setCancelling(false);
    setCancelTarget(null);
    await load();
  };

  const getBeneficiaryName = (m: Membership): string => {
    const depName = m.beneficiaries?.dependents?.full_name;
    const tutorName = m.beneficiaries?.dependents?.profiles?.full_name;
    const userName = m.beneficiaries?.profiles?.full_name;
    if (depName && tutorName) return `${depName} — Carga de ${tutorName}`;
    if (depName) return `${depName} — Carga`;
    return userName || m.profiles?.full_name || "—";
  };

  const getReceiptData = (m: Membership): ReceiptData => {
    const depName = m.beneficiaries?.dependents?.full_name;
    const tutorName = m.beneficiaries?.dependents?.profiles?.full_name;
    return {
      receiptNumber: `REC-${new Date(m.created_at).getFullYear()}-${m.id.slice(0, 8).toUpperCase()}`,
      beneficiaryName: depName || m.beneficiaries?.profiles?.full_name || m.profiles?.full_name || "—",
      tutorName: tutorName || undefined,
      planName: m.membership_plans?.name || "—",
      startDate: m.start_date,
      endDate: m.end_date,
      amount: 0,
      method: "transferencia",
      issuedAt: m.created_at,
    };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">Membresías</h1>
        <div className="flex gap-3">
          {tab === "membresias" && (
            <button onClick={() => setAssignOpen(true)} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Asignar Membresía
            </button>
          )}
          {tab === "planes" && (
            <button onClick={openCreate} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nuevo Plan
            </button>
          )}
        </div>
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
            { key: "beneficiary_id", label: "Beneficiario", render: (m) => (
              <div>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{getBeneficiaryName(m)}</p>
              </div>
            )},
            { key: "plan_id", label: "Plan", render: (m) => m.membership_plans?.name || "—" },
            { key: "start_date", label: "Inicio", render: (m) => new Date(m.start_date).toLocaleDateString("es-CL") },
            { key: "end_date", label: "Fin", render: (m) => new Date(m.end_date).toLocaleDateString("es-CL") },
            { key: "status", label: "Estado", render: (m) => <StatusBadge status={m.status} /> },
          ]}
          data={memberships}
          loading={loading}
          onEdit={openEditMembership}
          onDelete={setCancelTarget}
          emptyMessage="No hay membresías registradas"
        />
      )}

      {/* Plan modal */}
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
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Beneficios</label>
            <div className="flex gap-2 mb-3">
              <input
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBenefit(); } }}
                placeholder="Escribe un beneficio..."
                className="flex-1 bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={addBenefit}
                disabled={!newBenefit.trim()}
                className="btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-4 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
              >
                + Agregar
              </button>
            </div>
            {form.benefits.length > 0 ? (
              <ul className="space-y-2">
                {form.benefits.map((b, idx) => (
                  <li key={idx} className="flex items-center justify-between bg-surface-container border border-on-surface/5 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                      <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{b}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBenefit(idx)}
                      className="text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/50 italic">
                Sin beneficios agregados
              </p>
            )}
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

      {/* Edit membership modal */}
      <FormModal open={!!editMembership} title="Editar Membresía" onClose={() => setEditMembership(null)}>
        <div className="space-y-4">
          {editMembership && (
            <>
              <div className="bg-surface-container rounded-lg p-4 border border-on-surface/5">
                <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1">Beneficiario</p>
                <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{getBeneficiaryName(editMembership)}</p>
                <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1 mt-2">Plan</p>
                <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{editMembership.membership_plans?.name}</p>
              </div>
              <div>
                <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Fecha de vencimiento</label>
                <input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Estado</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
                  <option value="activa">Activa</option>
                  <option value="vencida">Vencida</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
                <button onClick={() => setEditMembership(null)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
                <button onClick={handleSaveMembership} disabled={editSaving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{editSaving ? "Guardando..." : "Guardar Cambios"}</button>
              </div>
            </>
          )}
        </div>
      </FormModal>

      {/* Cancel confirmation */}
      <DeleteConfirm open={!!cancelTarget} title="Cancelar Membresía" message={`¿Estás seguro de cancelar la membresía de "${cancelTarget ? getBeneficiaryName(cancelTarget) : ""}"? Esta acción no se puede deshacer.`} onConfirm={handleCancelMembership} onCancel={() => setCancelTarget(null)} loading={cancelling} />

      {/* Assign membership modal */}
      <AssignMembershipModal open={assignOpen} onClose={() => setAssignOpen(false)} onSaved={load} />
    </div>
  );
}
