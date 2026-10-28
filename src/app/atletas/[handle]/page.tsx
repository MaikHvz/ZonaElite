"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getChileToday } from "@/lib/dates";
import { podiumPositionMeta, formatPodiumDate } from "@/lib/sport-profile";
import {
  athleteCategoryLabel,
  buildAchievementPosts,
  computeAthleteStats,
  coverGradient,
  featuredDiscipline,
  groupTournaments,
  yearsSince,
  type AthleteProfileResponse,
} from "@/lib/athlete-profile";
import AthleteAvatar from "@/components/athletes/AthleteAvatar";
import AchievementPostCard from "@/components/athletes/AchievementPostCard";
import AchievementPostModal from "@/components/athletes/AchievementPostModal";
import EditAthleteProfileModal from "@/components/athletes/EditAthleteProfileModal";
import { rememberRecentAthlete } from "@/lib/athlete-recent";

type Tab = "publicaciones" | "palmares" | "torneos";

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: "publicaciones", label: "Publicaciones", icon: "grid_on" },
  { value: "palmares", label: "Palmarés", icon: "military_tech" },
  { value: "torneos", label: "Torneos", icon: "emoji_events" },
];

export default function AthleteProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const router = useRouter();

  const [data, setData] = useState<AthleteProfileResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>("publicaciones");
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null);
  const [openPost, setOpenPost] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .rpc("get_athlete_profile", { p_handle: decodeURIComponent(handle) })
      .then(({ data: res, error }) => {
        if (cancelled) return;
        setLoadError(!!error);
        setNotFound(!error && !res);
        if (!error && res) setData(res as AthleteProfileResponse);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle, reloadKey]);

  const load = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const full = data && !data.restricted ? data : null;
  const featured = full ? featuredDiscipline(full.disciplines, full.profile.primary_discipline_id) : null;
  const ringColor = featured?.grade_color || null;

  useEffect(() => {
    if (full && !full.profile.is_owner) {
      rememberRecentAthlete({
        alias: full.profile.alias,
        full_name: full.profile.full_name,
        grade_color: ringColor,
      });
    }
  }, [full, ringColor]);

  const allPosts = useMemo(() => (full ? buildAchievementPosts(full) : []), [full]);
  const posts = useMemo(() => {
    if (!disciplineFilter) return allPosts;
    return allPosts.filter((p) => p.discipline === disciplineFilter);
  }, [allPosts, disciplineFilter]);

  if (loading && !data) {
    return (
      <div className="px-4 animate-pulse">
        <div className="h-28 md:h-40 rounded-xl bg-surface-container" />
        <div className="flex items-end gap-6 -mt-10 px-4">
          <div className="w-24 h-24 md:w-36 md:h-36 rounded-full bg-surface-container-high border-4 border-background" />
          <div className="flex-1 grid grid-cols-4 gap-3 pb-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-surface-container" />
            ))}
          </div>
        </div>
        <div className="mt-6 space-y-2 px-4">
          <div className="h-4 w-40 rounded bg-surface-container" />
          <div className="h-3 w-64 rounded bg-surface-container" />
        </div>
        <div className="mt-8 grid grid-cols-3 gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square bg-surface-container" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || loadError) {
    return (
      <div className="px-5 py-20 text-center">
        <span className="material-symbols-outlined text-[56px] text-on-surface/30">
          {loadError ? "cloud_off" : "person_search"}
        </span>
        <h1 className="mt-4 font-[family-name:var(--font-headline-md)] text-[22px] uppercase text-on-surface">
          {loadError ? "No se pudo cargar el perfil" : "Atleta no encontrado"}
        </h1>
        <p className="mt-2 text-[14px] text-on-surface-variant">
          {loadError
            ? "Revisa tu conexión e inténtalo de nuevo."
            : "El enlace puede estar mal escrito o el atleta cambió su nombre de usuario."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {loadError && (
            <button
              onClick={load}
              className="px-5 py-2.5 rounded-lg btn-fire text-white font-[family-name:var(--font-headline-md)] text-[13px] uppercase cursor-pointer"
            >
              Reintentar
            </button>
          )}
          <Link
            href="/atletas"
            className="px-5 py-2.5 rounded-lg btn-gold-outline text-white font-[family-name:var(--font-headline-md)] text-[13px] uppercase"
          >
            Buscar atletas
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (data.restricted) {
    return (
      <div className="px-4">
        <div className="h-28 md:h-40 rounded-xl" style={{ background: coverGradient(data.profile.cover_theme) }} />
        <div className="flex flex-col items-center -mt-12 text-center">
          <AthleteAvatar name={data.profile.full_name} size="xl" />
          <p className="mt-3 font-[family-name:var(--font-body-md)] text-[18px] font-semibold text-on-surface">
            {data.profile.alias}
          </p>
          <p className="text-[14px] text-on-surface-variant">{data.profile.full_name}</p>
          <div className="mt-10 flex flex-col items-center gap-2">
            <span className="w-16 h-16 rounded-full border-2 border-on-surface/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[30px] text-on-surface/70">lock</span>
            </span>
            <p className="font-[family-name:var(--font-headline-md)] text-[16px] uppercase text-on-surface">
              Este perfil es privado
            </p>
            <p className="text-[13px] text-on-surface-variant max-w-xs">
              El atleta decidió no mostrar sus logros a la comunidad.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { profile } = data;
  const stats = computeAthleteStats(data.podiums, data.trophies);
  const years = yearsSince(profile.member_since, getChileToday());
  const tournaments = groupTournaments(data.podiums);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/atletas/${profile.alias}` : "";

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile.full_name} · ZonaElite`, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // el usuario canceló el diálogo de compartir
    }
  };

  const counters = [
    { label: "Torneos", value: stats.tournaments },
    { label: "Medallas", value: stats.medals },
    { label: "Trofeos", value: stats.trophies },
    { label: years === 1 ? "Año" : "Años", value: years },
  ];

  return (
    <div>
      {profile.is_owner && (profile.hidden_by_admin || profile.visibility === "privado") && (
        <div className="mx-4 mb-3 flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <span className="material-symbols-outlined text-yellow-400 text-[18px]">
            {profile.hidden_by_admin ? "visibility_off" : "lock"}
          </span>
          <p className="text-[13px] text-yellow-200">
            {profile.hidden_by_admin
              ? "La administración ocultó tu perfil: solo tú y el staff pueden verlo."
              : "Tu perfil es privado: solo tú y el staff pueden verlo. Cámbialo en Editar perfil."}
          </p>
        </div>
      )}

      {/* Portada + cabecera */}
      <div className="px-4">
        <div className="h-28 md:h-40 rounded-xl" style={{ background: coverGradient(profile.cover_theme) }} />
      </div>

      <header className="px-4 md:px-8">
        <div className="flex items-end gap-5 md:gap-10 -mt-12 md:-mt-16">
          <AthleteAvatar name={profile.full_name} ringColor={ringColor} size="xl" />
          <ul className="flex-1 grid grid-cols-4 gap-1 pb-1 md:pb-3">
            {counters.map((c) => (
              <li key={c.label} className="text-center">
                <span className="block font-[family-name:var(--font-headline-md)] text-[18px] md:text-[22px] text-on-surface leading-tight">
                  {c.value}
                </span>
                <span className="block font-[family-name:var(--font-body-md)] text-[11px] md:text-[13px] text-on-surface-variant">
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[family-name:var(--font-body-md)] text-[17px] md:text-[20px] font-semibold text-on-surface">
              {profile.alias}
            </h1>
            {!profile.active && (
              <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-on-surface/10 text-on-surface-variant">
                Ex alumno
              </span>
            )}
          </div>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            {profile.full_name}
            {profile.nickname && <span className="text-on-surface-variant"> · “{profile.nickname}”</span>}
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
            {[featured?.name, featured?.grade_name ? `Cinturón ${featured.grade_name}` : null, athleteCategoryLabel(profile.category)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {profile.bio ? (
            <p className="mt-2 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface/90 whitespace-pre-line">
              {profile.bio}
            </p>
          ) : (
            profile.is_owner && (
              <button
                onClick={() => setEditing(true)}
                className="mt-2 text-[13px] text-gold hover:text-gold-light cursor-pointer"
              >
                + Agrega una biografía
              </button>
            )
          )}
        </div>

        <div className="mt-4 flex gap-2">
          {profile.is_owner && (
            <button
              onClick={() => setEditing(true)}
              className="flex-1 md:flex-none md:px-8 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-[family-name:var(--font-body-md)] text-[14px] font-semibold transition-colors cursor-pointer"
            >
              Editar perfil
            </button>
          )}
          <button
            onClick={share}
            className="flex-1 md:flex-none md:px-8 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-[family-name:var(--font-body-md)] text-[14px] font-semibold transition-colors cursor-pointer"
          >
            {copied ? "¡Enlace copiado!" : "Compartir perfil"}
          </button>
          {!profile.is_owner && (
            <button
              onClick={() => router.push("/atletas")}
              className="px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors cursor-pointer"
              aria-label="Buscar atletas"
              title="Buscar atletas"
            >
              <span className="material-symbols-outlined text-[20px] align-middle">search</span>
            </button>
          )}
        </div>

        {/* Destacados: una burbuja por disciplina (filtra las publicaciones) */}
        {data.disciplines.length > 0 && (
          <div className="mt-6 flex gap-5 overflow-x-auto pb-1 -mx-1 px-1">
            {data.disciplines.map((d) => {
              const active = disciplineFilter === d.name;
              return (
                <button
                  key={d.discipline_id}
                  onClick={() => {
                    setDisciplineFilter(active ? null : d.name);
                    setTab("publicaciones");
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
                  aria-pressed={active}
                >
                  <span
                    className={`w-16 h-16 md:w-[77px] md:h-[77px] rounded-full p-[3px] ${active ? "ring-2 ring-gold ring-offset-2 ring-offset-background" : ""}`}
                    style={{ background: d.grade_color || "var(--color-surface-container-high)" }}
                  >
                    <span className="w-full h-full rounded-full bg-surface-container flex items-center justify-center border-2 border-background">
                      <span className="material-symbols-outlined text-[26px] text-on-surface">sports_martial_arts</span>
                    </span>
                  </span>
                  <span className="max-w-[80px] truncate font-[family-name:var(--font-body-md)] text-[12px] text-on-surface">
                    {d.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Pestañas */}
      <nav className="mt-6 border-t border-on-surface/10 flex justify-around md:justify-center md:gap-14 sticky top-[60px] md:top-[72px] z-20 bg-background">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 py-3 -mt-px border-t cursor-pointer transition-colors font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-[0.12em] ${
              tab === t.value
                ? "border-on-surface text-on-surface"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
            aria-pressed={tab === t.value}
          >
            <span className="material-symbols-outlined text-[20px] md:text-[14px]">{t.icon}</span>
            <span className="hidden md:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === "publicaciones" && (
        <section>
          {disciplineFilter && (
            <div className="px-4 py-2 flex items-center justify-between text-[13px] text-on-surface-variant">
              <span>Mostrando logros de {disciplineFilter}</span>
              <button onClick={() => setDisciplineFilter(null)} className="text-gold cursor-pointer">
                Ver todos
              </button>
            </div>
          )}
          {posts.length === 0 ? (
            <EmptyState
              icon="emoji_events"
              title={profile.is_owner ? "Tu primer logro te espera" : "Aún no hay logros"}
              text={
                profile.is_owner
                  ? "Cuando la academia registre tus cinturones, podios o trofeos, aparecerán aquí como publicaciones."
                  : "Los cinturones, podios y trofeos de este atleta aparecerán aquí."
              }
            />
          ) : (
            <div className="grid grid-cols-3 gap-[3px] md:gap-1">
              {posts.map((post, i) => (
                <AchievementPostCard key={post.key} post={post} onOpen={() => setOpenPost(i)} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "palmares" && (
        <section className="px-4 py-6 space-y-6">
          <div className="grid grid-cols-4 gap-2">
            {[
              { emoji: "🥇", label: "Oro", value: stats.gold },
              { emoji: "🥈", label: "Plata", value: stats.silver },
              { emoji: "🥉", label: "Bronce", value: stats.bronze },
              { emoji: "🏆", label: "Trofeos", value: stats.trophies },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-surface-container border border-on-surface/5 p-3 text-center">
                <span className="text-[28px] md:text-[36px] leading-none">{m.emoji}</span>
                <p className="mt-1 font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface">{m.value}</p>
                <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">{m.label}</p>
              </div>
            ))}
          </div>

          {data.trophies.length === 0 && stats.medals === 0 ? (
            <EmptyState icon="military_tech" title="Sin medallas ni trofeos todavía" text="Las medallas de torneos y los trofeos de la academia se mostrarán aquí." />
          ) : (
            <ul className="space-y-2">
              {data.trophies.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container border border-on-surface/5">
                  <span className="text-[26px]">🏆</span>
                  <div className="min-w-0">
                    <p className="text-[14px] text-on-surface truncate">{t.title}</p>
                    <p className="text-[12px] text-on-surface-variant truncate">
                      {formatPodiumDate(t.awarded_on)}{t.discipline ? ` · ${t.discipline}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {data.podiums
                .filter((p) => p.position !== "participacion")
                .map((p) => {
                  const meta = podiumPositionMeta(p.position);
                  return (
                    <li key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container border border-on-surface/5">
                      <span className="text-[26px]">{meta.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-[14px] text-on-surface truncate">{p.tournament}</p>
                        <p className="text-[12px] text-on-surface-variant truncate">
                          {meta.label} · {formatPodiumDate(p.event_date)}
                          {p.discipline ? ` · ${p.discipline}` : ""}
                          {p.category ? ` · ${p.category}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      )}

      {tab === "torneos" && (
        <section className="px-4 py-6">
          {tournaments.length === 0 ? (
            <EmptyState icon="sports_kabaddi" title="Sin torneos registrados" text="Los torneos en los que compita aparecerán aquí con su resultado." />
          ) : (
            <ol className="relative border-l border-on-surface/10 ml-3 space-y-5">
              {tournaments.map((t) => (
                <li key={t.key} className="pl-5 relative">
                  <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-gold" />
                  <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                    {formatPodiumDate(t.date)}
                  </p>
                  <p className="font-[family-name:var(--font-headline-md)] text-[16px] uppercase text-on-surface">
                    {t.tournament}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {t.results.map((r) => {
                      const meta = podiumPositionMeta(r.position);
                      return (
                        <li key={r.id} className="text-[13px] text-on-surface-variant">
                          {meta.emoji} {meta.label}
                          {r.discipline ? ` · ${r.discipline}` : ""}
                          {r.category ? ` · ${r.category}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <AchievementPostModal
        posts={posts}
        index={openPost}
        onIndexChange={setOpenPost}
        onClose={() => setOpenPost(null)}
        athleteName={profile.full_name}
        athleteAlias={profile.alias}
        ringColor={ringColor}
      />

      {profile.is_owner && editing && (
        <EditAthleteProfileModal
          profile={profile}
          disciplines={data.disciplines}
          ringColor={ringColor}
          onClose={() => setEditing(false)}
          onSaved={(alias) => {
            setEditing(false);
            if (alias !== decodeURIComponent(handle) && handle !== "yo") {
              router.replace(`/atletas/${alias}`);
            } else {
              load();
            }
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="py-14 px-6 text-center">
      <span className="inline-flex w-16 h-16 rounded-full border-2 border-on-surface/30 items-center justify-center">
        <span className="material-symbols-outlined text-[30px] text-on-surface/70">{icon}</span>
      </span>
      <p className="mt-3 font-[family-name:var(--font-headline-md)] text-[18px] uppercase text-on-surface">{title}</p>
      <p className="mt-1 text-[13px] text-on-surface-variant max-w-sm mx-auto">{text}</p>
    </div>
  );
}
