import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyFlowPayment } from "@/lib/flow";

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

    // Buscar el pago
    const { data: payment } = await supabase
      .from("payments")
      .select("id, status, flow_token, commerce_order")
      .eq("flow_token", token)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!payment) {
      // Intentar por commerceOrder
      const { data: payment2 } = await supabase
        .from("payments")
        .select("id, status, flow_token, commerce_order")
        .eq("user_id", user.id)
        .eq("method", "flow")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!payment2) {
        return NextResponse.json({ status: "not_found" });
      }

      if (payment2.status === "pagado") {
        return NextResponse.json({ status: "pagado" });
      }

      // Verificar con Flow
      try {
        const verification = await verifyFlowPayment(token);
        if (verification.status === 2) {
          await supabase
            .from("payments")
            .update({
              status: "pagado",
              paid_at: new Date().toISOString(),
              flow_token: token,
              flow_order: verification.flowOrder || null,
            })
            .eq("id", payment2.id);

          // Crear membresía si no existe
          await createMembership(supabase, payment2.id, user.id);

          return NextResponse.json({ status: "pagado" });
        }
      } catch {
        // Flow verification failed
      }

      return NextResponse.json({ status: payment2.status });
    }

    if (payment.status === "pagado") {
      return NextResponse.json({ status: "pagado" });
    }

    // Verificar con Flow API
    try {
      const verification = await verifyFlowPayment(token);
      if (verification.status === 2) {
        await supabase
          .from("payments")
          .update({
            status: "pagado",
            paid_at: new Date().toISOString(),
            flow_order: verification.flowOrder || null,
          })
          .eq("id", payment.id);

        await createMembership(supabase, payment.id, user.id);

        return NextResponse.json({ status: "pagado" });
      } else if (verification.status === 4) {
        await supabase
          .from("payments")
          .update({ status: "cancelado" })
          .eq("id", payment.id);
        return NextResponse.json({ status: "cancelado" });
      }
    } catch {
      // Flow verification failed, keep current status
    }

    return NextResponse.json({ status: payment.status });
  } catch (error) {
    console.error("Flow verify error:", error);
    return NextResponse.json({ status: "error" });
  }
}

async function createMembership(
  supabase: any,
  paymentId: string,
  userId: string
) {
  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, concept, membership_id")
    .eq("id", paymentId)
    .single();

  if (!payment || payment.membership_id) return;

  const metadataMatch = payment.concept?.match(/^Membresía\s+(.+)$/);
  const planName = metadataMatch ? metadataMatch[1].trim() : null;
  if (!planName) return;

  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, duration_days")
    .ilike("name", planName)
    .single();
  if (!plan) return;

  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("purchased_by", userId)
    .eq("plan_id", plan.id)
    .eq("status", "activa")
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .maybeSingle();

  if (existing) {
    await supabase
      .from("payments")
      .update({ membership_id: existing.id })
      .eq("id", paymentId);
    return;
  }

  const { data: ownBeneficiary } = await supabase
    .from("beneficiaries")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (!ownBeneficiary) return;

  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + plan.duration_days * 86400000)
    .toISOString()
    .split("T")[0];

  const { data: membership } = await supabase
    .from("memberships")
    .insert({
      beneficiary_id: ownBeneficiary.id,
      plan_id: plan.id,
      purchased_by: userId,
      start_date: today,
      end_date: endDate,
      status: "activa",
    })
    .select("id")
    .single();

  if (membership) {
    await supabase
      .from("payments")
      .update({ membership_id: membership.id })
      .eq("id", paymentId);
  }
}
