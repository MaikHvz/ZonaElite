import { FLOW_LOG_PREFIX } from "./flow";

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
}

export async function confirmAndCreateMembership(
  supabase: SupabaseClient,
  paymentId: string,
  userId: string
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

  const planName = extractPlanName(payment.concept);
  if (!planName) {
    console.error(HELPERS_LOG, "Could not extract plan name from concept:", payment.concept);
    return { success: false, error: "No se pudo determinar el plan desde el concepto" };
  }

  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, duration_days")
    .ilike("name", planName)
    .single();

  if (!plan) {
    console.error(HELPERS_LOG, "Plan not found:", planName);
    return { success: false, error: `Plan "${planName}" no encontrado` };
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

  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(
    Date.now() + plan.duration_days * 86400000
  )
    .toISOString()
    .split("T")[0];

  const { data: membership } = await supabase
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

  if (!membership) {
    console.error(HELPERS_LOG, "Failed to create membership for payment:", paymentId);
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
  const match = concept.match(/^Membres[íi]a\s+(.+)$/i);
  return match ? match[1].trim() : null;
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
