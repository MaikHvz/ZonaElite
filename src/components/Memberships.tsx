"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/providers/SessionProvider";
import CheckoutModal from "@/components/CheckoutModal";

interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  category: string;
  benefits: string[];
  active: boolean;
}

export default function Memberships() {
  const { user } = useSession();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("membership_plans")
      .select("*")
      .eq("active", true)
      .order("price")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error loading membership plans:", error);
        }
        setPlans((data as MembershipPlan[]) || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section id="membresias" className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
            Planes de Entrenamiento
          </span>
          <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter">
            Membresías <span className="text-primary">ZonaElite</span>
          </h2>
          <p className="mt-4 font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] text-on-surface-variant max-w-2xl mx-auto">
            Alcanza tu máximo potencial con nuestros planes de entrenamiento
            diseñados para cada nivel de compromiso.
          </p>
        </div>
        <div className="flex justify-center py-12">
          <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </section>
    );
  }

  if (plans.length === 0) return null;

  const formatPrice = (price: number) =>
    "$" + price.toLocaleString("es-CL");

  const formatDuration = (days: number) => {
    if (days <= 7) return "/semana";
    if (days <= 31) return "/mes";
    return `/${Math.round(days / 30)} meses`;
  };

  const featuredIndex = plans.length === 3 ? 1 : 0;

  return (
    <section
      id="membresias"
      className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto"
    >
      <div className="text-center mb-16">
        <span className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] leading-[16px] uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
          Planes de Entrenamiento
        </span>
        <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter">
          Membresías{" "}
          <span className="text-primary">ZonaElite</span>
        </h2>
        <p className="mt-4 font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] text-on-surface-variant max-w-2xl mx-auto">
          Alcanza tu máximo potencial con nuestros planes de entrenamiento
          diseñados para cada nivel de compromiso.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5 items-start max-w-[960px] mx-auto">
        {plans.map((plan, idx) => {
          const featured = idx === featuredIndex;
          const benefits = Array.isArray(plan.benefits) ? plan.benefits : [];
          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl transition-all duration-300 ${
                featured
                  ? "bg-surface-container-lowest border border-primary/30 shadow-[0_0_40px_rgba(255,84,76,0.12)] md:-translate-y-3 md:scale-[1.03] z-10"
                  : "bg-surface-container-low border border-on-surface/5 hover:border-on-surface/10 hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
              }`}
            >
              {featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[10px] leading-[14px] uppercase py-1 px-4 rounded-full tracking-[0.1em] whitespace-nowrap shadow-[0_4px_20px_rgba(229,57,53,0.4)]">
                  Recomendado
                </div>
              )}

              <div className={`p-7 pb-5 ${featured ? "pt-9" : ""}`}>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] leading-[22px] text-on-surface-variant uppercase mb-3">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`font-[family-name:var(--font-headline-lg)] text-[42px] leading-[44px] tracking-[-0.03em] ${
                      featured ? "text-primary" : "text-on-surface"
                    }`}
                  >
                    {formatPrice(plan.price)}
                  </span>
                  <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface-variant">
                    {formatDuration(plan.duration_days)}
                  </span>
                </div>
              </div>

              <div className="px-7 pb-2">
                <div className={`h-px ${featured ? "bg-primary/15" : "bg-on-surface/5"}`} />
              </div>

              <div className="flex-grow px-7 pt-5 pb-6">
                <ul className="space-y-3">
                  {benefits.map((feature: string) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className={`material-symbols-outlined text-[18px] mt-0.5 ${featured ? "text-primary" : "text-primary/60"}`}>
                        check_circle
                      </span>
                      <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface">
                        {feature}
                      </span>
                    </li>
                  ))}
                  {benefits.length === 0 && (
                    <li className="flex items-start gap-2.5">
                      <span className={`material-symbols-outlined text-[18px] mt-0.5 ${featured ? "text-primary" : "text-primary/60"}`}>
                        check_circle
                      </span>
                      <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface">
                        Acceso a la academia
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="px-7 pb-7">
                {user ? (
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full py-3 px-6 text-center font-[family-name:var(--font-headline-md)] text-[13px] leading-[16px] uppercase rounded-lg transition-all duration-200 cursor-pointer ${
                      featured
                        ? "btn-primary-gradient text-white shadow-[0_0_24px_rgba(229,57,53,0.3)] hover:shadow-[0_0_32px_rgba(229,57,53,0.45)] hover:scale-[1.02]"
                        : "border border-on-surface/15 text-on-surface hover:bg-on-surface/5 hover:border-on-surface/25 hover:scale-[1.01]"
                    }`}
                  >
                    Comprar ahora
                  </button>
                ) : (
                  <Link
                    href="/auth"
                    className={`block w-full py-3 px-6 text-center font-[family-name:var(--font-headline-md)] text-[13px] leading-[16px] uppercase rounded-lg transition-all duration-200 ${
                      featured
                        ? "btn-primary-gradient text-white shadow-[0_0_24px_rgba(229,57,53,0.3)] hover:shadow-[0_0_32px_rgba(229,57,53,0.45)] hover:scale-[1.02]"
                        : "border border-on-surface/15 text-on-surface hover:bg-on-surface/5 hover:border-on-surface/25 hover:scale-[1.01]"
                    }`}
                  >
                    Seleccionar
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <CheckoutModal
        open={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        plan={selectedPlan}
      />
    </section>
  );
}
