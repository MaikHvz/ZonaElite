"use client";

interface DeleteConfirmProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmLabel?: string;
}

export default function DeleteConfirm({ open, title, message, onConfirm, onCancel, loading, confirmLabel = "Eliminar" }: DeleteConfirmProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-400 text-[24px]">warning</span>
          </div>
          <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase">
            {title}
          </h2>
        </div>
        <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mb-6">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors font-[family-name:var(--font-body-md)] text-[14px] disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-[family-name:var(--font-body-md)] text-[14px] disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
