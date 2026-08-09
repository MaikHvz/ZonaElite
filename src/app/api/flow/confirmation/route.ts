import { getAdminClient } from "@/lib/supabase/admin";
import {
  verifyFlowPayment,
  mapFlowStatus,
  FLOW_LOG_PREFIX,
} from "@/lib/flow";
import {
  confirmAndCreateMembership,
  confirmPersonalizedPack,
  extendEnrollment,
  isVerificationOrderMatch,
  notifyPaymentWithoutMembership,
  notifyUserPaymentStatus,
} from "@/lib/flow-helpers";
import {
  isStorePayment,
  handleStorePaymentApproved,
  handleStorePaymentRejected,
} from "@/lib/store";
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
      .select("id, user_id, commerce_order, status, concept, flow_token, flow_order, beneficiary_id, membership_id, include_enrollment, enrollment_plan_id, order_id")
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
    const mapped = mapFlowStatus(verification.status);
    console.warn(L, "Flow not approved, status:", verification.status);

    // B-018: marcar el pago rechazado/anulado en la BD para no dejarlo pendiente
    if (mapped === "rechazado" || mapped === "cancelado") {
      try {
        await supabase
          .from("payments")
          .update({ status: mapped })
          .eq("id", payment.id);
      } catch (err) {
        console.error(L, "Failed to mark payment as rejected/cancelled:", err);
      }
    }

    // Tienda: si Flow rechazó/anuló el pago, cancelar la orden y restaurar stock.
    if (isStorePayment(payment)) {
      await handleStorePaymentRejected(supabase, payment);
    }

    // Notificar al usuario qué pasó con su pago (best-effort, nunca lanza)
    if (payment.user_id) {
      if (mapped === "rechazado") {
        await notifyUserPaymentStatus(supabase, payment, "rejected");
      } else if (mapped === "cancelado") {
        await notifyUserPaymentStatus(supabase, payment, "cancelled");
      } else {
        await notifyUserPaymentStatus(supabase, payment, "pending");
      }
    }
    return;
  }

  if (!isVerificationOrderMatch(payment.commerce_order, verification.commerceOrder)) {
    console.error(L, "commerceOrder mismatch — descartando callback:", {
      flowOrder: verification.commerceOrder,
      paymentOrder: payment.commerce_order,
      token,
    });
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

  // Only call confirmAndCreateMembership if there's a membership plan in the concept
  const hasMembershipConcept = payment.concept && /membres[íi]a/i.test(payment.concept);
  let assignedSomething = false;
  if (hasMembershipConcept) {
    try {
      const result = await confirmAndCreateMembership(supabase, payment.id, payment.user_id);
      if (result.success) {
        assignedSomething = true;
      } else {
        console.error(L, "Membership creation failed:", result.error);
        await notifyPaymentWithoutMembership(supabase, payment, result.error || "Error al crear membresía");
      }
    } catch (err) {
      console.error(L, "Membership creation threw:", err);
      await notifyPaymentWithoutMembership(supabase, payment, String(err));
    }
  }

  // Handle enrollment extension if included in payment
  try {
    if (payment.include_enrollment && payment.enrollment_plan_id && payment.beneficiary_id) {
      const enrollResult = await extendEnrollment(
        supabase,
        payment.id,
        payment.beneficiary_id,
        payment.enrollment_plan_id
      );
      if (enrollResult.success) {
        assignedSomething = true;
      } else {
        console.error(L, "Enrollment extension failed:", enrollResult.error);
      }
    }
  } catch (err) {
    console.error(L, "Enrollment extension threw:", err);
  }

  // Clases personalizadas (módulo desacoplado): concepto "Clase Personalizada X"
  const hasPersonalizedConcept = /^Clase Personalizad[ao]/i.test(payment.concept || "");
  if (hasPersonalizedConcept) {
    try {
      const result = await confirmPersonalizedPack(supabase, payment.id, payment.user_id);
      if (result.success) {
        assignedSomething = true;
      } else {
        console.error(L, "Personalized pack creation failed:", result.error);
        await notifyPaymentWithoutMembership(supabase, payment, result.error || "Error al crear pack personalizado");
      }
    } catch (err) {
      console.error(L, "Personalized pack creation threw:", err);
      await notifyPaymentWithoutMembership(supabase, payment, String(err));
    }
  }

  // Tienda (módulo desacoplado): pago con order_id + concepto "Tienda: ...".
  // Confirma la orden (product_orders → 'pagado') y envía el recibo al correo.
  // No toca membresías/tokens ni envía notificación in-app de membresía.
  if (isStorePayment(payment)) {
    const storeResult = await handleStorePaymentApproved(supabase, payment);
    if (storeResult.success) {
      assignedSomething = true;
    } else {
      console.error(L, "Store order confirmation failed:", storeResult.error);
    }
  }

  if (assignedSomething && payment.user_id) {
    await notifyUserPaymentStatus(supabase, payment, "approved");
  }
}
