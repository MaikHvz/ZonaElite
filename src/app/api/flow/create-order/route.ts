import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getChileToday } from "@/lib/dates";
import { createFlowOrder, buildFlowPaymentUrl, verifyFlowPayment, mapFlowStatus, FLOW_LOG_PREFIX } from "@/lib/flow";
import { getPaymentSettings } from "@/lib/payment-settings";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const ROUTE_LOG = `${FLOW_LOG_PREFIX}/create-order`;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Inicia sesión para continuar" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { planId, beneficiaryId, includeEnrollment, enrollmentPlanId, personalizedPlanId } = body;

    if (!beneficiaryId) {
      return NextResponse.json(
        { error: "Beneficiario es obligatorio" },
        { status: 400 }
      );
    }

    if (!planId && !includeEnrollment && !personalizedPlanId) {
      return NextResponse.json(
        { error: "Selecciona un plan de membresía, inscripción o clases personalizadas" },
        { status: 400 }
      );
    }

    // Clases personalizadas es un módulo desacoplado: nunca se combina con otros planes
    if (personalizedPlanId && (planId || includeEnrollment || enrollmentPlanId)) {
      return NextResponse.json(
        { error: "Las clases personalizadas no se combinan con otros planes" },
        { status: 400 }
      );
    }

    if (includeEnrollment && !enrollmentPlanId) {
      return NextResponse.json(
        { error: "Selecciona un plan de inscripción" },
        { status: 400 }
      );
    }

    // Validate membership plan
    let membershipPlan = null;
    if (planId) {
      const { data, error: planError } = await supabase
        .from("membership_plans")
        .select("id, name, price, duration_days, active")
        .eq("id", planId)
        .single();

      if (planError || !data) {
        return NextResponse.json(
          { error: "Plan no encontrado" },
          { status: 400 }
        );
      }

      if (!data.active) {
        return NextResponse.json(
          { error: "Plan no disponible" },
          { status: 400 }
        );
      }

      membershipPlan = data;
    }

    // Validate enrollment plan
    let enrollmentPlan = null;
    if (includeEnrollment && enrollmentPlanId) {
      const { data, error: epError } = await supabase
        .from("enrollment_plans")
        .select("id, name, price, duration_days, active")
        .eq("id", enrollmentPlanId)
        .single();

      if (epError || !data) {
        return NextResponse.json(
          { error: "Plan de inscripción no encontrado" },
          { status: 400 }
        );
      }

      if (!data.active) {
        return NextResponse.json(
          { error: "Plan de inscripción no disponible" },
          { status: 400 }
        );
      }

      enrollmentPlan = data;
    }

    // Validate personalized plan (módulo clases personalizadas)
    let personalizedPlan = null;
    if (personalizedPlanId) {
      const { data, error: ppError } = await supabase
        .from("personalized_plans")
        .select("id, name, price, total_classes, validity_days, active")
        .eq("id", personalizedPlanId)
        .single();

      if (ppError || !data) {
        return NextResponse.json(
          { error: "Plan no encontrado" },
          { status: 400 }
        );
      }

      if (!data.active) {
        return NextResponse.json(
          { error: "Plan no disponible" },
          { status: 400 }
        );
      }

      personalizedPlan = data;
    }

    // Validate beneficiary
    const { data: beneficiary, error: benError } = await supabase
      .from("beneficiaries")
      .select("id, profile_id, dependent_id")
      .eq("id", beneficiaryId)
      .single();

    if (benError || !beneficiary) {
      return NextResponse.json(
        { error: "Beneficiario no válido" },
        { status: 400 }
      );
    }

    if (beneficiary.profile_id) {
      if (beneficiary.profile_id !== user.id) {
        return NextResponse.json(
          { error: "Beneficiario no válido" },
          { status: 400 }
        );
      }
    } else if (beneficiary.dependent_id) {
      const { data: dependent } = await supabase
        .from("dependents")
        .select("id")
        .eq("id", beneficiary.dependent_id)
        .eq("tutor_id", user.id)
        .single();

      if (!dependent) {
        return NextResponse.json(
          { error: "Beneficiario no válido" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Beneficiario no válido" },
        { status: 400 }
      );
    }

    // Check if beneficiary already has active enrollment
    if (includeEnrollment) {
      const { data: existingEnrollment } = await supabase
        .from("academy_enrollments")
        .select("id")
        .eq("beneficiary_id", beneficiaryId)
        .eq("status", "activa")
        .gte("end_date", getChileToday())
        .maybeSingle();

      if (existingEnrollment) {
        // Will extend, not create new — this is fine
      }
    }

    // Modo de pago manual: si el tipo de producto está en "manual",
    // el pago online con Flow está desactivado (usar transferencia).
    const settings = await getPaymentSettings(supabase);
    const paymentType: "memberships" | "personalized" | "enrollment" = personalizedPlanId
      ? "personalized"
      : planId
        ? "memberships"
        : "enrollment";

    if (settings[paymentType] === "manual") {
      return NextResponse.json(
        { error: "El pago online está desactivado para este producto. Usa transferencia." },
        { status: 400 }
      );
    }

    // Calculate total amount
    const totalAmount = (membershipPlan?.price || 0) + (enrollmentPlan?.price || 0) + (personalizedPlan?.price || 0);

    // Build concept
    const conceptParts: string[] = [];
    if (enrollmentPlan) conceptParts.push(`Inscripción ${enrollmentPlan.name}`);
    if (membershipPlan) conceptParts.push(`Membresía ${membershipPlan.name}`);
    if (personalizedPlan) conceptParts.push(`Clase Personalizada ${personalizedPlan.name}`);
    const concept = conceptParts.join(" + ") || "Pago ZONAELITE";

    // Prevent duplicate pending payments (5 min window)
    const commerceOrder = crypto.randomUUID();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingPending } = await supabase
      .from("payments")
      .select("id, flow_token")
      .eq("user_id", user.id)
      .eq("status", "pendiente")
      .eq("method", "flow")
      .gte("created_at", fiveMinAgo)
      .maybeSingle();

    if (existingPending?.flow_token) {
      try {
        const verifyRes = await verifyFlowPayment(existingPending.flow_token);
        const mapped = mapFlowStatus(verifyRes.status);

        if (mapped === "pagado") {
          // Ya fue confirmado por el callback (race) — mostrar el éxito, no pagar de nuevo.
          await supabase
            .from("payments")
            .update({ status: "pagado", paid_at: new Date().toISOString() })
            .eq("id", existingPending.id);
          return NextResponse.json({
            status: "already_paid",
            token: existingPending.flow_token,
          });
        }

        if (mapped === "rechazado" || mapped === "cancelado") {
          // B-018/B-019: el token fue rechazado/anulado en Flow — no reutilizarlo.
          // Marcarlo y crear una orden NUEVA abajo.
          console.warn(ROUTE_LOG, "Descartando pago pendiente con token muerto:", {
            paymentId: existingPending.id,
            flowStatus: verifyRes.status,
          });
          await supabase
            .from("payments")
            .update({ status: mapped })
            .eq("id", existingPending.id);
        } else {
          // status 1 (sigue pendiente) — continuar pagando el mismo token.
          const flowPaymentUrl = buildFlowPaymentUrl(existingPending.flow_token);

          return NextResponse.json({
            url: flowPaymentUrl,
            token: existingPending.flow_token,
            reused: true,
          });
        }
      } catch {
        // No se pudo verificar — mantener como pendiente y reutilizar (comportamiento original).
        const flowPaymentUrl = buildFlowPaymentUrl(existingPending.flow_token);

        return NextResponse.json({
          url: flowPaymentUrl,
          token: existingPending.flow_token,
          reused: true,
        });
      }
    }

    // Create payment record (store enrollment info directly — Flow doesn't return 'optional' on getStatus)
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      beneficiary_id: beneficiary.id,
      commerce_order: commerceOrder,
      concept,
      amount: totalAmount,
      method: "flow",
      status: "pendiente",
    };
    if (enrollmentPlan) {
      insertPayload.include_enrollment = true;
      insertPayload.enrollment_plan_id = enrollmentPlan.id;
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(insertPayload)
      .select("id")
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Error al procesar pago" },
        { status: 500 }
      );
    }

    const flowResponse = await createFlowOrder({
      commerceOrder,
      subject: `${concept} - ZONAELITE`,
      amount: totalAmount,
      email: user.email || "",
    });

    await supabase
      .from("payments")
      .update({
        flow_token: flowResponse.token,
        flow_order: flowResponse.flowOrder,
      })
      .eq("id", payment.id);

    return NextResponse.json({
      url: flowResponse.url,
      token: flowResponse.token,
    });
  } catch (error) {
    console.error(ROUTE_LOG, "Unexpected error:", error);
    return NextResponse.json(
      { error: "Error al procesar pago. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
