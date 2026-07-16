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
}

interface Role { id: number; name: string; }

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
    const [uRes, rRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("id"),
    ]);
    setUsers((uRes.data as UserRow[]) || []);
    setRoles((rRes.data as Role[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (u: UserRow) => { setEditing(u); setForm({ role_id: u.role_id, active: u.active }); setModalOpen(true); };

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
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-[16px]">person</span>
              </div>
              <div>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{u.full_name}</p>
                <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant">{u.email}</p>
              </div>
            </div>
          )},
          { key: "role_id", label: "Rol", render: (u) => ROLE_LABELS[u.role_id] || `Rol ${u.role_id}` },
          { key: "phone", label: "Teléfono", render: (u) => u.phone || "—" },
          { key: "active", label: "Estado", render: (u) => <StatusBadge status={u.active ? "activo" : "cancelado"} /> },
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
