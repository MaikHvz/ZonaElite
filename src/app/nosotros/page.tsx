import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactModal from "@/components/ContactModal";
import FadeUpObserver from "@/components/FadeUpObserver";
import PageCTA from "@/components/PageCTA";

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
      <FadeUpObserver />
      <Navbar />

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
        <section className="py-[64px] md:py-[96px] bg-surface-container-lowest fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <img
              src="/logo.png"
              alt="ZonaElite Logo"
              className="h-36 w-36 object-contain mb-6"
            />
            <p className="font-[family-name:var(--font-label-sm)] text-primary uppercase tracking-[0.15em] mb-4 text-[12px] leading-[16px]">
              Sobre Nosotros
            </p>
            <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter mb-6">
              Academia de Kenpo, Kickboxing y{" "}
              <span className="text-primary">MMA en La Serena</span>
            </h1>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl">
              En Zona Elite Legacy, entendemos que las Artes Marciales son mucho
              más que un deporte; son una filosofía de vida que te prepara para
              cualquier desafío. Combinamos la tradición, la técnica y la ciencia
              del combate para ofrecerte un sistema de Defensa Personal real y
              efectivo.
            </p>
          </div>
        </section>

        {/* Filosofía */}
        <section className="py-[64px] md:py-[96px] fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-on-surface uppercase tracking-tighter mb-8">
              Nuestra <span className="text-primary">Filosofía</span>
            </h2>
            <div className="max-w-3xl">
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-6">
                Dominio Marcial y Excelencia Deportiva: tu camino hacia la
                seguridad total. Creemos que cada persona tiene el derecho de
                sentirse segura y preparada para enfrentar los desafíos de la
                vida cotidiana.
              </p>
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-6">
                Vivimos en un mundo donde la seguridad personal ya no es
                opcional. El bullying, el acoso y la violencia no discriminan,
                pero tú puedes elegir estar preparado. Transforma el miedo en
                acción a través de nuestro sistema de entrenamiento integral.
              </p>
              <blockquote className="border-l-4 border-primary pl-6 my-8">
                <p className="font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] text-on-surface italic">
                  &ldquo;Sabemos lo que somos… pero aún no sabemos lo que podemos
                  llegar a ser.&rdquo;
                </p>
              </blockquote>
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                A través de nuestro sistema, no solo fortalecerás tu cuerpo;
                forjarás una mentalidad inquebrantable, superando complejos y
                ganando la autoconfianza necesaria para caminar seguro en
                cualquier lugar.
              </p>
            </div>
          </div>
        </section>

        {/* Disciplinas Detalladas */}
        <section className="py-[64px] md:py-[96px] bg-surface-container-low fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-on-surface uppercase tracking-tighter mb-4">
              Formación Marcial de Élite
            </h2>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl mb-12">
              Domina las disciplinas más completas y prepárate para proteger lo
              que más quieres:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-surface-container rounded-2xl p-8 border border-on-surface/5">
                <div className="w-12 h-12 rounded-full glass-panel flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary">
                    sports_martial_arts
                  </span>
                </div>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase mb-3">
                  Kenpo
                </h3>
                <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                  La ciencia de la defensa personal urbana. Velocidad y lógica
                  aplicada a la protección real.
                </p>
              </div>

              <div className="bg-surface-container rounded-2xl p-8 border border-on-surface/5">
                <div className="w-12 h-12 rounded-full glass-panel flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary">
                    sports_kabaddi
                  </span>
                </div>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase mb-3">
                  Kick Boxing
                </h3>
                <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                  Potencia explosiva y dominio del combate de pie. Disciplina
                  que forja tu carácter y tu físico.
                </p>
              </div>

              <div className="bg-surface-container rounded-2xl p-8 border border-on-surface/5">
                <div className="w-12 h-12 rounded-full glass-panel flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary">
                    hardware
                  </span>
                </div>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase mb-3">
                  MMA (Artes Marciales Mixtas)
                </h3>
                <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                  La evolución total. Aprende a transicionar entre el golpeo y
                  la lucha, adaptándote a cualquier situación.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Estilo de Vida */}
        <section className="py-[64px] md:py-[96px] fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[24px] text-on-surface uppercase tracking-tighter mb-6">
              Un Estilo de Vida Saludable y Deportivo
            </h2>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl mb-10">
              No solo entrenas para defenderte, entrenas para vivir mejor. Te
              ofrecemos un ambiente deportivo y saludable, libre de egos, donde
              el respeto es nuestra base.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
              <div>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] leading-[22px] text-primary uppercase mb-2">
                  Clases Personalizadas
                </h3>
                <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                  Diseñadas específicamente para tu ritmo, enfocadas en mejorar
                  tu agilidad, potencia y resistencia. Semi-personalizadas para
                  grupos reducidos.
                </p>
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] leading-[22px] text-primary uppercase mb-2">
                  Comunidad Motivadora
                </h3>
                <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                  Un espacio donde cada entrenamiento te acerca a tu mejor
                  versión física y mental. Potencia tus resultados con nuestro
                  sistema de Funcional Trainer.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-[64px] md:py-[96px] bg-surface-container-low fade-up">
          <div className="max-w-[1280px] mx-auto px-5 md:px-6">
            <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-on-surface uppercase tracking-tighter mb-10">
              Preguntas <span className="text-primary">Frecuentes</span>
            </h2>

            <div className="max-w-3xl space-y-6">
              {[
                {
                  q: "¿Qué edades aceptan en ZONAELITE?",
                  a: "En ZONAELITE aceptamos personas de todas las edades. Contamos con programas adaptados para niños, adolescentes y adultos.",
                },
                {
                  q: "¿Necesito experiencia previa para entrenar?",
                  a: "No. Nuestros entrenamientos están diseñados para todos los niveles. Ofrecemos una primera clase de prueba gratuita para que conozcas nuestras instalaciones y disciplinas.",
                },
                {
                  q: "¿Qué disciplinas se enseñan en ZONAELITE?",
                  a: "Enseñamos Kenpo, Kickboxing, MMA (Artes Marciales Mixtas) y Entrenamiento Funcional con nuestro sistema de Funcional Trainer.",
                },
                {
                  q: "¿Dónde está ubicada la academia?",
                  a: "ZONAELITE está ubicada en La Serena, Región de Coquimbo, Chile. Contáctanos para conocer la dirección exacta y agendar tu clase de prueba.",
                },
                {
                  q: "¿Cuáles son los beneficios de entrenar artes marciales?",
                  a: "Las artes marciales mejoran la condición física, la confianza, la disciplina, la capacidad de defensa personal y la salud mental. Son un estilo de vida que prepara para cualquier desafío.",
                },
              ].map((faq) => (
                <div
                  key={faq.q}
                  className="bg-surface-container rounded-xl p-6 border border-on-surface/5"
                >
                  <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] leading-[20px] text-on-surface uppercase mb-2">
                    {faq.q}
                  </h3>
                  <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
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
      <ContactModal />
    </>
  );
}
