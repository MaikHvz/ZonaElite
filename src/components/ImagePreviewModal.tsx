"use client";

import { useEffect, useCallback } from "react";

interface ImagePreviewModalProps {
  open: boolean;
  imageUrl: string;
  title: string;
  fileName?: string;
  onClose: () => void;
}

function downloadFileName(url: string, fallback: string): string {
  const last = url.split("/").pop();
  if (last && /\.\w{2,5}(\?|$)/.test(last)) return last.split("?")[0];
  return fallback;
}

function buildDownloadUrl(url: string, fileName: string): string {
  if (url.includes("/storage/v1/object/public/")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}download=${encodeURIComponent(fileName)}`;
  }
  return url;
}

export default function ImagePreviewModal({ open, imageUrl, title, fileName, onClose }: ImagePreviewModalProps) {
  const name = fileName || downloadFileName(imageUrl, "imagen");
  const downloadUrl = buildDownloadUrl(imageUrl, name);
  const isStorageUrl = imageUrl.includes("/storage/v1/object/public/");

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [open]);

  useEffect(() => {
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, handleEsc]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4 md:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-5xl max-h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider text-white/70 truncate">
            {title}
          </p>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-black/60 border border-white/10 text-white/80 hover:text-white hover:border-white/30 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Cerrar vista previa"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Image */}
        <div className="flex-1 min-h-0 flex items-center justify-center bg-black/40 border border-white/10 rounded-xl overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-[60vh] md:max-h-[68vh] w-auto h-auto object-contain"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-white/85 hover:bg-white/5 transition-colors text-[14px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
            Cerrar
          </button>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={isStorageUrl ? undefined : name}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-primary-gradient text-white text-[14px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Descargar
          </a>
        </div>
      </div>
    </div>
  );
}