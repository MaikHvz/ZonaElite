import type { Metadata } from "next";
import Footer from "@/components/Footer";
import PageCTA from "@/components/PageCTA";
import GalleryCarousel from "@/components/GalleryCarousel";
import HistoryExplorer from "@/components/history/HistoryExplorer";

export const metadata: Metadata = {
  title: "Quiénes Somos | Kenpo, Kickboxing y MMA en La Serena | ZONAELITE",
  description:
    "Descubre quiénes somos y nuestra historia: la del American Kenpo, nuestra raíz; y las del Kickboxing y el MMA. Una historia interactiva que conecta mil años de arte marcial con la academia ZONAELITE en La Serena.",
  keywords: [
    "quienes somos ZonaElite",
    "academia de artes marciales La Serena",
    "historia del American Kenpo",
    "que es el kenpo americano",
    "historia del kickboxing",
    "historia del MMA",
    "clases de kenpo La Serena",
    "kickboxing La Serena",
    "MMA La Serena",
    "defensa personal La Serena",
    "academia de kenpo La Serena",
    "gimnasio de artes marciales La Serena",
  ],
  openGraph: {
    title: "Quiénes Somos | Kenpo, Kickboxing y MMA en La Serena | ZONAELITE",
    description:
      "Nuestra historia comienza con el American Kenpo, nuestra raíz, y continúa con el Kickboxing y el MMA. Léela como se vive: capítulo a capítulo.",
    type: "website",
    locale: "es_CL",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "ZONAELITE Academia",
  description:
    "Academia de Kenpo, Kickboxing, MMA y Acondicionamiento Físico en La Serena. Defensa personal y entrenamiento de alto rendimiento.",
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
          name: "Clases de MMA",
          description:
            "Entrenamiento integral de artes marciales mixtas en La Serena.",
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
        text: "Enseñamos Kenpo, Kickboxing, MMA (Artes Marciales Mixtas) y Entrenamiento Funcional con nuestro sistema de Funcional Trainer.",
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
              junto al Kickboxing y al MMA: tres historias que se entrelazan en
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
                  a: "Enseñamos Kenpo, Kickboxing, MMA (Artes Marciales Mixtas) y Entrenamiento Funcional con nuestro sistema de Funcional Trainer.",
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
