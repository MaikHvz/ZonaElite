"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Competition {
  fecha: string;
  lugar: string;
  flag: string;
  torneo: string;
  cats: string;
  scope: "internacional" | "nacional";
  highlight?: string;
}

const COMPETITIONS: Competition[] = [
  {
    fecha: "Junio 2026",
    lugar: "La Serena, Chile",
    flag: "🇨🇱",
    torneo: "C4 The Combat Series",
    cats: "MMA (Artes Marciales Mixtas)",
    scope: "nacional",
    highlight: "Sede Local",
  },
  {
    fecha: "Abril 2026",
    lugar: "Santiago, Chile",
    flag: "🇨🇱",
    torneo: "Campeonato Nacional Kenpo",
    cats: "Formas, Light Contact, Kick Light",
    scope: "nacional",
    highlight: "Torneo Federado",
  },
  {
    fecha: "Junio 2025",
    lugar: "Vicuña, Chile",
    flag: "🇨🇱",
    torneo: "Artes Marciales Vicuña",
    cats: "Light Contact, Kick Light",
    scope: "nacional",
  },
  {
    fecha: "Abril 2025",
    lugar: "Caldas da Rainha, Portugal",
    flag: "🇵🇹",
    torneo: "XXI Mundial de Kempo IKF",
    cats: "Full Kempo, Semi Kempo, Kata, MMA",
    scope: "internacional",
    highlight: "Mundial IKF",
  },
  {
    fecha: "Octubre 2024",
    lugar: "Talcahuano, Chile",
    flag: "🇨🇱",
    torneo: "Torneo Copa Ed Parker",
    cats: "Formas, Combate y Sumisión",
    scope: "nacional",
    highlight: "Tributo Ed Parker",
  },
  {
    fecha: "Abril 2023",
    lugar: "Caldas da Rainha, Portugal",
    flag: "🇵🇹",
    torneo: "XIX Mundial de Kempo IKF",
    cats: "Full Kempo, Semi Kempo, MMA",
    scope: "internacional",
    highlight: "Mundial IKF",
  },
  {
    fecha: "Noviembre 2022",
    lugar: "Neuquén, Argentina",
    flag: "🇦🇷",
    torneo: "I Panamericano IKF",
    cats: "Full Kempo, Sumisión",
    scope: "internacional",
    highlight: "🥇 Oro Sudamericano",
  },
];

interface LightboxState {
  url: string;
  title: string;
  subtitle?: string;
  caption?: string;
}

