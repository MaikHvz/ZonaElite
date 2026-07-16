"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("membership_plans")
      .select("*")
      .eq("active", true)
      .order("price")
      .then(({ data }) => {
        setPlans((data as MembershipPlan[]) || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section id="membresias" className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto">
        <div className="text-center mb-16">
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

  return (
    <section
      id="membresias"
      className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto fade-up"
    >
      <div className="text-center mb-16">
        <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter">
          Membresías{" "}
          <span className="text-primary">ZonaElite</span>
        </h2>
        <p className="mt-4 font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] text-on-surface-variant max-w-2xl mx-auto">
          Alcanza tu máximo potencial con nuestros planes de entrenamiento
          diseñados para cada nivel de compromiso.
        </p>
      </div>

      <div className="flex flex-col md:flex-row justify-center items-stretch gap-6 md:gap-8">
        {plans.map((plan, idx) => {
          const featured = idx === 1 || (plans.length === 3 && idx === 1);
          const benefits = Array.isArray(plan.benefits) ? plan.benefits : [];
          return (
            <article
              key={plan.id}
              className={`flex flex-col rounded-2xl p-8 w-full md:w-1/3 transition-all duration-300 ${
                featured
                  ? "bg-surface-container-lowest border-2 border-primary shadow-[0_12px_40px_rgba(229,57,53,0.15)] md:-translate-y-4 hover:-translate-y-6"
                  : "bg-surface-container-low border border-on-surface/5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.3)] hover:border-on-surface/10"
              }`}
            >
              {featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[12px] leading-[16px] uppercase py-1.5 px-5 rounded-full tracking-wider whitespace-nowrap shadow-[0_4px_20px_rgba(229,57,53,0.4)]">
                  Recomendado
                </div>
              )}

              <div className={`mb-8 ${featured ? "mt-2" : ""}`}>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-on-surface uppercase mb-1">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-[family-name:var(--font-headline-lg)] text-[48px] leading-[52px] tracking-[-0.03em] ${
                      featured ? "text-primary" : "text-on-surface"
                    }`}
                  >
                    {formatPrice(plan.price)}
                  </span>
                  <span className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant">
                    {formatDuration(plan.duration_days)}
                  </span>
                </div>
              </div>

              <div className="flex-grow">
                <ul className="space-y-4 mb-8">
                  {benefits.map((feature: string) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary mt-0.5">
                        check_circle
                      </span>
                      <span className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface">
                        {feature}
                      </span>
                    </li>
                  ))}
                  {benefits.length === 0 && (
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary mt-0.5">
                        check_circle
                      </span>
                      <span className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface">
                        Acceso a la academia
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              <Link
                href="/auth"
                className={`w-full py-3 px-6 text-center font-[family-name:var(--font-headline-md)] text-[14px] leading-[18px] uppercase rounded-[0.25rem] transition-colors duration-200 ${
                  featured
                    ? "btn-primary-gradient text-white shadow-[0_0_20px_rgba(229,57,53,0.3)] hover:opacity-90"
                    : "border border-on-surface/20 text-on-surface hover:bg-on-surface/5 hover:border-on-surface/40"
                }`}
              >
                Seleccionar
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
