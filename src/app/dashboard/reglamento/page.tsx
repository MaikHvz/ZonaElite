"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Reglamento {
  id: string;
  content: string;
  updated_at: string;
}

export default function DashboardReglamentoPage() {
  const [content, setContent] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("reglamento_interno")
      .select("content, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setContent((data as Reglamento).content);
          setUpdatedAt((data as Reglamento).updated_at);
        }
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="material-symbols-outlined text-primary text-[28px]">menu_book</span>
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
          Reglamento Interno
        </h1>
      </div>

      {content && content.trim() !== "" ? (
        <div className="glass-card p-6 sm:p-8">
          {content.split("\n").map((paragraph, i) => {
            if (paragraph.trim() === "") return <br key={i} />;
            return (
              <p
                key={i}
                className="font-[family-name:var(--font-body-lg)] text-[15px] leading-[28px] text-on-surface mb-4"
              >
                {paragraph}
              </p>
            );
          })}
          {updatedAt && (
            <p className="mt-6 pt-4 border-t border-on-surface/5 font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant/50">
              Última actualización: {new Date(updatedAt).toLocaleDateString("es-CL")}
            </p>
          )}
        </div>
      ) : (
        <div className="glass-card p-10 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30 text-5xl mb-4 block">menu_book</span>
          <p className="font-[family-name:var(--font-body-md)] text-[15px] text-on-surface-variant">
            El reglamento interno aún no ha sido publicado.
          </p>
        </div>
      )}
    </div>
  );
}
