import Link from "next/link";

export default function CTA() {
  return (
    <section className="py-[64px] md:py-[96px] relative overflow-hidden mt-16 fade-up">
      <div className="absolute inset-0 bg-primary opacity-10" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="relative z-10 max-w-4xl mx-auto px-5 text-center">
        <p className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-[0.15em] mb-6 text-[12px] leading-[16px]">
          Clases grupales + Entrenamiento personal
        </p>

        <h2 className="font-[family-name:var(--font-display-xl)] text-[50px] md:text-[80px] md:leading-[80px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter mb-6 text-glow-red">
          ¿Estás listo para
          <br />
          comenzar?
        </h2>

        <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-2xl mx-auto mb-10">
          Establezca un horario para aprender más sobre nuestras opciones de
          entrenamiento.
        </p>

        <Link
          href="/auth"
          className="inline-block btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-xl px-12 py-5 rounded-[0.25rem] uppercase tracking-widest hover:scale-105 transition-transform duration-300 shadow-[0_0_40px_rgba(229,57,53,0.4)]"
        >
          Reserva tu clase ahora
        </Link>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </section>
  );
}
