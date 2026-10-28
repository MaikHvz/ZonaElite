// ============================================================
// Perfil de Atleta (v1.17.0) — tipos y helpers puros.
// Los datos llegan de las RPC get_athlete_profile /
// search_athletes (migración 048). Sin imágenes: las
// "publicaciones" son tarjetas de logros generadas a partir de
// podios, cinturones y trofeos.
// ============================================================

import { podiumPositionMeta } from "./sport-profile.ts";

export type CoverTheme = "fuego" | "oro" | "brasa" | "acero" | "noche";
export type AthleteVisibility = "comunidad" | "privado";

export interface AthleteDiscipline {
  discipline_id: string;
  name: string;
  color_hex: string | null;
  grade_name: string | null;
  grade_color: string | null;
  grade_position: number | null;
}

export interface AthletePodium {
  id: string;
  tournament: string;
  event_date: string;
  discipline: string | null;
  category: string | null;
  position: string;
  description: string | null;
}

export interface AthleteTrophy {
  id: string;
  title: string;
  description: string | null;
  awarded_on: string;
  discipline: string | null;
}

export interface AthletePromotion {
  id: string;
  discipline: string;
  grade_name: string;
  grade_color: string;
  promoted_on: string;
}

/** Publicación propia del alumno (athlete_posts, migración 050). */
export type OwnPostKind = "torneo" | "cinturon" | "trofeo" | "hito" | "publicacion";

export interface AthleteOwnPost {
  id: string;
  kind: OwnPostKind;
  title: string | null;
  body: string | null;
  event_date: string;
  position: string | null;
  discipline: string | null;
  color: string | null;
  created_at: string;
}

export interface AthleteProfileHeader {
  id: string;
  alias: string;
  full_name: string;
  nickname: string | null;
  bio: string | null;
  cover_theme: CoverTheme;
  visibility: AthleteVisibility;
  hidden_by_admin: boolean;
  primary_discipline_id: string | null;
  /** Claves de buildAchievementPosts fijadas por el alumno (máx. 3). */
  pinned_posts?: string[];
  category: "nino" | "juvenil" | "adulto";
  member_since: string;
  active: boolean;
  is_owner: boolean;
}

export type AthleteProfileResponse =
  | {
      restricted: true;
      profile: Pick<AthleteProfileHeader, "alias" | "full_name" | "nickname" | "cover_theme">;
    }
  | {
      restricted: false;
      viewer_is_admin?: boolean;
      profile: AthleteProfileHeader;
      disciplines: AthleteDiscipline[];
      podiums: AthletePodium[];
      trophies: AthleteTrophy[];
      promotions: AthletePromotion[];
      posts?: AthleteOwnPost[];
    };

export interface AthleteSearchResult {
  profile_id: string;
  alias: string;
  full_name: string;
  nickname: string | null;
  category: "nino" | "juvenil" | "adulto";
  discipline_name: string | null;
  grade_name: string | null;
  grade_color: string | null;
  medals: number;
  trophies: number;
}

// ---- Portadas (paleta "fuego y oro") ------------------------

export const COVER_THEMES: { value: CoverTheme; label: string; gradient: string }[] = [
  { value: "fuego", label: "Fuego", gradient: "linear-gradient(135deg, #3a0d06 0%, #b9230f 55%, #f2552a 100%)" },
  { value: "oro", label: "Oro", gradient: "linear-gradient(135deg, #2a1a06 0%, #b9781e 55%, #f9d27a 100%)" },
  { value: "brasa", label: "Brasa", gradient: "linear-gradient(135deg, #1a0a05 0%, #6e1a0c 50%, #e6a53a 100%)" },
  { value: "acero", label: "Acero", gradient: "linear-gradient(135deg, #121212 0%, #3a3939 55%, #8a8a8a 100%)" },
  { value: "noche", label: "Noche", gradient: "linear-gradient(135deg, #050403 0%, #1c1b1b 60%, #5b403d 100%)" },
];

