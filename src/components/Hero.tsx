import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden fade-up">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-no-repeat"
          style={{
            backgroundImage: "url('/original.jpg')",
            backgroundPosition: "center 36%",
          }}
        />
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 bg-background/30" />
      </div>

      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-5 md:px-6 mt-16 md:mt-0">
        <div className="max-w-4xl">
          <h1 className="font-[family-name:var(--font-display-xl)] text-[32px] leading-[36px] md:text-[100px] md:leading-[95px] text-on-surface uppercase tracking-tighter mb-6 drop-shadow-2xl">
            DOMINA TU CUERPO.
            <br />
            <span className="text-primary text-glow-red">
              FORTALECE TU MENTE.
            </span>
          </h1>

          <p className="font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] md:text-xl text-on-surface-variant max-w-2xl mb-10 border-l-4 border-primary pl-4 opacity-90">
            Entrena Kenpo, Kickboxing, Sport Kempo y Acondicionamiento Físico en un
            ambiente diseñado para desarrollar disciplina, confianza y
            rendimiento.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link
              href="/horarios"
              className="btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-lg px-8 py-4 rounded-[0.25rem] text-center hover:scale-105 transition-transform duration-300 uppercase tracking-wide shadow-[0_10px_40px_rgba(229,57,53,0.4)]"
            >
              Reservar Clase
            </Link>
            <a
              href="/horarios"
              className="border-2 border-on-surface/20 hover:border-on-surface/50 text-on-surface font-[family-name:var(--font-headline-md)] text-lg px-8 py-4 rounded-[0.25rem] text-center transition-all duration-300 uppercase tracking-wide bg-surface-container-high"
            >
              Ver Horarios
            </a>
          </div>

          {/* Features Row */}
          <div className="flex flex-wrap gap-6 md:gap-12 border-t border-on-surface/10 pt-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">
                check_circle
              </span>
              <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px]">
                Primera clase de prueba
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">
                check_circle
              </span>
              <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px]">
                Todas las edades
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">
                check_circle
              </span>
              <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px]">
                Entrenadores certificados
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce hidden md:block">
        <span className="material-symbols-outlined text-on-surface-variant text-4xl opacity-50">
          keyboard_arrow_down
        </span>
      </div>
    </section>
  );
}
