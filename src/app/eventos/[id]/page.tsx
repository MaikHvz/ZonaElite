"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Event {
  id: string;
  type: string;
  title: string;
  description: string | null;
  image: string | null;
  location_name: string | null;
  location_url: string | null;
  event_date: string;
  extra: Record<string, unknown>;
  created_at: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function typeInfo(t: string) {
  const map: Record<string, { label: string; icon: string; gradient: string }> = {
    torneo: { label: "Torneo", icon: "emoji_events", gradient: "from-amber-500/80 to-yellow-600/80" },
    graduacion: { label: "Ceremonia", icon: "military_tech", gradient: "from-purple-500/80 to-indigo-600/80" },
    seminario: { label: "Seminario", icon: "school", gradient: "from-blue-500/80 to-cyan-600/80" },
    clase_especial: { label: "Clase Especial", icon: "fitness_center", gradient: "from-emerald-500/80 to-teal-600/80" },
  };
  return map[t] || { label: t, icon: "event", gradient: "from-gray-500/80 to-gray-600/80" };
}

function extractGoogleMapsEmbed(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.includes("google.com/maps/embed")) return trimmed;
  return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setEvent(data as Event | null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-28 pb-16 px-5">
        <div className="max-w-[900px] mx-auto flex justify-center py-20">
          <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background pt-28 pb-16 px-5">
        <div className="max-w-[900px] mx-auto text-center py-20">
          <span className="material-symbols-outlined text-on-surface/20 text-7xl mb-4 block">event_busy</span>
          <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant mb-6">Evento no encontrado</p>
          <Link href="/eventos" className="inline-flex items-center gap-2 font-[family-name:var(--font-headline-md)] text-[14px] text-primary uppercase tracking-wider hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Volver a eventos
          </Link>
        </div>
      </div>
    );
  }

  const info = typeInfo(event.type);
  const mapsEmbed = event.location_url ? extractGoogleMapsEmbed(event.location_url) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-[360px] md:h-[440px] bg-surface-container overflow-hidden">
        {event.image ? (
          <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${info.gradient} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-white/20 text-[160px]">{info.icon}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Back button */}
        <Link
          href="/eventos"
          className="absolute top-6 left-6 flex items-center gap-2 bg-black/70 text-white/80 hover:text-white px-4 py-2 rounded-full text-[13px] font-[family-name:var(--font-body-md)] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Eventos
        </Link>

        {/* Type badge */}
        <div className="absolute top-6 right-6 btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[11px] uppercase py-2 px-5 rounded-full tracking-wider">
          {info.label}
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-[900px] mx-auto">
            <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[48px] text-white uppercase tracking-tighter leading-tight">
              {event.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-5 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface-container-lowest border border-on-surface/5 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full btn-primary-gradient flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-white text-[20px]">calendar_today</span>
                </div>
                <div>
                  <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1">Fecha</p>
                  <p className="font-[family-name:var(--font-body-md)] text-[15px] text-on-surface capitalize">{formatDate(event.event_date)}</p>
                </div>
              </div>

              {event.location_name && (
                <div className="bg-surface-container-lowest border border-on-surface/5 rounded-xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full btn-primary-gradient flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-white text-[20px]">location_on</span>
                  </div>
                  <div>
                    <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1">Lugar</p>
                    <p className="font-[family-name:var(--font-body-md)] text-[15px] text-on-surface">{event.location_name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div>
                <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase mb-4">
                  Sobre este evento
                </h2>
                <div className="space-y-3">
                  {event.description.split("\n").map((paragraph, i) => (
                    <p key={i} className="font-[family-name:var(--font-body-md)] text-[15px] leading-[26px] text-on-surface-variant">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Google Maps */}
            {mapsEmbed && (
              <div>
                <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase mb-4">
                  Ubicación
                </h2>
                <div className="rounded-2xl overflow-hidden border border-on-surface/5">
                  <iframe
                    src={mapsEmbed}
                    width="100%"
                    height="350"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full"
                  />
                </div>
                {event.location_url && (
                  <a
                    href={event.location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-[13px] text-primary hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    Abrir en Google Maps
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-surface-container-lowest border border-on-surface/5 rounded-2xl p-6 sticky top-28">
              <div className="text-center mb-6">
                <span className={`inline-flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] uppercase tracking-wider py-2 px-5 rounded-full`}>
                  <span className="material-symbols-outlined text-[18px]">{info.icon}</span>
                  {info.label}
                </span>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">calendar_today</span>
                  <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface capitalize">{formatDate(event.event_date)}</span>
                </div>
                {event.location_name && (
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
                    <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{event.location_name}</span>
                  </div>
                )}
              </div>

              <Link
                href="/auth"
                className="block w-full text-center px-6 py-3 rounded-xl btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                Inscribirse
              </Link>

              <div className="border-t border-on-surface/5 mt-4 pt-4">
                <Link
                  href="/eventos"
                  className="flex items-center justify-center gap-2 text-[13px] text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Volver a eventos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
