"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import EventCard, { type EventData } from "@/components/EventCard";
import PageCTA from "@/components/PageCTA";

const TABS = [
  { key: "all", label: "Todos" },
  { key: "torneo", label: "Torneos" },
  { key: "graduacion", label: "Ceremonias" },
];

export default function EventosPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("events")
      .select("*")
      .in("type", ["torneo", "graduacion"])
      .order("event_date", { ascending: true })
      .then(({ data }) => {
        setEvents((data as EventData[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);

  return (
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center mb-12 fade-up">
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[48px] text-on-surface uppercase tracking-tighter mb-2">
            Eventos <span className="text-primary">ZonaElite</span>
          </h1>
          <p className="font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] text-on-surface-variant max-w-xl mx-auto">
            Torneos, ceremonias y más. Compite, crece y forma parte de nuestra comunidad.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider px-5 py-2 rounded-full border transition-colors cursor-pointer ${
                filter === tab.key
                  ? "btn-primary-gradient text-white border-transparent"
                  : "border-on-surface/20 text-on-surface-variant hover:border-primary/50 hover:text-on-surface"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-on-surface/20 text-7xl mb-4 block">
              {filter === "torneo" ? "emoji_events" : filter === "graduacion" ? "military_tech" : "event"}
            </span>
            <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant">
              No hay eventos{filter !== "all" ? ` de tipo "${TABS.find((t) => t.key === filter)?.label}"` : ""} programados
            </p>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant/60 mt-2">
              ¡Seguinos para enterarte de los próximos eventos!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      <PageCTA />
    </div>
  );
}
