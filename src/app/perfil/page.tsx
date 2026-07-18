"use client";

import { useSession } from "@/providers/SessionProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/supabase/auth";
import {
  getProfileForEdit,
  updateProfile,
} from "@/lib/supabase/dashboard";
import { createClient } from "@/lib/supabase/client";

export default function PerfilPage() {
  const { user, loading, refreshProfile } = useSession();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      getProfileForEdit(user.id).then(({ data }) => {
        if (data) {
          setFullName(data.full_name || "");
          setPhone(data.phone || "");
          setBirthDate(data.birth_date || "");
        }
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);
    const { error } = await updateProfile(user.id, {
      full_name: fullName,
      phone: phone || undefined,
      birth_date: birthDate || undefined,
    });
    if (error) setSaveMsg(error);
    else {
      setSaveMsg("Cambios guardados");
      await refreshProfile();
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setChangingPassword(true);
    setPasswordMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPasswordMsg(error.message);
    else {
      setPasswordMsg("Contraseña actualizada");
      setNewPassword("");
    }
    setChangingPassword(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    router.push("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const displayName =
    user.user_metadata?.full_name || fullName || "Sin nombre";

  return (
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <div className="max-w-[700px] mx-auto space-y-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
          Mi <span className="text-primary">Perfil</span>
        </h1>

        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full btn-primary-gradient flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-[28px]">
                person
              </span>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase">
                {displayName}
              </h2>
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                {user.email}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Nombre completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-background border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 0000 0000"
                className="w-full bg-background border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-background border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] py-3 rounded-lg uppercase tracking-wider disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>

            {saveMsg && (
              <p
                className={`font-[family-name:var(--font-body-md)] text-[13px] text-center ${
                  saveMsg.includes("Error") ? "text-red-400" : "text-green-400"
                }`}
              >
                {saveMsg}
              </p>
            )}
          </div>
        </div>

        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-6">
          <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase mb-4">
            Seguridad
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface block">
                  Email
                </span>
                <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                  {user.email}
                </span>
              </div>
              <span
                className={`font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  user.email_confirmed_at
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                }`}
              >
                {user.email_confirmed_at ? "Verificado" : "Pendiente"}
              </span>
            </div>

            <div className="border-t border-on-surface/5 pt-4">
              <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Nueva contraseña
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="flex-1 bg-background border border-on-surface/10 rounded-lg px-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 focus:border-primary focus:outline-none transition-colors"
                />
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword}
                  className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-30 cursor-pointer whitespace-nowrap"
                >
                  {changingPassword ? "..." : "Cambiar"}
                </button>
              </div>
              {passwordMsg && (
                <p
                  className={`font-[family-name:var(--font-body-md)] text-[12px] mt-1.5 ${
                    passwordMsg.includes("Error") || passwordMsg.includes("debe")
                      ? "text-red-400"
                      : "text-green-400"
                  }`}
                >
                  {passwordMsg}
                </p>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full border border-red-500/30 text-red-400 font-[family-name:var(--font-headline-md)] text-[14px] py-3 rounded-lg uppercase tracking-wider hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
        </button>
      </div>
    </div>
  );
}
