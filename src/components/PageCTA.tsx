"use client";

import Link from "next/link";

export default function PageCTA() {
  return (
    <section className="py-[64px] md:py-[96px] relative overflow-hidden fade-up">
      <div className="absolute inset-0 bg-primary opacity-10" />
      <div className="relative z-10 max-w-4xl mx-auto px-5 text-center">
        <h2 className="font-[family-name:var(--font-display-xl)] text-[40px] md:text-[60px] md:leading-[60px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter mb-8 text-glow-red">
          ¿Listo para conocernos?
        </h2>
        <Link href="/auth" className="inline-block btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-xl px-12 py-5 rounded-[0.25rem] uppercase tracking-widest hover:scale-105 transition-transform duration-300 shadow-[0_0_40px_rgba(229,57,53,0.4)]">
          Reservar Clase de Prueba
        </Link>
      </div>
    </section>
  );
}
