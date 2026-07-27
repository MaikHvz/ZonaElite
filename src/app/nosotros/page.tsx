import type { Metadata } from "next";
import Footer from "@/components/Footer";
import PageCTA from "@/components/PageCTA";
import GalleryCarousel from "@/components/GalleryCarousel";

export const metadata: Metadata = {
  title: "Academia de Artes Marciales en La Serena | ZONAELITE",
  description:
    "Conoce ZONAELITE: academia de Kenpo, Kickboxing y MMA en La Serena. Defensa personal, entrenamiento funcional y formación marcial de élite. Filosofía, disciplina y excelencia deportiva.",
  keywords: [
    "academia de artes marciales La Serena",
    "clases de kenpo La Serena",
    "kickboxing La Serena",
    "MMA La Serena",
    "defensa personal La Serena",
    "entrenamiento funcional La Serena",
    "artes marciales La Serena Chile",
    "academia de kenpo La Serena",
    "clases de kickboxing La Serena",
    "gimnasio de artes marciales La Serena",
  ],
  openGraph: {
    title: "Academia de Artes Marciales en La Serena | ZONAELITE",
    description:
      "Conoce ZONAELITE: academia de Kenpo, Kickboxing y MMA en La Serena. Defensa personal, entrenamiento funcional y formación marcial de élite.",
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

export default function NosotrosPage() {
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

        {/* Hero */}
        <section className="relative py-[64px] md:py-[96px] overflow-hidden fade-up">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="relative max-w-[1280px] mx-auto px-5 md:px-6">
            <div className="flex items-center gap-4 mb-6">
              <img
                src="/logo.png"
                alt="ZonaElite Logo"
                className="h-14 w-14 object-contain"
              />
              <span className="font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary">
                Sobre Nosotros
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-headline-lg)] text-[36px] leading-[40px] md:text-[52px] md:leading-[56px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter mb-6 max-w-4xl">
              Academia de Kenpo, Kickboxing y{" "}
              <span className="text-primary">MMA en La Serena</span>
            </h1>
            <p className="font-[family-name:var(--font-body-md)] text-[17px] leading-[26px] text-on-surface-variant max-w-3xl">
              En Zona Elite Legacy, entendemos que las Artes Marciales son mucho
              más que un deporte; son una filosofía de vida que te prepara para
              cualquier desafío. Combinamos la tradición, la técnica y la ciencia
              del combate para ofrecerte un sistema de Defensa Personal real y
              efectivo.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="py-10 border-y border-on-surface/5 fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: "4+", label: "Disciplinas" },
                { value: "100%", label: "Compromiso" },
                { value: "0", label: "Egos" },
                { value: "1", label: "Comunidad" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <span className="block font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] leading-[44px] text-primary">
                    {stat.value}
                  </span>
                  <span className="block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.1em] text-on-surface-variant mt-1">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Filosofía */}
        <section className="py-[64px] md:py-[96px] fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-12 md:gap-16 items-start">
              <div>
                <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
                  Nuestro Sistema
                </span>
                <h2 className="font-[family-name:var(--font-headline-md)] text-[28px] leading-[32px] md:text-[32px] md:leading-[36px] text-on-surface uppercase tracking-tighter">
                  Nuestra <span className="text-primary">Filosofía</span>
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
                    &ldquo;Sabemos lo que somos… pero aún no sabemos lo que podemos
                    llegar a ser.&rdquo;
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

        {/* Galería */}
        <GalleryCarousel />

        {/* Disciplinas Detalladas */}
        <section className="py-[64px] md:py-[96px] bg-surface-container-low fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <div className="mb-12">
              <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
                Programas
              </span>
              <h2 className="font-[family-name:var(--font-headline-md)] text-[28px] leading-[32px] md:text-[32px] md:leading-[36px] text-on-surface uppercase tracking-tighter mb-4">
                Formación Marcial de Élite
              </h2>
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl">
                Domina las disciplinas más completas y prepárate para proteger lo
                que más quieres:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: "sports_martial_arts",
                  name: "Kenpo",
                  desc: "La ciencia de la defensa personal urbana. Velocidad y lógica aplicada a la protección real.",
                },
                {
                  icon: "sports_kabaddi",
                  name: "Kick Boxing",
                  desc: "Potencia explosiva y dominio del combate de pie. Disciplina que forja tu carácter y tu físico.",
                },
                {
                  icon: "hardware",
                  name: "MMA",
                  desc: "La evolución total. Aprende a transicionar entre el golpeo y la lucha, adaptándote a cualquier situación.",
                },
              ].map((d) => (
                <div
                  key={d.name}
                  className="group relative bg-surface-container rounded-2xl p-8 border border-on-surface/5 hover:border-primary/20 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,84,76,0.08)]"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-5">
                    <span className="material-symbols-outlined text-primary text-[22px]">
                      {d.icon}
                    </span>
                  </div>
                  <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase mb-3">
                    {d.name}
                  </h3>
                  <p className="font-[family-name:var(--font-body-md)] text-[15px] leading-[24px] text-on-surface-variant">
                    {d.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Estilo de Vida */}
        <section className="py-[64px] md:py-[96px] fade-up">
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
                  No solo entrenas para defenderte, entrenas para vivir mejor. Te
                  ofrecemos un ambiente deportivo y saludable, libre de egos, donde
                  el respeto es nuestra base.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-surface-container-low rounded-xl p-6 border border-on-surface/5">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-primary text-[20px]">group</span>
                    </div>
                    <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] leading-[20px] text-on-surface uppercase mb-2">
                      Clases Personalizadas
                    </h3>
                    <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[22px] text-on-surface-variant">
                      Diseñadas para tu ritmo, enfocadas en mejorar tu agilidad,
                      potencia y resistencia. Semi-personalizadas para grupos reducidos.
                    </p>
                  </div>
                  <div className="bg-surface-container-low rounded-xl p-6 border border-on-surface/5">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-primary text-[20px]">fitness_center</span>
                    </div>
                    <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] leading-[20px] text-on-surface uppercase mb-2">
                      Comunidad Motivadora
                    </h3>
                    <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[22px] text-on-surface-variant">
                      Un espacio donde cada entrenamiento te acerca a tu mejor
                      versión física y mental. Potencia tus resultados con Funcional Trainer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-[64px] md:py-[96px] bg-surface-container-low fade-up">
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

        {/* CTA */}
        <PageCTA />
      </main>

      <Footer />
    </>
  );
}
