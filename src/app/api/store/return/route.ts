import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Flow devuelve al comercio con GET (query `token`) en el flujo KPF y con POST
// (body `token`) en la página legacy pay.php. Las páginas de Next.js solo
// aceptan GET (405 para el resto), así que este route handler normaliza ambas
// variantes a una redirección 303 hacia `/tienda/confirmacion?token=...`.
function redirectToConfirmacion(token: string, origin: string): NextResponse {
  const target = token
    ? `/tienda/confirmacion?token=${encodeURIComponent(token)}`
    : "/tienda/confirmacion";
  return NextResponse.redirect(new URL(target, origin), 303);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return redirectToConfirmacion(searchParams.get("token") || "", request.url);
}

export async function POST(request: Request) {
  let token = "";
  try {
    const form = await request.formData();
    token = String(form.get("token") || "");
  } catch {
    try {
      const text = await request.text();
      const match = text.match(/token=([^&\s]+)/);
      if (match) token = decodeURIComponent(match[1]);
    } catch {
      // Sin body parseable — se redirige sin token.
    }
  }
  return redirectToConfirmacion(token, request.url);
}
