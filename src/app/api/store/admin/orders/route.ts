import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { FLOW_LOG_PREFIX } from "@/lib/flow";
import { getOrderItems, cancelStoreOrder } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const ROUTE_LOG = `${FLOW_LOG_PREFIX}/store/admin/orders`;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Inicia sesión" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role_id !== 1) {
    return { error: NextResponse.json({ error: "Solo administradores" }, { status: 403 }) };
  }

  return { userId: user.id };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const admin = getAdminClient();

    const { data: orders, error } = await admin
      .from("product_orders")
      .select("id, user_id, status, total, reference, guest_email, guest_phone, guest_name, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(ROUTE_LOG, "Failed to list orders:", error);
      return NextResponse.json({ error: "Error al listar órdenes" }, { status: 500 });
    }

    // Agregar items a cada orden.
    const result = [];
    for (const order of (orders as Array<Record<string, unknown>>) || []) {
      const items = await getOrderItems(admin, String(order.id));
      result.push({
        ...order,
        items: items.map((i) => ({
          product_id: i.product_id,
          name: i.products?.name || "Producto",
          quantity: i.quantity,
          unit_price: Number(i.unit_price) || 0,
          subtotal: Number(i.unit_price || 0) * i.quantity,
        })),
      });
    }

    return NextResponse.json({ orders: result });
  } catch (err) {
    console.error(ROUTE_LOG, "Unexpected error:", err);
    return NextResponse.json({ error: "Error al listar órdenes" }, { status: 500 });
  }
}

interface OrderActionBody {
  orderId?: string;
  action?: "enviado" | "entregado" | "cancelar";
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = (await request.json()) as OrderActionBody;
    const { orderId, action } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Orden es obligatoria" }, { status: 400 });
    }
    if (action !== "enviado" && action !== "entregado" && action !== "cancelar") {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: order } = await admin
      .from("product_orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    if (order.status === "cancelado") {
      return NextResponse.json({ error: "La orden ya fue cancelada" }, { status: 409 });
    }

    if (action === "cancelar") {
      const result = await cancelStoreOrder(admin, orderId);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "No se pudo cancelar la orden" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, status: "cancelado" });
    }

    // Enviado / entregado: solo desde estados "pagado" o "enviado" (encadenado).
    const targetStatus = action;
    const allowedFrom =
      targetStatus === "enviado" ? ["pagado"] : ["pagado", "enviado"];

    if (!allowedFrom.includes(order.status)) {
      return NextResponse.json(
        { error: `No se puede marcar como ${targetStatus} desde el estado "${order.status}"` },
        { status: 409 }
      );
    }

    const { data: updated, error: updateError } = await admin
      .from("product_orders")
      .update({ status: targetStatus })
      .eq("id", orderId)
      .eq("status", order.status)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: "La orden cambió de estado. Recarga e intenta de nuevo." }, { status: 409 });
    }

    console.log(ROUTE_LOG, "Order updated:", orderId, targetStatus);
    return NextResponse.json({ ok: true, status: targetStatus });
  } catch (err) {
    console.error(ROUTE_LOG, "Unexpected error:", err);
    return NextResponse.json({ error: "Error al actualizar la orden" }, { status: 500 });
  }
}
