import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createFlowOrder, FLOW_LOG_PREFIX } from "@/lib/flow";
import {
  reserveStock,
  restoreStock,
  buildStoreReference,
  StockError,
  STORE_CONCEPT_PREFIX,
} from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const ROUTE_LOG = `${FLOW_LOG_PREFIX}/store/checkout`;

interface CheckoutItemInput {
  product_id?: string;
  quantity?: number;
}

interface CheckoutGuestInput {
  email?: string;
  phone?: string;
  name?: string;
}

interface CheckoutBody {
  items?: CheckoutItemInput[];
  guest?: CheckoutGuestInput;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9 ()-]{8,20}$/;

export async function POST(request: Request) {
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

  const admin = getAdminClient();

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (rawItems.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }

  const items = rawItems.map((it) => ({
    product_id: String(it.product_id || ""),
    quantity: Number(it.quantity) || 0,
  }));

  if (items.some((i) => !i.product_id || i.quantity <= 0 || !Number.isInteger(i.quantity))) {
    return NextResponse.json(
      { error: "Carrito inválido: verifica las cantidades" },
      { status: 400 }
    );
  }

  // Invitado: email + teléfono obligatorios, nombre opcional.
  let guestEmail: string | null = null;
  let guestPhone: string | null = null;
  let guestName: string | null = null;

  if (user) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .maybeSingle();
    guestEmail = profile?.email || user.email || null;
  } else {
    const guest = body.guest || {};
    guestEmail = (guest.email || "").trim();
    guestPhone = (guest.phone || "").trim();
    guestName = (guest.name || "").trim() || null;

    if (!guestEmail || !EMAIL_REGEX.test(guestEmail)) {
      return NextResponse.json({ error: "Ingresa un email válido para el recibo" }, { status: 400 });
    }
    if (!guestPhone || !PHONE_REGEX.test(guestPhone)) {
      return NextResponse.json({ error: "Ingresa un teléfono válido" }, { status: 400 });
    }
  }

  // Cargar productos desde la BD (precio siempre del servidor, nunca del cliente).
  const productIds = items.map((i) => i.product_id);
  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, name, price, stock, active")
    .in("id", productIds);

  if (productsError) {
    console.error(ROUTE_LOG, "Failed to load products:", productsError);
    return NextResponse.json({ error: "Error al cargar productos" }, { status: 500 });
  }

  const productMap = new Map(
    (products as { id: string; name: string; price: number; stock: number; active: boolean }[]).map(
      (p) => [p.id, p]
    )
  );

  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 400 });
    }
    if (!product.active) {
      return NextResponse.json({ error: `${product.name} no está disponible` }, { status: 400 });
    }
    if (product.stock < item.quantity) {
      return NextResponse.json(
        { error: `Stock insuficiente de "${product.name}"` },
        { status: 409 }
      );
    }
  }

  const total = items.reduce((acc, item) => {
    const product = productMap.get(item.product_id)!;
    return acc + Number(product.price) * item.quantity;
  }, 0);

  // Reservar stock de forma atómica.
  let reservedItems: { product_id: string; quantity: number }[] = [];
  try {
    reservedItems = await reserveStock(admin, items);
  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json(
        { error: "No hay stock suficiente para uno o más productos" },
        { status: 409 }
      );
    }
    console.error(ROUTE_LOG, "reserveStock threw:", err);
    return NextResponse.json({ error: "Error al reservar stock" }, { status: 500 });
  }

  const reference = buildStoreReference();
  const concept = `${STORE_CONCEPT_PREFIX} ${reference}`;
  const commerceOrder = reference;

  try {
    // Crear la orden de tienda (pendiente de pago).
    const orderPayload: Record<string, unknown> = {
      status: "pendiente",
      total,
      reference,
    };
    if (user) {
      orderPayload.user_id = user.id;
    } else {
      orderPayload.guest_email = guestEmail;
      orderPayload.guest_phone = guestPhone;
      orderPayload.guest_name = guestName;
    }

    const { data: order, error: orderError } = await admin
      .from("product_orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderError || !order) {
      console.error(ROUTE_LOG, "Failed to create product order:", orderError);
      throw new Error(`no-order: ${String(orderError?.message || orderError)}`);
    }

    const orderItemsPayload = items.map((item) => {
      const product = productMap.get(item.product_id)!;
      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(product.price),
      };
    });

    const { error: itemsError } = await admin
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      console.error(ROUTE_LOG, "Failed to insert order items:", itemsError);
      throw new Error(`no-items: ${String(itemsError?.message || itemsError)}`);
    }

    // Crear el pago Flow (user_id puede ser NULL para invitados).
    const paymentPayload: Record<string, unknown> = {
      commerce_order: commerceOrder,
      order_id: order.id,
      concept,
      amount: total,
      method: "flow",
      status: "pendiente",
    };
    if (user) {
      paymentPayload.user_id = user.id;
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert(paymentPayload)
      .select("id")
      .single();

    if (paymentError || !payment) {
      console.error(ROUTE_LOG, "Failed to create payment:", paymentError);
      throw new Error(`no-payment: ${String(paymentError?.message || paymentError)}`);
    }

    const flowResponse = await createFlowOrder({
      commerceOrder,
      subject: `${concept} - ZONAELITE`,
      amount: Math.round(total),
      email: guestEmail || "",
      returnUrl: "/tienda/confirmacion",
    });

    await admin
      .from("payments")
      .update({
        flow_token: flowResponse.token,
        flow_order: flowResponse.flowOrder,
      })
      .eq("id", payment.id);

    return NextResponse.json({
      url: flowResponse.url,
      token: flowResponse.token,
      reference,
      total,
    });
  } catch (err) {
    // Fallo post-reserva: restaurar el stock reservado.
    console.error(ROUTE_LOG, "Checkout failed after reservation, restoring stock:", err);
    if (reservedItems && reservedItems.length > 0) {
      try {
        await restoreStock(admin, reservedItems);
      } catch (restoreErr) {
        console.error(ROUTE_LOG, "Failed to restore stock after error:", restoreErr);
      }
    }
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Error al procesar el pago. Intenta de nuevo.", detail },
      { status: 500 }
    );
  }
}
