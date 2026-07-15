"use client";

import Link from "next/link";
import ContactLink from "./ContactLink";

const logoUrl = "/logo.png";

const footerLinks = [
  { label: "Nosotros", href: "/nosotros" },
  { label: "Horarios", href: "/horarios" },
  { label: "Política de Privacidad", href: "#" },
  { label: "Términos de Servicio", href: "#" },
];

export default function Footer() {
  return (
    <footer className="bg-surface-container-lowest py-[64px] border-t border-on-surface/5 mt-auto">
      <div className="flex flex-col md:flex-row justify-between items-center px-6 max-w-[1280px] mx-auto gap-8">
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt="ZonaElite Logo"
              className="h-24 w-24 object-contain"
            />
            <span className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-primary uppercase tracking-tighter">
              ZONAELITE
            </span>
          </Link>
          <p className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-widest text-center md:text-left text-[12px] leading-[16px]">
            Bio Kenpo La Serena
            <br />
            Alto Rendimiento
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-6 font-[family-name:var(--font-label-sm)] uppercase tracking-wider text-[12px] leading-[16px]">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-on-surface-variant hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <ContactLink className="text-on-surface-variant hover:text-primary transition-colors">
            Contacto
          </ContactLink>
        </div>

        {/* Copyright */}
        <div className="text-center md:text-right">
          <p className="font-[family-name:var(--font-label-sm)] text-on-surface-variant/50 text-[12px] leading-[16px]">
            2024 ZONAELITE ACADEMIA.
            <br />
            TODOS LOS DERECHOS RESERVADOS.
          </p>
        </div>
      </div>
    </footer>
  );
}
