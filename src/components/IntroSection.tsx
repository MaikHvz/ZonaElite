import Link from "next/link";

export default function IntroSection() {
  return (
    <section className="py-[48px] md:py-[64px] relative overflow-hidden fade-up">
      <div className="absolute inset-0 bg-surface-container-low" />

      <div className="relative z-10 max-w-[1280px] mx-auto px-5 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
          {/* Left: Estilo de Vida */}
          <div>
            <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-on-surface uppercase tracking-tighter mb-4">
              Un Estilo de Vida{" "}
              <span className="text-primary">Saludable y Deportivo</span>
            </h2>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-5">
              No solo entrenas para defenderte, entrenas para vivir mejor. Un
              ambiente deportivo y saludable, libre de egos, donde el respeto es
              nuestra base.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-lg mt-0.5">
                  check_circle
                </span>
                <span className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface">
                  <span className="font-semibold">Clases Personalizadas</span>{" "}
                  Diseñadas para tu ritmo, enfocadas en agilidad, potencia y
                  resistencia.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-lg mt-0.5">
                  check_circle
                </span>
                <span className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface">
                  <span className="font-semibold">Comunidad Motivadora</span>{" "}
                  Cada entrenamiento te acerca a tu mejor versión física y
                  mental.
                </span>
              </li>
            </ul>
          </div>

          {/* Right: Defensa */}
          <div>
            <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-on-surface uppercase tracking-tighter mb-4">
              Más que un entrenamiento, tu{" "}
              <span className="text-primary">mejor defensa</span>
            </h2>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-4">
              Vivimos en un mundo donde la seguridad personal ya no es opcional.
              Transforma el miedo en acción. Forjarás una mentalidad
              inquebrantable, superando complejos y ganando la autoconfianza
              necesaria para caminar seguro en cualquier lugar.
            </p>
            <blockquote className="border-l-4 border-primary pl-4 mb-5">
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface italic">
                &ldquo;La victoria comienza cuando decides
                prepararte.&rdquo;
              </p>
            </blockquote>
            <div className="flex items-center gap-3">
              <Link
                href="/auth"
                className="btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] leading-[18px] px-6 py-3 rounded-[0.25rem] uppercase tracking-wider hover:scale-105 transition-transform duration-300 shadow-[0_0_20px_rgba(229,57,53,0.3)]"
              >
                Únete en La Serena
              </Link>
              <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[11px] leading-[15px]">
                Clases grupales + Entrenamiento personal
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
