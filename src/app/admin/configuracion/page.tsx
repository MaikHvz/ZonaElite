"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/admin/ImageUpload";

interface AcademySettings {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  whatsapp: string | null;
  social_links: Record<string, string>;
}

export default function AdminConfiguracionPage() {
  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("academy_settings").select("*").limit(1).single().then(({ data }) => {
      setSettings(data as AcademySettings);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("academy_settings").update({
      name: settings.name,
      logo_url: settings.logo_url,
      address: settings.address,
      whatsapp: settings.whatsapp,
      social_links: settings.social_links,
    }).eq("id", settings.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
      </div>
    </div>
  );
}
