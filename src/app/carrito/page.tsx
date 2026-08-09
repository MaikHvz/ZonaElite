"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useSession } from "@/providers/SessionProvider";

export default function CarritoPage() {
  const { items, totalPrice, setQuantity, removeItem, clearCart } = useCart();
  const { user, profile, loading: sessionLoading } = useSession();
  const router = useRouter();

  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGuest = !user;

  const handleCheckout = async () => {
    setError(null);

    if (items.length === 0) {
      setError("Tu carrito está vacío");
      return;
    }

    const payload: {
      items: { product_id: string; quantity: number }[];
      guest?: { email: string; phone: string; name?: string };
    } = {
      items: items.map((it) => ({ product_id: it.productId, quantity: it.quantity })),
    };

    if (isGuest) {
      if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        setError("Ingresa un email válido para recibir tu recibo");
        return;
      }
      if (!guestPhone.trim()) {
        setError("Ingresa tu teléfono de contacto");
        return;
      }
      payload.guest = {
        email: guestEmail.trim(),
        phone: guestPhone.trim(),
        name: guestName.trim() || undefined,
      };
    }

    setPaying(true);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo iniciar el pago. Intenta de nuevo.");
        setPaying(false);
        return;
      }

      clearCart();
      router.push(data.url);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[44px] text-on-surface uppercase tracking-tighter mb-2">
            Tu <span className="text-primary">Carrito</span>
          </h1>
          <p className="font-[family-name:var(--font-body-lg)] text-[16px] text-on-surface-variant">
            Revisa tus productos antes de pagar
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-on-surface/20 text-7xl mb-4 block">
              shopping_cart
            </span>
            <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant mb-6">
              Tu carrito está vacío.
            </p>
            <Link
              href="/productos"
              className="inline-flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] px-8 py-3 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Ir a la tienda
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
            {/* Items */}
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-4 bg-surface-container-lowest border border-on-surface/5 rounded-2xl p-4"
                >
                  <div className="w-16 h-16 bg-surface-container rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-on-surface/30 text-2xl">package_2</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/productos/${item.productId}`}
                      className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase hover:text-primary transition-colors block truncate"
                    >
                      {item.name}
                    </Link>
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mt-0.5">
                      ${item.price.toLocaleString("es-CL")} c/u
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors cursor-pointer"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-24 text-right">
                    <span className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface">
                      ${(item.price * item.quantity).toLocaleString("es-CL")}
                    </span>
                  </div>

                  <button
                    onClick={() => removeItem(item.productId)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Resumen */}
            <div className="bg-surface-container-lowest border border-on-surface/5 rounded-2xl p-6 sticky top-24">
              <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase mb-4">
                Resumen
              </h3>

              <div className="flex items-center justify-between mb-6">
                <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
                  Total
                </span>
                <span className="font-[family-name:var(--font-headline-lg)] text-[26px] text-primary">
                  ${totalPrice.toLocaleString("es-CL")}
                </span>
              </div>

              {isGuest && !sessionLoading && (
                <div className="space-y-3 mb-4">
                  <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                    Completa tus datos para continuar (el recibo llega a tu correo):
                  </p>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Nombre (opcional)"
                    className="w-full px-4 py-2.5 rounded-lg bg-surface-container border border-on-surface/10 text-on-surface text-[14px] focus:outline-none focus:border-primary/50"
                  />
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="Email *"
                    className="w-full px-4 py-2.5 rounded-lg bg-surface-container border border-on-surface/10 text-on-surface text-[14px] focus:outline-none focus:border-primary/50"
                  />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Teléfono *"
                    className="w-full px-4 py-2.5 rounded-lg bg-surface-container border border-on-surface/10 text-on-surface text-[14px] focus:outline-none focus:border-primary/50"
                  />
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="font-[family-name:var(--font-body-md)] text-[13px] text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] px-6 py-3.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">lock</span>
                {paying ? "Preparando pago..." : "Pagar con Flow"}
              </button>

              <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60 mt-4 text-center">
                Al reservar tu pedido se descuenta el stock de forma segura. Si el pago se cancela o rechaza, el stock se devuelve automáticamente.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
