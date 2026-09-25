import type { Metadata } from "next";
import Footer from "@/components/Footer";
import PageCTA from "@/components/PageCTA";
import GalleryCarousel from "@/components/GalleryCarousel";
import HistoryExplorer from "@/components/history/HistoryExplorer";

export const metadata: Metadata = {
    title: "Quiénes Somos | Kenpo, Kickboxing y Sport Kempo en La Serena | ZONAELITE",
  description:
    "Descubre quiénes somos y nuestra historia: la del American Kenpo, nuestra raíz; y las del Kickboxing y el Sport Kempo. Una historia interactiva que conecta mil años de arte marcial con la academia ZONAELITE en La Serena.",
  keywords: [
    "quienes somos ZonaElite",
    "academia de artes marciales La Serena",
    "historia del American Kenpo",
    "que es el kenpo americano",
    "historia del kickboxing",
    "historia del Sport Kempo",
    "clases de kenpo La Serena",
    "kickboxing La Serena",
    "Sport Kempo La Serena",
    "defensa personal La Serena",
    "academia de kenpo La Serena",
    "gimnasio de artes marciales La Serena",
  ],
  openGraph: {
  title: "Quiénes Somos | Kenpo, Kickboxing y Sport Kempo en La Serena | ZONAELITE",
    description:
      "Nuestra historia comienza con el American Kenpo, nuestra raíz, y continúa con el Kickboxing y el Sport Kempo. Léela como se vive: capítulo a capítulo.",
    type: "website",
    locale: "es_CL",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "ZONAELITE Academia",
  description:
    "Academia de Kenpo, Kickboxing, Sport Kempo y Acondicionamiento Físico en La Serena. Defensa personal y entrenamiento de alto rendimiento.",
  url: "https://zonaelite.cl",
  telephone: "+56-9-XXXX-XXXX",
  address: {
    "@type": "PostalAddress",
    addressLocality: "La Serena",
    addressRegion: "Coquimbo",
    addressCountry: "CL",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -29.9027,
    longitude: -71.252,
  },
  areaServed: {
    "@type": "City",
    name: "La Serena",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Programas de Entrenamiento",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Clases de Kenpo",
          description:
            "Defensa personal y desarrollo técnico de precisión en La Serena.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Clases de Kickboxing",
          description:
            "Potencia explosiva y dominio del combate de pie en La Serena.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Clases de Sport Kempo",
          description:
            "Entrenamiento competitivo de Sport Kempo en La Serena.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Entrenamiento Funcional",
          description:
            "Acondicionamiento físico con sistema Funcional Trainer en La Serena.",
        },
      },
    ],
  },
  priceRange: "$$",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "07:00",
      closes: "22:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "09:00",
      closes: "14:00",
    },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Qué edades aceptan en ZONAELITE?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "En ZONAELITE aceptamos personas de todas las edades. Contamos con programas adaptados para niños, adolescentes y adultos.",
      },
    },
    {
      "@type": "Question",
      name: "¿Necesito experiencia previa para entrenar?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Nuestros entrenamientos están diseñados para todos los niveles. Ofrecemos una primera clase de prueba gratuita para que conozcas nuestras instalaciones y disciplinas.",
      },
    },
    {
      "@type": "Question",
      name: "¿Qué disciplinas se enseñan en ZONAELITE?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Enseñamos Kenpo, Kickboxing, Sport Kempo (Kempo Deportivo) y Entrenamiento Funcional con nuestro sistema de Funcional Trainer.",
      },
    },
    {
      "@type": "Question",
      name: "¿Dónde está ubicada la academia?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ZONAELITE está ubicada en La Serena, Región de Coquimbo, Chile. Contáctanos para conocer la dirección exacta y agendar tu clase de prueba.",
      },
    },
    {
      "@type": "Question",
      name: "¿Cuáles son los beneficios de entrenar artes marciales?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Las artes marciales mejoran la condición física, la confianza, la disciplina, la capacidad de defensa personal y la salud mental. Son un estilo de vida que prepara para cualquier desafío.",
      },
    },
  ],
};

