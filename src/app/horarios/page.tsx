import type { Metadata } from "next";
import Footer from "@/components/Footer";
import PageCTA from "@/components/PageCTA";

export const metadata: Metadata = {
  title: "Horarios de Clases | Kenpo, Kickboxing, MMA La Serena",
  description:
    "Consulta los horarios de Kenpo, Kickboxing, MMA y Entrenamiento Funcional en ZONAELITE La Serena. Clases para todas las edades: niños, juveniles y adultos.",
};

type ClassEntry = {
  name: string;
  instructor?: string;
  spots: number;
  totalSpots: number;
};

type TimeSlot = {
  time: string;
  schedule: (ClassEntry | null)[];
};

const days = [
  { short: "Lun", date: 13 },
  { short: "Mar", date: 14 },
  { short: "Mié", date: 15 },
  { short: "Jue", date: 16 },
  { short: "Vie", date: 17 },
  { short: "Sáb", date: 18 },
  { short: "Dom", date: 19 },
];

const schedule: TimeSlot[] = [
  {
    time: "06:00",
    schedule: [
      { name: "Personalizado Kenpo", instructor: "Juan", spots: 0, totalSpots: 1 },
      null,
      { name: "Personalizado Kenpo", instructor: "Juan", spots: 1, totalSpots: 1 },
      { name: "Personalizado Kenpo", instructor: "Juan", spots: 0, totalSpots: 1 },
      { name: "Personalizado Kenpo", instructor: "Juan", spots: 1, totalSpots: 1 },
      null,
      null,
    ],
  },
  {
    time: "07:00",
    schedule: [
      {
        name: "Funcional Semi-Personalizados",
        instructor: "Juan",
        spots: 1,
        totalSpots: 3,
      },
      {
        name: "Funcional Semi-Personalizados",
        instructor: "Juan",
        spots: 2,
        totalSpots: 3,
      },
      {
        name: "Funcional Semi-Personalizados",
        instructor: "Juan",
        spots: 3,
        totalSpots: 3,
      },
      {
        name: "Funcional Semi-Personalizados",
        instructor: "Juan",
        spots: 0,
        totalSpots: 3,
      },
      {
        name: "Funcional Semi-Personalizados",
        instructor: "Juan",
        spots: 2,
        totalSpots: 3,
      },
      {
        name: "Funcional Semi-Personalizados",
        instructor: "Juan",
        spots: 1,
        totalSpots: 3,
      },
      null,
    ],
  },
  {
    time: "09:00",
    schedule: [
      {
        name: "Funcional Personalizados",
        instructor: "Juan",
        spots: 3,
        totalSpots: 15,
      },
      {
        name: "Personalizados Kenpo",
        instructor: "Juan",
        spots: 4,
        totalSpots: 10,
      },
      {
        name: "Funcional Personalizados",
        instructor: "Juan",
        spots: 10,
        totalSpots: 15,
      },
      {
        name: "Personalizados Kenpo",
        instructor: "Juan",
        spots: 7,
        totalSpots: 10,
      },
      {
        name: "Funcional Personalizados",
        instructor: "Juan",
        spots: 5,
        totalSpots: 15,
      },
      {
        name: "Personalizados Kenpo",
        instructor: "Juan",
        spots: 6,
        totalSpots: 10,
      },
      null,
    ],
  },
  {
    time: "17:00",
    schedule: [
      {
        name: "Kenpo Kids (6 a 9 años)",
        instructor: "Juan",
        spots: 8,
        totalSpots: 15,
      },
      {
        name: "Kenpo Kids (6 a 9 años)",
        instructor: "Juan",
        spots: 12,
        totalSpots: 15,
      },
      {
        name: "Kenpo Kids (6 a 9 años)",
        instructor: "Juan",
        spots: 6,
        totalSpots: 15,
      },
      {
        name: "Kenpo Kids (6 a 9 años)",
        instructor: "Juan",
        spots: 14,
        totalSpots: 15,
      },
      null,
      {
        name: "Kenpo Kids (6 a 9 años)",
        instructor: "Juan",
        spots: 10,
        totalSpots: 15,
      },
      null,
    ],
  },
  {
    time: "18:00",
    schedule: [
      {
        name: "Plan Familiar Kenpo x3",
        instructor: "Juan",
        spots: 11,
        totalSpots: 15,
      },
      {
        name: "Plan Familiar Kenpo x3",
        instructor: "Juan",
        spots: 7,
        totalSpots: 15,
      },
      null,
      {
        name: "Plan Familiar Kenpo x3",
        instructor: "Juan",
        spots: 9,
        totalSpots: 15,
      },
      {
        name: "Plan Familiar Kenpo x3",
        instructor: "Juan",
        spots: 14,
        totalSpots: 15,
      },
      null,
      null,
    ],
  },
  {
    time: "19:00",
    schedule: [
      {
        name: "Juvenil Kenpo A (10 a 15 años)",
        instructor: "Juan",
        spots: 5,
        totalSpots: 15,
      },
      null,
      {
        name: "Juvenil Kenpo A (10 a 15 años)",
        instructor: "Juan",
        spots: 13,
        totalSpots: 15,
      },
      {
        name: "Juvenil Kenpo A (10 a 15 años)",
        instructor: "Juan",
        spots: 2,
        totalSpots: 15,
      },
      {
        name: "Juvenil Kenpo A (10 a 15 años)",
        instructor: "Juan",
        spots: 8,
        totalSpots: 15,
      },
      null,
      null,
    ],
  },
  {
    time: "20:00",
    schedule: [
      {
        name: "Kenpo (Adultos y Juvenil 16+)",
        instructor: "Juan",
        spots: 9,
        totalSpots: 15,
      },
      {
        name: "Kenpo (Adultos y Juvenil 16+)",
        instructor: "Juan",
        spots: 6,
        totalSpots: 15,
      },
      {
        name: "Kenpo (Adultos y Juvenil 16+)",
        instructor: "Juan",
        spots: 11,
        totalSpots: 15,
      },
      null,
      {
        name: "Kenpo (Adultos y Juvenil 16+)",
        instructor: "Juan",
        spots: 3,
        totalSpots: 15,
      },
      {
        name: "Kenpo (Adultos y Juvenil 16+)",
        instructor: "Juan",
        spots: 12,
        totalSpots: 15,
      },
      {
        name: "Kenpo (Adultos y Juvenil 16+)",
        instructor: "Juan",
        spots: 4,
        totalSpots: 15,
      },
    ],
  },
];

