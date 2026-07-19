import { getAdminClient } from "@/lib/supabase/admin";
import {
  verifyFlowPayment,
  FLOW_LOG_PREFIX,
} from "@/lib/flow";
import { after } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const L = `${FLOW_LOG_PREFIX}/confirmation`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  console.log(L, "GET fallback hit, token:", token);

  if (!token) return new Response("OK", { status: 200 });

  after(() => processInBackground(token));

  return new Response("OK", { status: 200 });
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
  } catch (err) {
    console.error(L, "Parse error:", err);
    return new Response("OK", { status: 200 });
  }

  if (!token) {
    console.warn(L, "No token in body");
    return new Response("OK", { status: 200 });
  }

  console.log(L, "POST received, token:", token);

  after(() => processInBackground(token));

  return new Response("OK", { status: 200 });
}

async function processInBackground(token: string) {
  console.log(L, "[1/7] Starting processing for token:", token);

  let supabase;
  try {
    supabase = getAdminClient();
    console.log(L, "[2/7] Admin client created OK");
  } catch (err) {
    console.error(L, "[2/7] getAdminClient() THREW:", err);
    return;
  }

  let payment;
  try {
    const result = await supabase
      .from("payments")
      .select("id, user_id, commerce_order, status, concept, flow_token, flow_order, beneficiary_id, membership_id")
      .eq("flow_token", token)
      .maybeSingle();
    payment = result.data;
    const error = result.error;
    if (error) {
      console.error(L, "[3/7] Supabase query ERROR:", JSON.stringify(error));
      return;
    }
    console.log(L, "[3/7] Payment found:", payment ? { id: payment.id, status: payment.status, beneficiary_id: payment.beneficiary_id } : "NULL");
  } catch (err) {
    console.error(L, "[3/7] findPaymentByToken THREW:", err);
    return;
  }

  if (!payment) {
    console.error(L, "[3/7] No payment for token:", token);
    return;
  }

  if (payment.status === "pagado") {
    console.log(L, "[3/7] Already pagado, skipping");
    return;
  }

  let flowVerified = false;
  let flowOrder: number | undefined;

  try {
    console.log(L, "[4/7] Calling Flow API verify...");
    const verification = await verifyFlowPayment(token);
    console.log(L, "[4/7] Flow response:", { status: verification.status, flowOrder: verification.flowOrder });

    if (verification.status === 2) {
      flowVerified = true;
      flowOrder = verification.flowOrder;
    } else {
      console.warn(L, "[4/7] Flow NOT approved, status:", verification.status);
      return;
    }
  } catch (err) {
    console.error(L, "[4/7] Flow verify THREW:", err);
    console.log(L, "[4/7] Proceeding anyway without Flow verification");
  }

  console.log(L, "[5/7] Marking payment as pagado...");
  try {
    const updateResult = await supabase
      .from("payments")
      .update({
        status: "pagado",
        paid_at: new Date().toISOString(),
        ...(flowOrder ? { flow_order: flowOrder } : {}),
      })
      .eq("id", payment.id);
    if (updateResult.error) {
      console.error(L, "[5/7] Update payment ERROR:", JSON.stringify(updateResult.error));
      return;
    }
    console.log(L, "[5/7] Payment marked pagado OK");
  } catch (err) {
    console.error(L, "[5/7] Update payment THREW:", err);
    return;
  }

  console.log(L, "[6/7] Creating membership...");
  try {
    await createMembershipDebug(supabase, payment);
  } catch (err) {
    console.error(L, "[6/7] createMembership THREW:", err);
  }

  console.log(L, "[7/7] Done");
}

async function createMembershipDebug(supabase: any, payment: any) {
  const paymentId = payment.id;
  const userId = payment.user_id;

  const { data: fullPayment, error: fpErr } = await supabase
    .from("payments")
    .select("id, user_id, concept, membership_id, beneficiary_id")
    .eq("id", paymentId)
    .single();
  console.log(L, "  [m1] Full payment:", fullPayment, "error:", fpErr);

  if (!fullPayment) {
    console.error(L, "  [m1] Payment not found in second query!");
    return;
  }

  if (fullPayment.membership_id) {
    console.log(L, "  [m1] Already has membership:", fullPayment.membership_id);
    return;
  }

  const concept = fullPayment.concept;
  const metadataMatch = concept?.match(/^Membres[íi]a\s+(.+)$/i);
  const planName = metadataMatch ? metadataMatch[1].trim() : null;
  console.log(L, "  [m2] Concept:", concept, "-> planName:", planName);

  if (!planName) {
    console.error(L, "  [m2] Could not extract plan name from concept:", concept);
    return;
  }

  const { data: plans, error: planErr } = await supabase
    .from("membership_plans")
    .select("id, name, duration_days, active")
    .ilike("name", planName);
  console.log(L, "  [m3] Plans found:", plans, "error:", planErr);

  if (!plans || plans.length === 0) {
    const { data: allPlans } = await supabase
      .from("membership_plans")
      .select("id, name, active");
    console.error(L, "  [m3] Plan not found. All plans in DB:", allPlans);
    return;
  }

  const plan = plans[0];
  console.log(L, "  [m3] Using plan:", { id: plan.id, name: plan.name, duration_days: plan.duration_days, active: plan.active });

  let targetBeneficiaryId = fullPayment.beneficiary_id;
  console.log(L, "  [m4] beneficiary_id from payment:", targetBeneficiaryId);

  if (!targetBeneficiaryId) {
    console.log(L, "  [m4] No beneficiary in payment, looking up own beneficiary for user:", userId);
    const { data: ownBen, error: benErr } = await supabase
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();
    console.log(L, "  [m4] Own beneficiary:", ownBen, "error:", benErr);
    if (ownBen) targetBeneficiaryId = ownBen.id;
  }

  if (!targetBeneficiaryId) {
    console.error(L, "  [m4] No beneficiary found for user:", userId);
    return;
  }

  const { data: existing, error: exErr } = await supabase
    .from("memberships")
    .select("id")
    .eq("beneficiary_id", targetBeneficiaryId)
    .eq("plan_id", plan.id)
    .eq("status", "activa")
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .maybeSingle();
  console.log(L, "  [m5] Existing membership:", existing, "error:", exErr);

  if (existing) {
    await supabase.from("payments").update({ membership_id: existing.id }).eq("id", paymentId);
    console.log(L, "  [m5] Linked to existing:", existing.id);
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + plan.duration_days * 86400000).toISOString().split("T")[0];

  console.log(L, "  [m6] Inserting membership:", { beneficiary_id: targetBeneficiaryId, plan_id: plan.id, purchased_by: userId, start: today, end: endDate });

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .insert({
      beneficiary_id: targetBeneficiaryId,
      plan_id: plan.id,
      purchased_by: userId,
      start_date: today,
      end_date: endDate,
      status: "activa",
    })
    .select("id")
    .single();

  console.log(L, "  [m6] Membership insert result:", membership, "error:", memErr);

  if (!membership) {
    console.error(L, "  [m6] MEMBERSHIP INSERT FAILED:", JSON.stringify(memErr));
    return;
  }

  await supabase.from("payments").update({ membership_id: membership.id }).eq("id", paymentId);
  console.log(L, "  [m7] Membership created and linked:", membership.id);
}
