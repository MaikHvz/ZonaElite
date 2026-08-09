import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { FLOW_LOG_PREFIX } from "@/lib/flow";
import { confirmAndCreateMembership, confirmPersonalizedPack, extendEnrollment, markPaymentAsPaid, notifyPaymentWithoutMembership, notifyUserPaymentStatus } from "@/lib/flow-helpers";
import { isStorePayment, handleStorePaymentApproved } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const FORCE_LOG = `${FLOW_LOG_PREFIX}/force-confirm`;

export async function POST(request: Request) {
  try {
    const admin = getAdminClient();
    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId required" }, { status: 400 });
    }

    console.log(`${FORCE_LOG} attempting force-confirm for payment ${paymentId}`);

    const { data: payment, error: fetchError } = await admin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "pagado") {
      return NextResponse.json({ success: true, message: "Already paid" });
    }

    await markPaymentAsPaid(admin, paymentId, "force-confirm", undefined);

    // Only call confirmAndCreateMembership if concept includes membership
    const hasMembership = /membres[íi]a/i.test(payment.concept || "");
    let assignedSomething = false;
    if (hasMembership) {
      const result = await confirmAndCreateMembership(admin, paymentId, payment.user_id);
      if (result.success) {
        assignedSomething = true;
      } else {
        console.error(`${FORCE_LOG} membership creation failed:`, result.error);
        await notifyPaymentWithoutMembership(admin, payment, result.error || "Error al crear membresía");
      }
    }

    // Handle enrollment if included in payment record
    if (payment.include_enrollment && payment.enrollment_plan_id && payment.beneficiary_id) {
      const enrollResult = await extendEnrollment(
        admin,
        paymentId,
        payment.beneficiary_id,
        payment.enrollment_plan_id
      );
      if (enrollResult.success) {
        assignedSomething = true;
      } else {
        console.error(`${FORCE_LOG} enrollment extension failed:`, enrollResult.error);
      }
    }

    // Clases personalizadas (módulo desacoplado): concepto "Clase Personalizada X"
    const hasPersonalizedConcept = /^Clase Personalizad[ao]/i.test(payment.concept || "");
    if (hasPersonalizedConcept) {
      const packResult = await confirmPersonalizedPack(admin, paymentId, payment.user_id);
      if (packResult.success) {
        assignedSomething = true;
      } else {
        console.error(`${FORCE_LOG} personalized pack creation failed:`, packResult.error);
        await notifyPaymentWithoutMembership(admin, payment, packResult.error || "Error al crear pack personalizado");
      }
    }

    // Tienda (módulo desacoplado): pago con order_id + concepto "Tienda: ...".
    if (isStorePayment(payment)) {
      const storeResult = await handleStorePaymentApproved(admin, payment);
      if (storeResult.success) {
        assignedSomething = true;
      } else {
        console.error(`${FORCE_LOG} store order confirmation failed:`, storeResult.error);
      }
    }

    if (assignedSomething) {
      await notifyUserPaymentStatus(admin, payment, "approved");
    }

    console.log(`${FORCE_LOG} payment ${paymentId} force-confirmed successfully`);

    return NextResponse.json({ success: true, message: "Payment force-confirmed" });
  } catch (err) {
    console.error(`${FORCE_LOG} error`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
