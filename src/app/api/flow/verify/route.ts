import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyFlowPayment, mapFlowStatus, FLOW_LOG_PREFIX } from "@/lib/flow";
import {
  confirmAndCreateMembership,
  extendEnrollment,
  markPaymentAsPaid,
  findPaymentByTokenAndUser,
  isVerificationOrderMatch,
  notifyPaymentWithoutMembership,
} from "@/lib/flow-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const VERIFY_LOG = `${FLOW_LOG_PREFIX}/verify`;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const admin = getAdminClient();

    // Helper to get summary response
    const buildSuccessResponse = async (payment: any) => {
      let beneficiaryName = "Titular";
      if (payment.beneficiary_id) {
        const { data: ben } = await admin
          .from("beneficiaries")
          .select("profiles(full_name), dependents(full_name)")
          .eq("id", payment.beneficiary_id)
          .maybeSingle();
        if (ben) {
          beneficiaryName = (ben.profiles as any)?.full_name || (ben.dependents as any)?.full_name || "Titular";
        }
      }

      return NextResponse.json({
        status: "pagado",
        payment: {
          concept: payment.concept || "Membresía Academia",
          amount: payment.amount,
          orderId: payment.order_id || payment.commerce_order || payment.id.slice(0, 8),
          paidAt: payment.paid_at || payment.created_at,
          beneficiaryName,
        },
      });
    };

    // Fetch payment with enrollment fields
    const { data: fullPayment } = await admin
      .from("payments")
      .select("id, user_id, commerce_order, order_id, amount, status, concept, paid_at, created_at, flow_token, flow_order, beneficiary_id, membership_id, include_enrollment, enrollment_plan_id")
      .eq("flow_token", token)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!fullPayment) {
      return NextResponse.json({ status: "not_found" });
    }

    if (fullPayment.status === "pagado") {
      return await buildSuccessResponse(fullPayment);
    }

    try {
      const verification = await verifyFlowPayment(token);

      if (verification.status === 2) {
        if (!isVerificationOrderMatch(fullPayment.commerce_order, verification.commerceOrder)) {
          console.error(VERIFY_LOG, "commerceOrder mismatch — descartando:", {
            flowOrder: verification.commerceOrder,
            paymentOrder: fullPayment.commerce_order,
            token,
          });
          return NextResponse.json({ status: fullPayment.status });
        }

        await markPaymentAsPaid(
          admin,
          fullPayment.id,
          token,
          verification.flowOrder
        );

        // Create membership if concept includes "membresía"
        const hasMembershipConcept = fullPayment.concept && /membres[íi]a/i.test(fullPayment.concept);
        if (hasMembershipConcept) {
          const result = await confirmAndCreateMembership(
            admin,
            fullPayment.id,
            user.id
          );

          if (!result.success) {
            console.error(VERIFY_LOG, "Membership creation failed:", result.error);
            await notifyPaymentWithoutMembership(admin, fullPayment, result.error || "Error al crear membresía");
          }
        }

        // Handle enrollment extension if included in payment
        if (fullPayment.include_enrollment && fullPayment.enrollment_plan_id && fullPayment.beneficiary_id) {
          const enrollResult = await extendEnrollment(
            admin,
            fullPayment.id,
            fullPayment.beneficiary_id,
            fullPayment.enrollment_plan_id
          );
          if (!enrollResult.success) {
            console.error(VERIFY_LOG, "Enrollment extension failed:", enrollResult.error);
          }
        }

        return await buildSuccessResponse(fullPayment);
      }

      // B-018: flujo no aprobado — actualizar el estado del pago en la BD
      const mapped = mapFlowStatus(verification.status);

      if (mapped === "rechazado" || mapped === "cancelado") {
        await admin
          .from("payments")
          .update({ status: mapped })
          .eq("id", fullPayment.id);
      }

      return NextResponse.json({ status: mapped });
    } catch {
      return NextResponse.json({ status: fullPayment.status });
    }
  } catch {
    return NextResponse.json({ status: "error" });
  }
}
