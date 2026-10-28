"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/providers/SessionProvider";
import { signOut } from "@/lib/supabase/auth";
import { getProfileForEdit, updateProfile } from "@/lib/supabase/dashboard";
import { parseMedida, isValidPeso, isValidAltura, isValidDominantHand } from "@/lib/medidas";
import { isValidRut, formatRut } from "@/lib/rut";
import { createClient } from "@/lib/supabase/client";

// Datos de la cuenta: información personal, apoderado, medidas,
// contraseña y cierre de sesión. Se usa en /perfil y en la pestaña
// "Cuenta" de Editar perfil (/atletas/yo). Requiere sesión.
export default function AccountSettings() {
  const { user, refreshProfile } = useSession();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [dominantHand, setDominantHand] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getProfileForEdit(user.id).then(({ data }) => {
        if (data) {
          setFullName(data.full_name || "");
          setPhone(data.phone || "");
          setBirthDate(data.birth_date || "");
          setRut(data.rut || "");
          setAddress(data.address || "");
          setGuardianName(data.guardian_name || "");
          setGuardianPhone(data.guardian_phone || "");
          setGuardianEmail(data.guardian_email || "");
          setWeight(data.weight != null ? String(data.weight) : "");
          setHeight(data.height != null ? String(data.height) : "");
          setDominantHand(data.dominant_hand || "");
        }
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (weight.trim() && !isValidPeso(weight)) {
      setSaveMsg("El peso debe ser mayor a 0 y hasta 300 kg, solo dígitos y un separador decimal.");
      return;
    }
    if (height.trim() && !isValidAltura(height)) {
      setSaveMsg("La altura debe ser mayor a 0 y hasta 250 cm, solo dígitos y un separador decimal.");
      return;
    }
    if (dominantHand && !isValidDominantHand(dominantHand)) {
      setSaveMsg("La mano dominante debe ser diestro o zurdo.");
      return;
    }
    if (rut.trim() && !isValidRut(rut)) {
      setSaveMsg("El RUT ingresado no es válido.");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    const { error } = await updateProfile(user.id, {
      full_name: fullName,
      phone: phone || undefined,
      birth_date: birthDate || undefined,
      rut: rut.trim() ? formatRut(rut) : undefined,
      address: address || undefined,
      guardian_name: guardianName.trim() || null,
      guardian_phone: guardianPhone.trim() || null,
      guardian_email: guardianEmail.trim() || null,
      weight: weight.trim() ? parseMedida(weight) : null,
      height: height.trim() ? parseMedida(height) : null,
      dominant_hand: dominantHand || null,
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

  if (!user) return null;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Personal Info Card */}
      <div id="tour-profile-personal" data-guide="perfil-info" className="glass-card p-5 md:p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[18px]">
              badge
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-headline-md)] text-[17px] md:text-[18px] text-on-surface uppercase">
            Información Personal
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface input-glow transition-all duration-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 0000 0000"
                className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 input-glow transition-all duration-300"
              />
            </div>
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                RUT
              </label>
              <input
                type="text"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="11.222.333-4"
                className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 input-glow transition-all duration-300"
              />
            </div>
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface input-glow transition-all duration-300"
              />
            </div>
          </div>

          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Dirección
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, número, comuna"
              className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 input-glow transition-all duration-300"
            />
          </div>

          {/* Apoderado (migración 040): obligatorio en la práctica para menores de edad. */}
          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Apoderado (si eres menor de edad)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Nombre del apoderado"
                className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 input-glow transition-all duration-300"
              />
              <input
                type="tel"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="Teléfono"
                className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 input-glow transition-all duration-300"
              />
              <input
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                placeholder="Correo"
                className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 input-glow transition-all duration-300"
              />
            </div>
          </div>

          <div data-guide="perfil-fisico" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Peso (kg)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Ej: 70.5"
                className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 input-glow transition-all duration-300"
              />
            </div>
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Altura (cm)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="Ej: 170"
                className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 input-glow transition-all duration-300"
              />
            </div>
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Mano dominante
              </label>
              <select
                value={dominantHand}
                onChange={(e) => setDominantHand(e.target.value)}
                className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface focus:outline-none focus:border-primary/50 input-glow transition-all duration-300 cursor-pointer"
              >
                <option value="">Sin especificar</option>
                <option value="diestro">Diestro</option>
                <option value="zurdo">Zurdo</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] py-3.5 rounded-xl uppercase tracking-wider disabled:opacity-50 cursor-pointer shadow-[0_0_16px_rgba(255,84,76,0.2)] hover:shadow-[0_0_24px_rgba(255,84,76,0.3)] transition-shadow"
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

      {/* Security Card */}
      <div id="tour-profile-security" data-guide="perfil-seguridad" className="glass-card p-5 md:p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-400 text-[18px]">
              shield
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-headline-md)] text-[17px] md:text-[18px] text-on-surface uppercase">
            Seguridad
          </h2>
        </div>

        <div className="space-y-4">
          {/* Email status */}
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-background/50 border border-on-surface/5">
            <div className="min-w-0">
              <span className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-0.5">
                Email
              </span>
              <span className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface truncate block">
                {user.email}
              </span>
            </div>
            <span
              className={`shrink-0 ml-3 font-[family-name:var(--font-label-sm)] text-[9px] md:text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                user.email_confirmed_at
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
              }`}
            >
              {user.email_confirmed_at ? "Verificado" : "Pendiente"}
            </span>
          </div>

          {/* Password change */}
          <div className="pt-2">
            <label className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Nueva contraseña
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="flex-1 bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface/30 input-glow transition-all duration-300"
              />
              <button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword}
                className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-4 py-3 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-30 cursor-pointer whitespace-nowrap"
              >
                {changingPassword ? "..." : "Cambiar"}
              </button>
            </div>
            {passwordMsg && (
              <p
                className={`font-[family-name:var(--font-body-md)] text-[12px] mt-2 ${
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

      {/* Session Card */}
      <div data-guide="perfil-sesion" className="glass-card p-5 md:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-400 text-[18px]">
              logout
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-headline-md)] text-[17px] md:text-[18px] text-on-surface uppercase">
            Sesión
          </h2>
        </div>
        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mb-4">
          Cerrar sesión en este dispositivo. Deberás iniciar sesión nuevamente para acceder a tu cuenta.
        </p>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full border border-red-500/30 text-red-400 font-[family-name:var(--font-headline-md)] text-[14px] py-3.5 rounded-xl uppercase tracking-wider hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
        </button>
      </div>
    </div>
  );
}
