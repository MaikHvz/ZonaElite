"use client";

import { useState, useEffect } from "react";

const disciplines = [
  {
    title: "Kenpo",
    icon: "sports_martial_arts",
    shortDescription: "Defensa personal y desarrollo técnico de precisión.",
    extendedDescription: `El Kenpo es un arte marcial de origen americano fundamentado en los principios científicos del movimiento humano, combinando la velocidad explosiva con la precisión milimétrica. A diferencia de otras disciplinas, el Kenpo no solo enseña golpes: te entrega un sistema completo de respuesta ante cualquier situación de riesgo real.

En ZonaElite, nuestro programa de Kenpo integra:
• Técnicas de defensa personal probadas en contextos urbanos
• Secuencias y formas (Katas) para desarrollar memoria muscular y coordinación
• Trabajo de velocidad en combinaciones de manos y pies
• Principios de distancia, ángulo y posicionamiento táctico
• Desarrollo de reflejos y lectura del adversario

El Kenpo cultiva simultáneamente la mente y el cuerpo. Cada clase es un desafío intelectual que te exige pensar mientras actúas. Ideal para quienes buscan defensa personal efectiva y un entrenamiento artístico profundo con raíces en las tradiciones marciales de Oriente y Occidente.`,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDW7bSX9sR4KZB6-lgYYS7Okid3ABZD7Ra1tQk_4QMFZRWSbPbtGsh0w-HQZlpkGjkhe48mrF4E67Mq10pUie4MqXCHYszU2EIBtnBMF5geq6zDUc02Iv8MgvcCs9jCkddlu52-62u63h_CtiQt-5QsEPj9yjPeSc3RDLU0VawlS8aHJH7LXDyx4SsndFtpf-pLnofEi9rEDjNkgFoFjcMoZ9b3uNPj8gkZ4gUt773hxHO3OQxLZRugqA",
    alt: "Luchador de Kenpo ejecutando una patada alta",
    color: "#ff544c",
  },
  {
    title: "Kickboxing",
    icon: "sports_kabaddi",
    shortDescription: "Velocidad, potencia y resistencia cardiovascular extrema.",
    extendedDescription: `El Kickboxing es la fusión perfecta entre la técnica del boxeo clásico y la potencia de las artes marciales de patadas. Una disciplina de combate de pie que desarrolla capacidades físicas completas: velocidad, fuerza, resistencia aeróbica y coordinación neuro-muscular.

En ZonaElite, nuestras clases de Kickboxing te llevan al siguiente nivel mediante:
• Técnicas de boxeo: jab, cross, hook, uppercut con fundamentos biomecánicos correctos
• Patadas de impacto: roundhouse, frontales, laterales y giratorias
• Combinaciones de alto nivel para desarrollo de fluidez y timing
• Entrenamiento en saco, pads y compañero para trabajar potencia real
• Acondicionamiento físico de alto rendimiento: circuitos, intervalos y cardio explosivo
• Sparring técnico controlado para aplicar todo en condiciones realistas

El Kickboxing transforma tu cuerpo y tu mentalidad. No hay manera más eficiente de quemar calorías, desarrollar músculo funcional y aprender a defenderte al mismo tiempo.`,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAVq0tMCCyX_32I9KXrEEwRxmOj-p8gzl6XlOKZBqwSbecOjOEXhqRVrjByvN3Evcft9es7x0hu7UHL9doVwnW39ZK3Sy4N0-xtq27FjzCPXN-jLC1MKvxKxct8Qi2gB6d1Mkq4clL0RfM0xJ_mMRmkFsQJ3bE8Ku2EH7p2coUw8bxhoxqzJzGx32EIrHvnhOYL3sKD9hNtkAGJfzPrAQM-jaFmlDImdoR-VDom9CV8N6ajn8AqdxeNBw",
    alt: "Kickboxer femenina lanzando una patada alta",
    color: "#ff7043",
  },
  {
    title: "Funcional",
    icon: "fitness_center",
    shortDescription: "Mejora tu condición física, fuerza y agilidad global.",
    extendedDescription: `El Entrenamiento Funcional es la metodología que prepara tu cuerpo para los movimientos reales de la vida y del combate. No se trata de máquinas aisladas: se trata de mover tu cuerpo en el espacio de la manera más eficiente y poderosa posible, con ejercicios que replican patrones naturales del movimiento humano.

En ZonaElite, nuestro programa Funcional incluye:
• Movimientos multiplanares con peso corporal, kettlebells, barras y bandas
• Circuitos de alta intensidad (HIIT) para maximizar la quema calórica
• Entrenamiento de core profundo y estabilidad articular
• Desarrollo de potencia explosiva y velocidad de reacción
• Clases personalizadas adaptadas a tu nivel: principiante, intermedio o avanzado
• Metodología semi-personalizada en grupos reducidos para mayor atención

El Funcional complementa perfectamente cualquier arte marcial que practiques. Los atletas que integran el entrenamiento funcional ven mejoras dramáticas en su rendimiento en combate, resistencia bajo presión y capacidad de recuperación.`,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDGbVlpwXQXnBtHkeA9rRmXezdLUxK5tz_ckknLjPOyX1WbTDkuVlfhvR4Ja1ym14p2CWZyUyd6--gjToWLVNEOZse99DUhKXJWu4hoz-FkypIBofMaMTmW7jCaQwtY2P7vGM03gnV2DaZWyFfNCN2N2sNDf7FZMVKRPCz4Cm39iUV6NoJHnIb5SoaZskLPrWoyQN-rXm-KcvLT6YrysNCvdEtRKQe_-Wyj6p77X2Rd_wWgXhvdLKhc2g",
    alt: "Mujer realizando ejercicio con cuerdas de batalla",
    color: "#ff9800",
  },
  {
    title: "MMA",
    icon: "hardware",
    shortDescription: "Entrenamiento integral combinando múltiples disciplinas de combate.",
    extendedDescription: `Las Artes Marciales Mixtas (MMA) representan la cúspide de la evolución marcial: un sistema de combate completo que integra golpeo, lucha de pie, trabajo en el suelo y todas las transiciones entre estos rangos. Es la disciplina más completa y exigente que existe.

En ZonaElite, nuestro programa de MMA incluye:
• Striking: boxeo, kickboxing, muay thai y defensa ante golpes
• Wrestling: takedowns, clinch, control de la distancia y derribo
• Grappling: posiciones de suelo, control, sumisiones y defensas
• Transiciones fluidas entre rango de golpeo, clinch y suelo
• Acondicionamiento específico para combate: intervalos y sparring técnico
• Estrategia y mentalidad competitiva para quienes buscan la competencia amateur o profesional

El MMA no es para todos, pero es para quien no acepta límites. Cada clase es una confrontación con tus propios límites físicos y mentales. Aquí no hay zonas de confort: hay evolución constante y compañeros que te elevan en cada sesión.`,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC8SJCEQv60z_WavNOCT9BVcHU35An_I7K4NccMiAjfJveloo157o1wQtVMc8_v9_YYpb1nojSqkh7QAnGGAXcUsFhQSBMPG_x67DN6523f8tGr0phlvJ5BpoyGRA0qPBquFEdOMMUjQbpI9JkFdeCIdAiM_YPIQ9GqYfJ1F9n6sOO1b8ysh6OTqNNwByra8K9_VVmCp6gll-t8b0xDzCnt5udOQ9J-go3dldFuZh0R2nKNdq-QF4VrzA",
    alt: "Luchador de MMA en postura preparada",
    color: "#e91e63",
  },
];

