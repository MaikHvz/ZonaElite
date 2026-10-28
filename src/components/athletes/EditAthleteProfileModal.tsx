"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AthleteAvatar from "./AthleteAvatar";
import AccountSettings from "./AccountSettings";
import {
  ATHLETE_AVATARS,
  COVER_IMAGES,
  COVER_THEMES,
  coverBackground,
  athleteInitials,
  athleteProfileErrorMessage,
  isValidAlias,
  normalizeAlias,
  type AthleteDiscipline,
  type AthleteProfileHeader,
  type AthleteVisibility,
  type CoverTheme,
} from "@/lib/athlete-profile";

export type EditProfileTab = "perfil" | "cuenta";

// "Editar perfil" (como en Instagram). Pestaña Perfil: presentación
// pública (avatar, portada, usuario, bio…). Pestaña Cuenta: datos
// personales, contraseña y sesión (los mismos de /perfil).
export default function EditAthleteProfileModal({
  profile,
  disciplines,
  ringColor,
  initialTab = "perfil",
  onClose,
  onSaved,
}: {
  profile: AthleteProfileHeader;
  disciplines: AthleteDiscipline[];
  ringColor: string | null;
  initialTab?: EditProfileTab;
  onClose: () => void;
  onSaved: (alias: string) => void;
}) {
  const [tab, setTab] = useState<EditProfileTab>(initialTab);
  const [avatarKey, setAvatarKey] = useState(profile.avatar_key || "");
  const [coverImage, setCoverImage] = useState(profile.cover_image || "");
  const overlayRef = useRef<HTMLDivElement>(null);
  const [alias, setAlias] = useState(profile.alias);
  const [nickname, setNickname] = useState(profile.nickname || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [primary, setPrimary] = useState(profile.primary_discipline_id || "");
  const [cover, setCover] = useState<CoverTheme>(profile.cover_theme);
  const [visibility, setVisibility] = useState<AthleteVisibility>(profile.visibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "auto";
    };
  }, [saving, onClose]);

  const aliasOk = isValidAlias(alias);

  const save = async () => {
    if (!aliasOk) {
      setError(athleteProfileErrorMessage("ALIAS_INVALID"));
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("update_my_athlete_profile", {
      p_alias: alias,
      p_nickname: nickname,
      p_bio: bio,
      p_primary_discipline_id: primary || null,
      p_cover_theme: cover,
      p_visibility: visibility,
      p_avatar_key: avatarKey || null,
      p_cover_image: coverImage || null,
    });
    setSaving(false);
    if (rpcError) {
      setError(athleteProfileErrorMessage(rpcError.message));
      return;
    }
    onSaved((data as string) || alias);
  };

  const labelCls =
    "block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5";
  const inputCls =
    "w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-gold/60";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] bg-black/70 flex items-end md:items-center justify-center md:p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Editar perfil"
    >
      <div className="w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-surface-container-lowest border border-on-surface/10 rounded-t-2xl md:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-surface-container-lowest border-b border-on-surface/10">
          <button
            onClick={onClose}
            disabled={saving}
            className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant hover:text-on-surface cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>
          <h2 className="font-[family-name:var(--font-headline-md)] text-[16px] uppercase text-on-surface">
            Editar perfil
          </h2>
          {tab === "perfil" ? (
            <button
              onClick={save}
              disabled={saving || !aliasOk}
              className="font-[family-name:var(--font-body-md)] text-[14px] font-semibold text-gold hover:text-gold-light cursor-pointer disabled:opacity-40"
            >
              {saving ? "Guardando..." : "Listo"}
            </button>
          ) : (
            <span className="w-[52px]" aria-hidden />
          )}
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-on-surface/10" role="tablist">
          {([
            { value: "perfil", label: "Perfil", icon: "account_circle" },
            { value: "cuenta", label: "Cuenta", icon: "manage_accounts" },
          ] as const).map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 border-b-2 -mb-px cursor-pointer transition-colors text-[13px] font-semibold ${
                tab === t.value
                  ? "border-gold text-on-surface"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "cuenta" ? (
          <div className="px-4 py-5">
            <AccountSettings />
          </div>
        ) : (
          <>
          <div className="h-28 relative" style={{ background: coverBackground(coverImage, cover) }}>
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
              <AthleteAvatar name={profile.full_name} ringColor={ringColor} avatarKey={avatarKey} size="lg" />
            </div>
          </div>

          <div className="px-5 pt-14 pb-6 space-y-6">
            <div>
              <span className={labelCls}>Avatar</span>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                <button
                  type="button"
                  onClick={() => setAvatarKey("")}
                  aria-pressed={avatarKey === ""}
                  title="Mis iniciales"
                  aria-label="Usar mis iniciales"
                  className={`aspect-square rounded-full flex items-center justify-center bg-surface-container-high text-on-surface font-[family-name:var(--font-headline-md)] text-[14px] uppercase cursor-pointer ring-offset-2 ring-offset-surface-container-lowest ${
                    avatarKey === "" ? "ring-2 ring-gold" : "hover:ring-1 hover:ring-on-surface/30"
                  }`}
                >
                  {athleteInitials(profile.full_name)}
                </button>
                {ATHLETE_AVATARS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAvatarKey(a.value)}
                    aria-pressed={avatarKey === a.value}
                    title={a.label}
                    aria-label={`Avatar ${a.label}`}
                    className={`aspect-square rounded-full flex items-center justify-center cursor-pointer ring-offset-2 ring-offset-surface-container-lowest ${
                      avatarKey === a.value ? "ring-2 ring-gold" : "hover:ring-1 hover:ring-on-surface/30"
                    }`}
                    style={{ background: a.background, color: a.color }}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                      {a.icon}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-on-surface-variant">
                El anillo toma el color de tu cinturón. No se suben fotos.
              </p>
            </div>

            <div>
              <span className={labelCls}>Portada</span>
              <div className="grid grid-cols-3 gap-2">
                {COVER_IMAGES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCoverImage(c.value)}
                    aria-pressed={coverImage === c.value}
                    className="flex flex-col gap-1 cursor-pointer text-left"
                  >
                    <span
                      className={`block h-14 rounded-lg border-2 ${coverImage === c.value ? "border-gold" : "border-transparent hover:border-on-surface/30"}`}
                      style={{ background: `url("${c.src}") center / cover no-repeat` }}
                    />
                    <span className="text-[11px] text-on-surface-variant truncate">{c.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 mb-2 text-[11px] text-on-surface-variant">O un color de la academia:</p>
              <div className="flex gap-2 flex-wrap">
                {COVER_THEMES.map((c) => {
                  const active = !coverImage && cover === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        setCoverImage("");
                        setCover(c.value);
                      }}
                      className="flex flex-col items-center gap-1 cursor-pointer"
                      aria-pressed={active}
                    >
                      <span
                        className={`w-12 h-12 rounded-lg border-2 ${active ? "border-gold" : "border-transparent hover:border-on-surface/30"}`}
                        style={{ background: c.gradient }}
                      />
                      <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="athlete-alias" className={labelCls}>Nombre de usuario</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[14px]">@</span>
                <input
                  id="athlete-alias"
                  value={alias}
                  onChange={(e) => setAlias(normalizeAlias(e.target.value))}
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`${inputCls} pl-8 ${alias && !aliasOk ? "border-red-500/60" : ""}`}
                />
              </div>
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Tu perfil quedará en /atletas/{alias || "…"}. De 3 a 30 caracteres: letras, números, punto, guion o guion bajo.
              </p>
            </div>

            <div>
              <label htmlFor="athlete-nickname" className={labelCls}>Apodo deportivo (opcional)</label>
              <input
                id="athlete-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={40}
                placeholder="Ej: El Tigre"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="athlete-bio" className={labelCls}>Biografía</label>
              <textarea
                id="athlete-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={150}
                rows={3}
                placeholder="Cuéntale a la comunidad quién eres como atleta"
                className={`${inputCls} resize-none`}
              />
              <p className="mt-1 text-right text-[11px] text-on-surface-variant">{bio.length}/150</p>
            </div>

            <div>
              <label htmlFor="athlete-primary" className={labelCls}>Disciplina principal</label>
              <select
                id="athlete-primary"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                disabled={disciplines.length === 0}
                className={`${inputCls} cursor-pointer disabled:opacity-50`}
              >
                <option value="">{disciplines.length === 0 ? "Aún no tienes disciplinas asignadas" : "Automática (mayor grado)"}</option>
                {disciplines.map((d) => (
                  <option key={d.discipline_id} value={d.discipline_id}>
                    {d.name}{d.grade_name ? ` · ${d.grade_name}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Define el color del anillo de tu perfil.
              </p>
            </div>

            <div>
              <span className={labelCls}>Privacidad</span>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "comunidad", icon: "groups", title: "Comunidad", desc: "Lo ven los alumnos con sesión iniciada" },
                  { value: "privado", icon: "lock", title: "Privado", desc: "Solo tú y el staff" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    aria-pressed={visibility === opt.value}
                    className={`text-left p-3 rounded-xl border cursor-pointer transition-colors ${
                      visibility === opt.value
                        ? "border-gold/60 bg-gold/10"
                        : "border-on-surface/10 hover:border-on-surface/20"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] text-gold">{opt.icon}</span>
                    <p className="font-[family-name:var(--font-headline-md)] text-[13px] uppercase text-on-surface mt-1">{opt.title}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-300">{error}</p>
            )}

            <p className="text-[11px] text-on-surface-variant">
              Publica tus torneos, cinturones, trofeos e hitos con el botón + de tu perfil. Los que registra la academia
              llevan la insignia ✔ Verificado por ZonaElite.
            </p>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
