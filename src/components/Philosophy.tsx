export default function Philosophy() {
  return (
    <section className="py-[64px] md:py-[96px] relative overflow-hidden fade-up">
      <div className="absolute inset-0 bg-surface-container-low" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="relative z-10 max-w-[1280px] mx-auto px-5 md:px-6">
        {/* Quote */}
        <div className="mb-16 md:mb-20">
          <p className="font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] md:text-xl text-on-surface-variant italic border-l-4 border-primary pl-6 max-w-2xl">
            &ldquo;Sabemos lo que somos… pero aún no sabemos lo que podemos
            llegar a ser.&rdquo;
          </p>
        </div>

        {/* Main Heading */}
        <div className="mb-16 md:mb-20">
          <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter mb-6">
            Dominio Marcial y{" "}
            <span className="text-primary">Excelencia Deportiva</span>
          </h2>
          <h3 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-primary uppercase tracking-tighter mb-8">
            Tu camino hacia la seguridad total
          </h3>
          <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl">
            En Zona Elite Legacy, entendemos que las Artes Marciales son mucho
            más que un deporte; son una filosofía de vida que te prepara para
            cualquier desafío. Combinamos la tradición, la técnica y la ciencia
            del combate para ofrecerte un sistema de Defensa Personal real y
            efectivo.
          </p>
        </div>

        {/* Discipline Details */}
        <div className="mb-16 md:mb-20">
          <h3 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-on-surface uppercase tracking-tighter mb-8 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">
              sports_martial_arts
            </span>
            Formación Marcial de Élite
          </h3>
          <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl mb-8">
            Domina las disciplinas más completas y prepárate para proteger lo
            que más quieres:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Kenpo */}
            <div className="bg-surface-container rounded-2xl p-6 border border-on-surface/5 hover:border-primary/30 transition-colors duration-300">
              <div className="w-10 h-10 rounded-full glass-panel flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-xl">
                  sports_martial_arts
                </span>
              </div>
              <h4 className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase mb-3">
                Kenpo
              </h4>
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                La ciencia de la defensa personal urbana. Velocidad y lógica
                aplicada a la protección real.
              </p>
            </div>

            {/* Kick Boxing */}
            <div className="bg-surface-container rounded-2xl p-6 border border-on-surface/5 hover:border-primary/30 transition-colors duration-300">
              <div className="w-10 h-10 rounded-full glass-panel flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-xl">
                  sports_kabaddi
                </span>
              </div>
              <h4 className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase mb-3">
                Kick Boxing
              </h4>
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                Potencia explosiva y dominio del combate de pie. Disciplina que
                forja tu carácter y tu físico.
              </p>
            </div>

            {/* Sport Kempo */}
            <div className="bg-surface-container rounded-2xl p-6 border border-on-surface/5 hover:border-primary/30 transition-colors duration-300">
              <div className="w-10 h-10 rounded-full glass-panel flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-xl">
                  shield
                </span>
              </div>
              <h4 className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase mb-3">
                Sport Kempo
              </h4>
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                La vertiente competitiva y reglamentada del Kenpo. Alto
                rendimiento internacional con reglas justas y ética deportiva.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