export default function Disciplines() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleCardClick = (index: number) => {
    setActiveIndex((prev) => (prev === index ? null : index));
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveIndex(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const activeDiscipline = activeIndex !== null ? disciplines[activeIndex] : null;

  return (
    <section
      id="disciplinas"
      className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto fade-up"
    >
      {/* Header */}
      <div className="mb-16">
        <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter">
          Nuestras <span className="text-primary">Disciplinas</span>
        </h2>
        <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mt-2 max-w-xl">
          Forja tu carácter y habilidades con nuestro programa integral.
          Entrenamiento de alto impacto para resultados reales.
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {disciplines.map((d, index) => {
          const isActive = activeIndex === index;
          return (
            <button
              key={d.title}
              onClick={() => handleCardClick(index)}
              aria-expanded={isActive}
              aria-label={`Ver más sobre ${d.title}`}
              className={[
                "group relative overflow-hidden rounded-2xl border text-left",
                "transition-all duration-500 ease-out cursor-pointer",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "h-[400px] flex flex-col justify-end p-6",
                isActive
                  ? "border-primary/60 shadow-[0_0_28px_6px_rgba(255,84,76,0.18)]"
                  : "border-on-surface/5 hover:border-primary/40",
              ].join(" ")}
              style={{ background: "var(--surface-container-low)" }}
            >
              {/* Background image */}
              <div
                className={[
                  "absolute inset-0 bg-cover bg-center transition-all duration-700",
                  isActive
                    ? "scale-110 opacity-55"
                    : "opacity-40 group-hover:scale-105 group-hover:opacity-50",
                ].join(" ")}
                style={{ backgroundImage: `url('${d.imageUrl}')` }}
              />

              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-transparent" />

              {/* Color glow when active */}
              <div
                className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at bottom center, ${d.color}20 0%, transparent 70%)`,
                  opacity: isActive ? 1 : 0,
                }}
              />

              {/* Hover hint */}
              {!isActive && (
                <div className="absolute inset-x-0 top-3 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="flex items-center gap-1.5 bg-background/90 rounded-full px-3 py-1.5 border border-on-surface/10">
                    <span className="material-symbols-outlined text-primary text-[15px]">touch_app</span>
                    <span className="font-[family-name:var(--font-label-md)] text-[10px] text-on-surface-variant uppercase tracking-widest">
                      Clic para más
                    </span>
                  </div>
                </div>
              )}

              {/* Close badge when active */}
              {isActive && (
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[14px]">close</span>
                </div>
              )}

              {/* Content */}
              <div className="relative z-10">
                <div
                  className={[
                    "w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors duration-300",
                    isActive
                      ? "bg-primary/25 border border-primary/40"
                      : "glass-panel group-hover:bg-primary/15",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "material-symbols-outlined transition-colors duration-300",
                      isActive ? "text-primary" : "text-on-surface",
                    ].join(" ")}
                  >
                    {d.icon}
                  </span>
                </div>

                <h3
                  className={[
                    "font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] uppercase mb-2 transition-colors duration-300",
                    isActive ? "text-primary" : "text-on-surface",
                  ].join(" ")}
                >
                  {d.title}
                </h3>

                <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[22px] text-on-surface-variant">
                  {d.shortDescription}
                </p>

                {/* Active arrow indicator */}
                <div
                  className={[
                    "mt-3 flex items-center gap-1 overflow-hidden transition-all duration-300",
                    isActive ? "max-h-8 opacity-100" : "max-h-0 opacity-0",
                  ].join(" ")}
                >
                  <span className="material-symbols-outlined text-primary text-[14px]">keyboard_arrow_down</span>
                  <span className="font-[family-name:var(--font-label-md)] text-[10px] text-primary uppercase tracking-widest">
                    Ver detalle abajo
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Expanded detail panel */}
      <div
        className={[
          "overflow-hidden transition-all duration-700 ease-out",
          activeDiscipline ? "max-h-[1000px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0",
        ].join(" ")}
        style={{ willChange: "max-height, opacity" }}
      >
        {activeDiscipline && (
          <div className="relative rounded-2xl border border-primary/20 overflow-hidden bg-surface-container-low flex flex-col lg:flex-row">
            {/* Image panel */}
            <div className="relative w-full lg:w-[320px] shrink-0 h-[220px] lg:h-auto min-h-[220px]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${activeDiscipline.imageUrl}')` }}
              />
              {/* fade to panel on desktop */}
              <div className="absolute inset-0 hidden lg:block"
                style={{ background: "linear-gradient(to right, transparent 60%, var(--surface-container-low) 100%)" }}
              />
              {/* fade down on mobile */}
              <div className="absolute inset-0 lg:hidden"
                style={{ background: "linear-gradient(to bottom, transparent 50%, var(--surface-container-low) 100%)" }}
              />
              {/* Mobile title */}
              <div className="absolute bottom-4 left-5 lg:hidden">
                <h3
                  className="font-[family-name:var(--font-headline-lg)] text-[36px] leading-none uppercase drop-shadow-lg"
                  style={{ color: activeDiscipline.color }}
                >
                  {activeDiscipline.title}
                </h3>
              </div>
            </div>

            {/* Text content */}
            <div className="flex-1 p-6 md:p-8 lg:p-10">
              {/* Desktop heading */}
              <div className="hidden lg:flex items-center gap-4 mb-5">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center border"
                  style={{
                    backgroundColor: `${activeDiscipline.color}20`,
                    borderColor: `${activeDiscipline.color}50`,
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[24px]"
                    style={{ color: activeDiscipline.color }}
                  >
                    {activeDiscipline.icon}
                  </span>
                </div>
                <h3
                  className="font-[family-name:var(--font-headline-lg)] text-[42px] leading-none uppercase tracking-tight"
                  style={{ color: activeDiscipline.color }}
                >
                  {activeDiscipline.title}
                </h3>
              </div>

              {/* Separator */}
              <div
                className="h-px mb-6 hidden lg:block"
                style={{
                  background: `linear-gradient(to right, ${activeDiscipline.color}70, transparent)`,
                }}
              />

              {/* Extended description */}
              <div className="space-y-4">
                {activeDiscipline.extendedDescription.split("\n\n").map((para, i) => {
                  const hasBullets = para.includes("•");
                  if (hasBullets) {
                    const lines = para.split("\n").filter(Boolean);
                    return (
                      <ul key={i} className="space-y-2 mt-1">
                        {lines.map((line, j) => {
                          const isBullet = line.trim().startsWith("•");
                          if (isBullet) {
                            return (
                              <li key={j} className="flex items-start gap-2.5 font-[family-name:var(--font-body-md)] text-[14px] md:text-[15px] leading-[24px] text-on-surface-variant">
                                <span
                                  className="mt-1 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                                  style={{
                                    backgroundColor: `${activeDiscipline.color}25`,
                                    color: activeDiscipline.color,
                                  }}
                                >
                                  ▸
                                </span>
                                <span>{line.trim().slice(1).trim()}</span>
                              </li>
                            );
                          }
                          return (
                            <p key={j} className="font-[family-name:var(--font-body-md)] text-[14px] md:text-[15px] leading-[26px] text-on-surface-variant">
                              {line}
                            </p>
                          );
                        })}
                      </ul>
                    );
                  }
                  return (
                    <p key={i} className="font-[family-name:var(--font-body-md)] text-[14px] md:text-[15px] leading-[26px] text-on-surface-variant">
                      {para}
                    </p>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="/horarios"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-[family-name:var(--font-label-md)] uppercase tracking-wider text-on-primary transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  style={{ backgroundColor: activeDiscipline.color }}
                >
                  <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                  Ver horarios
                </a>
                <button
                  onClick={() => setActiveIndex(null)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-[family-name:var(--font-label-md)] text-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-wider"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
