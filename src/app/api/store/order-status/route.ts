import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrderItems } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

interface OrderStatusItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ status: "error", message: "Token requerido" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Buscar el pago por el token de Flow para resolver la orden de tienda.
    const { data: payment } = await admin
      .from("payments")
      .select("id, order_id, concept, status")
      .eq("flow_token", token)
      .maybeSingle();

    if (!payment?.order_id) {
      // Orden no encontrada (pago no registrado para tienda).
      return NextResponse.json({ status: "not_found" });
    }

    const { data: order } = await admin
      .from("product_orders")
      .select("id, reference, status, total, created_at, user_id, guest_email, guest_name")
      .eq("id", payment.order_id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ status: "not_found" });
    }

    const items = await getOrderItems(admin, order.id);

    const itemsPayload: OrderStatusItem[] = items.map((i) => ({
      product_id: i.product_id,
      name: i.products?.name || "Producto",
      quantity: i.quantity,
      unit_price: Number(i.unit_price) || 0,
      subtotal: Number(i.unit_price || 0) * i.quantity,
    }));

    // Si el pago está "pagado" pero la orden sigue "pendiente", es un caso de
    // confirmación fallida del callback; el estado de la orden es la fuente de
    // verdad para la UI de confirmación.
    const orderStatus = order.status;

    return NextResponse.json({
      status: orderStatus,
      reference: order.reference || order.id,
      total: Number(order.total) || 0,
      createdAt: order.created_at,
      items: itemsPayload,
    });
  } catch (err) {
    console.error("[flow-sdk]/store/order-status", "Unexpected error:", err);
    return NextResponse.json({ status: "error", message: "Error al consultar la orden" }, { status: 500 });
  }
}
