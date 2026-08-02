"use client";

interface PaymentErrorModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

export default function PaymentErrorModal({
  open,
  onClose,
  title,
  description,
}: PaymentErrorModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-surface-container-lowest border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fondo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Ícono */}
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-rose-600 p-0.5 shadow-lg shadow-red-500/30 mb-4 animate-bounce-short">
            <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center">
              <span className="material-symbols-outlined text-[44px] text-red-400">
                error
              </span>
            </div>
          </div>

          <h2 className="font-[family-name:var(--font-headline-lg)] text-[24px] sm:text-[28px] text-on-surface uppercase tracking-tight font-bold">
            Pago <span className="text-red-400">No Realizado</span>
          </h2>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] sm:text-[14px] text-on-surface-variant mt-1">
            {title}
          </p>
          <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant/80 mt-1">
            {description}
          </p>

          <button
            onClick={onClose}
            className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 text-white font-[family-name:var(--font-headline-md)] text-[12px] uppercase tracking-wider text-center font-bold shadow-lg shadow-red-500/20 hover:brightness-110 transition-all cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
