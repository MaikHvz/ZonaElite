"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/providers/SessionProvider";
import CheckoutModal from "@/components/CheckoutModal";

export default function EnrollmentBanner() {
  const { user } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface-container-lowest to-surface-container-low shadow-[0_0_60px_rgba(255,84,76,0.1)] mb-10">
        {/* Glow accent top-left */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl"
        />
        {/* Glow accent bottom-right */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-8 w-48 h-48 rounded-full bg-primary/15 blur-3xl"
        />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 px-7 py-8">
          {/* Icon */}
          <div className="shrink-0 w-14 h-14 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,84,76,0.25)]">
            <span className="material-symbols-outlined text-primary text-[28px]">
              how_to_reg
            </span>
          </div>

          {/* Text */}
          <div className="flex-1 text-center md:text-left">
            {/* Badge */}
            <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Paso previo obligatorio
            </span>

            <h3 className="font-[family-name:var(--font-headline-lg)] text-[22px] md:text-[26px] leading-tight text-on-surface uppercase tracking-tight">
              ¿Ya eres parte de{" "}
              <span className="text-primary">ZonaElite</span>?
            </h3>
            <p className="mt-2 font-[family-name:var(--font-body-md)] text-[14px] leading-relaxed text-on-surface-variant max-w-xl">
              Antes de elegir tu plan de membresía mensual, necesitas una{" "}
              <strong className="text-on-surface">inscripción a la academia</strong>. Es un pago único
              anual o semestral que te da acceso a todas nuestras disciplinas.
            </p>

            {/* Feature pills */}
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2">
              {[
                { icon: "bolt", label: "Acceso completo a todas las disciplinas" },
                { icon: "shield_person", label: "Registro oficial en la academia" },
                { icon: "calendar_month", label: "Válida 6 o 12 meses" },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant bg-surface-container rounded-full px-3 py-1.5 border border-on-surface/5"
                >
                  <span className="material-symbols-outlined text-primary text-[14px]">
                    {icon}
                  </span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <button
              id="enrollment-banner-cta"
              onClick={handleClick}
              className="group relative overflow-hidden btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider px-7 py-3.5 rounded-xl shadow-[0_4px_24px_rgba(229,57,53,0.4)] hover:shadow-[0_6px_32px_rgba(229,57,53,0.6)] hover:scale-[1.03] transition-all duration-200 cursor-pointer flex items-center gap-2 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">
                how_to_reg
              </span>
              {user ? "Inscribirme ahora" : "Iniciar sesión para inscribirme"}
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors"
              />
            </button>
            {!user && (
              <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant/60 text-center">
                Necesitas una cuenta para continuar
              </p>
            )}
          </div>
        </div>
      </div>

      <CheckoutModal
        open={open}
        onClose={() => setOpen(false)}
        plan={null}
        mode="enrollment-only"
      />
    </>
  );
}
