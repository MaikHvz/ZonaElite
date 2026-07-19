import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  verifyFlowPayment,
  FLOW_LOG_PREFIX,
} from "@/lib/flow";
import {
  findPaymentByToken,
  confirmAndCreateMembership,
  markPaymentAsPaid,
} from "@/lib/flow-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FORCE_LOG = `${FLOW_LOG_PREFIX}/force-confirm`;

export async function POST(request: Request) {
  const body = await request.json();
  const { token } = body as { token?: string };

  if (!token) {
    return NextResponse.json(
      { error: "Token requerido en body JSON" },
      { status: 400 }
    );
  }

  const results: Record<string, unknown> = { token };

  const admin = getAdminClient();

  const payment = await findPaymentByToken(admin, token);

  if (!payment) {
    results.error = "Pago no encontrado con ese token en la DB";
    return NextResponse.json(results, { status: 200 });
  }

  results.payment = {
    id: payment.id,
    status: payment.status,
    userId: payment.user_id,
    beneficiaryId: payment.beneficiary_id,
    membershipId: payment.membership_id,
    concept: payment.concept,
  };

  if (payment.status === "pagado") {
    results.note = "Ya esta pagado. Verificando membresia...";

    if (!payment.membership_id) {
      const membershipResult = await confirmAndCreateMembership(
        admin,
        payment.id,
        payment.user_id
      );
      results.membershipResult = membershipResult;
    } else {
      results.note = "Ya tiene membership asociada";
    }

    return NextResponse.json(results, { status: 200 });
  }

  try {
    const flowResult = await verifyFlowPayment(token);
    results.flowStatus = flowResult.status;
    results.flowOrder = flowResult.flowOrder;

    if (flowResult.status === 2) {
      await markPaymentAsPaid(admin, payment.id, token, flowResult.flowOrder);

      const membershipResult = await confirmAndCreateMembership(
        admin,
        payment.id,
        payment.user_id
      );

      results.action = "CONFIRMED";
      results.membershipResult = membershipResult;
    } else {
      results.action = "NOT_PAID_IN_FLOW";
      results.note = `Flow returned status ${flowResult.status}. The user may not have completed payment.`;
    }
  } catch (err) {
    results.flowError = err instanceof Error ? err.message : String(err);
    results.action = "FLOW_API_ERROR";
  }

  return NextResponse.json(results, { status: 200 });
}
