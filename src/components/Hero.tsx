import Link from "next/link";

// Brasas ascendentes (deterministas para no romper la hidratación).
// Se concentran a la derecha, en el aura detrás del maestro.
const embers = Array.from({ length: 16 }, (_, i) => ({
  left: `${i % 4 === 0 ? (i * 37) % 100 : 60 + ((i * 29) % 40)}%`,
  size: 3 + ((i * 7) % 6),
  duration: 6 + ((i * 5) % 8),
  delay: (i * 0.6) % 9,
  drift: (i % 2 === 0 ? 1 : -1) * (15 + ((i * 13) % 50)),
}));

const features = [
  "Primera clase de prueba",
  "Todas las edades",
  "Entrenadores certificados",
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden fade-up bg-black">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        {/* Foto gradeada "fuego" (ver public/hero-fire*.jpg) */}
        <div
          className="absolute inset-0 bg-cover bg-no-repeat md:hidden"
          style={{
            backgroundImage: "url('/hero-fire-mobile.jpg')",
            backgroundPosition: "center top",
          }}
        />
        <div
          className="absolute inset-0 bg-cover bg-no-repeat hidden md:block"
          style={{
            backgroundImage: "url('/hero-fire.jpg')",
            backgroundPosition: "center 15%",
          }}
        />
        <div className="absolute inset-0 hero-fire-overlay" />
        <div className="absolute inset-0 hero-fire-flicker" />

        {/* Brasas */}
        <div className="absolute inset-0 pointer-events-none">
          {embers.map((e, i) => (
            <span
              key={i}
              className="ember ember-fire"
              style={{
                left: e.left,
                width: e.size,
                height: e.size,
                ["--ember-duration" as string]: `${e.duration}s`,
                ["--ember-delay" as string]: `${e.delay}s`,
                ["--ember-drift" as string]: `${e.drift}px`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-5 md:px-6 mt-16 md:mt-0">
        <div className="max-w-4xl">
          <h1 className="font-[family-name:var(--font-display-xl)] text-[44px] leading-[46px] sm:text-[68px] sm:leading-[68px] md:text-[104px] md:leading-[98px] uppercase tracking-tighter mb-6">
            <span className="block text-gold-metal">DOMINA TU CUERPO.</span>
            <span className="block text-fire">FORTALECE TU MENTE.</span>
          </h1>

          <p className="font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] md:text-xl text-white/90 max-w-2xl mb-10 border-l-4 border-ember pl-4 [text-shadow:0_2px_12px_rgba(0,0,0,0.8)]">
            Entrena Kenpo, Kickboxing, Sport Kempo y Acondicionamiento Físico en un
            ambiente diseñado para desarrollar disciplina, confianza y
            rendimiento.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link
              href="/horarios"
              className="btn-fire text-white font-[family-name:var(--font-headline-md)] text-lg px-8 py-4 rounded-[0.25rem] text-center uppercase tracking-wide"
            >
              Reservar Clase
            </Link>
            <Link
              href="/horarios"
              className="btn-gold-outline text-white font-[family-name:var(--font-headline-md)] text-lg px-8 py-4 rounded-[0.25rem] text-center uppercase tracking-wide"
            >
              Ver Horarios
            </Link>
          </div>

          {/* Features Row */}
          <div className="flex flex-wrap gap-6 md:gap-12 pt-8 relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-gold/50 via-ember/30 to-transparent" />
            {features.map((label) => (
              <div key={label} className="flex items-center gap-3">
                <span className="material-symbols-outlined text-gold [text-shadow:0_0_12px_rgba(245,185,66,0.6)]">
                  check_circle
                </span>
                <span className="font-[family-name:var(--font-headline-md)] text-white uppercase tracking-[0.12em] text-[13px] leading-[16px]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce hidden md:block z-10">
        <span className="material-symbols-outlined text-gold text-4xl opacity-70">
          keyboard_arrow_down
        </span>
      </div>
    </section>
  );
}
