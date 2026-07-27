import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyFlowPayment, FLOW_LOG_PREFIX } from "@/lib/flow";
import {
  confirmAndCreateMembership,
  extendEnrollment,
  markPaymentAsPaid,
  findPaymentByTokenAndUser,
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

    // Fetch payment with enrollment fields
    const { data: fullPayment } = await admin
      .from("payments")
      .select("id, user_id, commerce_order, status, concept, flow_token, flow_order, beneficiary_id, membership_id, include_enrollment, enrollment_plan_id")
      .eq("flow_token", token)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!fullPayment) {
      return NextResponse.json({ status: "not_found" });
    }

    if (fullPayment.status === "pagado") {
      return NextResponse.json({ status: "pagado" });
    }

    try {
      const verification = await verifyFlowPayment(token);

      if (verification.status === 2) {
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

        return NextResponse.json({ status: "pagado" });
      }

      if (verification.status === 4) {
        await admin
          .from("payments")
          .update({ status: "cancelado" })
          .eq("id", fullPayment.id);
        return NextResponse.json({ status: "cancelado" });
      }

      return NextResponse.json({ status: fullPayment.status });
    } catch {
      return NextResponse.json({ status: fullPayment.status });
    }
  } catch {
    return NextResponse.json({ status: "error" });
  }
}
