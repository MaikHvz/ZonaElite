"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";
import ImageUpload from "@/components/admin/ImageUpload";

interface Product {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  stock: number;
  active: boolean;
  created_at: string;
  product_images?: { id: string; url: string; position: number }[];
}

const emptyForm = { name: "", category: "", description: "", price: 0, stock: 0, active: true };

export default function AdminProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [images, setImages] = useState<(string | null)[]>([null, null, null]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*, product_images(id, url, position)")
      .order("created_at", { ascending: false });
    setProducts((data as Product[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setImages([null, null, null]);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category || "",
      description: p.description || "",
      price: p.price,
      stock: p.stock,
      active: p.active,
    });
    const sorted = [...(p.product_images || [])].sort((a, b) => a.position - b.position);
    const imgUrls: (string | null)[] = [null, null, null];
    sorted.forEach((img, i) => { if (i < 3) imgUrls[i] = img.url; });
    setImages(imgUrls);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    if (editing) {
      await supabase.from("products").update(form).eq("id", editing.id);
    } else {
      const { data: newProduct } = await supabase.from("products").insert(form).select("id").single();
      if (newProduct) {
        const inserts = images
          .map((url, position) => url ? { product_id: newProduct.id, url, position } : null)
          .filter((item): item is { product_id: string; url: string; position: number } => item !== null);
        if (inserts.length > 0) await supabase.from("product_images").insert(inserts);
      }
      setModalOpen(false);
      setSaving(false);
      await load();
      return;
    }

    if (editing) {
      const existing = editing.product_images || [];
      const newUrls = images.filter(Boolean);

      const toDelete = existing.filter((ei) => !newUrls.includes(ei.url));
      if (toDelete.length > 0) {
        await supabase.from("product_images").delete().in("id", toDelete.map((d) => d.id));
      }

      const toInsert = images
        .map((url, position) => {
          if (!url) return null;
          const alreadyExists = existing.some((ei) => ei.url === url);
          if (alreadyExists) {
            const ex = existing.find((ei) => ei.url === url);
            if (ex && ex.position !== position) {
              return { _update: true, id: ex.id, position };
            }
            return null;
          }
          return { product_id: editing.id, url, position };
        })
        .filter(Boolean) as { product_id?: string; url?: string; position: number; id?: string; _update?: boolean }[];

      for (const item of toInsert) {
        if (item._update && item.id) {
          await supabase.from("product_images").update({ position: item.position }).eq("id", item.id);
        } else if (item.product_id && item.url) {
          await supabase.from("product_images").insert({ product_id: item.product_id, url: item.url, position: item.position });
        }
      }
    }

    setModalOpen(false);
    setSaving(false);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("product_images").delete().eq("product_id", deleteTarget.id);
    await supabase.from("products").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  };

  const updateImage = (index: number, url: string | null) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = url;
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
          Productos
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo Producto
        </button>
      </div>

      <DataTable
        columns={[
          { key: "image", label: "Imagen", render: (p: Product) => {
            const img = p.product_images?.sort((a, b) => a.position - b.position)[0];
            return img ? <img src={img.url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <span className="text-on-surface-variant/30">—</span>;
          }},
          { key: "name", label: "Nombre" },
          { key: "category", label: "Categoría", render: (p: Product) => p.category || "—" },
          { key: "price", label: "Precio", render: (p: Product) => `$${p.price.toLocaleString("es-CL")}` },
          { key: "stock", label: "Stock", render: (p: Product) => String(p.stock) },
          { key: "active", label: "Estado", render: (p: Product) => <StatusBadge status={p.active ? "activo" : "cancelado"} /> },
        ]}
        data={products}
        loading={loading}
        searchKey="name"
        searchPlaceholder="Buscar producto..."
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        emptyMessage="No hay productos creados"
      />

      <FormModal open={modalOpen} title={editing ? "Editar Producto" : "Nuevo Producto"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Nombre *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Categoría</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              <option value="">Sin categoría</option>
              <option value="Indumentaria">Indumentaria</option>
              <option value="Accesorios">Accesorios</option>
              <option value="Suplementos">Suplementos</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Descripción</label>
            <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Precio ($) *</label>
              <input inputMode="numeric" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Stock *</label>
              <input inputMode="numeric" value={form.stock || ""} onChange={(e) => setForm({ ...form, stock: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">Activo</span>
          </label>

          <div className="border-t border-on-surface/5 pt-4">
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-3">
              Imágenes del producto (máx. 3)
            </label>
            <div className="space-y-3">
              {images.map((img, i) => (
                <ImageUpload
                  key={i}
                  value={img}
                  onChange={(url) => updateImage(i, url)}
                  folder="products"
                  label={i === 0 ? "Imagen principal" : `Imagen ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={!form.name || saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Producto"}</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm open={!!deleteTarget} title="Eliminar Producto" message={`¿Estás seguro de eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
