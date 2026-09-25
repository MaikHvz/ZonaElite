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

        {/* ============ NUESTRO MAESTRO ============ */}
        <section id="nuestro-maestro" className="py-[64px] md:py-[96px] fade-up" style={{ background: "linear-gradient(180deg, #131313 0%, #1a1010 50%, #131313 100%)" }}>
          <div className="absolute inset-x-0" style={{ height: "1px", background: "linear-gradient(to right, transparent, rgba(255,84,76,0.4), transparent)" }} />
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">

            {/* Encabezado */}
            <div className="mb-12 md:mb-16">
              <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
                Director Técnico & Fundador
              </span>
              <h2 className="font-[family-name:var(--font-display-xl)] text-[36px] leading-[38px] md:text-[52px] md:leading-[56px] text-on-surface uppercase tracking-tighter max-w-3xl">
                El hombre detrás de{" "}
                <span className="text-primary text-glow-red">ZONAELITE</span>
              </h2>
            </div>

            {/* Layout principal: imagen + bio */}
            <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-10 md:gap-16 items-start mb-16">

              {/* Imagen del maestro */}
              <div className="relative">
                <div className="relative overflow-hidden rounded-2xl" style={{ boxShadow: "0 0 60px rgba(255,84,76,0.20), 0 24px 48px rgba(0,0,0,0.6)" }}>
                  <img
                    src="/juan_banner.jpeg"
                    alt="Sensei Juan Valenzuela — Director Técnico ZONAELITE"
                    className="w-full h-auto object-cover"
                    style={{ aspectRatio: "9/16", objectFit: "cover", objectPosition: "center top" }}
                  />
                  {/* Overlay con datos */}
                  <div className="absolute bottom-0 left-0 right-0 p-6" style={{ background: "linear-gradient(0deg, rgba(19,19,19,0.97) 0%, rgba(19,19,19,0.70) 60%, transparent 100%)" }}>
                    <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-[0.2em] text-primary mb-1">Cinturón Negro 4to Grado (Danes)</p>
                    <h3 className="font-[family-name:var(--font-headline-md)] text-[22px] leading-[26px] text-on-surface uppercase">Juan Eduardo<br/>Valenzuela Araya</h3>
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mt-1">+30 años de trayectoria · Campeón Mundial</p>
                  </div>
                </div>
                {/* Badge flotante */}
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full btn-primary-gradient flex flex-col items-center justify-center shadow-[0_0_24px_rgba(255,84,76,0.5)]">
                  <span className="font-[family-name:var(--font-display-xl)] text-white text-[26px] leading-none">+30</span>
                  <span className="font-[family-name:var(--font-label-sm)] text-white text-[8px] uppercase tracking-wide leading-tight text-center">años<br/>marciales</span>
                </div>
              </div>

              {/* Bio y datos */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[28px] text-on-surface-variant">
                    La historia marcial de <strong className="text-on-surface">Juan Eduardo Valenzuela Araya</strong> comenzó a forjarse a mediados de los años noventa. En una época donde las artes marciales mixtas aún abrían camino en Chile, el joven Valenzuela destacó rápidamente por su disciplina implacable y su técnica depurada en el combate Light Contact.
                  </p>
                  <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[28px] text-on-surface-variant">
                    Entre 1995 y 1998, su nombre comenzó a sonar con fuerza en el circuito nacional e internacional al coronarse de manera consecutiva como Campeón en los <strong className="text-on-surface">Campeonatos Panamericanos y Sudamericanos</strong> realizados en Santiago de Chile.
                  </p>
                  <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[28px] text-on-surface-variant">
                    En 2014, con décadas de experiencia acumulada, fundó el <strong className="text-on-surface">Club Deportivo Kenpo La Serena (BKLS Zona Élite)</strong>, ubicado en Av. Cruz del Molino #342, La Serena. Hoy este club es un semillero de campeones y un espacio de formación integral para niños, jóvenes y adultos de la Región de Coquimbo.
                  </p>
                </div>

                {/* Datos de contacto institucional */}
                <div className="bg-surface-container rounded-xl p-5 border border-on-surface/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">location_on</span>
                    <div>
                      <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary mb-0.5">Sede Central</p>
                      <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">Av. Cruz del Molino #342, La Serena</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">phone</span>
                    <div>
                      <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary mb-0.5">Contacto</p>
                      <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">+56 9 3495 9924</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">mail</span>
                    <div>
                      <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary mb-0.5">Correo</p>
                      <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">biokenpo@gmail.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">share</span>
                    <div>
                      <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary mb-0.5">Instagram</p>
                      <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">@biokenpo.karate_juanvalenzuela</p>
                    </div>
                  </div>
                </div>

                {/* Afiliación */}
                <div className="flex items-center gap-3 px-5 py-3 rounded-full border border-primary/30 bg-primary/5 w-fit">
                  <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                  <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-widest text-on-surface-variant">American Kenpo Mixed System Martial Arts</span>
                </div>
              </div>
            </div>

            {/* Línea de tiempo de logros */}
            <div className="mb-16">
              <div className="mb-8">
                <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
                  Palmarés & Reconocimientos
                </span>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] md:text-[28px] md:leading-[32px] text-on-surface uppercase tracking-tighter">
                  Una carrera de <span className="text-primary">tres décadas</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { year: "1995–1998", icon: "emoji_events", title: "Campeón Panamericano & Sudamericano", desc: "1er Lugar en Combate Light Contact en reiterados Campeonatos Panamericanos y Sudamericanos en Santiago de Chile." },
                  { year: "2010", icon: "military_tech", title: "Deportista Destacado", desc: "Galardonado oficialmente como \"Deportista Destacado\" por la Asociación American Kenpo Karate." },
                  { year: "Nov 2013", icon: "public", title: "Campeón Mundial — Antofagasta", desc: "1er Lugar y Campeón Mundial categoría Danes Serie Adulta en Combate Light Contact. Certificado e indexado por el Diario La Estrella." },
                  { year: "2015", icon: "workspace_premium", title: "Campeón Mundial — Antofagasta", desc: "1er Lugar en Combate Light Contact en el Campeonato Mundial de Antofagasta, reafirmando su dominio internacional." },
                  { year: "2018", icon: "social_leaderboard", title: "Triple Honor", desc: "Reconocimiento oficial CIAM por 30 años de carrera + Campeón Mundial en Combate Light Contact en Talcahuano." },
                  { year: "2019", icon: "star", title: "Distinción Especial", desc: "Federación Nacional de Artes Zona Norte le otorgó distinción especial por trayectoria, dedicación y espíritu marcial." },
                  { year: "2022", icon: "flag", title: "Medallas de Oro Sudamericano", desc: "1er Lugar en Full Kempo, Semi Kempo y Kata de Manos Vacías en el Campeonato Sudamericano, Neuquén Argentina." },
                  { year: "2023–2025", icon: "travel_explore", title: "Mundial IKF — Portugal", desc: "Participación en el XIX y XXI Mundial de Kempo IKF en Caldas da Rainha, Portugal en múltiples categorías." },
                  { year: "2014–Hoy", icon: "groups", title: "Fundador Club Deportivo", desc: "Funda y dirige BKLS Zona Élite en La Serena, proyectando el nombre de Chile al mundo entero bajo valores marciales inquebrantables." },
                ].map((item) => (
                  <div key={item.year} className="group relative bg-surface-container rounded-xl p-5 border border-on-surface/5 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:[box-shadow:0_8px_32px_rgba(255,84,76,0.12)]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-primary text-[18px]">{item.icon}</span>
                      </div>
                      <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary">{item.year}</span>
                    </div>
                    <h4 className="font-[family-name:var(--font-headline-md)] text-[14px] leading-[18px] text-on-surface uppercase mb-2">{item.title}</h4>
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] leading-[20px] text-on-surface-variant">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial de competición reciente */}
            <div className="mb-16">
              <div className="mb-6">
                <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
                  Competición Internacional
                </span>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] md:text-[28px] md:leading-[32px] text-on-surface uppercase tracking-tighter">
                  Presencia global <span className="text-primary">reciente</span>
                </h3>
              </div>
              <div className="overflow-x-auto rounded-xl border border-on-surface/5">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-surface-container-high">
                      <th className="px-5 py-3 text-left font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary">Fecha</th>
                      <th className="px-5 py-3 text-left font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary">Ubicación</th>
                      <th className="px-5 py-3 text-left font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary">Torneo / Campeonato</th>
                      <th className="px-5 py-3 text-left font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-primary">Categorías</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { fecha: "Jun 2026", lugar: "La Serena, Chile", torneo: "C4 The Combat Series", cats: "MMA" },
                      { fecha: "Abr 2026", lugar: "Santiago, Chile", torneo: "Campeonato Nacional Kenpo", cats: "Formas, Light Contact, Kick Light, Point Fight" },
                      { fecha: "Jun 2025", lugar: "Vicuña, Chile", torneo: "Artes Marciales Vicuña 2025", cats: "Light Contact, Kick Light, Punto Tradicional" },
                      { fecha: "Abr 2025", lugar: "Caldas da Rainha, Portugal", torneo: "XXI Mundial de Kempo IKF", cats: "Full Kempo, Semi Kempo, Submission, Kata, MMA" },
                      { fecha: "Oct 2024", lugar: "Talcahuano, Chile", torneo: "Torneo Copa Ed Parker", cats: "Formas, Defensa Personal, Combate y Sumisión" },
                      { fecha: "Abr 2023", lugar: "Caldas da Rainha, Portugal", torneo: "XIX Mundial de Kempo Karate", cats: "Full Kempo, Semi Kempo, Submission, Kata, MMA" },
                      { fecha: "Nov 2022", lugar: "Neuquén, Argentina", torneo: "I Campeonato Panamericano IKF", cats: "Formas, Defensa Personal, Full Kempo, Sumisión" },
                    ].map((row, i) => (
                      <tr key={i} className={`border-t border-on-surface/5 ${i % 2 === 0 ? 'bg-surface-container' : 'bg-surface-container-low'} hover:bg-surface-container-high transition-colors`}>
                        <td className="px-5 py-3.5 font-[family-name:var(--font-label-sm)] text-[11px] text-primary whitespace-nowrap">{row.fecha}</td>
                        <td className="px-5 py-3.5 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant whitespace-nowrap">{row.lugar}</td>
                        <td className="px-5 py-3.5 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{row.torneo}</td>
                        <td className="px-5 py-3.5 font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">{row.cats}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Foto grupal — alumnos + maestro */}
            <div>
              <div className="mb-8">
                <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
                  Nuestra Familia
                </span>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] md:text-[28px] md:leading-[32px] text-on-surface uppercase tracking-tighter">
                  Los alumnos son <span className="text-primary">el legado</span>
                </h3>
              </div>
              <div className="relative overflow-hidden rounded-2xl" style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(255,84,76,0.10)" }}>
                <img
                  src="/kenpo_adulto.jpeg"
                  alt="Alumnos junto al Sensei Juan Valenzuela — BKLS Zona Élite"
                  className="w-full object-cover"
                  style={{ maxHeight: "520px", objectPosition: "center top" }}
                />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8" style={{ background: "linear-gradient(0deg, rgba(19,19,19,0.95) 0%, rgba(19,19,19,0.60) 60%, transparent 100%)" }}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full btn-primary-gradient flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-white text-[20px]">groups</span>
                    </div>
                    <div>
                      <p className="font-[family-name:var(--font-headline-md)] text-[16px] leading-[20px] text-on-surface uppercase">Clase de Kenpo Adultos</p>
                      <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">Club Deportivo Kenpo La Serena · Av. Cruz del Molino #342</p>
                    </div>
                  </div>
                </div>
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
