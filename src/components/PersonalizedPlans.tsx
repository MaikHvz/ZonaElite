"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/providers/SessionProvider";
import { getActivePersonalizedPlans, type PersonalizedPlanData } from "@/lib/supabase/dashboard";
import PersonalizedCheckoutModal from "@/components/PersonalizedCheckoutModal";

export default function PersonalizedPlans() {
  const { user } = useSession();
  const [plans, setPlans] = useState<PersonalizedPlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    getActivePersonalizedPlans().then((res) => {
      setPlans((res.data as PersonalizedPlanData[]) || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <section className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto">
        <div className="flex justify-center py-12">
          <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </section>
    );
  }

  if (plans.length === 0) return null;

  const formatPrice = (price: number) => "$" + price.toLocaleString("es-CL");

  return (
    <section className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto">
      <div className="text-center mb-16">
        <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
          Atención 1 a 1
        </span>
        <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter">
          ¿Necesitas{" "}
          <span className="text-primary">Clases Personalizadas?</span>
        </h2>
        <p className="mt-4 font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] text-on-surface-variant max-w-2xl mx-auto">
          Entrenamiento individual o grupos pequeños con foco total en tus
          objetivos. Independiente de tu membresía regular.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5 items-stretch max-w-[960px] mx-auto">
        {plans.map((plan) => {
          const features = Array.isArray(plan.features) ? plan.features : [];
          return (
            <article
              key={plan.id}
              className="relative flex flex-col rounded-2xl transition-all duration-300 bg-surface-container-low border border-on-surface/5 hover:border-on-surface/10 hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
            >
              <div className="p-7 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    workspace_premium
                  </span>
                  <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] leading-[22px] text-on-surface-variant uppercase">
                    {plan.name}
                  </h3>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-[family-name:var(--font-headline-lg)] text-[42px] leading-[44px] tracking-[-0.03em] text-on-surface">
                    {formatPrice(plan.price)}
                  </span>
                </div>
                <p className="mt-1 font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">
                  {plan.total_classes} {plan.total_classes === 1 ? "clase" : "clases"} · vigencia {plan.validity_days} días
                </p>
              </div>

              <div className="px-7 pb-2">
                <div className="h-px bg-on-surface/5" />
              </div>

              <div className="flex-grow px-7 pt-5 pb-6">
                <ul className="space-y-3">
                  {features.map((feature: string) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[18px] mt-0.5 text-primary/60">
                        check_circle
                      </span>
                      <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface">
                        {feature}
                      </span>
                    </li>
                  ))}
                  {features.length === 0 && (
                    <li className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[18px] mt-0.5 text-primary/60">
                        check_circle
                      </span>
                      <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface">
                        Entrenamiento 1 a 1 con coach
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="px-7 pb-7">
                {user ? (
                  <button
                    onClick={() => setCheckoutOpen(true)}
                    className="w-full py-3 px-6 text-center font-[family-name:var(--font-headline-md)] text-[13px] leading-[16px] uppercase rounded-lg transition-all duration-200 cursor-pointer border border-on-surface/15 text-on-surface hover:bg-on-surface/5 hover:border-on-surface/25 hover:scale-[1.01]"
                  >
                    Comprar ahora
                  </button>
                ) : (
                  <Link
                    href="/auth"
                    className="block w-full py-3 px-6 text-center font-[family-name:var(--font-headline-md)] text-[13px] leading-[16px] uppercase rounded-lg transition-all duration-200 border border-on-surface/15 text-on-surface hover:bg-on-surface/5 hover:border-on-surface/25 hover:scale-[1.01]"
                  >
                    Seleccionar
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <PersonalizedCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </section>
  );
}
