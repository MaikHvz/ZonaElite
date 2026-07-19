import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  verifyFlowPayment,
  getFlowConfig,
  FLOW_LOG_PREFIX,
} from "@/lib/flow";
import {
  findPaymentByToken,
  confirmAndCreateMembership,
  markPaymentAsPaid,
} from "@/lib/flow-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DEBUG_LOG = `${FLOW_LOG_PREFIX}/debug`;

export async function GET(request: Request) {
  const results: Record<string, unknown> = {};

  const { apiUrl, apiKey } = getFlowConfig();
  results.flowConfig = {
    apiUrl,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 6) + "..." : "MISSING",
    hasApiKey: !!apiKey,
  };

  const rawBase =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://zona-elite-six.vercel.app";
  const normalizedBase = rawBase.replace(/^http:\/\//i, "https://").replace(/\/+$/, "");

  results.baseUrl = {
    raw: rawBase,
    normalized: normalizedBase,
    confirmUrl: `${normalizedBase}/api/flow/confirmation`,
    returnUrl: `${normalizedBase}/dashboard/pagos`,
    hasTrailingSlash: rawBase !== normalizedBase,
  };

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  results.supabase = {
    hasServiceRoleKey: hasServiceKey,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + "..."
      : "MISSING",
  };

  if (!hasServiceKey) {
    results.error = "SUPABASE_SERVICE_ROLE_KEY is missing — cannot query DB";
    return NextResponse.json(results, { status: 200 });
  }

  const admin = getAdminClient();

  const { data: recentPayments, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, status, method, flow_token, flow_order, concept, amount, created_at, beneficiary_id, membership_id")
    .eq("method", "flow")
    .order("created_at", { ascending: false })
    .limit(5);

  results.recentPayments = recentPayments || [];
  if (payErr) results.paymentQueryError = String(payErr);

  const lastPending = (recentPayments || []).find(
    (p: { status: string }) => p.status === "pendiente"
  );
  results.lastPendingPayment = lastPending || null;

  if (lastPending?.flow_token) {
    try {
      const flowResult = await verifyFlowPayment(lastPending.flow_token);
      results.flowVerification = {
        status: flowResult.status,
        statusLabel:
          flowResult.status === 2
            ? "PAGADO"
            : flowResult.status === 4
              ? "CANCELADO"
              : `status=${flowResult.status}`,
        flowOrder: flowResult.flowOrder,
        commerceOrder: flowResult.commerceOrder,
      };
    } catch (err) {
      results.flowVerification = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else if (lastPending) {
    results.flowVerification = {
      note: "Payment has no flow_token — cannot verify with Flow API",
    };
  }

  const { data: recentConfirmed } = await admin
    .from("payments")
    .select("id, status, created_at")
    .eq("method", "flow")
    .eq("status", "pagado")
    .order("created_at", { ascending: false })
    .limit(3);

  results.recentConfirmedPayments = recentConfirmed || [];

  const { data: recentMemberships } = await admin
    .from("memberships")
    .select("id, beneficiary_id, plan_id, status, start_date, end_date, created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  results.recentMemberships = recentMemberships || [];

  return NextResponse.json(results, { status: 200 });
}
