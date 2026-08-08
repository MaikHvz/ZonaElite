import { FLOW_LOG_PREFIX } from "./flow.ts";
import { getChileToday, addDaysChile } from "./dates.ts";
import { extendOrCreateEnrollment } from "./enrollments.ts";

const HELPERS_LOG = `${FLOW_LOG_PREFIX}/helpers`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

interface PaymentRow {
  id: string;
  user_id: string;
  commerce_order: string | null;
  status: string;
  concept: string | null;
  flow_token: string | null;
  flow_order: number | null;
  beneficiary_id: string | null;
  membership_id: string | null;
  amount?: number | null;
}

export async function confirmAndCreateMembership(
  supabase: SupabaseClient,
  paymentId: string,
  userId: string
): Promise<{ success: boolean; membershipId?: string; error?: string }> {
  return createMembershipForPayment(supabase, paymentId, userId);
}

/**
 * Crea la membresía asociada a un pago. Usado por el flujo Flow (plan inferido
 * desde el concepto) y por la aprobación de pagos por transferencia (plan
 * explícito vía `planId`). Mismas reglas: dedup 10 min, cancela activas,
 * start_date = getChileToday(), end_date = addDaysChile.
 */
export async function createMembershipForPayment(
  supabase: SupabaseClient,
  paymentId: string,
  userId: string,
  planId?: string
): Promise<{ success: boolean; membershipId?: string; error?: string }> {
  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, concept, membership_id, beneficiary_id")
    .eq("id", paymentId)
    .single();

  if (!payment) {
    console.error(HELPERS_LOG, "Payment not found:", paymentId);
    return { success: false, error: "Pago no encontrado" };
  }

  if (payment.membership_id) {
    console.log(HELPERS_LOG, "Payment already has membership:", payment.membership_id);
    return { success: true, membershipId: payment.membership_id };
  }

  let plan: { id: string; duration_days: number } | null = null;

  if (planId) {
    const { data: byId } = await supabase
      .from("membership_plans")
      .select("id, duration_days")
      .eq("id", planId)
      .maybeSingle();
    plan = byId as { id: string; duration_days: number } | null;

    if (!plan) {
      console.error(HELPERS_LOG, "Plan not found:", planId);
      return { success: false, error: "Plan no encontrado" };
    }
  } else {
    const planName = extractPlanName(payment.concept);
    if (!planName) {
      console.error(HELPERS_LOG, "Could not extract plan name from concept:", payment.concept);
      return { success: false, error: "No se pudo determinar el plan desde el concepto" };
    }

    const { data: byName } = await supabase
      .from("membership_plans")
      .select("id, duration_days")
      .ilike("name", planName)
      .single();
    plan = byName as { id: string; duration_days: number } | null;

    if (!plan) {
      console.error(HELPERS_LOG, "Plan not found:", planName);
      return { success: false, error: `Plan "${planName}" no encontrado` };
    }
  }

  let targetBeneficiaryId = payment.beneficiary_id;

  if (!targetBeneficiaryId) {
    const { data: ownBeneficiary } = await supabase
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (ownBeneficiary) {
      targetBeneficiaryId = ownBeneficiary.id;
    }
  }

  if (!targetBeneficiaryId) {
    console.error(HELPERS_LOG, "No beneficiary found for user:", userId);
    return { success: false, error: "Beneficiario no encontrado" };
  }

  const today = getChileToday();
  const dedupWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("beneficiary_id", targetBeneficiaryId)
    .eq("plan_id", plan.id)
    .eq("status", "activa")
    .gte("created_at", dedupWindow)
    .maybeSingle();

  if (existingMembership) {
    console.log(HELPERS_LOG, "Linking to existing membership:", existingMembership.id);
    await supabase
      .from("payments")
      .update({ membership_id: existingMembership.id })
      .eq("id", paymentId);
    return { success: true, membershipId: existingMembership.id };
  }

  // Cancel ALL active memberships for this beneficiary
  const { error: cancelError } = await supabase
    .from("memberships")
    .update({ status: "cancelada" })
    .eq("beneficiary_id", targetBeneficiaryId)
    .eq("status", "activa");

  if (cancelError) {
    console.error(HELPERS_LOG, "Failed to cancel existing memberships:", cancelError);
  } else {
    console.log(HELPERS_LOG, "Deactivated prior memberships for:", targetBeneficiaryId);
  }

  const endDate = addDaysChile(today, plan.duration_days);

  const { data: membership, error: insertError } = await supabase
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

  // B-002: índice único parcial idx_memberships_one_active rechazó el insert
  // (SQLSTATE 23505) porque otra membresía activa quedó creada en paralelo.
  // Retry idempotente: re-consultar la activa existente y linkear el pago a esa.
  if (insertError?.code === "23505") {
    console.log(HELPERS_LOG, "Unique index (23505): linking to existing active membership:", paymentId);
    const { data: existingActive } = await supabase
      .from("memberships")
      .select("id")
      .eq("beneficiary_id", targetBeneficiaryId)
      .eq("status", "activa")
      .maybeSingle();

    if (existingActive) {
      await supabase
        .from("payments")
        .update({ membership_id: existingActive.id })
        .eq("id", paymentId);
      console.log(HELPERS_LOG, "Linked payment to existing active membership:", existingActive.id);
      return { success: true, membershipId: existingActive.id };
    }
  }

  if (!membership) {
    console.error(HELPERS_LOG, "Failed to create membership for payment:", paymentId, insertError);
    return { success: false, error: "Error al crear membresía" };
  }

  await supabase
    .from("payments")
    .update({ membership_id: membership.id })
    .eq("id", paymentId);

  console.log(HELPERS_LOG, "Membership created:", {
    membershipId: membership.id,
    beneficiaryId: targetBeneficiaryId,
    planId: plan.id,
    endDate,
  });

  return { success: true, membershipId: membership.id };
}