const embers = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 61) % 100}%`,
  size: 4 + ((i * 7) % 10),
  duration: 8 + ((i * 5) % 9),
  delay: (i * 0.7) % 10,
  drift: ((i % 2 === 0 ? 1 : -1) * (20 + ((i * 13) % 60))),
}));

export default function QuienesSomosPage() {
  return (
    <>
      <main className="pt-20">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />

        {/* ============ HERO ============ */}
        <section className="relative overflow-hidden fade-up">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(1100px 480px at 72% -8%, rgba(255,84,76,0.22), transparent 62%), radial-gradient(760px 420px at 12% 110%, rgba(255,84,76,0.10), transparent 60%)",
            }}
          />
          {/* Brasas ascendentes */}
          <div className="absolute inset-0 pointer-events-none">
            {embers.map((e, i) => (
              <span
                key={i}
                className="ember"
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

          <div className="relative max-w-[1280px] mx-auto px-5 md:px-6 pt-[64px] pb-[80px] md:pt-[104px] md:pb-[120px]">
            <div className="flex items-center gap-4 mb-6">
              <img
                src="/logo.png"
                alt="ZonaElite Logo"
                className="h-14 w-14 object-contain"
              />
              <span className="font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary">
                Quiénes Somos
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-display-xl)] text-[44px] leading-[46px] md:text-[64px] md:leading-[68px] text-on-surface uppercase tracking-tighter max-w-4xl mb-6">
              Toda historia tiene una{" "}
              <span className="text-primary text-glow-red">raíz</span>.{" "}
              La nuestra es el Kenpo.
            </h1>
            <p className="font-[family-name:var(--font-body-md)] text-[17px] leading-[27px] text-on-surface-variant max-w-2xl mb-8">
              Somos la academia de La Serena donde la tradición marcial se
              encuentra con la ciencia del combate. Aquí vive el American Kenpo,
              junto al Kickboxing y al Sport Kempo: tres historias que se entrelazan en
              una sola forma de entrenar, defenderse y vivir.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#nuestra-historia"
                className="inline-flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-base px-8 py-4 rounded-[0.25rem] uppercase tracking-widest hover:opacity-90 transition-opacity shadow-[0_0_34px_rgba(229,57,53,0.4)]"
              >
                Leer nuestra historia
                <span className="material-symbols-outlined text-[20px] hint-bounce">
                  arrow_downward
                </span>
              </a>
              <a
                href="/horarios"
                className="inline-flex items-center gap-2 bg-surface-container-high text-white font-[family-name:var(--font-headline-md)] text-base px-8 py-4 rounded-[0.25rem] uppercase tracking-widest hover:bg-surface-container-highest transition-colors"
              >
                Reservar clase
                <span className="material-symbols-outlined text-[20px]">
                  calendar_month
                </span>
              </a>
              <a
                href="#nuestro-maestro"
                className="inline-flex items-center gap-2 bg-transparent border border-primary/40 text-primary font-[family-name:var(--font-headline-md)] text-base px-8 py-4 rounded-[0.25rem] uppercase tracking-widest hover:border-primary hover:bg-primary/5 transition-all"
              >
                Conoce al Maestro
                <span className="material-symbols-outlined text-[20px]">
                  person
                </span>
              </a>
            </div>
          </div>

          {/* Indicador de scroll */}
          <div className="relative flex justify-center pb-8">
            <a
              href="#nuestra-historia"
              className="flex flex-col items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-[0.25em]">
                Descubre
              </span>
              <span className="material-symbols-outlined text-[18px] hint-bounce">
                expand_more
              </span>
            </a>
          </div>
        </section>

        {/* ============ NUESTRO MAESTRO ============ */}
        <section id="nuestro-maestro" className="relative overflow-hidden fade-up">
          {/* Fondo con gradiente rojo dramático */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(160deg, rgba(255,84,76,0.07) 0%, transparent 45%), linear-gradient(200deg, transparent 55%, rgba(255,84,76,0.04) 100%)" }} />
          {/* Línea separadora superior */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="max-w-[1280px] mx-auto px-5 md:px-6 py-[72px] md:py-[112px]">

            {/* ── ENCABEZADO ── */}
            <div className="text-center mb-14 md:mb-20">
              <span className="inline-flex items-center gap-2 font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.18em] text-primary bg-primary/10 border border-primary/25 rounded-full px-5 py-2 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-glow inline-block" />
                Director Técnico &amp; Fundador
              </span>
              <h2 className="font-[family-name:var(--font-display-xl)] text-[38px] leading-[40px] md:text-[60px] md:leading-[64px] text-on-surface uppercase tracking-tighter">
                El hombre detrás de{" "}
                <span className="text-primary text-glow-red">ZONAELITE</span>
              </h2>
              <p className="mt-5 font-[family-name:var(--font-body-md)] text-[16px] leading-[26px] text-on-surface-variant max-w-xl mx-auto">
                Cinturón Negro 4to Grado · Más de 30 años de trayectoria · Campeón Mundial
              </p>
            </div>

            {/* ── STATS ANIMADAS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-16">
              {[
                { num: "+30", label: "Años en las artes marciales", icon: "military_tech" },
                { num: "5×",  label: "Campeón Mundial / Continental", icon: "emoji_events" },
                { num: "2014", label: "Fundación del club en La Serena", icon: "flag" },
                { num: "3",   label: "Continentes de competencia", icon: "travel_explore" },
              ].map((s) => (
                <div key={s.num} className="stat-card relative overflow-hidden bg-surface-container border border-on-surface/8 rounded-2xl p-5 flex flex-col items-center text-center gap-2" style={{ borderColor: "rgba(255,180,172,0.1)" }}>
                  <span className="material-symbols-outlined text-primary text-[28px]">{s.icon}</span>
                  <span className="font-[family-name:var(--font-display-xl)] text-[36px] leading-none text-on-surface text-glow-red">{s.num}</span>
                  <span className="font-[family-name:var(--font-body-md)] text-[12px] leading-[18px] text-on-surface-variant">{s.label}</span>
                </div>
              ))}
            </div>

            {/* ── LAYOUT: FOTO + BIO ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-12 md:gap-20 items-start mb-20">

              {/* Foto con anillo pulsante */}
              <div className="maestro-photo-enter flex flex-col gap-6">
                <div className="relative mx-auto lg:mx-0 w-full max-w-[380px]">
                  {/* Glow ring exterior */}
                  <div className="absolute -inset-[6px] rounded-[22px] maestro-ring" style={{ background: "linear-gradient(135deg, rgba(255,84,76,0.3), rgba(255,180,172,0.1))" }} />
                  <div className="relative overflow-hidden rounded-2xl" style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(255,84,76,0.18)" }}>
                    <img
                      src="/juan_banner.jpeg"
                      alt="Sensei Juan Valenzuela — Director Técnico ZONAELITE"
                      className="w-full object-cover"
                      style={{ aspectRatio: "9/13", objectFit: "cover", objectPosition: "center top" }}
                    />
                    {/* Overlay inferior */}
                    <div className="absolute bottom-0 left-0 right-0 p-5" style={{ background: "linear-gradient(0deg, rgba(19,19,19,0.98) 0%, rgba(19,19,19,0.7) 55%, transparent 100%)" }}>
                      <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-[0.25em] text-primary mb-1">Cinturón Negro 4to Grado (Danes)</p>
                      <p className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase">Juan Eduardo<br/>Valenzuela Araya</p>
                    </div>
                    {/* Badge Campeón Mundial */}
                    <div className="absolute top-4 right-4 btn-primary-gradient rounded-xl px-3 py-2 shadow-[0_0_20px_rgba(255,84,76,0.5)]">
                      <span className="material-symbols-outlined text-white text-[18px] block text-center">emoji_events</span>
                      <p className="font-[family-name:var(--font-label-sm)] text-[8px] uppercase tracking-wide text-white text-center leading-tight">Campeón<br/>Mundial</p>
                    </div>
                  </div>
                </div>

                {/* Card datos institucionales */}
                <div className="bg-surface-container rounded-2xl p-5 border grid grid-cols-1 gap-3.5" style={{ borderColor: "rgba(255,180,172,0.1)" }}>
                  {[
                    { icon: "location_on", label: "Sede", val: "Av. Cruz del Molino #342, La Serena" },
                    { icon: "phone",       label: "Contacto", val: "+56 9 3495 9924" },
                    { icon: "mail",        label: "Email", val: "biokenpo@gmail.com" },
                    { icon: "photo_camera",label: "Instagram", val: "@biokenpo.karate_juanvalenzuela" },
                  ].map((d) => (
                    <div key={d.icon} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-primary text-[16px]">{d.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-widest text-primary">{d.label}</p>
                        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant truncate">{d.val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Biografía + Timeline vertical */}
              <div className="maestro-bio-enter space-y-10">

                {/* Bio */}
                <div className="space-y-4">
                  <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[28px] text-on-surface-variant">
                    La historia marcial de <strong className="text-on-surface">Juan Eduardo Valenzuela Araya</strong> comenzó a forjarse a mediados de los años noventa. En una época donde las artes marciales mixtas aún abrían camino en Chile, el joven Valenzuela destacó rápidamente por su disciplina implacable y su técnica depurada en el combate Light Contact.
                  </p>
                  <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[28px] text-on-surface-variant">
                    Entre 1995 y 1998 se consagró campeón en los <strong className="text-on-surface">Campeonatos Panamericanos y Sudamericanos</strong>. En noviembre de 2013 alcanzó la cima: <strong className="text-on-surface">Campeón Mundial</strong> categoría Danes Serie Adulta en Antofagasta, hito indexado públicamente por el Diario La Estrella.
                  </p>
                  <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[28px] text-on-surface-variant">
                    En 2014 fundó el <strong className="text-on-surface">Club Deportivo Kenpo La Serena (BKLS Zona Élite)</strong>. Hoy este club proyecta el nombre de Chile al mundo, compitiendo en Portugal, Argentina y Chile con atletas formados bajo su tutela.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border" style={{ borderColor: "rgba(255,180,172,0.25)", background: "rgba(255,84,76,0.05)" }}>
                    <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-on-surface-variant">American Kenpo Mixed System Martial Arts</span>
                  </div>
                </div>

                {/* Timeline de logros vertical */}
                <div>
                  <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] leading-[22px] text-on-surface uppercase tracking-tight mb-6">
                    Palmarés — <span className="text-primary">tres décadas</span>
                  </h3>
                  <div className="relative">
                    {/* Línea vertical continua */}
                    <div className="absolute left-[15px] top-2 bottom-2 w-px story-timeline" />

                    <ol className="space-y-0">
                      {[
                        { year: "1995–1998", icon: "emoji_events",      title: "Campeón Panamericano & Sudamericano",     desc: "Múltiples títulos en combate Light Contact en Santiago de Chile." },
                        { year: "2010",      icon: "military_tech",     title: "Deportista Destacado AKKK",               desc: "Galardón de la Asociación American Kenpo Karate." },
                        { year: "Nov 2013",  icon: "public",            title: "Campeón Mundial — Antofagasta",           desc: "1er Lugar Danes Serie Adulta. Indexado por el Diario La Estrella." },
                        { year: "2015",      icon: "workspace_premium", title: "Campeón Mundial — Antofagasta (2da vez)", desc: "Reafirma su dominio en Light Contact a nivel mundial." },
                        { year: "2018",      icon: "social_leaderboard",title: "Triple Honor + Reconocimiento CIAM",      desc: "30 años de carrera + Campeón Mundial en Talcahuano." },
                        { year: "2019",      icon: "star",              title: "Distinción Especial FNAZ",               desc: "Federación Nacional de Artes Zona Norte reconoce su espíritu marcial." },
                        { year: "2022",      icon: "flag",              title: "🥇 Oro Sudamericano — Neuquén",            desc: "Full Kempo, Semi Kempo y Kata de Manos Vacías en Argentina." },
                        { year: "2023–2025", icon: "travel_explore",    title: "XXI Mundial IKF — Portugal",             desc: "Caldas da Rainha: Full Kempo, Semi Kempo, Submission, Kata, MMA." },
                        { year: "2014–Hoy",  icon: "groups",            title: "Fundador BKLS Zona Élite",               desc: "Semillero de campeones que proyecta La Serena al mundo." },
                      ].map((item) => (
                        <li key={item.year} className="tl-item relative flex gap-5 pb-7 last:pb-0">
                          {/* Nodo */}
                          <div className="flex-shrink-0 relative z-10 mt-0.5">
                            <div className="tl-dot w-8 h-8 rounded-full btn-primary-gradient flex items-center justify-center shadow-[0_0_12px_rgba(255,84,76,0.4)]">
                              <span className="material-symbols-outlined text-white text-[14px]">{item.icon}</span>
                            </div>
                          </div>
                          {/* Contenido */}
                          <div className="flex-1 bg-surface-container rounded-xl p-4 border hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:[box-shadow:0_6px_24px_rgba(255,84,76,0.10)]" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary">{item.year}</span>
                            </div>
                            <h4 className="font-[family-name:var(--font-headline-md)] text-[14px] leading-[18px] text-on-surface uppercase mb-1">{item.title}</h4>
                            <p className="font-[family-name:var(--font-body-md)] text-[13px] leading-[20px] text-on-surface-variant">{item.desc}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

              </div>
            </div>

            {/* ── HISTORIAL COMPETICIÓN (BANNER PREMIUM) ── */}
            <div className="mb-20 relative">
              {/* Banner Header */}
              <div className="relative overflow-hidden rounded-t-3xl bg-surface-container border-t border-x px-6 md:px-10 py-8 md:py-12" style={{ borderColor: "rgba(255,180,172,0.15)", background: "linear-gradient(135deg, rgba(32,31,31,1) 0%, rgba(20,15,15,1) 100%)" }}>
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-10 w-40 h-40 bg-primary/5 rounded-full blur-[60px] pointer-events-none translate-y-1/2" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <span className="inline-flex items-center gap-2 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-[0.2em] text-primary bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 mb-4 shadow-[0_0_15px_rgba(255,84,76,0.15)]">
                      <span className="material-symbols-outlined text-[14px]">public</span>
                      Presencia Global
                    </span>
                    <h3 className="font-[family-name:var(--font-display-xl)] text-[32px] leading-[36px] md:text-[42px] md:leading-[46px] text-white uppercase tracking-tighter">
                      Nivel <span className="text-primary text-glow-red">Internacional</span>
                    </h3>
                    <p className="mt-3 font-[family-name:var(--font-body-md)] text-[15px] text-on-surface-variant max-w-lg">
                      Competimos en la élite mundial. Representando a Chile en los campeonatos más exigentes de América y Europa.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 border rounded-full px-4 py-2 backdrop-blur-md w-fit" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-glow" />
                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-white">Tour Activo</span>
                  </div>
                </div>
              </div>

              {/* Scrolling Cards */}
              <div className="bg-black/20 border-b border-x rounded-b-3xl p-6 md:p-10" style={{ borderColor: "rgba(255,180,172,0.15)", boxShadow: "inset 0 10px 30px rgba(0,0,0,0.5)" }}>
                <div className="flex overflow-x-auto gap-4 md:gap-6 pb-6 pt-2 snap-x scrollbar-hide -mx-6 px-6 md:-mx-10 md:px-10">
                  {[
                    { fecha: "Junio 2026",     lugar: "La Serena, Chile",           flag: "🇨🇱", torneo: "C4 The Combat Series",           cats: "MMA" },
                    { fecha: "Abril 2026",     lugar: "Santiago, Chile",             flag: "🇨🇱", torneo: "Campeonato Nacional Kenpo",       cats: "Formas, Light Contact, Kick Light" },
                    { fecha: "Junio 2025",     lugar: "Vicuña, Chile",               flag: "🇨🇱", torneo: "Artes Marciales Vicuña",          cats: "Light Contact, Kick Light" },
                    { fecha: "Abril 2025",     lugar: "Caldas da Rainha, Portugal",  flag: "🇵🇹", torneo: "XXI Mundial de Kempo IKF",        cats: "Full Kempo, Semi Kempo, Kata, MMA" },
                    { fecha: "Octubre 2024",   lugar: "Talcahuano, Chile",           flag: "🇨🇱", torneo: "Torneo Copa Ed Parker",           cats: "Formas, Combate y Sumisión" },
                    { fecha: "Abril 2023",     lugar: "Caldas da Rainha, Portugal",  flag: "🇵🇹", torneo: "XIX Mundial de Kempo",            cats: "Full Kempo, Semi Kempo, MMA" },
                    { fecha: "Noviembre 2022", lugar: "Neuquén, Argentina",          flag: "🇦🇷", torneo: "I Panamericano IKF",              cats: "Full Kempo, Sumisión" },
                  ].map((row, i) => (
                    <div key={i} className="snap-center shrink-0 w-[280px] md:w-[320px] bg-surface-container-high rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-2 group" style={{ borderColor: "rgba(255,255,255,0.06)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-black/40 rounded-lg px-3 py-1.5 border" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                          <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary">{row.fecha}</span>
                        </div>
                        <span className="text-[24px] filter grayscale-[0.3] group-hover:grayscale-0 transition-all">{row.flag}</span>
                      </div>
                      <h4 className="font-[family-name:var(--font-headline-md)] text-[18px] leading-[22px] text-white uppercase mb-2">{row.torneo}</h4>
                      <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mb-4 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">location_on</span>
                        {row.lugar}
                      </p>
                      <div className="pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-widest text-on-surface-variant mb-1">Categorías</p>
                        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-white/90">{row.cats}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── FOTO GRUPAL ── */}
            <div>
              <div className="mb-6">
                <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-3">Nuestra Familia</span>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[24px] md:text-[28px] text-on-surface uppercase tracking-tighter">Los alumnos son <span className="text-primary">el legado</span></h3>
              </div>
              <div className="group-scan relative overflow-hidden rounded-2xl" style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(255,84,76,0.08)" }}>
                <img
                  src="/kenpo_adulto.jpeg"
                  alt="Alumnos junto al Sensei Juan Valenzuela — BKLS Zona Élite"
                  className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  style={{ maxHeight: "560px", objectPosition: "center top" }}
                />
                {/* Overlay inferior */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10" style={{ background: "linear-gradient(0deg, rgba(19,19,19,0.97) 0%, rgba(19,19,19,0.6) 55%, transparent 100%)" }}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full btn-primary-gradient flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(255,84,76,0.5)]">
                        <span className="material-symbols-outlined text-white text-[22px]">groups</span>
                      </div>
                      <div>
                        <p className="font-[family-name:var(--font-headline-md)] text-[17px] leading-[22px] text-on-surface uppercase">Clase de Kenpo Adultos</p>
                        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">Club Deportivo Kenpo La Serena · Av. Cruz del Molino #342</p>
                      </div>
                    </div>
                    <a href="/horarios" className="inline-flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-sm px-6 py-3 rounded-[0.25rem] uppercase tracking-widest hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(229,57,53,0.3)] flex-shrink-0">
                      Reservar clase
                      <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>
          {/* Línea separadora inferior */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </section>

        {/* ============ HISTORIA INTERACTIVA ============ */}
        <section className="relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <HistoryExplorer />
        </section>

        {/* ============ FILOSOFÍA (conecta la historia con la academia) ============ */}
        <section className="py-[64px] md:py-[96px] fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-12 md:gap-16 items-start">
              <div>
                <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
                  Nuestra Filosofía
                </span>
                <h2 className="font-[family-name:var(--font-headline-md)] text-[28px] leading-[32px] md:text-[32px] md:leading-[36px] text-on-surface uppercase tracking-tighter">
                  De la raíz, <span className="text-primary">tu fortaleza</span>
                </h2>
              </div>
              <div className="space-y-5">
                <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[26px] text-on-surface-variant">
                  Dominio Marcial y Excelencia Deportiva: tu camino hacia la
                  seguridad total. Creemos que cada persona tiene el derecho de
                  sentirse segura y preparada para enfrentar los desafíos de la
                  vida cotidiana.
                </p>
                <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[26px] text-on-surface-variant">
                  Vivimos en un mundo donde la seguridad personal ya no es
                  opcional. El bullying, el acoso y la violencia no discriminan,
                  pero tú puedes elegir estar preparado. Transforma el miedo en
                  acción a través de nuestro sistema de entrenamiento integral.
                </p>
                <blockquote className="border-l-[3px] border-primary pl-6 py-2 my-6 bg-primary/5 rounded-r-lg">
                  <p className="font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] text-on-surface italic">
                    &ldquo;Sabemos lo que somos… pero aún no sabemos lo que
                    podemos llegar a ser.&rdquo;
                  </p>
                </blockquote>
                <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[26px] text-on-surface-variant">
                  A través de nuestro sistema, no solo fortalecerás tu cuerpo;
                  forjarás una mentalidad inquebrantable, superando complejos y
                  ganando la autoconfianza necesaria para caminar seguro en
                  cualquier lugar.
                </p>
              </div>
            </div>
          </div>
        </section>



        {/* ============ GALERÍA ============ */}
        <GalleryCarousel />

        {/* ============ ESTILO DE VIDA ============ */}
        <section className="py-[64px] md:py-[96px] bg-surface-container-low fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-12 md:gap-16 items-start">
              <div>
                <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
                  Más que un gimnasio
                </span>
                <h2 className="font-[family-name:var(--font-headline-md)] text-[28px] leading-[32px] md:text-[32px] md:leading-[36px] text-on-surface uppercase tracking-tighter">
                  Un Estilo de Vida Saludable y Deportivo
                </h2>
              </div>
              <div className="space-y-8">
                <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[26px] text-on-surface-variant">
                  No solo entrenas para defenderte, entrenas para vivir mejor.
                  Te ofrecemos un ambiente deportivo y saludable, libre de egos,
                  donde el respeto es nuestra base.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-surface-container rounded-xl p-6 border border-on-surface/5">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-primary text-[20px]">
                        group
                      </span>
                    </div>
                    <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] leading-[20px] text-on-surface uppercase mb-2">
                      Clases Personalizadas
                    </h3>
                    <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[22px] text-on-surface-variant">
                      Diseñadas para tu ritmo, enfocadas en mejorar tu agilidad,
                      potencia y resistencia. Semi-personalizadas para grupos
                      reducidos.
                    </p>
                  </div>
                  <div className="bg-surface-container rounded-xl p-6 border border-on-surface/5">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-primary text-[20px]">
                        fitness_center
                      </span>
                    </div>
                    <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] leading-[20px] text-on-surface uppercase mb-2">
                      Comunidad Motivadora
                    </h3>
                    <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[22px] text-on-surface-variant">
                      Un espacio donde cada entrenamiento te acerca a tu mejor
                      versión física y mental. Potencia tus resultados con
                      Funcional Trainer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section className="py-[64px] md:py-[96px] fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <div className="mb-10">
              <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
                FAQ
              </span>
              <h2 className="font-[family-name:var(--font-headline-md)] text-[28px] leading-[32px] md:text-[32px] md:leading-[36px] text-on-surface uppercase tracking-tighter">
                Preguntas <span className="text-primary">Frecuentes</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
              {[
                {
                  q: "¿Qué edades aceptan en ZONAELITE?",
                  a: "En ZONAELITE aceptamos personas de todas las edades. Contamos con programas adaptados para niños, adolescentes y adultos.",
                },
                {
                  q: "¿Necesito experiencia previa?",
                  a: "No. Nuestros entrenamientos están diseñados para todos los niveles. Ofrecemos una primera clase de prueba gratuita.",
                },
                {
                  q: "¿Qué disciplinas se enseñan?",
                  a: "Enseñamos Kenpo, Kickboxing, Sport Kempo (Kempo Deportivo) y Entrenamiento Funcional con nuestro sistema de Funcional Trainer.",
                },
                {
                  q: "¿Por qué el Kenpo es tan importante para ustedes?",
                  a: "Porque el American Kenpo es la raíz de la academia: un sistema de defensa personal real, científico y adaptable, que nació en la tradición milenaria y llegó a Chile para quedarse.",
                },
                {
                  q: "¿Dónde está ubicada la academia?",
                  a: "ZONAELITE está ubicada en La Serena, Región de Coquimbo, Chile. Contáctanos para agendar tu clase de prueba.",
                },
                {
                  q: "¿Cuáles son los beneficios?",
                  a: "Las artes marciales mejoran la condición física, la confianza, la disciplina, la capacidad de defensa personal y la salud mental.",
                },
              ].map((faq) => (
                <div
                  key={faq.q}
                  className="bg-surface-container rounded-xl p-6 border border-on-surface/5 hover:border-on-surface/10 transition-colors duration-200"
                >
                  <h3 className="font-[family-name:var(--font-headline-md)] text-[15px] leading-[20px] text-on-surface uppercase mb-2">
                    {faq.q}
                  </h3>
                  <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[22px] text-on-surface-variant">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <PageCTA />
      </main>

      <Footer />
    </>
  );
}