export function coverGradient(theme: string | null | undefined): string {
  return (COVER_THEMES.find((c) => c.value === theme) || COVER_THEMES[0]).gradient;
}

// ---- Alias --------------------------------------------------

/** Igual que el CHECK de athlete_profiles.alias: 3–30, a-z 0-9 . _ - */
export const ALIAS_REGEX = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;

export function normalizeAlias(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".");
}

export function isValidAlias(alias: string): boolean {
  return ALIAS_REGEX.test(alias);
}

/** Mensaje para los errores de update_my_athlete_profile. */
export function athleteProfileErrorMessage(raw: string | null | undefined): string {
  const msg = raw || "";
  if (msg.includes("ALIAS_TAKEN")) return "Ese nombre de usuario ya está en uso.";
  if (msg.includes("ALIAS_INVALID"))
    return "El nombre de usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.";
  if (msg.includes("NICKNAME_TOO_LONG")) return "El apodo puede tener hasta 40 caracteres.";
  if (msg.includes("BIO_TOO_LONG")) return "La biografía puede tener hasta 150 caracteres.";
  if (msg.includes("DISCIPLINE_INVALID")) return "La disciplina principal debe ser una de tus disciplinas.";
  return "No se pudo guardar el perfil. Inténtalo de nuevo.";
}

// ---- Presentación -------------------------------------------

export function athleteInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return (first + last).toUpperCase();
}

export function athleteCategoryLabel(category: string | null | undefined): string {
  if (category === "nino") return "Niños";
  if (category === "juvenil") return "Juveniles";
  return "Adultos";
}

/** Años completos entre `since` y `today` (ambos "YYYY-MM-DD"). */
export function yearsSince(since: string, today: string): number {
  const [sy, sm, sd] = since.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
  if (!sy || !ty) return 0;
  let years = ty - sy;
  if (tm < sm || (tm === sm && td < sd)) years--;
  return Math.max(0, years);
}

/** Disciplina destacada: la principal elegida, o la de mayor grado. */
export function featuredDiscipline(
  disciplines: AthleteDiscipline[],
  primaryId: string | null
): AthleteDiscipline | null {
  if (disciplines.length === 0) return null;
  const primary = primaryId ? disciplines.find((d) => d.discipline_id === primaryId) : undefined;
  if (primary) return primary;
  return [...disciplines].sort((a, b) => (b.grade_position ?? 0) - (a.grade_position ?? 0))[0];
}

export interface AthleteStats {
  tournaments: number;
  medals: number;
  gold: number;
  silver: number;
  bronze: number;
  trophies: number;
}

/**
 * Contadores del perfil: registros de la academia + logros que publicó
 * el alumno (torneos y trofeos propios también suman).
 */
export function computeAthleteStats(
  podiums: Pick<AthletePodium, "tournament" | "event_date" | "position">[],
  trophies: unknown[],
  ownPosts: Pick<AthleteOwnPost, "kind" | "title" | "event_date" | "position">[] = []
): AthleteStats {
  const results = [
    ...podiums.map((p) => ({ tournament: p.tournament, date: p.event_date, position: p.position })),
    ...ownPosts
      .filter((p) => p.kind === "torneo")
      .map((p) => ({ tournament: p.title || "", date: p.event_date, position: p.position || "" })),
  ];
  const tournaments = new Set(results.map((r) => `${r.tournament.trim().toLowerCase()}|${r.date}`));
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  for (const r of results) {
    if (r.position === "1") gold++;
    else if (r.position === "2") silver++;
    else if (r.position === "3") bronze++;
  }
  return {
    tournaments: tournaments.size,
    medals: gold + silver + bronze,
    gold,
    silver,
    bronze,
    trophies: trophies.length + ownPosts.filter((p) => p.kind === "trofeo").length,
  };
}

// ---- Publicaciones de logros --------------------------------

