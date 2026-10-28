"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { athleteCategoryLabel, type AthleteSearchResult } from "@/lib/athlete-profile";
import {
  clearRecentAthletes,
  forgetRecentAthlete,
  getRecentAthletes,
  type RecentAthlete,
} from "@/lib/athlete-recent";
import AthleteAvatar from "@/components/athletes/AthleteAvatar";

const CATEGORY_FILTERS = [
  { value: "", label: "Todos" },
  { value: "nino", label: "Niños" },
  { value: "juvenil", label: "Juveniles" },
  { value: "adulto", label: "Adultos" },
];

export default function AtletasSearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [disciplines, setDisciplines] = useState<{ id: string; name: string }[]>([]);
  // El layout solo renderiza esta página en el cliente (con sesión).
  const [recent, setRecent] = useState<RecentAthlete[]>(() => getRecentAthletes());
  const [done, setDone] = useState<{ key: string; results: AthleteSearchResult[]; error: boolean } | null>(null);
  const requestKey = JSON.stringify([query.trim(), category, disciplineId]);
  const loading = done?.key !== requestKey;
  const results = done?.results ?? [];
  const error = !loading && !!done?.error;

  useEffect(() => {
    createClient()
      .from("disciplines")
      .select("id, name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setDisciplines(data || []));
  }, []);

  // Búsqueda instantánea con debounce; descarta respuestas viejas.
  useEffect(() => {
    let cancelled = false;
    const [q, cat, disc] = JSON.parse(requestKey) as [string, string, string];
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await createClient().rpc("search_athletes", {
        p_query: q || null,
        p_discipline_id: disc || null,
        p_category: cat || null,
        p_limit: 40,
      });
      if (cancelled) return;
      setDone({ key: requestKey, results: (data || []) as AthleteSearchResult[], error: !!rpcError });
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [requestKey]);

  const searching = query.trim() !== "" || category !== "" || disciplineId !== "";

  return (
    <div className="px-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="font-[family-name:var(--font-headline-md)] text-[24px] md:text-[28px] uppercase text-on-surface">
          Atletas
        </h1>
        <Link
          href="/atletas/yo"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-[13px] font-semibold transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">account_circle</span>
          Mi perfil
        </Link>
      </div>

      {/* Buscador */}
      <div className="sticky top-[60px] md:top-[72px] z-20 bg-background pb-3 -mx-4 px-4 pt-1">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, apodo o usuario"
            aria-label="Buscar atletas"
            autoComplete="off"
            className="w-full bg-surface-container-high rounded-xl pl-10 pr-10 py-3 text-[15px] text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-gold/50 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-on-surface/30 text-background flex items-center justify-center cursor-pointer"
              aria-label="Borrar búsqueda"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              className={`shrink-0 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${
                category === c.value
                  ? "bg-on-surface text-background"
                  : "bg-surface-container-high text-on-surface hover:bg-surface-bright"
              }`}
            >
              {c.label}
            </button>
          ))}
          <select
            value={disciplineId}
            onChange={(e) => setDisciplineId(e.target.value)}
            aria-label="Filtrar por disciplina"
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-semibold cursor-pointer focus:outline-none ${
              disciplineId ? "bg-on-surface text-background" : "bg-surface-container-high text-on-surface"
            }`}
          >
            <option value="">Todas las disciplinas</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Recientes (solo sin búsqueda activa) */}
      {!searching && recent.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-[family-name:var(--font-body-md)] text-[15px] font-semibold text-on-surface">Recientes</h2>
            <button
              onClick={() => {
                clearRecentAthletes();
                setRecent([]);
              }}
              className="text-[13px] text-gold hover:text-gold-light cursor-pointer"
            >
              Borrar todo
            </button>
          </div>
          <ul>
            {recent.map((a) => (
              <li key={a.alias} className="flex items-center gap-3 py-2">
                <Link href={`/atletas/${a.alias}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <AthleteAvatar name={a.full_name} ringColor={a.grade_color} avatarKey={a.avatar_key} size="sm" />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-on-surface truncate">{a.alias}</span>
                    <span className="block text-[13px] text-on-surface-variant truncate">{a.full_name}</span>
                  </span>
                </Link>
                <button
                  onClick={() => setRecent(forgetRecentAthlete(a.alias))}
                  className="p-2 text-on-surface-variant hover:text-on-surface cursor-pointer"
                  aria-label={`Quitar ${a.alias} de recientes`}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-[family-name:var(--font-body-md)] text-[15px] font-semibold text-on-surface">
          {searching ? "Resultados" : "Atletas destacados"}
        </h2>

        {loading && results.length === 0 ? (
          <ul className="space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-surface-container" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-32 rounded bg-surface-container" />
                  <div className="h-3 w-48 rounded bg-surface-container" />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <p className="py-10 text-center text-[14px] text-on-surface-variant">
            No se pudo cargar la búsqueda. Inténtalo de nuevo.
          </p>
        ) : results.length === 0 ? (
          <div className="py-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface/30">person_search</span>
            <p className="mt-2 text-[14px] text-on-surface-variant">
              {searching ? "No encontramos atletas con esa búsqueda." : "Todavía no hay atletas para mostrar."}
            </p>
          </div>
        ) : (
          <ul className={`divide-y divide-on-surface/5 transition-opacity ${loading ? "opacity-60" : ""}`}>
            {results.map((a) => (
              <li key={a.profile_id}>
                <Link
                  href={`/atletas/${a.alias}`}
                  className="flex items-center gap-3 py-3 hover:bg-on-surface/[0.03] -mx-2 px-2 rounded-lg transition-colors"
                >
                  <AthleteAvatar name={a.full_name} ringColor={a.grade_color} avatarKey={a.avatar_key} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-on-surface truncate">
                      {a.alias}
                      {a.nickname && <span className="font-normal text-on-surface-variant"> · “{a.nickname}”</span>}
                    </p>
                    <p className="text-[13px] text-on-surface-variant truncate">{a.full_name}</p>
                    <p className="text-[12px] text-on-surface-variant truncate flex items-center gap-1.5">
                      {a.grade_color && (
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full border border-on-surface/20"
                          style={{ backgroundColor: a.grade_color }}
                        />
                      )}
                      {[a.discipline_name, a.grade_name, athleteCategoryLabel(a.category)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {(a.medals > 0 || a.trophies > 0) && (
                    <span className="shrink-0 text-[12px] text-on-surface-variant text-right leading-tight">
                      {a.medals > 0 && <span className="block">🏅 {a.medals}</span>}
                      {a.trophies > 0 && <span className="block">🏆 {a.trophies}</span>}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
