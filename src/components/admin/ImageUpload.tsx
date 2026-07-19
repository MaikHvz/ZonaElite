"use client";

import { useRef, useState, useCallback } from "react";
import { uploadImage, deleteImage } from "@/lib/supabase/storage";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  label?: string;
  required?: boolean;
}

type Mode = "drop" | "url";

export default function ImageUpload({ value, onChange, folder, label = "Imagen", required = false }: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("drop");
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  }, [folder, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setUrlInput("");
  };

  const handleRemove = async () => {
    if (value) {
      try { await deleteImage(value); } catch { /* ignore */ }
    }
    onChange(null);
  };

  return (
    <div>
      <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
        {label} {required && "*"}
      </label>

      {/* Preview */}
      {value && (
        <div className="relative mb-3 inline-block">
          <img src={value} alt="" className="h-32 rounded-lg object-cover border border-on-surface/10" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {!value && (
        <div className="space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("drop")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] uppercase tracking-wider font-[family-name:var(--font-label-sm)] transition-colors cursor-pointer ${
                mode === "drop"
                  ? "btn-primary-gradient text-white"
                  : "border border-on-surface/10 text-on-surface-variant hover:border-primary/50"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">upload</span>
              Subir archivo
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] uppercase tracking-wider font-[family-name:var(--font-label-sm)] transition-colors cursor-pointer ${
                mode === "url"
                  ? "btn-primary-gradient text-white"
                  : "border border-on-surface/10 text-on-surface-variant hover:border-primary/50"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">link</span>
              Pegar URL
            </button>
          </div>

          {/* Drop zone */}
          {mode === "drop" && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-on-surface/10 hover:border-primary/30"
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="text-[13px] text-on-surface-variant">Subiendo...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface/30 text-[40px]">cloud_upload</span>
                  <span className="text-[13px] text-on-surface-variant">
                    Arrastra una imagen aquí o haz clic para seleccionar
                  </span>
                  <span className="text-[11px] text-on-surface-variant/50">JPG, PNG, WebP o GIF — Máx. 5MB</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileInput} className="hidden" />
            </div>
          )}

          {/* URL input */}
          {mode === "url" && (
            <div className="flex gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="flex-1 bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[13px] disabled:opacity-50 cursor-pointer"
              >
                Usar
              </button>
            </div>
          )}
        </div>
      )}

      {value && (
        <button
          type="button"
          onClick={() => { setMode("drop"); handleRemove(); }}
          className="text-[12px] text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer mt-1"
        >
          Cambiar imagen
        </button>
      )}

      {error && (
        <p className="text-red-400 text-[12px] mt-1">{error}</p>
      )}
    </div>
  );
}
