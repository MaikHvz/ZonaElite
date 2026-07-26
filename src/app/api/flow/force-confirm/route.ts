import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { FLOW_LOG_PREFIX } from "@/lib/flow";
import { confirmAndCreateMembership, markPaymentAsPaid } from "@/lib/flow-helpers";

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
    await confirmAndCreateMembership(admin, paymentId, payment.user_id);

    console.log(`${FORCE_LOG} payment ${paymentId} force-confirmed successfully`);

    return NextResponse.json({ success: true, message: "Payment force-confirmed" });
  } catch (err) {
    console.error(`${FORCE_LOG} error`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