export default function MaestroSection() {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [viewMode, setViewMode] = useState<"slider" | "grid">("slider");
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);

  const checkScroll = useCallback(() => {
    if (!sliderRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, viewMode]);

  const scrollSlider = (direction: "left" | "right") => {
    if (!sliderRef.current) return;
    const shift = sliderRef.current.clientWidth * 0.75;
    sliderRef.current.scrollBy({
      left: direction === "left" ? -shift : shift,
      behavior: "smooth",
    });
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    if (lightbox) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKey);
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKey);
    };
  }, [lightbox]);

  return (
    <>
      <section
        id="nuestro-maestro"
        className="relative overflow-hidden fade-up"
        style={{ overflowX: "clip" }}
      >
        {/* Fondo con gradiente rojo dramático */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,84,76,0.08) 0%, transparent 45%), linear-gradient(200deg, transparent 55%, rgba(255,84,76,0.05) 100%)",
          }}
        />
        {/* Línea separadora superior */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-[56px] sm:py-[72px] md:py-[104px]">
          {/* ── ENCABEZADO ── */}
          <div className="text-center mb-10 sm:mb-14 md:mb-16">
            <span className="inline-flex items-center gap-2 font-[family-name:var(--font-label-sm)] text-[10px] sm:text-[11px] leading-[16px] uppercase tracking-[0.18em] text-primary bg-primary/10 border border-primary/25 rounded-full px-4 sm:px-5 py-1.5 sm:py-2 mb-4 sm:mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-glow inline-block" />
              Director Técnico &amp; Fundador
            </span>
            <h2 className="font-[family-name:var(--font-display-xl)] text-[32px] leading-[36px] sm:text-[44px] sm:leading-[48px] md:text-[58px] md:leading-[62px] text-on-surface uppercase tracking-tighter">
              El hombre detrás de{" "}
              <span className="text-primary text-glow-red">ZONAELITE</span>
            </h2>
            <p className="mt-3 sm:mt-4 font-[family-name:var(--font-body-md)] text-[14px] sm:text-[16px] leading-[24px] sm:leading-[26px] text-on-surface-variant max-w-xl mx-auto px-2">
              Cinturón Negro 4to Grado · Más de 30 años de trayectoria · Campeón
              Mundial
            </p>
          </div>

          {/* ── STATS ANIMADAS RESPONSIVAS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-12 sm:mb-16">
            {[
              {
                num: "+30",
                label: "Años en las artes marciales",
                icon: "military_tech",
              },
              {
                num: "5×",
                label: "Campeón Mundial / Continental",
                icon: "emoji_events",
              },
              {
                num: "2014",
                label: "Fundación del club en La Serena",
                icon: "flag",
              },
              {
                num: "3",
                label: "Continentes de competencia",
                icon: "travel_explore",
              },
            ].map((s) => (
              <div
                key={s.num}
                className="stat-card relative overflow-hidden bg-surface-container border rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col items-center text-center justify-center gap-1.5 sm:gap-2 transition-all hover:border-primary/40"
                style={{ borderColor: "rgba(255,180,172,0.12)" }}
              >
                <span className="material-symbols-outlined text-primary text-[22px] sm:text-[28px]">
                  {s.icon}
                </span>
                <span className="font-[family-name:var(--font-display-xl)] text-[26px] sm:text-[34px] md:text-[38px] leading-none text-on-surface text-glow-red">
                  {s.num}
                </span>
                <span className="font-[family-name:var(--font-body-md)] text-[11px] sm:text-[12px] leading-[15px] sm:leading-[17px] text-on-surface-variant max-w-[140px]">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* ── LAYOUT PRINCIPAL: FOTO MAESTRO + BIOGRAFÍA & PALMARÉS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-8 md:gap-12 lg:gap-16 items-start mb-16 sm:mb-20">
            {/* ── COLUMNA FOTO SENSEI + DATOS INSTITUCIONALES ── */}
            <div className="flex flex-col gap-6 w-full max-w-[420px] mx-auto lg:mx-0">
              {/* Foto Sensei con botón para ampliar */}
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  setLightbox({
                    url: "/juan_banner.jpeg",
                    title: "Sensei Juan Eduardo Valenzuela Araya",
                    subtitle: "Director Técnico & Fundador ZONAELITE",
                    caption:
                      "Cinturón Negro 4to Grado (Danes) · Campeón Mundial en Antofagasta (Light Contact) · Más de 30 años de docencia y alta competición internacional.",
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightbox({
                      url: "/juan_banner.jpeg",
                      title: "Sensei Juan Eduardo Valenzuela Araya",
                      subtitle: "Director Técnico & Fundador ZONAELITE",
                      caption:
                        "Cinturón Negro 4to Grado (Danes) · Campeón Mundial en Antofagasta (Light Contact) · Más de 30 años de docencia y alta competición internacional.",
                    });
                  }
                }}
                className="group relative cursor-pointer w-full rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-transform duration-300 hover:scale-[1.01]"
                style={{
                  boxShadow:
                    "0 24px 60px rgba(0,0,0,0.8), 0 0 50px rgba(255,84,76,0.18)",
                }}
                aria-label="Ver fotografía de Sensei Juan Valenzuela a tamaño completo"
              >
                {/* Glow ring exterior animado */}
                <div
                  className="absolute -inset-[3px] rounded-2xl maestro-ring pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,84,76,0.4), rgba(255,180,172,0.15))",
                  }}
                />

                {/* Contenedor de la Imagen */}
                <div className="relative overflow-hidden rounded-2xl bg-black">
                  <img
                    src="/juan_banner.jpeg"
                    alt="Sensei Juan Valenzuela — Director Técnico ZONAELITE"
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{
                      aspectRatio: "3/4",
                      objectPosition: "center 15%",
                    }}
                  />

                  {/* Badge flotante: Click / Toca para ampliar */}
                  <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md border border-white/20 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-lg group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                    <span className="material-symbols-outlined text-white text-[15px]">
                      zoom_in
                    </span>
                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-white font-medium">
                      Ver foto
                    </span>
                  </div>

                  {/* Badge Campeón Mundial */}
                  <div className="absolute top-3 right-3 btn-primary-gradient rounded-xl px-2.5 py-1.5 shadow-[0_0_20px_rgba(255,84,76,0.5)]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-white text-[16px]">
                        emoji_events
                      </span>
                      <span className="font-[family-name:var(--font-label-sm)] text-[8px] uppercase tracking-wide text-white leading-tight font-bold">
                        Campeón
                        <br />
                        Mundial
                      </span>
                    </div>
                  </div>

                  {/* Overlay inferior con información clara */}
                  <div
                    className="absolute bottom-0 left-0 right-0 p-4 sm:p-5"
                    style={{
                      background:
                        "linear-gradient(0deg, rgba(10,10,10,0.98) 0%, rgba(10,10,10,0.7) 65%, transparent 100%)",
                    }}
                  >
                    <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-[0.25em] text-primary mb-1 font-semibold">
                      Cinturón Negro 4to Grado (Danes)
                    </p>
                    <p className="font-[family-name:var(--font-headline-md)] text-[18px] sm:text-[22px] leading-[22px] sm:leading-[26px] text-white uppercase tracking-tight">
                      Juan Eduardo
                      <br />
                      Valenzuela Araya
                    </p>
                  </div>
                </div>
              </div>

              {/* Card datos institucionales sin truncar nada */}
              <div
                className="bg-surface-container rounded-2xl p-4 sm:p-5 border flex flex-col gap-3.5"
                style={{ borderColor: "rgba(255,180,172,0.12)" }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-[0.18em] text-primary">
                    Información de Contacto
                  </span>
                  <span className="material-symbols-outlined text-primary text-[16px]">
                    verified
                  </span>
                </div>

                {/* Sede */}
                <a
                  href="https://maps.google.com/?q=Av.+Cruz+del+Molino+342,+La+Serena"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-2 -mx-2 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-primary group-hover:text-white text-[16px]">
                      location_on
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-widest text-primary">
                      Sede Principal
                    </p>
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface leading-snug break-words">
                      Av. Cruz del Molino #342, La Serena
                    </p>
                  </div>
                </a>

                {/* Contacto / WhatsApp */}
                <a
                  href="https://wa.me/56934959924"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-2 -mx-2 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-primary group-hover:text-white text-[16px]">
                      phone
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-widest text-primary">
                      Teléfono &amp; WhatsApp
                    </p>
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface leading-snug">
                      +56 9 3495 9924
                    </p>
                  </div>
                </a>

                {/* Email */}
                <a
                  href="mailto:biokenpo@gmail.com"
                  className="flex items-start gap-3 p-2 -mx-2 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-primary group-hover:text-white text-[16px]">
                      mail
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-widest text-primary">
                      Correo Electrónico
                    </p>
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface leading-snug break-all">
                      biokenpo@gmail.com
                    </p>
                  </div>
                </a>

                {/* Instagram */}
                <a
                  href="https://instagram.com/biokenpo.karate_juanvalenzuela"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-2 -mx-2 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-primary group-hover:text-white text-[16px]">
                      photo_camera
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-widest text-primary">
                      Instagram Oficial
                    </p>
                    <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface leading-snug break-words">
                      @biokenpo.karate_juanvalenzuela
                    </p>
                  </div>
                </a>
              </div>
            </div>

            {/* ── COLUMNA DERECHA: BIOGRAFÍA + PALMARÉS TIMELINE ── */}
            <div className="space-y-8 sm:space-y-10">
              {/* Biografía */}
              <div className="space-y-4">
                <p className="font-[family-name:var(--font-body-md)] text-[15px] sm:text-[16px] leading-[26px] sm:leading-[28px] text-on-surface-variant">
                  La historia marcial de{" "}
                  <strong className="text-on-surface font-semibold">
                    Juan Eduardo Valenzuela Araya
                  </strong>{" "}
                  comenzó a forjarse a mediados de los años noventa. En una época
                  donde las artes marciales mixtas aún abrían camino en Chile, el
                  joven Valenzuela destacó rápidamente por su disciplina
                  implacable y su técnica depurada en el combate Light Contact.
                </p>
                <p className="font-[family-name:var(--font-body-md)] text-[15px] sm:text-[16px] leading-[26px] sm:leading-[28px] text-on-surface-variant">
                  Entre 1995 y 1998 se consagró campeón en los{" "}
                  <strong className="text-on-surface font-semibold">
                    Campeonatos Panamericanos y Sudamericanos
                  </strong>
                  . En noviembre de 2013 alcanzó la cima mundial:{" "}
                  <strong className="text-on-surface font-semibold">
                    Campeón Mundial
                  </strong>{" "}
                  categoría Danes Serie Adulta en Antofagasta, hito indexado
                  públicamente por el Diario La Estrella.
                </p>
                <p className="font-[family-name:var(--font-body-md)] text-[15px] sm:text-[16px] leading-[26px] sm:leading-[28px] text-on-surface-variant">
                  En 2014 fundó el{" "}
                  <strong className="text-on-surface font-semibold">
                    Club Deportivo Kenpo La Serena (BKLS Zona Élite)
                  </strong>
                  . Hoy este club proyecta el nombre de Chile al mundo,
                  compitiendo en Portugal, Argentina y Chile con atletas formados
                  bajo su tutela.
                </p>
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border max-w-full"
                  style={{
                    borderColor: "rgba(255,180,172,0.25)",
                    background: "rgba(255,84,76,0.06)",
                  }}
                >
                  <span className="material-symbols-outlined text-primary text-[16px] flex-shrink-0">
                    verified
                  </span>
                  <span className="font-[family-name:var(--font-label-sm)] text-[9px] sm:text-[10px] uppercase tracking-wider text-on-surface-variant truncate">
                    American Kenpo Mixed System Martial Arts
                  </span>
                </div>
              </div>

              {/* Timeline de logros vertical adaptado a móvil y desktop */}
              <div>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] sm:text-[18px] leading-[22px] text-on-surface uppercase tracking-tight mb-5 sm:mb-6">
                  Palmarés — <span className="text-primary">tres décadas de gloria</span>
                </h3>
                <div className="relative pl-1 sm:pl-2">
                  {/* Línea vertical continua */}
                  <div className="absolute left-[15px] sm:left-[19px] top-2 bottom-2 w-px story-timeline" />

                  <ol className="space-y-0">
                    {[
                      {
                        year: "1995–1998",
                        icon: "emoji_events",
                        title: "Campeón Panamericano & Sudamericano",
                        desc: "Múltiples títulos en combate Light Contact en Santiago de Chile.",
                      },
                      {
                        year: "2010",
                        icon: "military_tech",
                        title: "Deportista Destacado AKKK",
                        desc: "Galardón de la Asociación American Kenpo Karate.",
                      },
                      {
                        year: "Nov 2013",
                        icon: "public",
                        title: "Campeón Mundial — Antofagasta",
                        desc: "1er Lugar Danes Serie Adulta. Indexado públicamente por el Diario La Estrella.",
                      },
                      {
                        year: "2015",
                        icon: "workspace_premium",
                        title: "Campeón Mundial — Antofagasta (2da vez)",
                        desc: "Reafirma su dominio absoluto en Light Contact a nivel mundial.",
                      },
                      {
                        year: "2018",
                        icon: "social_leaderboard",
                        title: "Triple Honor + Reconocimiento CIAM",
                        desc: "30 años de carrera + Campeón Mundial en Talcahuano.",
                      },
                      {
                        year: "2019",
                        icon: "star",
                        title: "Distinción Especial FNAZ",
                        desc: "Federación Nacional de Artes Zona Norte reconoce su espíritu marcial.",
                      },
                      {
                        year: "2022",
                        icon: "flag",
                        title: "🥇 Oro Sudamericano — Neuquén",
                        desc: "Full Kempo, Semi Kempo y Kata de Manos Vacías en Argentina.",
                      },
                      {
                        year: "2023–2025",
                        icon: "travel_explore",
                        title: "XXI Mundial IKF — Portugal",
                        desc: "Caldas da Rainha: Full Kempo, Semi Kempo, Submission, Kata, MMA.",
                      },
                      {
                        year: "2014–Hoy",
                        icon: "groups",
                        title: "Fundador BKLS Zona Élite",
                        desc: "Semillero de campeones que proyecta La Serena al mundo entero.",
                      },
                    ].map((item) => (
                      <li
                        key={item.year}
                        className="tl-item relative flex gap-3 sm:gap-5 pb-5 sm:pb-6 last:pb-0"
                      >
                        {/* Nodo */}
                        <div className="flex-shrink-0 relative z-10 mt-1">
                          <div className="tl-dot w-7 h-7 sm:w-8 sm:h-8 rounded-full btn-primary-gradient flex items-center justify-center shadow-[0_0_12px_rgba(255,84,76,0.4)]">
                            <span className="material-symbols-outlined text-white text-[13px] sm:text-[14px]">
                              {item.icon}
                            </span>
                          </div>
                        </div>
                        {/* Contenido */}
                        <div
                          className="flex-1 bg-surface-container rounded-xl p-3.5 sm:p-4 border hover:border-primary/40 transition-all duration-300 hover:[box-shadow:0_6px_24px_rgba(255,84,76,0.12)]"
                          style={{ borderColor: "rgba(255,255,255,0.06)" }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-[family-name:var(--font-label-sm)] text-[9px] sm:text-[10px] uppercase tracking-widest text-primary font-bold">
                              {item.year}
                            </span>
                          </div>
                          <h4 className="font-[family-name:var(--font-headline-md)] text-[13px] sm:text-[14px] leading-[18px] text-on-surface uppercase mb-1">
                            {item.title}
                          </h4>
                          <p className="font-[family-name:var(--font-body-md)] text-[12px] sm:text-[13px] leading-[18px] sm:leading-[20px] text-on-surface-variant">
                            {item.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* ── BANNER DESTACADO DE COMPETICIONES (RESPONSIVO Y COMPLETO) ── */}
          <div className="mb-16 sm:mb-20">
            {/* Header del Banner */}
            <div
              className="relative overflow-hidden rounded-t-2xl sm:rounded-t-3xl bg-surface-container border-t border-x px-5 sm:px-8 md:px-10 py-6 sm:py-8 md:py-10"
              style={{
                borderColor: "rgba(255,180,172,0.15)",
                background:
                  "linear-gradient(135deg, rgba(32,31,31,1) 0%, rgba(20,15,15,1) 100%)",
              }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/3" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-primary bg-primary/10 border border-primary/30 rounded-full px-3.5 py-1 shadow-[0_0_15px_rgba(255,84,76,0.15)]">
                      <span className="material-symbols-outlined text-[13px]">
                        public
                      </span>
                      Presencia Global
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-full px-3 py-1">
                      <span className="w-2 h-2 rounded-full bg-primary animate-glow" />
                      <span className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-widest text-white">
                        Tour Activo
                      </span>
                    </span>
                  </div>
                  <h3 className="font-[family-name:var(--font-display-xl)] text-[26px] leading-[30px] sm:text-[34px] sm:leading-[38px] md:text-[42px] md:leading-[46px] text-white uppercase tracking-tighter">
                    Circuito de Competición{" "}
                    <span className="text-primary text-glow-red">
                      Internacional
                    </span>
                  </h3>
                  <p className="mt-2 font-[family-name:var(--font-body-md)] text-[13px] sm:text-[15px] text-on-surface-variant max-w-xl">
                    Competimos en la élite mundial. Representando a Chile en los
                    campeonatos más exigentes de América y Europa.
                  </p>
                </div>

                {/* Controles para móvil y desktop: Toggle vista y flechas */}
                <div className="flex items-center gap-3 self-start md:self-end flex-wrap">
                  {/* Selector Carrusel / Cuadrícula */}
                  <div className="inline-flex rounded-xl bg-black/50 border border-white/10 p-1">
                    <button
                      onClick={() => setViewMode("slider")}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-[family-name:var(--font-label-sm)] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                        viewMode === "slider"
                          ? "bg-primary text-white shadow-sm"
                          : "text-white/70 hover:text-white"
                      }`}
                      aria-label="Ver en carrusel"
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        view_carousel
                      </span>
                      Carrusel
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-[family-name:var(--font-label-sm)] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                        viewMode === "grid"
                          ? "bg-primary text-white shadow-sm"
                          : "text-white/70 hover:text-white"
                      }`}
                      aria-label="Ver todos los torneos en lista completa"
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        grid_view
                      </span>
                      Ver Todos ({COMPETITIONS.length})
                    </button>
                  </div>

                  {/* Flechas de navegación para slider */}
                  {viewMode === "slider" && (
                    <div className="hidden sm:flex items-center gap-2">
                      <button
                        onClick={() => scrollSlider("left")}
                        disabled={!canScrollLeft}
                        className="w-9 h-9 rounded-full bg-black/50 border border-white/10 text-white flex items-center justify-center hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        aria-label="Torneo anterior"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          arrow_back
                        </span>
                      </button>
                      <button
                        onClick={() => scrollSlider("right")}
                        disabled={!canScrollRight}
                        className="w-9 h-9 rounded-full bg-black/50 border border-white/10 text-white flex items-center justify-center hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        aria-label="Siguiente torneo"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          arrow_forward
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contenido de Torneos: Slider o Grid Completo */}
            <div
              className="bg-black/30 border-b border-x rounded-b-2xl sm:rounded-b-3xl p-4 sm:p-6 md:p-8"
              style={{
                borderColor: "rgba(255,180,172,0.15)",
                boxShadow: "inset 0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              {viewMode === "slider" ? (
                <>
                  {/* Scroll horizontal fluido y contenido sin desborde */}
                  <div
                    ref={sliderRef}
                    className="flex overflow-x-auto gap-3.5 sm:gap-5 pb-4 pt-1 snap-x scrollbar-hide"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {COMPETITIONS.map((c, i) => (
                      <div
                        key={i}
                        className="snap-start shrink-0 w-[260px] sm:w-[290px] md:w-[320px] bg-surface-container-high rounded-xl sm:rounded-2xl p-4 sm:p-5 border transition-all duration-300 hover:-translate-y-1.5 group flex flex-col justify-between"
                        style={{
                          borderColor: "rgba(255,255,255,0.07)",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
                        }}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <span className="bg-black/50 rounded-lg px-2.5 py-1 border border-white/5 font-[family-name:var(--font-label-sm)] text-[9px] sm:text-[10px] uppercase tracking-widest text-primary font-bold">
                              {c.fecha}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {c.highlight && (
                                <span className="bg-primary/15 text-primary border border-primary/20 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                                  {c.highlight}
                                </span>
                              )}
                              <span className="text-[20px] sm:text-[22px]">
                                {c.flag}
                              </span>
                            </div>
                          </div>
                          <h4 className="font-[family-name:var(--font-headline-md)] text-[15px] sm:text-[17px] leading-[20px] sm:leading-[22px] text-white uppercase mb-2">
                            {c.torneo}
                          </h4>
                          <p className="font-[family-name:var(--font-body-md)] text-[12px] sm:text-[13px] text-on-surface-variant mb-4 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px] text-primary">
                              location_on
                            </span>
                            {c.lugar}
                          </p>
                        </div>
                        <div
                          className="pt-3 border-t"
                          style={{ borderColor: "rgba(255,255,255,0.06)" }}
                        >
                          <p className="font-[family-name:var(--font-label-sm)] text-[8px] uppercase tracking-widest text-primary mb-0.5">
                            Modalidades
                          </p>
                          <p className="font-[family-name:var(--font-body-md)] text-[11px] sm:text-[12px] text-white/90 leading-tight">
                            {c.cats}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Hint de scroll para pantallas pequeñas */}
                  <div className="flex items-center justify-between pt-2 px-1 text-on-surface-variant text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        swipe
                      </span>
                      Desliza horizontalmente para ver todos los torneos
                    </span>
                    <button
                      onClick={() => setViewMode("grid")}
                      className="text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Ver cuadrícula completa →
                    </button>
                  </div>
                </>
              ) : (
                /* Vista cuadrícula completa: 100% visible sin esconder nada */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                  {COMPETITIONS.map((c, i) => (
                    <div
                      key={i}
                      className="bg-surface-container-high rounded-xl p-4 sm:p-5 border transition-all hover:border-primary/40 flex flex-col justify-between"
                      style={{ borderColor: "rgba(255,255,255,0.07)" }}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="bg-black/50 rounded-lg px-2.5 py-1 border border-white/5 font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-widest text-primary font-bold">
                            {c.fecha}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {c.highlight && (
                              <span className="bg-primary/15 text-primary border border-primary/20 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                                {c.highlight}
                              </span>
                            )}
                            <span className="text-[20px]">{c.flag}</span>
                          </div>
                        </div>
                        <h4 className="font-[family-name:var(--font-headline-md)] text-[15px] sm:text-[16px] leading-[20px] text-white uppercase mb-2">
                          {c.torneo}
                        </h4>
                        <p className="font-[family-name:var(--font-body-md)] text-[12px] sm:text-[13px] text-on-surface-variant mb-4 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-primary">
                            location_on
                          </span>
                          {c.lugar}
                        </p>
                      </div>
                      <div
                        className="pt-3 border-t"
                        style={{ borderColor: "rgba(255,255,255,0.06)" }}
                      >
                        <p className="font-[family-name:var(--font-label-sm)] text-[8px] uppercase tracking-widest text-primary mb-0.5">
                          Modalidades
                        </p>
                        <p className="font-[family-name:var(--font-body-md)] text-[11px] sm:text-[12px] text-white/90 leading-tight">
                          {c.cats}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── FOTO GRUPAL (CLASE DE KENPO ADULTOS) — VISIBLE 100% Y AMPLIABLE ── */}
          <div>
            <div className="mb-4 sm:mb-6">
              <span className="inline-block font-[family-name:var(--font-label-sm)] text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-3.5 sm:px-4 py-1.5 mb-2.5">
                Nuestra Familia
              </span>
              <h3 className="font-[family-name:var(--font-headline-md)] text-[22px] sm:text-[28px] text-on-surface uppercase tracking-tighter">
                Los alumnos son <span className="text-primary">el legado</span>
              </h3>
            </div>

            <div
              className="relative overflow-hidden rounded-2xl border"
              style={{
                borderColor: "rgba(255,180,172,0.15)",
                boxShadow:
                  "0 24px 60px rgba(0,0,0,0.8), 0 0 50px rgba(255,84,76,0.1)",
              }}
            >
              {/* Imagen cliqueable con banner de zoom */}
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  setLightbox({
                    url: "/kenpo_adulto.jpeg",
                    title: "Clase de Kenpo Adultos — BKLS Zona Élite",
                    subtitle:
                      "Club Deportivo Kenpo La Serena · Av. Cruz del Molino #342",
                    caption:
                      "Sensei Juan Valenzuela junto a la delegación de alumnos adultos y competidores formados bajo la disciplina del American Kenpo en La Serena.",
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightbox({
                      url: "/kenpo_adulto.jpeg",
                      title: "Clase de Kenpo Adultos — BKLS Zona Élite",
                      subtitle:
                        "Club Deportivo Kenpo La Serena · Av. Cruz del Molino #342",
                      caption:
                        "Sensei Juan Valenzuela junto a la delegación de alumnos adultos y competidores formados bajo la disciplina del American Kenpo en La Serena.",
                    });
                  }
                }}
                className="group relative cursor-pointer w-full bg-black block focus:outline-none"
                aria-label="Ver fotografía de clase de Kenpo Adultos a tamaño completo"
              >
                <img
                  src="/kenpo_adulto.jpeg"
                  alt="Alumnos junto al Sensei Juan Valenzuela — BKLS Zona Élite"
                  className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  style={{
                    maxHeight: "560px",
                    aspectRatio: "16/10",
                    objectPosition: "center 25%",
                  }}
                />

                {/* Badge flotante: Click / Toca para ampliar */}
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-black/75 backdrop-blur-md border border-white/20 rounded-full px-3.5 py-1.5 flex items-center gap-1.5 shadow-lg group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                  <span className="material-symbols-outlined text-white text-[16px]">
                    zoom_in
                  </span>
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] sm:text-[11px] uppercase tracking-wider text-white font-medium">
                    Toca para ampliar
                  </span>
                </div>
              </div>

              {/* Barra inferior de información (separada o con overlay seguro para no tapar los rostros) */}
              <div
                className="p-4 sm:p-6 md:p-8 bg-surface-container border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full btn-primary-gradient flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(255,84,76,0.4)]">
                    <span className="material-symbols-outlined text-white text-[20px] sm:text-[22px]">
                      groups
                    </span>
                  </div>
                  <div>
                    <p className="font-[family-name:var(--font-headline-md)] text-[15px] sm:text-[18px] leading-[20px] sm:leading-[24px] text-on-surface uppercase">
                      Clase de Kenpo Adultos
                    </p>
                    <p className="font-[family-name:var(--font-body-md)] text-[12px] sm:text-[13px] text-on-surface-variant">
                      Club Deportivo Kenpo La Serena · Av. Cruz del Molino #342
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setLightbox({
                        url: "/kenpo_adulto.jpeg",
                        title: "Clase de Kenpo Adultos — BKLS Zona Élite",
                        subtitle:
                          "Club Deportivo Kenpo La Serena · Av. Cruz del Molino #342",
                        caption:
                          "Sensei Juan Valenzuela junto a la delegación de alumnos adultos y competidores formados bajo la disciplina del American Kenpo en La Serena.",
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/15 text-white/90 text-xs uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      fullscreen
                    </span>
                    Ver Foto
                  </button>
                  <a
                    href="/horarios"
                    className="inline-flex items-center justify-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-xs sm:text-sm px-5 sm:px-6 py-2.5 sm:py-3 rounded-[0.25rem] uppercase tracking-widest hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(229,57,53,0.3)] flex-shrink-0"
                  >
                    Reservar clase
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">
                      calendar_month
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Línea separadora inferior */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </section>

      {/* ── LIGHTBOX MODAL PARA IMÁGENES CLIQUEABLES ── */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 md:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightbox(null);
          }}
        >
          <div className="w-full max-w-5xl max-h-[95vh] flex flex-col justify-between">
            {/* Header del Lightbox */}
            <div className="flex items-center justify-between gap-4 mb-3 pb-2 border-b border-white/10">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-headline-md)] text-[15px] sm:text-[17px] text-white uppercase truncate">
                  {lightbox.title}
                </p>
                {lightbox.subtitle && (
                  <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary truncate">
                    {lightbox.subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={() => setLightbox(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                aria-label="Cerrar vista previa"
              >
                <span className="material-symbols-outlined text-[22px]">
                  close
                </span>
              </button>
            </div>

            {/* Imagen Principal en alta definición sin recortes */}
            <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden py-2">
              <img
                src={lightbox.url}
                alt={lightbox.title}
                className="max-h-[68vh] md:max-h-[74vh] max-w-full w-auto h-auto object-contain rounded-lg shadow-2xl border border-white/10"
              />
            </div>

            {/* Caption & Acciones */}
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {lightbox.caption && (
                <p className="font-[family-name:var(--font-body-md)] text-[12px] sm:text-[13px] text-on-surface-variant max-w-2xl leading-relaxed">
                  {lightbox.caption}
                </p>
              )}
              <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                <a
                  href={lightbox.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-[family-name:var(--font-headline-md)] uppercase tracking-wider transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    download
                  </span>
                  Descargar
                </a>
                <button
                  onClick={() => setLightbox(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-primary-gradient text-white text-xs font-[family-name:var(--font-headline-md)] uppercase tracking-wider cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    check
                  </span>
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
