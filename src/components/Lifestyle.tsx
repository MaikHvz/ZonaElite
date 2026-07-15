export default function Lifestyle() {
  const features = [
    {
      icon: "personal_training",
      title: "Clases Personalizadas y Semi-personalizadas",
      description:
        "Diseñadas específicamente para tu ritmo, enfocadas en mejorar tu agilidad, potencia y resistencia.",
    },
    {
      icon: "groups",
      title: "Comunidad Motivadora",
      description:
        "Un espacio donde cada entrenamiento te acerca a tu mejor versión física y mental.",
    },
    {
      icon: "favorite",
      title: "Entrenamiento para Vivir Mejor",
      description:
        "No solo entrenas para defenderte, entrenas para vivir mejor. Un ambiente deportivo y saludable, libre de egos.",
    },
  ];

  return (
    <section className="py-[64px] md:py-[96px] relative overflow-hidden fade-up">
      <div className="absolute inset-0 bg-surface-container-lowest" />

      <div className="relative z-10 max-w-[1280px] mx-auto px-5 md:px-6">
        <div className="mb-12 md:mb-16">
          <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter mb-6">
            Un Estilo de Vida{" "}
            <span className="text-primary">Saludable y Deportivo</span>
          </h2>
          <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl">
            Potencia tus resultados con nuestro sistema de Funcional Trainer.
            El respeto es nuestra base y la comunidad nuestro motor.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-surface-container rounded-2xl p-8 border border-on-surface/5 hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-full glass-panel flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-primary text-2xl">
                  {f.icon}
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase mb-3">
                {f.title}
              </h3>
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
