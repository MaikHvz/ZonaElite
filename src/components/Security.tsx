export default function Security() {
  return (
    <section className="py-[64px] md:py-[96px] relative overflow-hidden fade-up">
      <div className="absolute inset-0 bg-surface-container" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="relative z-10 max-w-[1280px] mx-auto px-5 md:px-6">
        <div className="max-w-4xl mx-auto text-center md:text-left">
          <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter mb-8">
            Más que un entrenamiento, tu{" "}
            <span className="text-primary">mejor defensa</span>
          </h2>

          <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl mb-6">
            Vivimos en un mundo donde la seguridad personal ya no es opcional. El
            bullying, el acoso y la violencia no discriminan, pero tú puedes
            elegir estar preparado.
          </p>

          <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl mb-8">
            Transforma el miedo en acción. A través de nuestro sistema, no solo
            fortalecerás tu cuerpo; forjarás una mentalidad inquebrantable,
            superando complejos y ganando la autoconfianza necesaria para caminar
            seguro en cualquier lugar.
          </p>

          <blockquote className="border-l-4 border-primary pl-6 mb-10">
            <p className="font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] md:text-xl text-on-surface italic">
              &ldquo;La victoria comienza cuando decides prepararte.&rdquo;
            </p>
          </blockquote>

          <div className="flex flex-col sm:flex-row gap-4 items-center md:items-start">
            <a
              href="#contacto"
              className="btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-lg px-8 py-4 rounded-[0.25rem] text-center hover:scale-105 transition-transform duration-300 uppercase tracking-wide shadow-[0_10px_40px_rgba(229,57,53,0.4)]"
            >
              Únete a Nosotros
            </a>
            <p className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">
                location_on
              </span>
              La Serena
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
