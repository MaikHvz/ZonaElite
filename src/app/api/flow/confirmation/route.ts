import { getAdminClient } from "@/lib/supabase/admin";
import {
  verifyFlowCallbackSignature,
  verifyFlowPayment,
  FLOW_LOG_PREFIX,
} from "@/lib/flow";
import {
  confirmAndCreateMembership,
  markPaymentAsPaid,
  findPaymentByToken,
} from "@/lib/flow-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const CONFIRM_LOG = `${FLOW_LOG_PREFIX}/confirmation`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response("OK", { status: 200 });
  }

  console.log(CONFIRM_LOG, "GET fallback — token from query:", token);

  processInBackground(token).catch((err) => {
    console.error(CONFIRM_LOG, "Background processing failed (GET):", err);
  });

  return new Response("OK", { status: 200 });
}

export async function POST(request: Request) {
  let token: string | null = null;
  let signatureBody: Record<string, string> | null = null;

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      token = params.get("token");
      signatureBody = {};
      params.forEach((value, key) => {
        signatureBody![key] = value;
      });
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      token = body.token;
      signatureBody = body;
    }
  } catch (err) {
    console.error(CONFIRM_LOG, "Failed to parse request body:", err);
    return new Response("OK", { status: 200 });
  }

  if (!token) {
    console.warn(CONFIRM_LOG, "No token in request body");
    return new Response("OK", { status: 200 });
  }

  if (signatureBody && signatureBody.s) {
    try {
      const isValid = verifyFlowCallbackSignature(
        signatureBody,
        signatureBody.s
      );
      if (!isValid) {
        console.warn(CONFIRM_LOG, "Invalid HMAC signature on callback!");
      } else {
        console.log(CONFIRM_LOG, "HMAC signature verified OK");
      }
    } catch (err) {
      console.error(CONFIRM_LOG, "HMAC verification error:", err);
    }
  } else {
    console.warn(CONFIRM_LOG, "No signature (s) in callback body");
  }

  console.log(CONFIRM_LOG, "Received confirmation for token:", token);

  processInBackground(token).catch((err) => {
    console.error(CONFIRM_LOG, "Background processing failed:", err);
  });

  return new Response("OK", { status: 200 });
}

async function processInBackground(token: string) {
  const supabase = getAdminClient();

  const payment = await findPaymentByToken(supabase, token);

  if (!payment) {
    console.error(CONFIRM_LOG, "Payment not found for token:", token);
    return;
  }

  if (payment.status === "pagado") {
    console.log(CONFIRM_LOG, "Payment already pagado:", payment.id);
    return;
  }

  let flowVerified = false;
  let flowOrder: number | undefined;

  try {
    const verification = await verifyFlowPayment(token);
    if (verification.status === 2) {
      flowVerified = true;
      flowOrder = verification.flowOrder;
    } else {
      console.warn(
        CONFIRM_LOG,
        "Flow says payment is NOT approved. Status:",
        verification.status,
        "Payment ID:",
        payment.id
      );
      const statusMap: Record<number, string> = {
        3: "rechazado",
        4: "cancelado",
        5: "expirado",
      };
      const newStatus = statusMap[verification.status] || payment.status;
      await supabase
        .from("payments")
        .update({ status: newStatus })
        .eq("id", payment.id);
      return;
    }
  } catch (err) {
    console.error(CONFIRM_LOG, "Flow verification failed, proceeding with local data:", err);
  }

  if (!flowVerified) {
    console.warn(
      CONFIRM_LOG,
      "Could not verify with Flow API, marking as pagado based on callback"
    );
  }

  await markPaymentAsPaid(supabase, payment.id, token, flowOrder);

  const result = await confirmAndCreateMembership(
    supabase,
    payment.id,
    payment.user_id
  );

  if (!result.success) {
    console.error(CONFIRM_LOG, "Failed to create membership:", result.error);
  }
}