function ClassCard({ cls }: { cls: ClassEntry }) {
  const isLow = cls.totalSpots - cls.spots <= 3 && cls.totalSpots > 3;
  const isFull = cls.spots >= cls.totalSpots;

  return (
    <div
      className={`rounded-xl p-3 border transition-all duration-300 ${
        isFull
          ? "bg-surface-container-high/50 border-on-surface/5 opacity-50"
          : isLow
          ? "bg-primary/10 border-primary/30 hover:border-primary/60"
          : "bg-surface-container border-on-surface/5 hover:border-primary/30"
      }`}
    >
      <p className="font-[family-name:var(--font-label-sm)] text-[10px] leading-[14px] md:text-[11px] md:leading-[15px] text-on-surface uppercase tracking-wider line-clamp-2 mb-1">
        {cls.name}
      </p>
      {cls.instructor && (
        <p className="font-[family-name:var(--font-label-sm)] text-[9px] leading-[12px] md:text-[10px] md:leading-[14px] text-on-surface-variant/70 uppercase tracking-wider">
          {cls.instructor}
        </p>
      )}
      <div className="flex items-center gap-1 mt-1.5">
        <div className="flex-1 h-1 rounded-full bg-surface-container-highest overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isFull ? "bg-on-surface-variant/30" : "bg-primary"
            }`}
            style={{
              width: `${(cls.spots / cls.totalSpots) * 100}%`,
            }}
          />
        </div>
        <span
          className={`font-[family-name:var(--font-label-sm)] text-[9px] leading-[12px] md:text-[10px] ${
            isFull ? "text-on-surface-variant/40" : "text-on-surface-variant"
          }`}
        >
          {cls.spots} de {cls.totalSpots}
        </span>
      </div>
    </div>
  );
}

export default function HorariosPage() {
  return (
    <>
      <main className="min-h-screen bg-background">
      {/* Header */}
      <section className="pt-24 pb-8 px-5 md:px-6">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-[family-name:var(--font-label-sm)] text-primary uppercase tracking-[0.15em] mb-3 text-[12px] leading-[16px]">
            Calendario de Entrenamientos
          </p>
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter mb-4">
            Horarios
          </h1>
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase">
              Julio 2026
            </span>
            <div className="h-px flex-1 bg-on-surface/10" />
          </div>
        </div>
      </section>

      {/* Schedule Grid */}
      <section className="pb-16 px-5 md:px-6">
        <div className="max-w-[1280px] mx-auto">
          {/* Day Headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] md:grid-cols-[80px_repeat(7,1fr)] gap-1.5 md:gap-2 mb-3">
            <div />
            {days.map((d) => (
              <div key={d.date} className="text-center">
                <p className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[10px] leading-[14px] md:text-[12px] md:leading-[16px] mb-0.5">
                  {d.short}
                </p>
                <p className="font-[family-name:var(--font-headline-md)] text-on-surface text-[16px] leading-[20px] md:text-[20px] md:leading-[24px]">
                  {d.date}
                </p>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] md:grid-cols-[80px_repeat(7,1fr)] gap-1.5 md:gap-2 mb-3">
            <div />
            {days.map((d) => (
              <div
                key={d.date}
                className="h-0.5 rounded-full bg-primary/40"
              />
            ))}
          </div>

          {/* Time Rows */}
          <div className="space-y-2 md:space-y-3">
            {schedule.map((slot) => (
              <div
                key={slot.time}
                className="grid grid-cols-[60px_repeat(7,1fr)] md:grid-cols-[80px_repeat(7,1fr)] gap-1.5 md:gap-2 items-start"
              >
                {/* Time Label */}
                <div className="pt-2 md:pt-3">
                  <span className="font-[family-name:var(--font-label-sm)] text-primary text-[12px] leading-[16px] md:text-[14px] md:leading-[18px] font-bold">
                    {slot.time}
                  </span>
                </div>

                {/* Day Cells */}
                {slot.schedule.map((cls, i) => (
                  <div key={i} className="min-h-[60px] md:min-h-[72px]">
                    {cls ? <ClassCard cls={cls} /> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-10 flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant text-[10px] leading-[14px] md:text-[11px] uppercase tracking-wider">
                Disponible
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary/40" />
              <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant text-[10px] leading-[14px] md:text-[11px] uppercase tracking-wider">
                Últimos cupos
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-on-surface-variant/30" />
              <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant text-[10px] leading-[14px] md:text-[11px] uppercase tracking-wider">
                Sin cupos
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12">
            <PageCTA />
          </div>
        </div>
      </section>
      </main>
      <Footer />
    </>
  );
}
