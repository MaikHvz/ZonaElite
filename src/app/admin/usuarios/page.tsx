"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import StatusBadge from "@/components/admin/StatusBadge";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_id: number;
  active: boolean;
  created_at: string;
  _isDependent?: boolean;
  _tutorName?: string;
  _tutorId?: string;
  _birthDate?: string;
  _category?: string;
}

interface Role { id: number; name: string; }
interface Dependent { id: string; full_name: string; tutor_id: string; birth_date: string; category: string; }

const ROLE_LABELS: Record<number, string> = { 1: "Administrador", 2: "Instructor", 3: "Recepción", 4: "Alumno" };

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ role_id: 4, active: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const [uRes, rRes, dRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("id"),
      supabase.from("dependents").select("id, full_name, tutor_id, birth_date, category"),
    ]);

    const profiles = (uRes.data as UserRow[]) || [];
    const deps = (dRes.data as Dependent[]) || [];
    setRoles((rRes.data as Role[]) || []);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const rows: UserRow[] = [];

    for (const p of profiles) {
      rows.push(p);
      const userDeps = deps.filter((d) => d.tutor_id === p.id);
      for (const d of userDeps) {
        rows.push({
          id: d.id,
          full_name: d.full_name,
          email: `—`,
          phone: null,
          role_id: 0,
          active: true,
          created_at: d.birth_date || p.created_at,
          _isDependent: true,
          _tutorName: p.full_name,
          _tutorId: p.id,
          _birthDate: d.birth_date,
          _category: d.category,
        });
      }
    }

    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (u: UserRow) => {
    if (u._isDependent) return;
    setEditing(u);
    setForm({ role_id: u.role_id, active: u.active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ role_id: form.role_id, active: form.active }).eq("id", editing.id);
    setModalOpen(false);
    setSaving(false);
    await load();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
          Usuarios
        </h1>
      </div>

      <DataTable
        columns={[
          { key: "full_name", label: "Nombre", render: (u) => (
            <div className={`flex items-center gap-3 ${u._isDependent ? "pl-6" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${u._isDependent ? "bg-surface-container" : "bg-surface-container"}`}>
                <span className={`material-symbols-outlined text-[16px] ${u._isDependent ? "text-on-surface-variant" : "text-primary"}`}>
                  {u._isDependent ? "child_care" : "person"}
                </span>
              </div>
              <div>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{u.full_name}</p>
                {u._isDependent ? (
                  <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant">Carga de {u._tutorName}</p>
                ) : (
                  <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant">{u.email}</p>
                )}
              </div>
            </div>
          )},
          { key: "role_id", label: "Rol / Tipo", render: (u) => {
            if (u._isDependent) return <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">{u._category === "nino" ? "Niño" : "Adulto"}</span>;
            return ROLE_LABELS[u.role_id] || `Rol ${u.role_id}`;
          }},
          { key: "phone", label: "Teléfono", render: (u) => u._isDependent ? "—" : (u.phone || "—") },
          { key: "active", label: "Estado", render: (u) => {
            if (u._isDependent) return <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">—</span>;
            return <StatusBadge status={u.active ? "activo" : "cancelado"} />;
          }},
          { key: "created_at", label: "Registro", render: (u) => new Date(u.created_at).toLocaleDateString("es-CL") },
        ]}
        data={users}
        loading={loading}
        searchKey="full_name"
        searchPlaceholder="Buscar usuario..."
        onEdit={openEdit}
        emptyMessage="No hay usuarios registrados"
      />

      <FormModal open={modalOpen} title={editing ? `Editar: ${editing.full_name}` : ""} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Rol</label>
            <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">Activo</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : "Guardar Cambios"}</button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
