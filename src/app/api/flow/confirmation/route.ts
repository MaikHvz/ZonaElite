import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

interface PaymentRow {
  id: string;
  user_id: string;
  commerce_order: string | null;
  status: string;
  concept: string | null;
  flow_token: string | null;
  flow_order: number | null;
  beneficiary_id: string | null;
}

export async function POST(request: Request) {
  let token: string | null = null;

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      token = params.get("token");
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      token = body.token;
    }
  } catch {
    return new Response("OK", { status: 200 });
  }

  if (!token) {
    console.log("[flow-confirm] No token in request body");
    return new Response("OK", { status: 200 });
  }

  console.log("[flow-confirm] Received token:", token);

  processInBackground(token).catch((err) => {
    console.error("[flow-confirm] Background processing error:", err);
  });

  return new Response("OK", { status: 200 });
}

async function processInBackground(token: string) {
  const supabase = getAdminClient();

  let payment: PaymentRow | null = null;

  const { data: byToken } = await supabase
    .from("payments")
    .select("id, user_id, commerce_order, status, concept, flow_token, flow_order, beneficiary_id")
    .eq("flow_token", token)
    .maybeSingle();

  if (byToken) {
    payment = byToken as PaymentRow;
  }

  if (!payment) {
    console.error("[flow-confirm] Payment not found for token:", token);
    return;
  }

  if (payment.status === "pagado") {
    console.log("[flow-confirm] Payment already pagado:", payment.id);
    return;
  }

  await supabase
    .from("payments")
    .update({
      status: "pagado",
      paid_at: new Date().toISOString(),
      flow_token: payment.flow_token || token,
    })
    .eq("id", payment.id);

  console.log("[flow-confirm] Payment marked pagado:", payment.id);

  const metadataMatch = payment.concept?.match(/^Membresía\s+(.+)$/);
  const planName = metadataMatch ? metadataMatch[1].trim() : null;
  if (!planName) {
    console.error("[flow-confirm] Could not extract plan name from:", payment.concept);
    return;
  }

  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, duration_days")
    .ilike("name", planName)
    .single();

  if (!plan) {
    console.error("[flow-confirm] Plan not found:", planName);
    return;
  }

  let targetBeneficiaryId = payment.beneficiary_id;

  if (!targetBeneficiaryId) {
    const { data: ownBeneficiary } = await supabase
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", payment.user_id)
      .maybeSingle();
    if (ownBeneficiary) {
      targetBeneficiaryId = ownBeneficiary.id;
    }
  }

  if (!targetBeneficiaryId) {
    console.error("[flow-confirm] No beneficiary found for user:", payment.user_id);
    return;
  }

  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("beneficiary_id", targetBeneficiaryId)
    .eq("plan_id", plan.id)
    .eq("status", "activa")
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .maybeSingle();

  if (existingMembership) {
    await supabase
      .from("payments")
      .update({ membership_id: existingMembership.id })
      .eq("id", payment.id);
    console.log("[flow-confirm] Linked to existing membership:", existingMembership.id);
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + plan.duration_days * 86400000)
    .toISOString()
    .split("T")[0];

  const { data: membership } = await supabase
    .from("memberships")
    .insert({
      beneficiary_id: targetBeneficiaryId,
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
    console.log("[flow-confirm] Created membership:", membership.id);
  }
}
