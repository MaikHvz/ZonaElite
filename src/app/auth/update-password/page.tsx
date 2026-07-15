"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/lib/supabase/auth";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ha ocurrido un error.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="w-full max-w-md bg-surface-container border border-on-surface/5 rounded-2xl p-8 text-center">
          <span className="material-symbols-outlined text-primary text-5xl mb-4">check_circle</span>
          <h1 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase mb-4">
            Contraseña actualizada
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-8">
            Tu contraseña ha sido cambiada correctamente. Serás redirigido al dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-24">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-8">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          <span className="font-[family-name:var(--font-label-sm)] text-[12px] leading-[16px] uppercase tracking-wider">
            Volver al inicio
          </span>
        </Link>

        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-8">
          <h1 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase mb-2 text-center">
            Nueva contraseña
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface-variant text-center mb-6">
            Ingresa tu nueva contraseña.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] mb-2">
                Nueva Contraseña
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-on-surface/10 rounded-[0.25rem] px-4 py-3 text-on-surface font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] mb-2">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-on-surface/10 rounded-[0.25rem] px-4 py-3 text-on-surface font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[16px] py-4 rounded-[0.25rem] uppercase tracking-wider hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(229,57,53,0.3)] disabled:opacity-50"
            >
              {loading ? "Actualizando..." : "Actualizar Contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
