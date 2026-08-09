import crypto from "crypto";
import { FLOW_LOG_PREFIX } from "./flow.ts";
import { sendProductReceiptEmail } from "./email.ts";

const STORE_LOG = `${FLOW_LOG_PREFIX}/store`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface StoreCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
}

export interface StoreCheckoutItem {
  product_id: string;
  quantity: number;
}

export interface StorePaymentRow {
  id: string;
  user_id: string | null;
  order_id: string | null;
  concept: string | null;
  amount?: number | null;
  status: string;
}

export interface StoreOrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products: { id: string; name: string } | null;
}

export const STORE_CONCEPT_PREFIX = "Tienda:";
export const STORE_ORDER_STATUS = {
  borrador: "borrador",
  pendiente: "pendiente",
  pagado: "pagado",
  enviado: "enviado",
  entregado: "entregado",
  cancelado: "cancelado",
} as const;

export type StoreOrderStatus = (typeof STORE_ORDER_STATUS)[keyof typeof STORE_ORDER_STATUS];

export function isStorePayment(payment: { order_id?: string | null; concept?: string | null }): boolean {
  return Boolean(payment.order_id) && Boolean(payment.concept && payment.concept.startsWith(STORE_CONCEPT_PREFIX));
}

export function buildStoreReference(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:TZ]/g, "")
    .slice(0, 14);
  const rand = crypto.randomUUID().slice(0, 8);
  return `REF-ZE-prod-${ts}${rand}`;
}

export class StockError extends Error {
  productId: string;
  quantity: number;

  constructor(productId: string, quantity: number) {
    super(`Stock insuficiente para el producto ${productId} (solicitado: ${quantity})`);
    this.name = "StockError";
    this.productId = productId;
    this.quantity = quantity;
  }
}

/**
 * Reserva stock de forma atómica por producto vía RPC
 * `decrement_product_stock` (UPDATE ... WHERE stock >= qty). Si algún item no
 * tiene stock suficiente, lanza StockError con el detalle; el caller debe
 * restaurar los items ya reservados con `restoreStock`.
 * Devuelve la lista de items reservados.
 */
export async function reserveStock(
  supabase: SupabaseClient,
  items: StoreCheckoutItem[]
): Promise<StoreCheckoutItem[]> {
  const reserved: StoreCheckoutItem[] = [];

  for (const item of items) {
    const { data: ok, error } = await supabase.rpc("decrement_product_stock", {
      p_product_id: item.product_id,
      p_qty: item.quantity,
    });

    if (error || !ok) {
      console.error(STORE_LOG, "reserveStock failed:", item.product_id, error);
      throw new StockError(item.product_id, item.quantity);
    }

    reserved.push(item);
  }

  return reserved;
}

/**
 * Restaura stock de una lista de items reservados vía RPC
 * `increment_product_stock`. Idempotente y best-effort: nunca lanza (los
 * fallos se loguean para revisión manual).
 */
export async function restoreStock(
  supabase: SupabaseClient,
  items: StoreCheckoutItem[]
): Promise<void> {
  for (const item of items) {
    const { error } = await supabase.rpc("increment_product_stock", {
      p_product_id: item.product_id,
      p_qty: item.quantity,
    });

    if (error) {
      console.error(STORE_LOG, "restoreStock failed:", item.product_id, error);
    }
  }
}

/**
 * Consulta los items de una orden de tienda con el nombre del producto.
 */
export async function getOrderItems(
  supabase: SupabaseClient,
  orderId: string
): Promise<StoreOrderItemRow[]> {
  const { data } = await supabase
    .from("order_items")
    .select("id, order_id, product_id, quantity, unit_price, products(id, name)")
    .eq("order_id", orderId);

  return (data as StoreOrderItemRow[]) || [];
}

/**
 * Resuelve el email de contacto de una orden: el de la cuenta si es un usuario
 * autenticado (product_orders.user_id → profiles.email), si no el del invitado
 * (product_orders.guest_email).
 */
export async function getOrderContactEmail(
  supabase: SupabaseClient,
  order: { user_id?: string | null; guest_email?: string | null }
): Promise<string | null> {
  if (order.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", order.user_id)
      .maybeSingle();
    if (profile?.email) return profile.email;
  }
  return order.guest_email || null;
}

/**
 * Confirma una orden de tienda tras el pago Flow exitoso:
 *  - `product_orders.status` → 'pagado'
 * Idempotente: si ya está pagado/enviado/entregado, no hace nada.
 * Devuelve `{ success, orderId?, error? }`.
 */
