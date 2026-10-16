import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendRenewalRequestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const ROUTE_LOG = "[renewal-request]";

// Solicitud de renovación de membresía (migración 044). El RPC se llama con
// la sesión del usuario (auth.uid() y owns_beneficiary reales); el correo a
// los administradores va después, en segundo plano.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para continuar" }, { status: 401 });
  }

  let body: { beneficiaryId?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const beneficiaryId = String(body.beneficiaryId || "");
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
  if (!beneficiaryId) {
    return NextResponse.json({ error: "Falta el alumno" }, { status: 400 });
  }

  const { data: requestId, error } = await supabase.rpc("request_membership_renewal", {
    p_beneficiary_id: beneficiaryId,
    p_note: note,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  after(() => notifyAdmins(String(requestId), user.id));

  return NextResponse.json({ ok: true, requestId });
}

async function notifyAdmins(requestId: string, userId: string) {
  try {
    const admin = getAdminClient();

    const [{ data: req }, { data: profile }, { data: admins }] = await Promise.all([
      admin
        .from("membership_renewal_requests")
        .select("note, membership_plans(name)")
        .eq("id", requestId)
        .maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      admin.from("profiles").select("email").eq("role_id", 1),
    ]);

    const adminEmails = (admins || []).map((a) => a.email).filter((e): e is string => Boolean(e));
    const recipients = adminEmails.length ? adminEmails : process.env.SMTP_USER ? [process.env.SMTP_USER] : [];
    const reviewUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://zona-elite-six.vercel.app"}/admin/membresias?tab=membresias`;
    const planName = (req?.membership_plans as unknown as { name?: string } | null)?.name || "Plan";

    for (const to of recipients) {
      try {
        await sendRenewalRequestEmail({
          to,
          userName: profile?.full_name || "Alumno",
          planName,
          note: req?.note || null,
          reviewUrl,
        });
      } catch (emailErr) {
        console.error(ROUTE_LOG, "Email failed for", to, emailErr);
      }
    }
  } catch (err) {
    console.error(ROUTE_LOG, "Admin notification failed:", err);
  }
}
