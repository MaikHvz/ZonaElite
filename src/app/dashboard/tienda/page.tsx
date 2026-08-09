"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/providers/SessionProvider";

interface StoreItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products: { id: string; name: string }[] | null;
}

interface StoreOrder {
  id: string;
  reference: string | null;
  status: string;
  total: number;
  created_at: string;
  order_items: StoreItem[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente de pago", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  pagado: { label: "Pagado", color: "text-green-400 border-green-500/30 bg-green-500/10" },
  enviado: { label: "Enviado", color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  entregado: { label: "Entregado", color: "text-green-400 border-green-500/30 bg-green-500/10" },
  cancelado: { label: "Cancelado", color: "text-red-400 border-red-500/30 bg-red-500/10" },
  borrador: { label: "Borrador", color: "text-on-surface-variant border-on-surface/15 bg-on-surface/5" },
};

export default function DashboardTiendaPage() {
  const { user } = useSession();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("product_orders")
      .select("id, reference, status, total, created_at, order_items(id, product_id, quantity, unit_price, products(id, name))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError("No se pudieron cargar tus compras.");
        } else {
          setOrders((data as StoreOrder[]) || []);
        }
        setLoading(false);
      });
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[26px] md:text-[32px] text-on-surface uppercase tracking-tighter mb-1">
          Mis Compras de <span className="text-primary">Tienda</span>
        </h1>
        <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
          El estado de tus pedidos de la tienda de productos
        </p>
      </div>

      {loading ? (
        <div className="glass-card p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-on-surface/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-card p-6 text-center">
          <p className="font-[family-name:var(--font-body-md)] text-on-surface mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-6 py-2 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-6xl mb-4 block">storefront</span>
          <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant mb-6">
            Aún no tienes compras en la tienda.
          </p>
          <Link
            href="/productos"
            className="inline-flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-6 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">storefront</span>
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = STATUS_LABELS[order.status] || STATUS_LABELS.borrador;
            const itemCount = order.order_items?.reduce((acc, it) => acc + it.quantity, 0) || 0;
            return (
              <div key={order.id} className="glass-card p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase">
                      {order.reference || order.id.slice(0, 8)}
                    </p>
                    <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">
                      {new Date(order.created_at).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      · {itemCount} {itemCount === 1 ? "artículo" : "artículos"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full border ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-t border-on-surface/5">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-[15px]">package_2</span>
                        </span>
                        <div>
                          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                            {item.products?.[0]?.name || "Producto"}
                          </p>
                          <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">
                            ${Number(item.unit_price).toLocaleString("es-CL")} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                        ${(Number(item.unit_price) * item.quantity).toLocaleString("es-CL")}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-on-surface/10 pt-4">
                  <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                    Total
                  </span>
                  <span className="font-[family-name:var(--font-headline-md)] text-[18px] text-primary">
                    ${Number(order.total).toLocaleString("es-CL")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
