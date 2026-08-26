import type { Metadata } from "next";
import { Anton, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ContactModalProvider } from "@/components/ContactModalContext";
import ContactModal from "@/components/ContactModal";
import Navbar from "@/components/Navbar";
import FadeUpObserver from "@/components/FadeUpObserver";
import SessionProvider from "@/providers/SessionProvider";
import { CartProvider } from "@/context/CartContext";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://zonaelite.cl"
  ),
  title: {
    default: "ZONAELITE | Academia de Kenpo, Kickboxing, Sport Kempo en La Serena",
    template: "%s | ZONAELITE",
  },
  description:
    "Academia de artes marciales en La Serena: Kenpo, Kickboxing, Sport Kempo y Entrenamiento Funcional. Defensa personal, disciplina y excelencia deportiva. Primera clase de prueba gratuita.",
  keywords: [
    "artes marciales La Serena",
    "kenpo La Serena",
    "kickboxing La Serena",
    "Sport Kempo La Serena",
    "defensa personal La Serena",
    "academia de artes marciales",
    "entrenamiento funcional La Serena",
  ],
  openGraph: {
    title: "ZONAELITE | Academia de Kenpo, Kickboxing, Sport Kempo en La Serena",
    description:
      "Academia de artes marciales en La Serena: Kenpo, Kickboxing, Sport Kempo y Entrenamiento Funcional. Defensa personal, disciplina y excelencia deportiva.",
    type: "website",
    locale: "es_CL",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${anton.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable}`}
      >
        <SessionProvider>
          <CartProvider>
            <ContactModalProvider>
              <Navbar />
              <FadeUpObserver />
              {children}
              <ContactModal />
            </ContactModalProvider>
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
