import { createClient } from "./client";

const BUCKET = "public";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function extFromMime(type: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[type] || "jpg";
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Formato no válido. Usa JPG, PNG, WebP o GIF.";
  if (file.size > MAX_SIZE) return "El archivo supera 5MB.";
  return null;
}

export async function uploadImage(file: File, folder: string): Promise<string> {
  const error = validateFile(file);
  if (error) throw new Error(error);

  const supabase = createClient();
  const ext = extFromMime(file.type);
  const id = crypto.randomUUID();
  const path = `${folder}/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteImage(url: string): Promise<void> {
  if (!url) return;
  const supabase = createClient();

  const idx = url.indexOf("/storage/v1/object/public/");
  if (idx === -1) return;

  const afterPrefix = url.slice(idx + "/storage/v1/object/public/".length);
  const path = afterPrefix.replace(`${BUCKET}/`, "");

  await supabase.storage.from(BUCKET).remove([path]);
}

export function getImagePath(url: string): string | null {
  if (!url) return null;
  const idx = url.indexOf("/storage/v1/object/public/");
  if (idx === -1) return null;
  const afterPrefix = url.slice(idx + "/storage/v1/object/public/".length);
  return afterPrefix.replace(`${BUCKET}/`, "");
}
