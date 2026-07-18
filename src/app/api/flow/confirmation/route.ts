import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyFlowPayment } from "@/lib/flow";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let token: string | null = null;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      token = params.get("token");
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      token = body.token;
    }

    if (!token) {
      return new Response("OK", { status: 200 });
    }

    let verification;
    try {
      verification = await verifyFlowPayment(token);
    } catch (e) {
      console.error("Flow callback: verification failed", e);
      return new Response("OK", { status: 200 });
    }

    if (verification.status !== 2) {
      return new Response("OK", { status: 200 });
    }

    const supabase = await createClient();

    // Buscar pago por flow_token O por commerceOrder
    let payment = null;

    const { data: byToken } = await supabase
      .from("payments")
      .select("id, user_id, commerce_order, status, amount, concept, flow_token")
      .eq("flow_token", token)
      .maybeSingle();

    if (byToken) {
      payment = byToken;
    } else if (verification.commerceOrder) {
      const { data: byCommerce } = await supabase
        .from("payments")
        .select("id, user_id, commerce_order, status, amount, concept, flow_token")
        .eq("commerce_order", verification.commerceOrder)
        .maybeSingle();
      if (byCommerce) payment = byCommerce;
    }

    if (!payment) {
      console.error("Flow callback: payment not found for token:", token);
      return new Response("OK", { status: 200 });
    }

    if (payment.status === "pagado") {
      return new Response("OK", { status: 200 });
    }

    // Actualizar pago a pagado
    await supabase
      .from("payments")
      .update({
        status: "pagado",
        paid_at: new Date().toISOString(),
        flow_token: payment.flow_token || token,
        flow_order: verification.flowOrder || null,
      })
      .eq("id", payment.id);

    // Buscar plan desde el concepto: "Membresía PlanName"
    const metadataMatch = payment.concept?.match(/^Membresía\s+(.+)$/);
    const planName = metadataMatch ? metadataMatch[1].trim() : null;

    if (!planName) {
      console.error("Flow callback: could not extract plan name from:", payment.concept);
      return new Response("OK", { status: 200 });
    }

    const { data: plan } = await supabase
      .from("membership_plans")
      .select("id, duration_days")
      .ilike("name", planName)
      .single();

    if (!plan) {
      console.error("Flow callback: plan not found:", planName);
      return new Response("OK", { status: 200 });
    }

    // Verificar que no exista ya una membresía activa reciente para este usuario+plan
    const { data: existingMembership } = await supabase
      .from("memberships")
      .select("id")
      .eq("purchased_by", payment.user_id)
      .eq("plan_id", plan.id)
      .eq("status", "activa")
      .gte(
        "created_at",
        new Date(Date.now() - 10 * 60 * 1000).toISOString()
      )
      .maybeSingle();

    if (existingMembership) {
      // Vincular membresía existente al pago
      await supabase
        .from("payments")
        .update({ membership_id: existingMembership.id })
        .eq("id", payment.id);
      return new Response("OK", { status: 200 });
    }

    // Buscar beneficiario del usuario
    const { data: ownBeneficiary } = await supabase
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", payment.user_id)
      .maybeSingle();

    if (!ownBeneficiary) {
      console.error("Flow callback: no beneficiary found for user:", payment.user_id);
      return new Response("OK", { status: 200 });
    }

    const today = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + plan.duration_days * 86400000)
      .toISOString()
      .split("T")[0];

    const { data: membership } = await supabase
      .from("memberships")
      .insert({
        beneficiary_id: ownBeneficiary.id,
        plan_id: plan.id,
        purchased_by: payment.user_id,
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
        .eq("id", payment.id);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Flow confirmation error:", error);
    return new Response("OK", { status: 200 });
  }
}
