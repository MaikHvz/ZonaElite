interface BeltBannerProps {
  color: string;
  className?: string;
  height?: string;
  opacity?: number;
  id?: string;
}

/**
 * Cinturón decorativo (banda + nudo) usado como fondo de las cards
 * deportivas. Recibe el color desde la BD (belt_grades.color): no hay
 * lógica de color hardcodeada en los componentes.
 */
export default function BeltBanner({
  color,
  className = "",
  height = "clamp(56px, 22%, 96px)",
  opacity = 0.22,
  id,
}: BeltBannerProps) {
  return (
    <div
      id={id}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
    >
      <div
        className="w-[130%] rounded-full relative"
        style={{
          height,
          backgroundColor: color,
          opacity,
          boxShadow: `0 0 40px 12px ${color}33`,
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ opacity: 1 }}
        >
          <div className="relative flex items-center justify-center" style={{ height, width: height }}>
            <div
              className="absolute w-1/3 h-full rounded-full"
              style={{ backgroundColor: color, transform: "rotate(18deg)" }}
            />
            <div
              className="absolute w-1/3 h-full rounded-full"
              style={{ backgroundColor: color, transform: "rotate(-18deg)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
