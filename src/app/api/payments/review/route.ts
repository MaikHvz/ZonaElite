import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createMembershipForPayment,
  confirmPersonalizedPack,
  extendEnrollment,
  notifyUserPaymentStatus,
  notifyPaymentWithoutMembership,
} from "@/lib/flow-helpers";
import { FLOW_LOG_PREFIX } from "@/lib/flow";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const ROUTE_LOG = `${FLOW_LOG_PREFIX}/payments/review`;

interface ReviewBody {
  paymentId?: string;
  action?: "aprobar" | "rechazar";
  adminNote?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Inicia sesión para continuar" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role_id !== 1) {
      return NextResponse.json({ error: "Solo administradores pueden revisar solicitudes" }, { status: 403 });
    }

    const body = (await request.json()) as ReviewBody;
    const { paymentId, action, adminNote } = body;

    if (!paymentId) {
      return NextResponse.json({ error: "Pago es obligatorio" }, { status: 400 });
    }
    if (action !== "aprobar" && action !== "rechazar") {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: payment } = await admin
      .from("payments")
      .select("id, user_id, status, method, concept, beneficiary_id, membership_plan_id, personalized_plan_id, include_enrollment, enrollment_plan_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    }
    if (payment.method !== "transferencia") {
      return NextResponse.json({ error: "Este pago no es una solicitud de transferencia" }, { status: 400 });
    }
    if (payment.status !== "pendiente") {
      return NextResponse.json({ error: "Esta solicitud ya fue revisada" }, { status: 400 });
    }

    if (action === "rechazar") {
      const { data: updated } = await admin
        .from("payments")
        .update({
          status: "rechazado",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_note: adminNote || null,
        })
        .eq("id", paymentId)
        .eq("status", "pendiente")
        .select("id")
        .maybeSingle();

      if (!updated) {
        return NextResponse.json({ error: "La solicitud ya fue revisada" }, { status: 409 });
      }

      await notifyUserPaymentStatus(admin, payment, "rejected");
      console.log(ROUTE_LOG, "Transfer payment rejected:", paymentId);

      return NextResponse.json({ ok: true, status: "rechazado" });
    }

    // Aprobar: marca como pagado primero (guard de concurrencia) y luego asigna.
    const { data: locked } = await admin
      .from("payments")
      .update({
        status: "pagado",
        paid_at: new Date().toISOString(),
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .eq("status", "pendiente")
      .select("id")
      .maybeSingle();

    if (!locked) {
      return NextResponse.json({ error: "La solicitud ya fue revisada" }, { status: 409 });
    }

    let assignment: { success: boolean; error?: string } | null = null;

    if (payment.personalized_plan_id) {
      assignment = await confirmPersonalizedPack(admin, paymentId, payment.user_id, payment.personalized_plan_id);
    } else if (payment.membership_plan_id || payment.include_enrollment) {
      const results: { success: boolean; error?: string }[] = [];
      if (payment.membership_plan_id) {
        results.push(
          await createMembershipForPayment(admin, paymentId, payment.user_id, payment.membership_plan_id)
        );
      }
      if (payment.include_enrollment && payment.enrollment_plan_id && payment.beneficiary_id) {
        results.push(
          await extendEnrollment(admin, paymentId, payment.beneficiary_id, payment.enrollment_plan_id)
        );
      }
      assignment = results.find((r) => !r.success) || null;
    }

    if (assignment && !assignment.success) {
      console.error(ROUTE_LOG, "Assignment failed after approval:", paymentId, assignment.error);
      await notifyPaymentWithoutMembership(admin, payment, assignment.error || "Asignación fallida");
      return NextResponse.json(
        { error: "El pago quedó aprobado pero no se pudo asignar el beneficio. Revisa manualmente." },
        { status: 500 }
      );
    }

    await notifyUserPaymentStatus(admin, payment, "approved");
    console.log(ROUTE_LOG, "Transfer payment approved:", paymentId);

    return NextResponse.json({ ok: true, status: "pagado" });
  } catch (error) {
    console.error(ROUTE_LOG, "Unexpected error:", error);
    return NextResponse.json(
      { error: "Error al revisar la solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
