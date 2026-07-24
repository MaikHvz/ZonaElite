import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createFlowOrder, getFlowConfig, verifyFlowPayment, FLOW_LOG_PREFIX } from "@/lib/flow";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const ROUTE_LOG = `${FLOW_LOG_PREFIX}/create-order`;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Inicia sesión para continuar" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { planId, beneficiaryId } = body;

    if (!planId || !beneficiaryId) {
      return NextResponse.json(
        { error: "Plan y beneficiario son obligatorios" },
        { status: 400 }
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("membership_plans")
      .select("id, name, price, duration_days, active")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan no encontrado" },
        { status: 400 }
      );
    }

    if (!plan.active) {
      return NextResponse.json(
        { error: "Plan no disponible" },
        { status: 400 }
      );
    }

    const { data: beneficiary, error: benError } = await supabase
      .from("beneficiaries")
      .select("id, profile_id, dependent_id")
      .eq("id", beneficiaryId)
      .single();

    if (benError || !beneficiary) {
      return NextResponse.json(
        { error: "Beneficiario no válido" },
        { status: 400 }
      );
    }

    if (beneficiary.profile_id) {
      if (beneficiary.profile_id !== user.id) {
        return NextResponse.json(
          { error: "Beneficiario no válido" },
          { status: 400 }
        );
      }
    } else if (beneficiary.dependent_id) {
      const { data: dependent } = await supabase
        .from("dependents")
        .select("id")
        .eq("id", beneficiary.dependent_id)
        .eq("tutor_id", user.id)
        .single();

      if (!dependent) {
        return NextResponse.json(
          { error: "Beneficiario no válido" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Beneficiario no válido" },
        { status: 400 }
      );
    }

    const commerceOrder = crypto.randomUUID();

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingPending } = await supabase
      .from("payments")
      .select("id, flow_token")
      .eq("user_id", user.id)
      .eq("status", "pendiente")
      .eq("method", "flow")
      .gte("created_at", fiveMinAgo)
      .maybeSingle();

    if (existingPending?.flow_token) {
      try {
        const verifyRes = await verifyFlowPayment(existingPending.flow_token);
        if (verifyRes.status === 2) {
          await supabase
            .from("payments")
            .update({ status: "pagado", paid_at: new Date().toISOString() })
            .eq("id", existingPending.id);
        }
      } catch {
        // Keep as pending — will require manual verification
      }

      const { apiUrl } = getFlowConfig();
      const flowPaymentUrl = apiUrl.replace(/\/api\/?$/, "/payment") + "?token=" + encodeURIComponent(existingPending.flow_token);

      return NextResponse.json({
        url: flowPaymentUrl,
        token: existingPending.flow_token,
        reused: true,
      });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        beneficiary_id: beneficiary.id,
        commerce_order: commerceOrder,
        concept: `Membresía ${plan.name}`,
        amount: plan.price,
        method: "flow",
        status: "pendiente",
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Error al procesar pago" },
        { status: 500 }
      );
    }

    const flowResponse = await createFlowOrder({
      commerceOrder,
      subject: `Membresía ${plan.name} - ZONAELITE`,
      amount: plan.price,
      email: user.email || "",
      metadata: {
        paymentId: payment.id,
        planId: plan.id,
        beneficiaryId: beneficiary.id,
      },
    });

    await supabase
      .from("payments")
      .update({
        flow_token: flowResponse.token,
        flow_order: flowResponse.flowOrder,
      })
      .eq("id", payment.id);

    return NextResponse.json({
      url: flowResponse.url,
      token: flowResponse.token,
    });
  } catch (error) {
    console.error(ROUTE_LOG, "Unexpected error:", error);
    return NextResponse.json(
      { error: "Error al procesar pago. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