export async function confirmProductOrder(
  supabase: SupabaseClient,
  payment: StorePaymentRow
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  if (!payment.order_id) {
    return { success: false, error: "Pago sin orden de tienda" };
  }

  const { data: order } = await supabase
    .from("product_orders")
    .select("id, status")
    .eq("id", payment.order_id)
    .maybeSingle();

  if (!order) {
    console.error(STORE_LOG, "Product order not found:", payment.order_id);
    return { success: false, error: "Orden de tienda no encontrada" };
  }

  if (order.status === "pagado" || order.status === "enviado" || order.status === "entregado") {
    console.log(STORE_LOG, "Order already confirmed:", payment.order_id, order.status);
    return { success: true, orderId: payment.order_id };
  }

  const { error: updateError } = await supabase
    .from("product_orders")
    .update({ status: "pagado" })
    .eq("id", payment.order_id);

  if (updateError) {
    console.error(STORE_LOG, "Failed to confirm product order:", payment.order_id, updateError);
    return { success: false, error: "No se pudo confirmar la orden de tienda" };
  }

  console.log(STORE_LOG, "Product order confirmed:", payment.order_id);
  return { success: true, orderId: payment.order_id };
}

/**
 * Cancela una orden de tienda y restaura el stock reservado. Usada cuando Flow
 * rechaza/anula el pago o cuando el admin cancela manualmente una orden.
 * Idempotente: si ya está cancelada, no vuelve a restaurar (evita doble stock).
 */
export async function cancelStoreOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: order } = await supabase
    .from("product_orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    console.error(STORE_LOG, "Product order not found for cancel:", orderId);
    return { success: false, error: "Orden de tienda no encontrada" };
  }

  if (order.status === "cancelado") {
    console.log(STORE_LOG, "Order already cancelled:", orderId);
    return { success: true };
  }

  const items = await getOrderItems(supabase, orderId);

  const { error: updateError } = await supabase
    .from("product_orders")
    .update({ status: "cancelado" })
    .eq("id", orderId);

  if (updateError) {
    console.error(STORE_LOG, "Failed to cancel product order:", orderId, updateError);
    return { success: false, error: "No se pudo cancelar la orden de tienda" };
  }

  if (items.length > 0) {
    await restoreStock(
      supabase,
      items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }))
    );
  }

  console.log(STORE_LOG, "Product order cancelled and stock restored:", orderId);
  return { success: true };
}

/**
 * Envía el recibo de compra al correo de contacto de una orden de tienda
 * (cuenta del usuario o email de invitado). Best-effort: nunca lanza.
 * Devuelve `{ success, email? }` con el destinatario resuelto (null si no hay
 * correo para enviar).
 */
export async function sendStoreOrderReceipt(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ success: boolean; email?: string | null; error?: string }> {
  try {
    const { data: order } = await supabase
      .from("product_orders")
      .select("id, reference, total, user_id, guest_email, guest_name")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      console.error(STORE_LOG, "Order not found for receipt:", orderId);
      return { success: false, error: "Orden no encontrada" };
    }

    const email = await getOrderContactEmail(supabase, order);

    if (!email) {
      console.warn(STORE_LOG, "No contact email for order, skipping receipt:", orderId);
      return { success: false, email: null, error: "Sin correo de contacto" };
    }

    const items = await getOrderItems(supabase, orderId);

    if (items.length === 0) {
      console.warn(STORE_LOG, "Order has no items, skipping receipt:", orderId);
      return { success: false, email, error: "Orden sin items" };
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://zona-elite-six.vercel.app";

    await sendProductReceiptEmail({
      to: email,
      buyerName: order.guest_name || null,
      reference: order.reference || orderId,
      items: items.map((i) => ({
        name: i.products?.name || "Producto",
        quantity: i.quantity,
        unit_price: Number(i.unit_price) || 0,
      })),
      total: Number(order.total) || 0,
      storeUrl: `${base}/productos`,
    });

    console.log(STORE_LOG, "Receipt sent for order:", orderId, email);
    return { success: true, email };
  } catch (err) {
    console.error(STORE_LOG, "sendStoreOrderReceipt threw:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Manejo unificado del pago de tienda aprobado (usado por confirmation,
 * verify y force-confirm): confirma la orden (product_orders → 'pagado') y
 * envía el recibo al correo de contacto. Best-effort, nunca lanza.
 */
export async function handleStorePaymentApproved(
  supabase: SupabaseClient,
  payment: StorePaymentRow
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const confirmed = await confirmProductOrder(supabase, payment);
    if (!confirmed.success) {
      return confirmed;
    }
    if (confirmed.orderId) {
      await sendStoreOrderReceipt(supabase, confirmed.orderId);
    }
    return confirmed;
  } catch (err) {
    console.error(STORE_LOG, "handleStorePaymentApproved threw:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Manejo unificado del pago de tienda rechazado/anulado (usado por
 * confirmation y verify): cancela la orden (product_orders → 'cancelado') y
 * restaura el stock reservado. Best-effort, nunca lanza.
 */
export async function handleStorePaymentRejected(
  supabase: SupabaseClient,
  payment: StorePaymentRow
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!payment.order_id) {
      return { success: false, error: "Pago sin orden de tienda" };
    }
    return await cancelStoreOrder(supabase, payment.order_id);
  } catch (err) {
    console.error(STORE_LOG, "handleStorePaymentRejected threw:", err);
    return { success: false, error: String(err) };
  }
}
