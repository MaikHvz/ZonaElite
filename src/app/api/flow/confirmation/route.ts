import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyFlowPayment } from "@/lib/flow";

interface PaymentRow {
  id: string;
  user_id: string;
  commerce_order: string | null;
  status: string;
  amount: number;
  concept: string | null;
  flow_token: string | null;
  flow_order: number | null;
  membership_id: string | null;
}

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

    const supabase = getAdminClient();

    let payment: PaymentRow | null = null;

    const { data: byToken } = await supabase
      .from("payments")
      .select("id, user_id, commerce_order, status, amount, concept, flow_token")
      .eq("flow_token", token)
      .maybeSingle();

    if (byToken) {
      payment = byToken as PaymentRow;
    } else if (verification.commerceOrder) {
      const { data: byCommerce } = await supabase
        .from("payments")
        .select("id, user_id, commerce_order, status, amount, concept, flow_token")
        .eq("commerce_order", verification.commerceOrder)
        .maybeSingle();
      if (byCommerce) payment = byCommerce as PaymentRow;
    }

    if (!payment) {
      console.error("Flow callback: payment not found for token:", token);
      return new Response("OK", { status: 200 });
    }

    if (payment.status === "pagado") {
      return new Response("OK", { status: 200 });
    }

    await supabase
      .from("payments")
      .update({
        status: "pagado",
        paid_at: new Date().toISOString(),
        flow_token: payment.flow_token || token,
        flow_order: verification.flowOrder || null,
      })
      .eq("id", payment.id);

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
      await supabase
        .from("payments")
        .update({ membership_id: existingMembership.id })
        .eq("id", payment.id);
      return new Response("OK", { status: 200 });
    }

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
