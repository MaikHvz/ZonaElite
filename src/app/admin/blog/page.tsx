"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";

interface BlogPost { id: string; title: string; slug: string; content: string; cover_image: string | null; status: string; published_at: string | null; created_at: string; }

const emptyForm = { title: "", slug: "", content: "", cover_image: "", status: "borrador" };

function slugify(s: string) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    setPosts((data as BlogPost[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (p: BlogPost) => { setEditing(p); setForm({ title: p.title, slug: p.slug, content: p.content, cover_image: p.cover_image || "", status: p.status }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, cover_image: form.cover_image || null, slug: form.slug || slugify(form.title) };
    if (editing) {
      await supabase.from("blog_posts").update(payload).eq("id", editing.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("blog_posts").insert({ ...payload, author_id: user?.id });
    }
    setModalOpen(false);
    setSaving(false);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("blog_posts").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">Blog</h1>
        <button onClick={openCreate} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo Post
        </button>
      </div>

      <DataTable
        columns={[
          { key: "title", label: "Título" },
          { key: "slug", label: "Slug", render: (p) => <span className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">/{p.slug}</span> },
          { key: "status", label: "Estado", render: (p) => <StatusBadge status={p.status} /> },
          { key: "created_at", label: "Creado", render: (p) => new Date(p.created_at).toLocaleDateString("es-CL") },
        ]}
        data={posts}
        loading={loading}
        searchKey="title"
        searchPlaceholder="Buscar post..."
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        emptyMessage="No hay posts creados"
      />

      <FormModal open={modalOpen} title={editing ? "Editar Post" : "Nuevo Post"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Título *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Slug</label>
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={slugify(form.title || "")} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Contenido *</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">URL de imagen</label>
            <input value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Estado *</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              <option value="borrador">Borrador</option>
              <option value="programado">Programado</option>
              <option value="publicado">Publicado</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={!form.title || !form.content || saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Post"}</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm open={!!deleteTarget} title="Eliminar Post" message={`¿Estás seguro de eliminar "${deleteTarget?.title}"? Esta acción no se puede deshacer.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
