"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";
import ImageUpload from "@/components/admin/ImageUpload";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";

interface Event {
  id: string;
  type: string;
  title: string;
  description: string | null;
  image: string | null;
  location_name: string | null;
  location_url: string | null;
  event_date: string;
  extra: Record<string, unknown>;
  created_at: string;
}

const emptyForm = { type: "torneo", title: "", description: "", image: "", location_name: "", location_url: "", event_date: "" };

function extractGoogleMapsEmbed(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  if (trimmed.includes("goo.gl/maps") || trimmed.includes("google.com/maps")) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }

  if (trimmed.includes("google.com/maps/embed")) return trimmed;
  if (trimmed.includes("maps.google.com")) return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`;

  return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

export default function AdminEventosPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
    setEvents((data as Event[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (e: Event) => {
    setEditing(e);
    setForm({
      type: e.type,
      title: e.title,
      description: e.description || "",
      image: e.image || "",
      location_name: e.location_name || "",
      location_url: e.location_url || "",
      event_date: e.event_date,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const supabase = createClient();
      const payload = {
        ...form,
        description: form.description || null,
        image: form.image || null,
        location_name: form.location_name || null,
        location_url: form.location_url || null,
      };
      if (editing) {
        const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
        if (error) { setToast({ msg: getSupabaseErrorMessage(error, "actualizar evento"), type: "error" }); return; }
      } else {
        const { error } = await supabase.from("events").insert(payload);
        if (error) { setToast({ msg: getSupabaseErrorMessage(error, "crear evento"), type: "error" }); return; }
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "guardar evento"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const supabase = createClient();
      const { error } = await supabase.from("events").delete().eq("id", deleteTarget.id);
      if (error) { setToast({ msg: getSupabaseErrorMessage(error, "eliminar evento"), type: "error" }); return; }
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "eliminar evento"), type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const typeLabel = (t: string) => ({ torneo: "Torneo", graduacion: "Ceremonia", seminario: "Seminario", clase_especial: "Clase Especial" }[t] || t);

  const previewEmbed = form.location_url ? extractGoogleMapsEmbed(form.location_url) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
          Eventos
        </h1>
        <button onClick={openCreate} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo Evento
        </button>
      </div>

      <DataTable
        columns={[
          { key: "image", label: "Imagen", render: (e) => e.image ? <img src={e.image} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <span className="text-on-surface-variant/30">—</span> },
          { key: "title", label: "Título" },
          { key: "type", label: "Tipo", render: (e) => typeLabel(e.type) },
          { key: "event_date", label: "Fecha", render: (e) => new Date(e.event_date + "T12:00:00").toLocaleDateString("es-CL") },
          { key: "location_name", label: "Lugar", render: (e) => e.location_name || "—" },
        ]}
        data={events}
        loading={loading}
        searchKey="title"
        searchPlaceholder="Buscar evento..."
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        emptyMessage="No hay eventos creados"
      />

      <FormModal open={modalOpen} title={editing ? "Editar Evento" : "Nuevo Evento"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Tipo *</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              <option value="torneo">Torneo</option>
              <option value="graduacion">Ceremonia</option>
              <option value="seminario">Seminario</option>
              <option value="clase_especial">Clase Especial</option>
            </select>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Título *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Fecha *</label>
            <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Lugar</label>
            <input value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} placeholder="Nombre del recinto" className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Ubicación Google Maps</label>
            <input
              value={form.location_url}
              onChange={(e) => setForm({ ...form, location_url: e.target.value })}
              placeholder="https://maps.google.com/... o buscar dirección"
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50"
            />
            <p className="text-[11px] text-on-surface-variant/50 mt-1">Pegá el link de Google Maps o escribí una dirección</p>
            {previewEmbed && (
              <div className="mt-3 rounded-lg overflow-hidden border border-on-surface/10">
                <iframe
                  src={previewEmbed}
                  width="100%"
                  height="200"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full"
                />
              </div>
            )}
          </div>
          <div>
            <ImageUpload
              value={form.image || null}
              onChange={(url) => setForm({ ...form, image: url || "" })}
              folder="events"
              label="Imagen del evento"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={!form.title || !form.event_date || saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Evento"}</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm open={!!deleteTarget} title="Eliminar Evento" message={`¿Estás seguro de eliminar "${deleteTarget?.title}"? Esta acción no se puede deshacer.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
