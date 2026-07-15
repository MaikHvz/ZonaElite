"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const type = params.get("type");

    if (type === "signup" && accessToken) {
      supabase.auth.exchangeCodeForSession(accessToken).then(({ error }) => {
        if (error) {
          setStatus("error");
          setMessage("El enlace de confirmación ha expirado o no es válido.");
        } else {
          setStatus("success");
        }
      });
    } else {
      setStatus("error");
      setMessage("Enlace de confirmación no válido.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-md bg-surface-container border border-on-surface/5 rounded-2xl p-8 text-center">
        {status === "loading" && (
          <>
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
              Confirmando tu cuenta...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <span className="material-symbols-outlined text-primary text-5xl mb-4">check_circle</span>
            <h1 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase mb-4">
              Cuenta confirmada
            </h1>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-8">
              Tu cuenta ha sido activada correctamente. Ya puedes iniciar sesión.
            </p>
            <Link
              href="/auth"
              className="inline-block w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[16px] py-4 rounded-[0.25rem] uppercase tracking-wider hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(229,57,53,0.3)]"
            >
              Iniciar Sesión
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <span className="material-symbols-outlined text-red-400 text-5xl mb-4">error</span>
            <h1 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase mb-4">
              Error de confirmación
            </h1>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-8">
              {message}
            </p>
            <Link
              href="/auth"
              className="inline-block w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[16px] py-4 rounded-[0.25rem] uppercase tracking-wider hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(229,57,53,0.3)]"
            >
              Volver al inicio de sesión
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
