"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";

interface Reglamento {
  id: string;
  content: string;
  updated_at: string;
  updated_by: string | null;
}

export default function AdminReglamentoPage() {
  const [reglamento, setReglamento] = useState<Reglamento | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("reglamento_interno")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setReglamento(data as Reglamento);
          setContent((data as Reglamento).content);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (reglamento) {
        const { error } = await supabase
          .from("reglamento_interno")
          .update({ content, updated_by: user?.id ?? null })
          .eq("id", reglamento.id);
        if (error) { setToast({ msg: getSupabaseErrorMessage(error, "guardar reglamento"), type: "error" }); return; }
      } else {
        const { data, error } = await supabase
          .from("reglamento_interno")
          .insert({ content, updated_by: user?.id ?? null })
          .select()
          .single();
        if (error) { setToast({ msg: getSupabaseErrorMessage(error, "guardar reglamento"), type: "error" }); return; }
        if (data) setReglamento(data as Reglamento);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "guardar reglamento"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
          Reglamento Interno
        </h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar"}
        </button>
      </div>

      <div className="max-w-3xl bg-surface-container border border-on-surface/5 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
            Contenido del reglamento
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder={"Escribe aquí el reglamento interno de la academia.\n\nCada párrafo en una línea en blanco separada."}
            className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-3 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 resize-y"
          />
          <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60 mt-1">
            Los usuarios verán este texto como párrafos separados en su panel.
          </p>
        </div>
        {reglamento && (
          <p className="font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant/50">
            Última actualización: {new Date(reglamento.updated_at).toLocaleString("es-CL")}
          </p>
        )}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
