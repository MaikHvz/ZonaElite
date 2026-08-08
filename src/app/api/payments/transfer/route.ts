import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPaymentSettings, type PaymentProductType } from "@/lib/payment-settings";
import { sendTransferRequestEmail } from "@/lib/email";
import { FLOW_LOG_PREFIX } from "@/lib/flow";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const ROUTE_LOG = `${FLOW_LOG_PREFIX}/payments/transfer`;

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];
const MAX_VOUCHER_BYTES = 5 * 1024 * 1024;

function extFromMime(type: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
  };
  return map[type] || "jpg";
}

function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "";
  for (let i = 0; i < 6; i++) {
    ref += chars[crypto.randomInt(chars.length)];
  }
  return `REF-ZE-${ref}`;
}

interface TransferBody {
  productType?: string;
  planId?: string;
  beneficiaryId?: string;
  includeEnrollment?: boolean;
  enrollmentPlanId?: string;
  rut?: string;
  fileName?: string;
  fileBase64?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Inicia sesión para continuar" }, { status: 401 });
    }

    const body = (await request.json()) as TransferBody;
    const { productType, planId, beneficiaryId, includeEnrollment, enrollmentPlanId, rut, fileName, fileBase64 } = body;

    if (!productType || !["memberships", "personalized", "enrollment"].includes(productType)) {
      return NextResponse.json({ error: "Tipo de producto inválido" }, { status: 400 });
    }
    if (!beneficiaryId) {
      return NextResponse.json({ error: "Beneficiario es obligatorio" }, { status: 400 });
    }
    if (!planId && !includeEnrollment && productType !== "enrollment") {
      return NextResponse.json({ error: "Selecciona un plan" }, { status: 400 });
    }

    const admin = getAdminClient();
    const settings = await getPaymentSettings(admin);

    const modeKey: PaymentProductType =
      productType === "memberships" ? "memberships"
        : productType === "personalized" ? "personalized"
          : "enrollment";

    if (settings[modeKey] !== "manual") {
      return NextResponse.json({ error: "Este producto no acepta pago por transferencia en este momento" }, { status: 400 });
    }

    const bank = settings.bank;
    if (!bank || !bank.bank_name || !bank.account_number) {
      return NextResponse.json({ error: "La academia no tiene datos bancarios configurados" }, { status: 400 });
    }

    // Voucher: obligatorio, imagen o PDF, máx 5MB
    if (!fileBase64) {
      return NextResponse.json({ error: "Debes adjuntar el comprobante de tu transferencia" }, { status: 400 });
    }
    const dataUrlMatch = /^data:([^;]+);base64,(.*)$/.exec(fileBase64);
    const mime = dataUrlMatch ? dataUrlMatch[1] : (fileName || "").split(".").pop() === "pdf" ? "application/pdf" : "";
    if (!ALLOWED_MIME.includes(mime)) {
      return NextResponse.json({ error: "Formato no válido. Usa JPG, PNG, WebP, GIF o PDF." }, { status: 400 });
    }
    const b64 = dataUrlMatch ? dataUrlMatch[2] : fileBase64.split(",").pop() || "";
    const voucherBytes = Buffer.from(b64, "base64");
    if (voucherBytes.length === 0 || voucherBytes.length > MAX_VOUCHER_BYTES) {
      return NextResponse.json({ error: "El comprobante supera 5MB o está vacío" }, { status: 400 });
    }

    // Validar beneficiario (mismo patrón que create-order)
    const { data: beneficiary, error: benError } = await supabase
      .from("beneficiaries")
      .select("id, profile_id, dependent_id")
      .eq("id", beneficiaryId)
      .single();

    if (benError || !beneficiary) {
      return NextResponse.json({ error: "Beneficiario no válido" }, { status: 400 });
    }

    if (beneficiary.profile_id) {
      if (beneficiary.profile_id !== user.id) {
        return NextResponse.json({ error: "Beneficiario no válido" }, { status: 400 });
      }
    } else if (beneficiary.dependent_id) {
      const { data: dependent } = await supabase
        .from("dependents")
        .select("id")
        .eq("id", beneficiary.dependent_id)
        .eq("tutor_id", user.id)
        .single();
      if (!dependent) {
        return NextResponse.json({ error: "Beneficiario no válido" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Beneficiario no válido" }, { status: 400 });
    }

    // Validar plan + monto + concepto (espejo de create-order)
    let amount = 0;
    const conceptParts: string[] = [];
    let membershipPlanId: string | null = null;
    let personalizedPlanId: string | null = null;
    let useEnrollmentPlanId: string | null = null;

    if (productType === "memberships" || productType === "enrollment") {
      if (planId) {
        const { data: mp } = await admin
          .from("membership_plans")
          .select("id, name, price, active")
          .eq("id", planId)
          .single();
        if (!mp || !mp.active) {
          return NextResponse.json({ error: "Plan no disponible" }, { status: 400 });
        }
        membershipPlanId = mp.id;
        amount += Number(mp.price) || 0;
        conceptParts.push(`Membresía ${mp.name}`);
      }
      if (includeEnrollment && enrollmentPlanId) {
        const { data: ep } = await admin
          .from("enrollment_plans")
          .select("id, name, price, active")
          .eq("id", enrollmentPlanId)
          .single();
        if (!ep || !ep.active) {
          return NextResponse.json({ error: "Plan de inscripción no disponible" }, { status: 400 });
        }
        useEnrollmentPlanId = ep.id;
        amount += Number(ep.price) || 0;
        conceptParts.push(`Inscripción ${ep.name}`);
      }
      if (productType === "enrollment" && !planId && !includeEnrollment) {
        return NextResponse.json({ error: "Selecciona un plan de inscripción" }, { status: 400 });
      }
    } else if (productType === "personalized") {
      if (planId) {
        const { data: pp } = await admin
          .from("personalized_plans")
          .select("id, name, price, active")
          .eq("id", planId)
          .single();
        if (!pp || !pp.active) {
          return NextResponse.json({ error: "Plan no disponible" }, { status: 400 });
        }
        personalizedPlanId = pp.id;
        amount += Number(pp.price) || 0;
        conceptParts.push(`Clase Personalizada ${pp.name}`);
      }
    }

    if (amount <= 0 || conceptParts.length === 0) {
      return NextResponse.json({ error: "No se pudo determinar el monto del producto" }, { status: 400 });
    }

    const concept = conceptParts.join(" + ");
    const reference = generateReference();

    // Subir voucher al bucket public/vouchers
    const voucherId = crypto.randomUUID();
    const ext = extFromMime(mime);
    const path = `vouchers/${voucherId}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("public")
      .upload(path, voucherBytes, { contentType: mime, upsert: true });

    if (uploadError) {
      console.error(ROUTE_LOG, "Voucher upload failed:", uploadError);
      return NextResponse.json({ error: "Error al subir el comprobante. Intenta de nuevo." }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from("public").getPublicUrl(path);
    const receiptUrl = urlData?.publicUrl || null;

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      beneficiary_id: beneficiary.id,
      commerce_order: reference,
      concept,
      amount,
      method: "transferencia",
      status: "pendiente",
      receipt_url: receiptUrl,
    };
    if (membershipPlanId) insertPayload.membership_plan_id = membershipPlanId;
    if (personalizedPlanId) insertPayload.personalized_plan_id = personalizedPlanId;
    if (includeEnrollment) insertPayload.include_enrollment = true;
    if (useEnrollmentPlanId) insertPayload.enrollment_plan_id = useEnrollmentPlanId;

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert(insertPayload)
      .select("id, user_id, concept, amount, commerce_order")
      .single();

    if (paymentError || !payment) {
      console.error(ROUTE_LOG, "Payment insert failed:", paymentError);
      return NextResponse.json({ error: "Error al registrar la solicitud" }, { status: 500 });
    }

    // Guardar RUT informativo en el perfil si viene (no pisar el existente)
    if (rut && rut.trim()) {
      await admin
        .from("profiles")
        .update({ rut: rut.trim() })
        .eq("id", user.id);
    }

    // Notificación in-app a staff
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("role_id", 1)
      .limit(1)
      .maybeSingle();

    if (adminProfile) {
      await admin.from("notifications").insert({
        type: "sistema",
        subject: "Nueva solicitud de pago por transferencia",
        content: JSON.stringify({
          payment_id: payment.id,
          user_id: payment.user_id,
          concept: payment.concept,
          reference: payment.commerce_order,
          receipt_url: receiptUrl,
        }),
        target: "staff",
        sent_by: adminProfile.id,
        sent_at: new Date().toISOString(),
      });
    }

    // Correo a todos los admins (best-effort, patrón create-user)
    try {
      const { data: admins } = await admin
        .from("profiles")
        .select("email")
        .eq("role_id", 1);
      const adminEmails = (admins || [])
        .map((a) => a.email)
        .filter((e): e is string => Boolean(e));
      const fallback = process.env.SMTP_USER;
      const recipients: string[] = adminEmails.length
        ? adminEmails
        : fallback
          ? [fallback]
          : [];

      const { data: userProfile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const paymentUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://zona-elite-six.vercel.app"}/admin/ventas?tab=solicitudes`;

      for (const recipient of recipients) {
        try {
          await sendTransferRequestEmail({
            to: recipient,
            userName: userProfile?.full_name || user.email || "Usuario",
            concept: payment.concept as string,
            amount: Number(payment.amount) || 0,
            reference: payment.commerce_order as string,
            rut: rut || null,
            voucherUrl: receiptUrl,
            paymentUrl,
          });
        } catch (emailErr) {
          console.error(ROUTE_LOG, "Email failed for", recipient, emailErr);
        }
      }
    } catch (err) {
      console.error(ROUTE_LOG, "Admin emails query failed:", err);
    }

    return NextResponse.json({ ok: true, paymentId: payment.id, reference: payment.commerce_order });
  } catch (error) {
    console.error(ROUTE_LOG, "Unexpected error:", error);
    return NextResponse.json(
      { error: "Error al enviar la solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
