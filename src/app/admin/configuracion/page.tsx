"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/admin/ImageUpload";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";

interface AcademySettings {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  whatsapp: string | null;
  social_links: Record<string, string>;
}

interface GalleryImage {
  id: string;
  url: string;
  alt: string;
  position: number;
  active: boolean;
}

export default function AdminConfiguracionPage() {
  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [newImageAlt, setNewImageAlt] = useState("");
  const [addingImage, setAddingImage] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("academy_settings").select("*").limit(1).single().then(({ data }) => {
      setSettings(data as AcademySettings);
      setLoading(false);
    });

    supabase
      .from("gallery_images")
      .select("*")
      .order("position")
      .then(({ data }) => {
        setGallery((data as GalleryImage[]) || []);
        setGalleryLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const supabase = createClient();
      const { error } = await supabase.from("academy_settings").update({
        name: settings.name,
        logo_url: settings.logo_url,
        address: settings.address,
        whatsapp: settings.whatsapp,
        social_links: settings.social_links,
      }).eq("id", settings.id);
      if (error) {
        setToast({ msg: getSupabaseErrorMessage(error, "Guardar configuración"), type: "error" });
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setToast({ msg: getSupabaseErrorMessage(err, "Guardar configuración"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddImage = async (url: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("gallery_images")
        .insert({ url, alt: newImageAlt, position: gallery.length, active: true })
        .select()
        .single();
      if (error) {
        setToast({ msg: getSupabaseErrorMessage(error, "Agregar imagen"), type: "error" });
        return;
      }
      if (data) {
        setGallery((prev) => [...prev, data as GalleryImage]);
        setNewImageAlt("");
      }
    } catch (err) {
      setToast({ msg: getSupabaseErrorMessage(err, "Agregar imagen"), type: "error" });
    } finally {
      setAddingImage(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("gallery_images").delete().eq("id", id);
      if (error) {
        setToast({ msg: getSupabaseErrorMessage(error, "Eliminar imagen"), type: "error" });
        return;
      }
      setGallery((prev) => prev.filter((img) => img.id !== id));
    } catch (err) {
      setToast({ msg: getSupabaseErrorMessage(err, "Eliminar imagen"), type: "error" });
    }
  };

  const handleToggleImage = async (id: string, active: boolean) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("gallery_images").update({ active }).eq("id", id);
      if (error) {
        setToast({ msg: getSupabaseErrorMessage(error, "Cambiar visibilidad"), type: "error" });
        return;
      }
      setGallery((prev) => prev.map((img) => img.id === id ? { ...img, active } : img));
    } catch (err) {
      setToast({ msg: getSupabaseErrorMessage(err, "Cambiar visibilidad"), type: "error" });
    }
  };

  const handleReorder = async (id: string, direction: "up" | "down") => {
    const idx = gallery.findIndex((img) => img.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= gallery.length) return;

    try {
      const newGallery = [...gallery];
      [newGallery[idx], newGallery[swapIdx]] = [newGallery[swapIdx], newGallery[idx]];

      const supabase = createClient();
      const updates = newGallery.map((img, i) =>
        supabase.from("gallery_images").update({ position: i }).eq("id", img.id)
      );
      const results = await Promise.all(updates);
      const hasError = results.some((r) => r.error);
      if (hasError) {
        setToast({ msg: getSupabaseErrorMessage(new Error("Error al reordenar imágenes"), "Reordenar"), type: "error" });
        return;
      }

      setGallery(newGallery.map((img, i) => ({ ...img, position: i })));
    } catch (err) {
      setToast({ msg: getSupabaseErrorMessage(err, "Reordenar"), type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!settings) return <p className="text-on-surface-variant">No se encontraron configuraciones.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">Configuración</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">save</span>
          {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar"}
        </button>
      </div>

      <div className="max-w-2xl bg-surface-container border border-on-surface/5 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Nombre de la academia</label>
          <input value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Dirección</label>
          <input value={settings.address || ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">WhatsApp</label>
          <input value={settings.whatsapp || ""} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} placeholder="+56912345678" className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50" />
        </div>
        <div>
          <ImageUpload
            value={settings.logo_url || null}
            onChange={(url) => setSettings({ ...settings, logo_url: url })}
            folder="settings"
            label="Logo de la academia"
          />
        </div>

        <div className="border-t border-on-surface/5 pt-5">
          <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase mb-4">Redes Sociales</h3>
          <div className="space-y-3">
            {["instagram", "facebook", "tiktok", "youtube"].map((platform) => (
              <div key={platform}>
                <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5 capitalize">{platform}</label>
                <input
                  value={settings.social_links[platform] || ""}
                  onChange={(e) => setSettings({ ...settings, social_links: { ...settings.social_links, [platform]: e.target.value } })}
                  placeholder={`https://${platform}.com/...`}
                  className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Gallery Management */}
        <div className="border-t border-on-surface/5 pt-5">
          <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase mb-1">Galería de Espacios</h3>
          <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant mb-4">
            Imágenes del carrusel en la página /nosotros. Se muestran en el orden indicado.
          </p>

          {galleryLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-surface-container-high/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {gallery.map((img, idx) => (
                  <div key={img.id} className={`flex items-center gap-3 p-3 rounded-xl border border-on-surface/5 ${img.active ? "" : "opacity-50"}`}>
                    <img src={img.url} alt={img.alt} className="w-16 h-12 object-cover rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface truncate">{img.alt || "Sin título"}</p>
                      <span className="font-[family-name:var(--font-label-sm)] text-[10px] text-on-surface-variant/60">Posición {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleReorder(img.id, "up")} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-on-surface/5 disabled:opacity-30 cursor-pointer">
                        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">arrow_upward</span>
                      </button>
                      <button onClick={() => handleReorder(img.id, "down")} disabled={idx === gallery.length - 1} className="p-1.5 rounded-lg hover:bg-on-surface/5 disabled:opacity-30 cursor-pointer">
                        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">arrow_downward</span>
                      </button>
                      <button onClick={() => handleToggleImage(img.id, !img.active)} className="p-1.5 rounded-lg hover:bg-on-surface/5 cursor-pointer">
                        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">{img.active ? "visibility" : "visibility_off"}</span>
                      </button>
                      <button onClick={() => handleDeleteImage(img.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 cursor-pointer">
                        <span className="material-symbols-outlined text-red-400 text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}

                {gallery.length === 0 && (
                  <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/60 text-center py-6">
                    No hay imágenes en la galería
                  </p>
                )}
              </div>

              {/* Add Image */}
              {addingImage ? (
                <div className="bg-surface-container-high/30 rounded-xl p-4 space-y-3">
                  <ImageUpload
                    value={null}
                    onChange={(url) => { if (url) handleAddImage(url); }}
                    folder="gallery"
                    label="Nueva imagen"
                  />
                  <div>
                    <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Descripción (opcional)</label>
                    <input
                      value={newImageAlt}
                      onChange={(e) => setNewImageAlt(e.target.value)}
                      placeholder="Ej: Área de entrenamiento"
                      className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <button onClick={() => setAddingImage(false)} className="text-[12px] text-on-surface-variant/60 hover:text-on-surface-variant cursor-pointer">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingImage(true)}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-on-surface/15 rounded-xl py-3 text-on-surface-variant hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                  <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider">Agregar imagen</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
