import { athleteInitials, findAthleteAvatar } from "@/lib/athlete-profile";

const SIZES = {
  sm: { box: "w-11 h-11", text: "text-[15px]", icon: 22, ring: "p-[2px]" },
  md: { box: "w-14 h-14", text: "text-[18px]", icon: 28, ring: "p-[2px]" },
  lg: { box: "w-20 h-20 md:w-24 md:h-24", text: "text-[26px] md:text-[30px]", icon: 44, ring: "p-[3px]" },
  xl: { box: "w-24 h-24 md:w-36 md:h-36", text: "text-[32px] md:text-[46px]", icon: 60, ring: "p-[3px] md:p-1" },
} as const;

// Avatar sin foto: el avatar ilustrado que eligió el alumno o sus
// iniciales, dentro de un anillo con el color del cinturón (o el
// degradado fuego→oro si no tiene grado).
export default function AthleteAvatar({
  name,
  ringColor,
  avatarKey,
  size = "md",
}: {
  name: string;
  ringColor?: string | null;
  avatarKey?: string | null;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const avatar = findAthleteAvatar(avatarKey);
  return (
    <div
      className={`${s.box} ${s.ring} rounded-full shrink-0`}
      style={{
        background: ringColor
          ? ringColor
          : "linear-gradient(135deg, #f9d27a 0%, #f2552a 55%, #b9230f 100%)",
      }}
      aria-hidden
    >
      <div className="w-full h-full rounded-full p-[2px] bg-background">
        {avatar ? (
          <div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{ background: avatar.background, color: avatar.color }}
          >
            {/* Tamaño en línea: la hoja de Material Symbols fija font-size: 24px. */}
            <span
              className="material-symbols-outlined"
              style={{ fontSize: s.icon, fontVariationSettings: "'FILL' 1, 'wght' 500" }}
            >
              {avatar.icon}
            </span>
          </div>
        ) : (
          <div
            className={`w-full h-full rounded-full flex items-center justify-center bg-surface-container-high text-on-surface font-[family-name:var(--font-headline-md)] ${s.text} uppercase`}
          >
            {athleteInitials(name)}
          </div>
        )}
      </div>
    </div>
  );
}
