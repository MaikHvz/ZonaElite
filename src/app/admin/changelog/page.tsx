"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  summary: string;
  created_at: string;
}

export default function AdminChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("changelog")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEntries((data as ChangelogEntry[]) || []);
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
    <div>
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
          Changelog de Desarrolladores
        </h1>
        <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mt-1">
          Nuevos cambios y mejoras realizadas por el equipo de desarrollo, organizados por versión.
        </p>
      </div>

      <div className="max-w-3xl space-y-4">
        {entries.length === 0 && (
          <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-6 text-center">
            <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
              Aún no hay cambios registrados.
            </p>
          </div>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-surface-container border border-on-surface/5 rounded-2xl p-6"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[22px]">update</span>
                <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase tracking-tight">
                  {entry.title}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-primary/15 border border-primary/30 text-primary font-[family-name:var(--font-label-md)] text-[11px] uppercase tracking-wider px-3 py-1 rounded-full">
                  {entry.version}
                </span>
                <span className="font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant/50">
                  {new Date(entry.created_at).toLocaleDateString("es-CL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[24px] text-on-surface-variant mt-3 whitespace-pre-line">
              {entry.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