export type AchievementKind =
  | "campeonato"
  | "podio"
  | "participacion"
  | "cinturon"
  | "trofeo"
  | "hito"
  | "publicacion";

export interface AchievementPost {
  key: string;
  kind: AchievementKind;
  /** true = registrado por la academia; false = publicado por el alumno. */
  verified: boolean;
  /** id en athlete_posts cuando la publicó el alumno. */
  ownPostId: string | null;
  date: string;
  emoji: string;
  title: string;
  subtitle: string;
  detail: string | null;
  discipline: string | null;
  /** Color de acento (cinturón) cuando aplica. */
  color: string | null;
}

export const ACHIEVEMENT_KIND_LABEL: Record<AchievementKind, string> = {
  campeonato: "Campeonato",
  podio: "Podio",
  participacion: "Torneo",
  cinturon: "Cinturón",
  trofeo: "Trofeo",
  hito: "Hito",
  publicacion: "Publicación",
};

/** Tipos que el alumno puede publicar por su cuenta. */
export const OWN_POST_KINDS: { value: OwnPostKind; label: string; emoji: string; hint: string }[] = [
  { value: "publicacion", label: "Publicación", emoji: "💬", hint: "Un entrenamiento, una meta, una reflexión" },
  { value: "torneo", label: "Torneo", emoji: "🥇", hint: "Un torneo en el que compitió y su resultado" },
  { value: "cinturon", label: "Cinturón", emoji: "🥋", hint: "Un grado obtenido (también en otra escuela)" },
  { value: "trofeo", label: "Trofeo", emoji: "🏆", hint: "Un premio o reconocimiento" },
  { value: "hito", label: "Hito", emoji: "⭐", hint: "Seminarios, certificaciones, logros personales" },
];

export interface OwnPostDraft {
  kind: OwnPostKind;
  title: string;
  body: string;
  event_date: string;
  position: string;
  discipline: string;
  color: string;
}

/** Mismas reglas que los CHECK de athlete_posts. null = válido. */
export function validateOwnPost(d: OwnPostDraft): string | null {
  const title = d.title.trim();
  const body = d.body.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.event_date)) return "Indica la fecha.";
  if (d.kind === "publicacion") {
    if (!body) return "Escribe el texto de la publicación.";
  } else if (!title) {
    return d.kind === "torneo" ? "Indica el nombre del torneo." : "Indica un título.";
  }
  if (title.length > 80) return "El título puede tener hasta 80 caracteres.";
  if (body.length > 1000) return "El texto puede tener hasta 1000 caracteres.";
  if (d.kind === "torneo" && !["1", "2", "3", "participacion"].includes(d.position)) return "Elige tu resultado.";
  if (d.discipline.trim().length > 60) return "La disciplina puede tener hasta 60 caracteres.";
  if (d.color && !/^#[0-9a-fA-F]{6}$/.test(d.color)) return "Color inválido.";
  return null;
}

/** Publicaciones del perfil, de la más reciente a la más antigua. */
export function buildAchievementPosts(data: {
  podiums: AthletePodium[];
  trophies: AthleteTrophy[];
  promotions: AthletePromotion[];
  posts?: AthleteOwnPost[];
}): AchievementPost[] {
  const posts: AchievementPost[] = [];

  for (const p of data.podiums) {
    const meta = podiumPositionMeta(p.position);
    const kind: AchievementKind =
      p.position === "1" ? "campeonato" : p.position === "participacion" ? "participacion" : "podio";
    posts.push({
      key: `podio-${p.id}`,
      kind,
      verified: true,
      ownPostId: null,
      date: p.event_date,
      emoji: meta.emoji,
      title: kind === "campeonato" ? `Campeón · ${p.tournament}` : `${meta.label} · ${p.tournament}`,
      subtitle: [p.discipline, p.category].filter(Boolean).join(" · "),
      detail: p.description,
      discipline: p.discipline,
      color: null,
    });
  }

  for (const b of data.promotions) {
    posts.push({
      key: `cinturon-${b.id}`,
      kind: "cinturon",
      verified: true,
      ownPostId: null,
      date: b.promoted_on,
      emoji: "🥋",
      title: `Cinturón ${b.grade_name}`,
      subtitle: b.discipline,
      detail: null,
      discipline: b.discipline,
      color: b.grade_color,
    });
  }

  for (const t of data.trophies) {
    posts.push({
      key: `trofeo-${t.id}`,
      kind: "trofeo",
      verified: true,
      ownPostId: null,
      date: t.awarded_on,
      emoji: "🏆",
      title: t.title,
      subtitle: t.discipline || "Reconocimiento ZonaElite",
      detail: t.description,
      discipline: t.discipline,
      color: null,
    });
  }

  for (const o of data.posts || []) {
    posts.push(ownPostToAchievement(o));
  }

  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
}

