"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface OrderStatusItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface OrderStatusResponse {
  status: string;
  reference: string;
  total: number;
  createdAt: string;
  items: OrderStatusItem[];
}

function ConfirmacionContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<"loading" | "paid" | "failed" | "pending" | "not_found" | "error">(
    "loading"
  );
  const [order, setOrder] = useState<OrderStatusResponse | null>(null);

  const checkStatus = useCallback(async () => {
    if (!token) {
      setState("not_found");
      return;
    }

    try {
      const res = await fetch(`/api/store/order-status?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        return;
      }

      if (data.status === "not_found") {
        setState("not_found");
        return;
      }

      setOrder(data);

      if (data.status === "pagado" || data.status === "enviado" || data.status === "entregado") {
        setState("paid");
      } else if (data.status === "cancelado" || data.status === "rechazado") {
        setState("failed");
      } else {
        setState("pending");
      }
    } catch {
      setState("error");
    }
  }, [token]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      checkStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return (
    <div className="min-h-screen bg-background pt-32 pb-16 px-5">
      <div className="max-w-[560px] mx-auto text-center">
        {state === "loading" && (
          <div className="py-20">
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant">
              Confirmando tu pago...
            </p>
          </div>
        )}

        {state === "paid" && order && (
          <div className="bg-surface-container-lowest border border-green-500/20 rounded-2xl p-8">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-green-400 text-[32px]">check_circle</span>
            </div>
            <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter mb-2">
              ¡Pago <span className="text-green-400">recibido</span>!
            </h1>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mb-6">
              Tu pedido fue confirmado. Enviamos el recibo a tu correo.
            </p>

            <div className="bg-surface-container rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between mb-2">
                <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                  N° de orden
                </span>
                <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface font-mono">
                  {order.reference}
                </span>
              </div>
              {order.items.map((item) => (
                <div key={item.product_id} className="flex justify-between py-1.5 border-t border-on-surface/5">
                  <span className="font-[family-name:var(--font-body-sm)] text-[13px] text-on-surface-variant">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-[family-name:var(--font-body-sm)] text-[13px] text-on-surface">
                    ${item.subtotal.toLocaleString("es-CL")}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-on-surface/10">
                <span className="font-[family-name:var(--font-headline-md)] text-[14px] text-on-surface uppercase">
                  Total
                </span>
                <span className="font-[family-name:var(--font-headline-md)] text-[16px] text-primary">
                  ${order.total.toLocaleString("es-CL")}
                </span>
              </div>
            </div>

            <Link
              href="/productos"
              className="inline-flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] px-8 py-3 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Seguir comprando
            </Link>
          </div>
        )}

        {state === "failed" && (
          <div className="bg-surface-container-lowest border border-red-500/20 rounded-2xl p-8">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-red-400 text-[32px]">cancel</span>
            </div>
            <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter mb-2">
              Pago <span className="text-red-400">no concretado</span>
            </h1>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mb-6">
              El pago fue cancelado o rechazado. No se realizó ningún cargo y el stock reservado fue devuelto.
            </p>
            <Link
              href="/carrito"
              className="inline-flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] px-8 py-3 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
              Reintentar compra
            </Link>
          </div>
        )}

        {state === "pending" && (
          <div className="py-20">
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant mb-2">
              Tu pago está pendiente de confirmación.
            </p>
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/60">
              Esta página se actualiza automáticamente.
            </p>
          </div>
        )}

        {state === "not_found" && (
          <div className="py-20">
            <span className="material-symbols-outlined text-on-surface/20 text-7xl mb-4 block">search_off</span>
            <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant mb-6">
              No encontramos esta orden. Es posible que el pago no se haya iniciado.
            </p>
            <Link
              href="/productos"
              className="inline-flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] px-8 py-3 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Ir a la tienda
            </Link>
          </div>
        )}

        {state === "error" && (
          <div className="py-20">
            <span className="material-symbols-outlined text-on-surface/20 text-7xl mb-4 block">error</span>
            <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant mb-6">
              Ocurrió un error al consultar tu pedido. Intenta de nuevo en unos segundos.
            </p>
            <button
              onClick={checkStatus}
              className="inline-flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] px-8 py-3 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background pt-32 px-5" />}>
      <ConfirmacionContent />
    </Suspense>
  );
}
