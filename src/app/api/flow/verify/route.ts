import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyFlowPayment, FLOW_LOG_PREFIX } from "@/lib/flow";
import {
  confirmAndCreateMembership,
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

    const payment = await findPaymentByTokenAndUser(admin, token, user.id);

    if (!payment) {
      return NextResponse.json({ status: "not_found" });
    }

    if (payment.status === "pagado") {
      return NextResponse.json({ status: "pagado" });
    }

    try {
      const verification = await verifyFlowPayment(token);

      if (verification.status === 2) {
        await markPaymentAsPaid(
          admin,
          payment.id,
          token,
          verification.flowOrder
        );

        const result = await confirmAndCreateMembership(
          admin,
          payment.id,
          user.id
        );

        if (!result.success) {
          console.error(VERIFY_LOG, "Membership creation failed:", result.error);
        }

        return NextResponse.json({ status: "pagado" });
      }

      if (verification.status === 4) {
        await admin
          .from("payments")
          .update({ status: "cancelado" })
          .eq("id", payment.id);
        return NextResponse.json({ status: "cancelado" });
      }

      return NextResponse.json({ status: payment.status });
    } catch {
      return NextResponse.json({ status: payment.status });
    }
  } catch {
    return NextResponse.json({ status: "error" });
  }
}
