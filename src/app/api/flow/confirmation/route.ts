import { getAdminClient } from "@/lib/supabase/admin";
import {
  verifyFlowPayment,
  FLOW_LOG_PREFIX,
} from "@/lib/flow";
import { confirmAndCreateMembership } from "@/lib/flow-helpers";
import { after } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const L = `${FLOW_LOG_PREFIX}/confirmation`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

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
  } catch {
    return new Response("OK", { status: 200 });
  }

  if (!token) {
    return new Response("OK", { status: 200 });
  }

  after(() => processInBackground(token));

  return new Response("OK", { status: 200 });
}

async function processInBackground(token: string) {
  let supabase;
  try {
    supabase = getAdminClient();
  } catch (err) {
    console.error(L, "Failed to create admin client:", err);
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
    if (result.error) {
      console.error(L, "Supabase query error:", JSON.stringify(result.error));
      return;
    }
  } catch (err) {
    console.error(L, "Payment query threw:", err);
    return;
  }

  if (!payment) {
    console.error(L, "No payment for token");
    return;
  }

  if (payment.status === "pagado") {
    return;
  }

  let verification;
  try {
    verification = await verifyFlowPayment(token);
  } catch (err) {
    console.error(L, "Flow verify failed, aborting:", err);
    return;
  }

  if (verification.status !== 2) {
    console.warn(L, "Flow not approved, status:", verification.status);
    return;
  }

  try {
    await supabase
      .from("payments")
      .update({
        status: "pagado",
        paid_at: new Date().toISOString(),
        ...(verification.flowOrder ? { flow_order: verification.flowOrder } : {}),
      })
      .eq("id", payment.id);
  } catch (err) {
    console.error(L, "Failed to update payment:", err);
    return;
  }

  try {
    const result = await confirmAndCreateMembership(supabase, payment.id, payment.user_id);
    if (!result.success) {
      console.error(L, "Membership creation failed:", result.error);
    }
  } catch (err) {
    console.error(L, "Membership creation threw:", err);
  }
}
