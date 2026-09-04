"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import type { BankAccount } from "@/lib/payment-settings";

interface TransferPaymentStepProps {
  productType: "memberships" | "personalized" | "enrollment";
  amount: number;
  bank: BankAccount;
  beneficiaryId: string;
  planId?: string;
  includeEnrollment?: boolean;
  enrollmentPlanId?: string;
  onSuccess?: () => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const EXTRA_ALLOWED_TYPES = [
  "image/heic",
  "image/heif",
  "image/avif",
  "image/bmp",
  "image/jfif",
  "image/pjpeg",
  "image/svg+xml",
  "image/tiff",
  "application/x-pdf",
];
const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif", "bmp", "jfif", "pdf", "svg", "tif", "tiff"
];
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.8;

function isPdfFile(f: File): boolean {
  return f.type === "application/pdf" || f.type === "application/x-pdf" || f.name.toLowerCase().endsWith(".pdf");
}

async function compressImage(file: File): Promise<File> {
  if (isPdfFile(file)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
      img.src = url;
    });
    let { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return file;
    if (Math.max(w, h) > MAX_IMAGE_DIMENSION) {
      const ratio = MAX_IMAGE_DIMENSION / Math.max(w, h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", IMAGE_QUALITY)
    );
    if (blob && blob.size > 0 && blob.size < file.size) {
      const base = file.name.replace(/\.[^.]+$/, "") || "comprobante";
      return new File([blob], `${base}.webp`, { type: "image/webp" });
    }
    return file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function formatCLP(amount: number) {
  return "$" + amount.toLocaleString("es-CL");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export default function TransferPaymentStep({
  productType,
  amount,
  bank,
  beneficiaryId,
  planId,
  includeEnrollment,
  enrollmentPlanId,
  onSuccess,
}: TransferPaymentStepProps) {
  const { user } = useSession();
  const [rut, setRut] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("rut")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.rut) setRut(data.rut);
      });
  }, [user]);

  const handleFile = (f: File | null) => {
    setError(null);
    setFile(f);
    setPreviewUrl(null);
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    const isMimeOk = ALLOWED_TYPES.includes(f.type) || EXTRA_ALLOWED_TYPES.includes(f.type) || f.type.startsWith("image/");
    const isExtOk = ALLOWED_EXTENSIONS.includes(ext);
    if (!isMimeOk && !isExtOk) {
      setError("Formato no válido. Usa JPG, PNG, WebP, GIF o PDF.");
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("El comprobante supera 5MB.");
      setFile(null);
      return;
    }
    if (!isPdfFile(f) && ext !== "heic" && ext !== "heif") {
      try {
        setPreviewUrl(URL.createObjectURL(f));
      } catch {
        setPreviewUrl(null);
      }
    }
  };

  const handleCopy = async () => {
    const text = `${bank.bank_name || ""} ${bank.account_type || ""} ${bank.account_number || ""}`.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Debes adjuntar el comprobante de tu transferencia.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fileToSend = await compressImage(file);
      const fileBase64 = await fileToBase64(fileToSend);
      const res = await fetch("/api/payments/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType,
          planId,
          beneficiaryId,
          includeEnrollment,
          enrollmentPlanId,
          rut: rut.trim() || undefined,
          fileName: fileToSend.name,
          fileBase64,
        }),
      });

      let data: { error?: string; reference?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        setError(data?.error || `Error al enviar la solicitud (${res.status}). Intenta de nuevo.`);
        return;
      }

      setDone({ reference: data?.reference || "" });
      onSuccess?.();
    } catch {
      setError(
        "Sin respuesta del servidor. Tu solicitud pudo quedar registrada: revisa el estado en 'Mis solicitudes' antes de reintentar."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-green-400 text-[28px]">check_circle</span>
        </div>
        <div>
          <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">
            Solicitud enviada
          </h3>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mt-2">
            Tu comprobante está en revisión. Te avisaremos cuando el pago sea aprobado.
          </p>
          {done.reference && (
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mt-2">
              Referencia: <strong className="text-primary">{done.reference}</strong>
            </p>
          )}
        </div>
      </div>
    );
  }

  const bankRows = [
    bank.bank_name && ["Banco", bank.bank_name],
    bank.account_type && ["Tipo de cuenta", bank.account_type],
    bank.account_number && ["Número de cuenta", bank.account_number],
    bank.account_holder && ["Titular", bank.account_holder],
    bank.rut && ["RUT beneficiario", bank.rut],
    bank.email && ["Email", bank.email],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="space-y-4">
      {/* Bank data */}
      <div className="bg-surface-container rounded-xl p-4 border border-on-surface/5 space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
            Datos para transferir
          </p>
          {bank.account_number && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] font-[family-name:var(--font-label-sm)] text-primary hover:opacity-80 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copiado" : "Copiar"}
            </button>
          )}
        </div>
        {bankRows.length > 0 ? (
          <div className="space-y-1">
            {bankRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 font-[family-name:var(--font-body-md)] text-[13px]">
                <span className="text-on-surface-variant">{label}</span>
                <span className="text-on-surface text-right">{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
            La academia aún no configura los datos bancarios.
          </p>
        )}
        <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant/70 border-t border-on-surface/5 pt-2">
          Monto a transferir: <strong className="text-primary">{formatCLP(amount)}</strong>
        </p>
      </div>

      {/* RUT */}
      <div>
        <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
          Tu RUT (opcional)
        </label>
        <input
          value={rut}
          onChange={(e) => setRut(e.target.value)}
          placeholder="11.222.333-4"
          className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Voucher */}
      <div>
        <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
          Comprobante de transferencia *
        </label>
        <label onPointerDown={(e) => e.stopPropagation()} className="flex flex-col items-center justify-center gap-2 border border-dashed border-on-surface/20 rounded-xl py-6 px-4 cursor-pointer hover:border-primary/40 transition-colors">
          {previewUrl ? (
            <div className="flex flex-col items-center gap-2">
              <img src={previewUrl} alt="Comprobante" className="max-h-40 rounded-lg object-contain" />
              <span className="font-[family-name:var(--font-label-sm)] text-[11px] text-primary underline">Cambiar archivo</span>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center gap-1.5 text-center">
              <span className="material-symbols-outlined text-primary text-[36px]">
                {isPdfFile(file) ? "picture_as_pdf" : "image"}
              </span>
              <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface font-semibold max-w-xs truncate">
                {file.name}
              </span>
              <span className="font-[family-name:var(--font-label-sm)] text-[10px] text-on-surface-variant">
                {(file.size / (1024 * 1024)).toFixed(2)} MB · Clic para cambiar
              </span>
            </div>
          ) : (
            <>
              <span className="material-symbols-outlined text-on-surface-variant text-[28px]">upload_file</span>
              <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                Subir imagen o PDF (máx 5MB)
              </span>
              <span className="font-[family-name:var(--font-body-sm)] text-[10px] text-on-surface-variant/60">
                JPG, PNG, WebP, HEIC, PDF, etc.
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.bmp,.gif,.jfif"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>

      {error && (
        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-red-400 text-center">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !file}
        className="w-full btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider py-3 rounded-lg transition-opacity disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            Enviando...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[18px]">send</span>
            Enviar solicitud
          </>
        )}
      </button>

      <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant/50 text-center">
        Tu solicitud será revisada por la academia antes de activar el beneficio.
      </p>
    </div>
  );
}
