"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/providers/SessionProvider";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";

interface Notification {
  id: string;
  type: string;
  subject: string;
  content: string;
  target: string;
  sent_by: string;
  sent_at: string | null;
  created_at: string;
  profiles?: { full_name: string };
}

const TYPE_LABELS: Record<string, string> = {
  correo_masivo: "Correo Masivo",
  aviso: "Aviso",
  recordatorio: "Recordatorio",
  comunicado: "Comunicado",
};

const TARGET_LABELS: Record<string, string> = {
  todos: "Todos",
  segmento: "Segmento",
};

const emptyForm = { type: "aviso", subject: "", content: "", target: "todos" };

export default function AdminNotificacionesPage() {
  const { profile } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Notification | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*, profiles:sent_by(full_name)")
      .order("created_at", { ascending: false });
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (n: Notification) => { setEditing(n); setForm({ type: n.type, subject: n.subject, content: n.content, target: n.target }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      if (editing) {
        const { error } = await supabase.from("notifications").update(form).eq("id", editing.id);
        if (error) { setToast({ msg: getSupabaseErrorMessage(error), type: "error" }); setSaving(false); return; }
      } else {
        const { error } = await supabase.from("notifications").insert({
          ...form,
          sent_by: profile?.id,
          sent_at: new Date().toISOString(),
        });
        if (error) { setToast({ msg: getSupabaseErrorMessage(error), type: "error" }); setSaving(false); return; }
      }
      setModalOpen(false);
      setToast({ msg: editing ? "Notificación actualizada" : "Notificación creada", type: "success" });
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
      const { error } = await supabase.from("notifications").delete().eq("id", deleteTarget.id);
      if (error) { setToast({ msg: getSupabaseErrorMessage(error), type: "error" }); setDeleting(false); return; }
      setDeleteTarget(null);
      setToast({ msg: "Notificación eliminada", type: "success" });
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e), type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
          Notificaciones
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nueva Notificación
        </button>
      </div>

      <DataTable
        columns={[
          { key: "subject", label: "Asunto" },
          { key: "type", label: "Tipo", render: (n) => TYPE_LABELS[n.type] || n.type },
          { key: "target", label: "Destinatarios", render: (n) => TARGET_LABELS[n.target] || n.target },
          { key: "sent_by", label: "Enviado por", render: (n) => n.profiles?.full_name || "—" },
          { key: "sent_at", label: "Enviado", render: (n) => n.sent_at ? new Date(n.sent_at).toLocaleDateString("es-CL") : <StatusBadge status="borrador" /> },
        ]}
        data={notifications}
        loading={loading}
        searchKey="subject"
        searchPlaceholder="Buscar notificación..."
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        emptyMessage="No hay notificaciones creadas"
      />

      <FormModal open={modalOpen} title={editing ? "Editar Notificación" : "Nueva Notificación"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Tipo *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="aviso">Aviso</option>
              <option value="recordatorio">Recordatorio</option>
              <option value="comunicado">Comunicado</option>
              <option value="correo_masivo">Correo Masivo</option>
            </select>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Asunto *</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Contenido *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={5}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Destinatarios *</label>
            <select
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="todos">Todos los usuarios</option>
              <option value="segmento">Segmento específico</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!form.subject || !form.content || saving}
              className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Notificación"}
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        title="Eliminar Notificación"
        message={`¿Estás seguro de eliminar "${deleteTarget?.subject}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