function extractPlanName(concept: string | null): string | null {
  if (!concept) return null;
  // Match "Membresía X" or "Inscripción X + Membresía Y" or "Inscripción X + Membresía Y - ZONAELITE"
  const membershipMatch = concept.match(/Membres[íi]a\s+(.+?)(?:\s*-\s*ZONAELITE)?$/i);
  if (membershipMatch) return membershipMatch[1].trim();
  // Fallback: just "Membresía X"
  const fallback = concept.match(/^Membres[íi]a\s+(.+)$/i);
  return fallback ? fallback[1].trim() : null;
}

function extractPersonalizedPlanName(concept: string | null): string | null {
  if (!concept) return null;
  // Match "Clase Personalizada X" (con o sin sufijo "- ZONAELITE")
  const match = concept.match(/Clase Personalizad[ao]\s+(.+?)(?:\s*-\s*ZONAELITE)?$/i);
  return match ? match[1].trim() : null;
}

/**
 * Clases personalizadas (módulo desacoplado): crea un `personalized_packs`
 * al confirmarse un pago cuyo concepto es "Clase Personalizada <plan>".
 * Idempotente: si el pago ya tiene un pack vinculado, no duplica.
 * NO toca membresías ni tokens (no cancela activas, no inserta en memberships).
 */