function ownPostToAchievement(o: AthleteOwnPost): AchievementPost {
  const base = {
    key: `propio-${o.id}`,
    verified: false,
    ownPostId: o.id,
    date: o.event_date,
    discipline: o.discipline,
    detail: o.body,
    color: null as string | null,
  };
  const title = (o.title || "").trim();
  if (o.kind === "torneo") {
    const meta = podiumPositionMeta(o.position || "participacion");
    const kind: AchievementKind =
      o.position === "1" ? "campeonato" : o.position === "participacion" ? "participacion" : "podio";
    return {
      ...base,
      kind,
      emoji: meta.emoji,
      title: kind === "campeonato" ? `Campeón · ${title}` : `${meta.label} · ${title}`,
      subtitle: o.discipline || "",
    };
  }
  if (o.kind === "cinturon") {
    return { ...base, kind: "cinturon", emoji: "🥋", title, subtitle: o.discipline || "", color: o.color };
  }
  if (o.kind === "trofeo") {
    return { ...base, kind: "trofeo", emoji: "🏆", title, subtitle: o.discipline || "" };
  }
  if (o.kind === "hito") {
    return { ...base, kind: "hito", emoji: "⭐", title, subtitle: o.discipline || "" };
  }
  const body = (o.body || "").trim();
  return {
    ...base,
    kind: "publicacion",
    emoji: "💬",
    title: title || (body.length > 90 ? `${body.slice(0, 90).trimEnd()}…` : body),
    subtitle: o.discipline || "",
  };
}

/** Las fijadas primero (en el orden elegido) y luego el resto. */
export function orderWithPinned(posts: AchievementPost[], pinned: string[] | null | undefined): AchievementPost[] {
  const keys = (pinned || []).filter((k) => posts.some((p) => p.key === k));
  const pinnedPosts = keys.map((k) => posts.find((p) => p.key === k)!);
  return [...pinnedPosts, ...posts.filter((p) => !keys.includes(p.key))];
}

export type TournamentResult = AthletePodium & { verified: boolean };

/** Torneos agrupados (un torneo puede tener varios resultados). */
export function groupTournaments(
  podiums: AthletePodium[],
  ownPosts: AthleteOwnPost[] = []
): {
  key: string;
  tournament: string;
  date: string;
  results: TournamentResult[];
}[] {
  const all: TournamentResult[] = [
    ...podiums.map((p) => ({ ...p, verified: true })),
    ...ownPosts
      .filter((o) => o.kind === "torneo")
      .map((o) => ({
        id: o.id,
        tournament: o.title || "",
        event_date: o.event_date,
        discipline: o.discipline,
        category: null,
        position: o.position || "participacion",
        description: o.body,
        verified: false,
      })),
  ];
  const map = new Map<string, { key: string; tournament: string; date: string; results: TournamentResult[] }>();
  for (const p of all) {
    const key = `${p.tournament.trim().toLowerCase()}|${p.event_date}`;
    const entry = map.get(key) || { key, tournament: p.tournament, date: p.event_date, results: [] };
    entry.results.push(p);
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function formatAchievementDate(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}
