import { getChileToday, addDaysChile } from "./dates.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface AcademyEnrollmentResult {
  success: boolean;
  enrollmentId?: string;
  error?: string;
}

/**
 * Asigna o extiende una inscripción de academia (B-004).
 *
 * Dedup: si el beneficiario ya tiene una inscripción ACTIVA vigente
 * (status='activa' AND end_date >= hoy Chile), la EXTENDE desde
 * max(end_date, hoy) + duration_days; si no, crea una nueva con
 * start_date = hoy Chile y end_date = addDaysChile(hoy, duration).
 *
 * Todas las fechas se calculan con helpers DST-safe de America/Santiago
 * (getChileToday/addDaysChile), nunca con new Date() del servidor.
 *
 * paymentId es opcional: al EXTENDER no sobreescribe un payment_id previo
 * si no se pasa uno nuevo (preserva la trazabilidad del pago original).
 */
export async function extendOrCreateEnrollment(
  supabase: SupabaseClient,
  beneficiaryId: string,
  enrollmentPlanId: string,
  paymentId: string | null
): Promise<AcademyEnrollmentResult> {
  const { data: plan } = await supabase
    .from("enrollment_plans")
    .select("id, duration_days")
    .eq("id", enrollmentPlanId)
    .single();

  if (!plan) {
    return { success: false, error: "Plan de inscripción no encontrado" };
  }

  const today = getChileToday();

  const { data: existing } = await supabase
    .from("academy_enrollments")
    .select("id, end_date")
    .eq("beneficiary_id", beneficiaryId)
    .eq("status", "activa")
    .gte("end_date", today)
    .order("end_date", { ascending: false })
    .maybeSingle();

  if (existing) {
    const baseDate = existing.end_date > today ? existing.end_date : today;
    const endDate = addDaysChile(baseDate, plan.duration_days);

    const updateData: Record<string, unknown> = {
      end_date: endDate,
      enrollment_plan_id: enrollmentPlanId,
    };
    if (paymentId) updateData.payment_id = paymentId;

    const { error } = await supabase
      .from("academy_enrollments")
      .update(updateData)
      .eq("id", existing.id);

    if (error) {
      console.error("[enrollments]", "Failed to extend enrollment:", error);
      return { success: false, error: "Error al extender inscripción" };
    }

    console.log("[enrollments]", "Enrollment extended:", {
      enrollmentId: existing.id,
      newEndDate: endDate,
      daysAdded: plan.duration_days,
    });

    return { success: true, enrollmentId: existing.id };
  }

  const endDate = addDaysChile(today, plan.duration_days);

  const { data: enrollment, error } = await supabase
    .from("academy_enrollments")
    .insert({
      beneficiary_id: beneficiaryId,
      enrollment_plan_id: enrollmentPlanId,
      payment_id: paymentId,
      start_date: today,
      end_date: endDate,
      status: "activa",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[enrollments]", "Failed to create enrollment:", error);
    return { success: false, error: "Error al crear inscripción" };
  }

  console.log("[enrollments]", "Enrollment created:", {
    enrollmentId: enrollment.id,
    startDate: today,
    endDate,
  });

  return { success: true, enrollmentId: enrollment.id };
}