export async function confirmPersonalizedPack(
  supabase: SupabaseClient,
  paymentId: string,
  userId: string,
  planId?: string
): Promise<{ success: boolean; packId?: string; error?: string }> {
  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, concept, beneficiary_id")
    .eq("id", paymentId)
    .single();

  if (!payment) {
    console.error(HELPERS_LOG, "Payment not found:", paymentId);
    return { success: false, error: "Pago no encontrado" };
  }

  const { data: existingPack } = await supabase
    .from("personalized_packs")
    .select("id")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existingPack) {
    console.log(HELPERS_LOG, "Payment already has personalized pack:", existingPack.id);
    return { success: true, packId: existingPack.id };
  }

  let plan: { id: string; total_classes: number; validity_days: number } | null = null;

  if (planId) {
    const { data: byId } = await supabase
      .from("personalized_plans")
      .select("id, total_classes, validity_days")
      .eq("id", planId)
      .maybeSingle();
    plan = byId as { id: string; total_classes: number; validity_days: number } | null;

    if (!plan) {
      console.error(HELPERS_LOG, "Personalized plan not found:", planId);
      return { success: false, error: "Plan no encontrado" };
    }
  } else {
    const planName = extractPersonalizedPlanName(payment.concept);
    if (!planName) {
      console.error(HELPERS_LOG, "Could not extract personalized plan name from concept:", payment.concept);
      return { success: false, error: "No se pudo determinar el plan desde el concepto" };
    }

    const { data: byName } = await supabase
      .from("personalized_plans")
      .select("id, total_classes, validity_days")
      .ilike("name", planName)
      .single();
    plan = byName as { id: string; total_classes: number; validity_days: number } | null;

    if (!plan) {
      console.error(HELPERS_LOG, "Personalized plan not found:", planName);
      return { success: false, error: `Plan "${planName}" no encontrado` };
    }
  }

  let targetBeneficiaryId = payment.beneficiary_id;

  if (!targetBeneficiaryId) {
    const { data: ownBeneficiary } = await supabase
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (ownBeneficiary) {
      targetBeneficiaryId = ownBeneficiary.id;
    }
  }

  if (!targetBeneficiaryId) {
    console.error(HELPERS_LOG, "No beneficiary found for user:", userId);
    return { success: false, error: "Beneficiario no encontrado" };
  }

  const today = getChileToday();
  const endDate = addDaysChile(today, plan.validity_days);

  const { data: pack, error: insertError } = await supabase
    .from("personalized_packs")
    .insert({
      beneficiary_id: targetBeneficiaryId,
      plan_id: plan.id,
      purchased_by: userId,
      payment_id: paymentId,
      start_date: today,
      end_date: endDate,
      total_classes: plan.total_classes,
      used_classes: 0,
      status: "activa",
    })
    .select("id")
    .single();

  if (insertError || !pack) {
    console.error(HELPERS_LOG, "Failed to create personalized pack:", paymentId, insertError);
    return { success: false, error: "Error al crear el pack personalizado" };
  }

  console.log(HELPERS_LOG, "Personalized pack created:", {
    packId: pack.id,
    beneficiaryId: targetBeneficiaryId,
    planId: plan.id,
    endDate,
  });

  return { success: true, packId: pack.id };
}

export async function extendEnrollment(
  supabase: SupabaseClient,
  paymentId: string,
  beneficiaryId: string,
  enrollmentPlanId: string
): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
  return extendOrCreateEnrollment(supabase, beneficiaryId, enrollmentPlanId, paymentId);
}

/**
 * Verifica que el commerceOrder devuelto por Flow (vía payment/getStatus)
 * coincida con el commerce_order guardado en el pago del sistema. Evita
 * confusión de órdenes y replay cross-tenant (B-007).
 */
export function isVerificationOrderMatch(
  paymentCommerceOrder: string | null | undefined,
  flowCommerceOrder: string | null | undefined
): boolean {
  if (!paymentCommerceOrder || !flowCommerceOrder) return false;
  return paymentCommerceOrder === flowCommerceOrder;
}

/**
 * B-008: alerta admin cuando un pago quedó "pagado" pero la membresía
 * no se pudo crear. Inserta una notificación `target='staff'` (solo visible
 * para admin/staff según RLS `notifications_select_all_or_admin`).
 * `sent_by` es NOT NULL, así que se resuelve el primer admin (role_id=1).
 * Nunca lanza: cualquier fallo solo se loguea (la alerta es best-effort).
 */
export async function notifyPaymentWithoutMembership(
  supabase: SupabaseClient,
  payment: { id: string; user_id: string; concept?: string | null },
  error: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: admin } = await supabase
      .from("profiles")
      .select("id")
      .eq("role_id", 1)
      .limit(1)
      .maybeSingle();

    if (!admin) {
      console.error(HELPERS_LOG, "No admin found to notify for payment:", payment.id);
      return { success: false, error: "Sin admin para notificar" };
    }

    const { error: insertError } = await supabase
      .from("notifications")
      .insert({
        type: "sistema",
        subject: "Pago pagado sin membresía",
        content: JSON.stringify({
          payment_id: payment.id,
          user_id: payment.user_id,
          concept: payment.concept || null,
          error,
        }),
        target: "staff",
        sent_by: admin.id,
        sent_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error(HELPERS_LOG, "Failed to insert notification:", insertError);
      return { success: false, error: "No se pudo insertar notificación" };
    }

    console.log(HELPERS_LOG, "Notified admin about payment without membership:", payment.id);
    return { success: true };
  } catch (err) {
    console.error(HELPERS_LOG, "Notification insert threw:", err);
    return { success: false, error: String(err) };
  }
}

export type PaymentNotificationOutcome =
  | "approved"
  | "rejected"
  | "cancelled"
  | "pending";

