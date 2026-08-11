interface BeltBannerProps {
  color: string;
  className?: string;
  opacity?: number;
  id?: string;
}

/**
 * Cinturón decorativo realista usado como fondo de las cards deportivas.
 * Incluye textura de costuras y un nudo central con extremos colgantes.
 */
export default function BeltBanner({
  color,
  className = "",
  opacity = 0.25,
  id,
}: BeltBannerProps) {
  return (
    <div
      id={id}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <span
        className="material-symbols-outlined absolute -right-4 -bottom-6 select-none leading-none z-0"
        style={{
          color,
          fontSize: "160px",
          opacity: opacity * 0.4,
          transform: "rotate(-10deg)",
        }}
      >
        sports_martial_arts
      </span>
      <div className="absolute inset-0 flex items-center justify-center z-0">
        <div
          className="absolute w-full flex items-center justify-center"
          style={{ opacity, transform: "rotate(-3deg) scale(1.05)" }}
        >
          {/* Banda principal del cinturón */}
          <div
            className="absolute w-[120%] h-10"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 15px 3px ${color}50, inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)`,
            }}
          >
            {/* Costuras */}
            <div className="absolute inset-x-0 top-[20%] border-t border-black/20" />
            <div className="absolute inset-x-0 top-[40%] border-t border-black/20" />
            <div className="absolute inset-x-0 top-[60%] border-t border-black/20" />
            <div className="absolute inset-x-0 top-[80%] border-t border-black/20" />
          </div>

          {/* Nudo central y extremos */}
          <div className="relative flex items-center justify-center translate-y-1">
            {/* Extremo izquierdo */}
            <div
              className="absolute w-9 h-20 -bottom-16 -left-6 origin-top-right rounded-b-sm"
              style={{
                backgroundColor: color,
                transform: "rotate(20deg)",
                boxShadow: `inset -2px 0 5px rgba(0,0,0,0.3), 0 4px 8px ${color}40`,
              }}
            >
              <div className="absolute inset-x-0 top-[20%] border-t border-black/20" />
              <div className="absolute inset-x-0 top-[40%] border-t border-black/20" />
              <div className="absolute inset-x-0 top-[60%] border-t border-black/20" />
              <div className="absolute inset-x-0 top-[80%] border-t border-black/20" />
            </div>

            {/* Extremo derecho */}
            <div
              className="absolute w-9 h-24 -bottom-20 -right-5 origin-top-left rounded-b-sm"
              style={{
                backgroundColor: color,
                transform: "rotate(-12deg)",
                boxShadow: `inset 2px 0 5px rgba(0,0,0,0.3), 0 4px 8px ${color}40`,
              }}
            >
              <div className="absolute inset-x-0 top-[20%] border-t border-black/20" />
              <div className="absolute inset-x-0 top-[40%] border-t border-black/20" />
              <div className="absolute inset-x-0 top-[60%] border-t border-black/20" />
              <div className="absolute inset-x-0 top-[80%] border-t border-black/20" />
            </div>

            {/* Nudo */}
            <div
              className="w-12 h-12 rotate-45 rounded-sm relative z-10"
              style={{
                backgroundColor: color,
                boxShadow: `inset 0 0 10px rgba(0,0,0,0.5), 0 4px 10px ${color}60`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/20" />
              <div className="absolute w-full h-[1px] bg-black/30 top-1/2 -translate-y-1/2 rotate-[-45deg]" />
              <div className="absolute w-[1px] h-full bg-black/20 left-1/2 -translate-x-1/2 rotate-[-45deg]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
