"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AthleteAvatar from "./AthleteAvatar";
import {
  COVER_THEMES,
  athleteProfileErrorMessage,
  isValidAlias,
  normalizeAlias,
  type AthleteDiscipline,
  type AthleteProfileHeader,
  type AthleteVisibility,
  type CoverTheme,
} from "@/lib/athlete-profile";

// "Editar perfil" (como en Instagram). Solo datos de presentación:
// grados, podios y trofeos los gestiona el staff.
export default function EditAthleteProfileModal({
  profile,
  disciplines,
  ringColor,
  onClose,
  onSaved,
}: {
  profile: AthleteProfileHeader;
  disciplines: AthleteDiscipline[];
  ringColor: string | null;
  onClose: () => void;
  onSaved: (alias: string) => void;
}) {
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
          <button
            onClick={save}
            disabled={saving || !aliasOk}
            className="font-[family-name:var(--font-body-md)] text-[14px] font-semibold text-gold hover:text-gold-light cursor-pointer disabled:opacity-40"
          >
            {saving ? "Guardando..." : "Listo"}
          </button>
        </div>

        <div
          className="h-24 relative"
          style={{ background: COVER_THEMES.find((c) => c.value === cover)?.gradient }}
        >
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
            <AthleteAvatar name={profile.full_name} ringColor={ringColor} size="lg" />
          </div>
        </div>

        <div className="px-5 pt-14 pb-6 space-y-5">
          <p className="text-center font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
            Tu perfil no muestra fotos: se identifica con tus iniciales y el color de tu cinturón.
          </p>

          <div>
            <span className={labelCls}>Portada</span>
            <div className="flex gap-2 flex-wrap">
              {COVER_THEMES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCover(c.value)}
                  className={`flex flex-col items-center gap-1 cursor-pointer`}
                  aria-pressed={cover === c.value}
                >
                  <span
                    className={`w-12 h-12 rounded-lg border-2 ${cover === c.value ? "border-gold" : "border-transparent"}`}
                    style={{ background: c.gradient }}
                  />
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">
                    {c.label}
                  </span>
                </button>
              ))}
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
            Tus cinturones, podios y trofeos los registra la academia. Si falta alguno, pídelo a tu profesor.
          </p>
        </div>
      </div>
    </div>
  );
}