/**
 * Notificación al usuario sobre el resultado de un pago (membresía/inscripción).
 * Se dispara al aprobarse el pago (con la asignación y el beneficiario) o cuando
 * el pago queda rechazado/anulado/pendiente. Best-effort: nunca lanza ni
 * bloquea el flujo de cobro.
 *
 * Dedup: se busca una notificación previa del mismo pago (marcador `Ref:` en el
 * content) para no duplicar entre confirmation/verify/force-confirm.
 */
export async function notifyUserPaymentStatus(
  supabase: SupabaseClient,
  payment: {
    id: string;
    user_id: string;
    concept?: string | null;
    beneficiary_id?: string | null;
  },
  outcome: PaymentNotificationOutcome
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existing } = await supabase
      .from("user_notifications")
      .select("id")
      .eq("user_id", payment.user_id)
      .ilike("content", `%${payment.id}%`)
      .maybeSingle();

    if (existing) {
      console.log(HELPERS_LOG, "Payment already notified, skipping:", payment.id);
      return { success: true };
    }

    let beneficiaryName = "Titular";
    if (payment.beneficiary_id) {
      const { data: ben } = await supabase
        .from("beneficiaries")
        .select("profiles(full_name), dependents(full_name)")
        .eq("id", payment.beneficiary_id)
        .maybeSingle();
      if (ben) {
        beneficiaryName =
          (ben.profiles as { full_name?: string } | null)?.full_name ||
          (ben.dependents as { full_name?: string } | null)?.full_name ||
          "Titular";
      }
    }

    const concept = payment.concept || "Pago ZONAELITE";
    const ref = `\nRef: ${payment.id}`;

    const messages: Record<
      PaymentNotificationOutcome,
      { title: string; content: string }
    > = {
      approved: {
        title: "Pago aprobado",
        content: `Se asignó ${concept} a ${beneficiaryName}.${ref}`,
      },
      rejected: {
        title: "Pago rechazado",
        content: `Tu pago de ${concept} para ${beneficiaryName} fue rechazado. No se realizó ningún cargo.${ref}`,
      },
      cancelled: {
        title: "Pago anulado",
        content: `Tu pago de ${concept} para ${beneficiaryName} fue anulado. No se realizó ningún cargo.${ref}`,
      },
      pending: {
        title: "Pago pendiente",
        content: `Tu pago de ${concept} para ${beneficiaryName} está pendiente de confirmación.${ref}`,
      },
    };

    const msg = messages[outcome];

    const { error } = await supabase.from("user_notifications").insert({
      user_id: payment.user_id,
      title: msg.title,
      content: msg.content,
      read: false,
    });

    if (error) {
      console.error(HELPERS_LOG, "Failed to insert user notification:", error);
      return { success: false, error: "No se pudo insertar notificación" };
    }

    console.log(HELPERS_LOG, "User notified about payment:", payment.id, outcome);
    return { success: true };
  } catch (err) {
    console.error(HELPERS_LOG, "User notification insert threw:", err);
    return { success: false, error: String(err) };
  }
}

export async function markPaymentAsPaid(
  supabase: SupabaseClient,
  paymentId: string,
  flowToken: string,
  flowOrder?: number
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status: "pagado",
    paid_at: new Date().toISOString(),
  };

  if (flowToken) updateData.flow_token = flowToken;
  if (flowOrder) updateData.flow_order = flowOrder;

  await supabase
    .from("payments")
    .update(updateData)
    .eq("id", paymentId);

  console.log(HELPERS_LOG, "Payment marked as pagado:", paymentId);
}

export async function findPaymentByToken(
  supabase: SupabaseClient,
  token: string
): Promise<PaymentRow | null> {
  const { data } = await supabase
    .from("payments")
    .select("id, user_id, commerce_order, status, concept, flow_token, flow_order, beneficiary_id, membership_id")
    .eq("flow_token", token)
    .maybeSingle();

  return data as PaymentRow | null;
}

export async function findPaymentByTokenAndUser(
  supabase: SupabaseClient,
  token: string,
  userId: string
): Promise<PaymentRow | null> {
  const { data } = await supabase
    .from("payments")
    .select("id, user_id, commerce_order, status, concept, flow_token, flow_order, beneficiary_id, membership_id")
    .eq("flow_token", token)
    .eq("user_id", userId)
    .maybeSingle();

  return data as PaymentRow | null;
}
