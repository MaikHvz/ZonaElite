import Link from "next/link";

export interface EventData {
  id: string;
  type: string;
  title: string;
  description: string | null;
  image: string | null;
  location_name: string | null;
  location_url: string | null;
  event_date: string;
  extra: Record<string, unknown>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    torneo: "Torneo",
    graduacion: "Ceremonia",
    seminario: "Seminario",
    clase_especial: "Clase Especial",
  };
  return map[t] || t;
}

function typeIcon(t: string) {
  const map: Record<string, string> = {
    torneo: "emoji_events",
    graduacion: "military_tech",
    seminario: "school",
    clase_especial: "fitness_center",
  };
  return map[t] || "event";
}

export default function EventCard({ event }: { event: EventData }) {
  return (
    <Link
      href={`/eventos/${event.id}`}
      className="block relative rounded-2xl overflow-hidden border border-on-surface/5 bg-surface-container-lowest group hover:border-primary/30 transition-colors"
    >
      <div className="relative h-[200px] bg-surface-container flex items-center justify-center overflow-hidden">
        {event.image ? (
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <span className="material-symbols-outlined text-on-surface/20 text-7xl">
            {typeIcon(event.type)}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-4 left-4 btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[11px] uppercase py-1.5 px-4 rounded-full tracking-wider">
          {typeLabel(event.type)}
        </div>
      </div>

      <div className="p-6">
        <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase mb-2">
          {event.title}
        </h3>

        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary text-[18px]">
            calendar_today
          </span>
          <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant capitalize">
            {formatDate(event.event_date)}
          </span>
        </div>

        {event.location_name && (
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-[18px]">
              location_on
            </span>
            <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
              {event.location_name}
            </span>
          </div>
        )}

        {event.description && (
          <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[22px] text-on-surface-variant mb-4">
            {event.description.length > 140
              ? event.description.slice(0, 140) + "..."
              : event.description}
          </p>
        )}

        <span className="inline-block font-[family-name:var(--font-headline-md)] text-[13px] text-primary uppercase tracking-wider group-hover:text-on-surface transition-colors">
          Ver detalles &rarr;
        </span>
      </div>
    </Link>
  );
}
