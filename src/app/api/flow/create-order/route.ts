import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createFlowOrder, getFlowConfig, verifyFlowPayment, FLOW_LOG_PREFIX } from "@/lib/flow";

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
    const { planId, beneficiaryId, includeEnrollment, enrollmentPlanId } = body;

    if (!beneficiaryId) {
      return NextResponse.json(
        { error: "Beneficiario es obligatorio" },
        { status: 400 }
      );
    }

    if (!planId && !includeEnrollment) {
      return NextResponse.json(
        { error: "Selecciona un plan de membresía o inscripción" },
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
        .gte("end_date", new Date().toISOString().split("T")[0])
        .maybeSingle();

      if (existingEnrollment) {
        // Will extend, not create new — this is fine
      }
    }

    // Calculate total amount
    const totalAmount = (membershipPlan?.price || 0) + (enrollmentPlan?.price || 0);

    // Build concept
    const conceptParts: string[] = [];
    if (enrollmentPlan) conceptParts.push(`Inscripción ${enrollmentPlan.name}`);
    if (membershipPlan) conceptParts.push(`Membresía ${membershipPlan.name}`);
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
        if (verifyRes.status === 2) {
          await supabase
            .from("payments")
            .update({ status: "pagado", paid_at: new Date().toISOString() })
            .eq("id", existingPending.id);
        }
      } catch {
        // Keep as pending
      }

      const { apiUrl } = getFlowConfig();
      const flowPaymentUrl = apiUrl.replace(/\/api\/?$/, "/payment") + "?token=" + encodeURIComponent(existingPending.flow_token);

      return NextResponse.json({
        url: flowPaymentUrl,
        token: existingPending.flow_token,
        reused: true,
      });
    }

    // Create payment record
    const metadata: Record<string, string> = {
      paymentId: "", // will be filled after insert
      beneficiaryId: beneficiary.id,
    };
    if (membershipPlan) metadata.planId = membershipPlan.id;
    if (enrollmentPlan) {
      metadata.includeEnrollment = "true";
      metadata.enrollmentPlanId = enrollmentPlan.id;
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        beneficiary_id: beneficiary.id,
        commerce_order: commerceOrder,
        concept,
        amount: totalAmount,
        method: "flow",
        status: "pendiente",
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Error al procesar pago" },
        { status: 500 }
      );
    }

    // Update metadata with payment ID
    metadata.paymentId = payment.id;

    const flowResponse = await createFlowOrder({
      commerceOrder,
      subject: `${concept} - ZONAELITE`,
      amount: totalAmount,
      email: user.email || "",
      metadata,
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
