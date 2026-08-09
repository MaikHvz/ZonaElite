import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createFlowOrder, getFlowConfig, FLOW_LOG_PREFIX } from "@/lib/flow";
import { buildStoreReference } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ROUTE_LOG = `${FLOW_LOG_PREFIX}/store/debug-flow`;

// Diagnóstico temporal (2026-08-09): bisección del "Error Processing Request"
// de sandbox.flow.cl/app/web/pay.php en órdenes de tienda. Crea 5 órdenes Flow
// variando un solo campo a la vez respecto a la orden que falla:
//   1. control      -> membresía-style (commerceOrder UUID, sin returnUrl)
//   2. storeFull    -> réplica exacta de la orden de tienda que falla
//   3. uuidCommerce -> como storeFull pero commerceOrder UUID (aisla commerceOrder)
//   4. defaultRet   -> como storeFull pero sin returnUrl (aisla urlReturn)
//   5. profileEmail -> como storeFull pero con profiles.email (aisla email)
// NO escribe en la BD y solo crea órdenes en sandbox. SE ELIMINARÁ al cerrar el caso.
export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    supabase = null;
  }

  const {
    data: { user },
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  if (!user?.email) {
    return NextResponse.json({ error: "Se requiere sesión iniciada" }, { status: 401 });
  }

  const { apiUrl } = getFlowConfig();

  const { data: profile } = await getAdminClient()
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  const profileEmail = profile?.email || null;

  const storeRef = buildStoreReference();
  const uuidRef = crypto.randomUUID();

  const amount = 60000;

  const orders = [
    {
      label: "1-control",
      commerceOrder: crypto.randomUUID(),
      subject: "Control - ZONAELITE",
      amount: 5000,
      email: user.email,
    },
    {
      label: "2-storeFull",
      commerceOrder: storeRef,
      subject: `Tienda: ${storeRef} - ZONAELITE`,
      amount,
      email: user.email,
      returnUrl: "/tienda/confirmacion",
    },
    {
      label: "3-uuidCommerce",
      commerceOrder: uuidRef,
      subject: `Tienda: ${storeRef} - ZONAELITE`,
      amount,
      email: user.email,
      returnUrl: "/tienda/confirmacion",
    },
    {
      label: "4-defaultRet",
      commerceOrder: storeRef,
      subject: `Tienda: ${storeRef} - ZONAELITE`,
      amount,
      email: user.email,
    },
    {
      label: "5-profileEmail",
      commerceOrder: crypto.randomUUID(),
      subject: `Tienda: ${storeRef} - ZONAELITE`,
      amount,
      email: profileEmail || user.email,
      returnUrl: "/tienda/confirmacion",
    },
  ];

  const results = [];

  for (const order of orders) {
    try {
      const flow = await createFlowOrder(order);
      results.push({
        label: order.label,
        commerceOrder: order.commerceOrder,
        subject: order.subject,
        amount: order.amount,
        email: order.email,
        returnUrl: order.returnUrl || "(default /dashboard/pagos)",
        flowOrder: flow.flowOrder,
        url: flow.url,
      });
    } catch (err) {
      console.error(ROUTE_LOG, "Order failed:", order.label, err);
      results.push({
        label: order.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ apiUrl, orders: results });
}
