const disciplines = [
  {
    title: "Kenpo",
    icon: "sports_martial_arts",
    shortDescription: "Defensa personal y desarrollo técnico de precisión.",
    fullDescription:
      "La ciencia de la defensa personal urbana. Velocidad y lógica aplicada a la protección real.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDW7bSX9sR4KZB6-lgYYS7Okid3ABZD7Ra1tQk_4QMFZRWSbPbtGsh0w-HQZlpkGjkhe48mrF4E67Mq10pUie4MqXCHYszU2EIBtnBMF5geq6zDUc02Iv8MgvcCs9jCkddlu52-62u63h_CtiQt-5QsEPj9yjPeSc3RDLU0VawlS8aHJH7LXDyx4SsndFtpf-pLnofEi9rEDjNkgFoFjcMoZ9b3uNPj8gkZ4gUt773hxHO3OQxLZRugqA",
    alt: "Luchador de Kenpo ejecutando una patada alta",
    offset: false,
  },
  {
    title: "Kickboxing",
    icon: "sports_kabaddi",
    shortDescription: "Velocidad, potencia y resistencia cardiovascular extrema.",
    fullDescription:
      "Potencia explosiva y dominio del combate de pie. Disciplina que forja tu carácter y tu físico.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAVq0tMCCyX_32I9KXrEEwRxmOj-p8gzl6XlOKZBqwSbecOjOEXhqRVrjByvN3Evcft9es7x0hu7UHL9doVwnW39ZK3Sy4N0-xtq27FjzCPXN-jLC1MKvxKxct8Qi2gB6d1Mkq4clL0RfM0xJ_mMRmkFsQJ3bE8Ku2EH7p2coUw8bxhoxqzJzGx32EIrHvnhOYL3sKD9hNtkAGJfzPrAQM-jaFmlDImdoR-VDom9CV8N6ajn8AqdxeNBw",
    alt: "Kickboxer femenina lanzando una patada alta",
    offset: true,
  },
  {
    title: "Funcional",
    icon: "fitness_center",
    shortDescription: "Mejora tu condición física, fuerza y agilidad global.",
    fullDescription:
      "Sistema de Funcional Trainer con clases personalizadas y semi-personalizadas para mejorar agilidad, potencia y resistencia.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDGbVlpwXQXnBtHkeA9rRmXezdLUxK5tz_ckknLjPOyX1WbTDkuVlfhvR4Ja1ym14p2CWZyUyd6--gjToWLVNEOZse99DUhKXJWu4hoz-FkypIBofMaMTmW7jCaQwtY2P7vGM03gnV2DaZWyFfNCN2N2sNDf7FZMVKRPCz4Cm39iUV6NoJHnIb5SoaZskLPrWoyQN-rXm-KcvLT6YrysNCvdEtRKQe_-Wyj6p77X2Rd_wWgXhvdLKhc2g",
    alt: "Mujer realizando ejercicio con cuerdas de batalla",
    offset: false,
  },
  {
    title: "MMA",
    icon: "hardware",
    shortDescription:
      "Entrenamiento integral combinando múltiples disciplinas de combate.",
    fullDescription:
      "La evolución total. Aprende a transicionar entre el golpeo y la lucha, adaptándote a cualquier situación.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC8SJCEQv60z_WavNOCT9BVcHU35An_I7K4NccMiAjfJveloo157o1wQtVMc8_v9_YYpb1nojSqkh7QAnGGAXcUsFhQSBMPG_x67DN6523f8tGr0phlvJ5BpoyGRA0qPBquFEdOMMUjQbpI9JkFdeCIdAiM_YPIQ9GqYfJ1F9n6sOO1b8ysh6OTqNNwByra8K9_VVmCp6gll-t8b0xDzCnt5udOQ9J-go3dldFuZh0R2nKNdq-QF4VrzA",
    alt: "Luchador de MMA en postura preparada",
    offset: true,
  },
];

export default function Disciplines() {
  return (
    <section
      id="disciplinas"
      className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto fade-up"
    >
      <div className="mb-16">
        <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter">
          Nuestras <span className="text-primary">Disciplinas</span>
        </h2>
        <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mt-2 max-w-xl">
          Forja tu carácter y habilidades con nuestro programa integral.
          Entrenamiento de alto impacto para resultados reales.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {disciplines.map((d) => (
          <div
            key={d.title}
            className="group relative overflow-hidden rounded-2xl bg-surface-container-low border border-on-surface/5 h-[400px] flex flex-col justify-end p-6 hover:border-primary/50 transition-colors duration-500"
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 opacity-40 group-hover:opacity-60"
              style={{ backgroundImage: `url('${d.imageUrl}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-full glass-panel flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-on-surface">
                  {d.icon}
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-on-surface uppercase mb-2">
                {d.title}
              </h3>
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant line-clamp-3">
                {d.fullDescription}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
