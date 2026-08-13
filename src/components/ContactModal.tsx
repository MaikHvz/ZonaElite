"use client";

import { useContactModal } from "./ContactModalContext";

export default function ContactModal() {
  const { open, setOpen } = useContactModal();

  return (
    <>
      {/* Floating Button — hidden on mobile to avoid blocking content */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex fixed bottom-8 right-8 z-50 w-16 h-16 rounded-full btn-primary-gradient text-white shadow-[0_10px_40px_rgba(229,57,53,0.4)] items-center justify-center hover:scale-110 transition-transform duration-300 group"
      >
        <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform">
          mail
        </span>
      </button>

      {/* Modal */}
      <div
        className={`fixed inset-0 z-[60] ${
          open ? "flex" : "hidden"
        } items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`glass-panel w-full max-w-md rounded-2xl p-8 relative transform transition-transform duration-300 ${
            open ? "scale-100" : "scale-95"
          }`}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-primary uppercase tracking-tighter mb-6">
            Contáctanos
          </h2>

          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px]">
                Nombre
              </label>
              <input
                type="text"
                placeholder="Tu nombre"
                className="bg-surface-container-low border border-on-surface/10 rounded-[0.25rem] p-3 text-on-surface focus:border-primary outline-none transition-colors"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px]">
                Correo
              </label>
              <input
                type="email"
                placeholder="tu@email.com"
                className="bg-surface-container-low border border-on-surface/10 rounded-[0.25rem] p-3 text-on-surface focus:border-primary outline-none transition-colors"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px]">
                Mensaje
              </label>
              <textarea
                rows={4}
                placeholder="¿En qué podemos ayudarte?"
                className="bg-surface-container-low border border-on-surface/10 rounded-[0.25rem] p-3 text-on-surface focus:border-primary outline-none transition-colors resize-none"
                required
              />
            </div>
            <button
              type="submit"
              className="mt-4 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-lg py-4 rounded-[0.25rem] uppercase tracking-wide shadow-[0_0_20px_rgba(229,57,53,0.3)] hover:opacity-90 transition-opacity"
            >
              Enviar Mensaje
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
