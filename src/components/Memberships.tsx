"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/providers/SessionProvider";
import CheckoutModal from "@/components/CheckoutModal";
import EnrollmentBanner from "@/components/EnrollmentBanner";

interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  category: string;
  benefits: string[];
  active: boolean;
  featured: boolean;
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

  // Reorder: featured goes to the center (index 1 in a 3-plan grid)
  const featuredPlan = plans.find((p) => p.featured);
  const otherPlans = plans.filter((p) => !p.featured);
  let orderedPlans: MembershipPlan[];
  if (featuredPlan && plans.length >= 2) {
    const half = Math.floor(otherPlans.length / 2);
    orderedPlans = [
      ...otherPlans.slice(0, half),
      featuredPlan,
      ...otherPlans.slice(half),
    ];
  } else {
    orderedPlans = plans;
  }

  // Fallback featured index if no plan has featured=true (only used for ordering, no highlighting)
  const featuredIndex = featuredPlan
    ? orderedPlans.indexOf(featuredPlan)
    : Math.floor(orderedPlans.length / 2);

  return (
    <section
      id="membresias"
      className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto"
    >
      {/* Prismatic keyframe animation injected inline */}
      <style>{`
        @keyframes prismatic-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes diamond-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.08); }
        }
        .prismatic-text {
          background: linear-gradient(90deg, #a855f7, #ec4899, #f97316, #eab308, #22c55e, #06b6d4, #a855f7);
          background-size: 300%;
          animation: prismatic-shift 4s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .prismatic-border {
          background: linear-gradient(#131313, #131313) padding-box,
                      linear-gradient(135deg, #a855f7, #ec4899, #f97316, #eab308, #22c55e, #06b6d4, #a855f7) border-box;
          background-size: 100% 100%, 300%;
          animation: prismatic-shift 4s linear infinite;
          border: 2px solid transparent;
        }
        .diamond-aura {
          animation: diamond-pulse 3s ease-in-out infinite;
        }
      `}</style>

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

      {/* Enrollment Banner */}
      <EnrollmentBanner />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5 items-start max-w-[960px] mx-auto">
        {orderedPlans.map((plan, idx) => {
          const isPro = !!plan.featured;
          const benefits = Array.isArray(plan.benefits) ? plan.benefits : [];

          if (isPro) {
            return (
              <article
                key={plan.id}
                className="relative flex flex-col rounded-2xl prismatic-border md:-translate-y-4 md:scale-[1.05] z-10 overflow-hidden"
                style={{ background: "linear-gradient(145deg, #1a1a2e, #131313)" }}
              >
                {/* Diamond aura glow layers */}
                <div
                  aria-hidden="true"
                  className="diamond-aura pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, #a855f720, #ec489915, #f9731610, #eab30810, #22c55e10, #06b6d415)",
                    filter: "blur(1px)",
                  }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-60"
                  style={{ background: "radial-gradient(circle, #a855f750, transparent 70%)" }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl opacity-50"
                  style={{ background: "radial-gradient(circle, #06b6d450, transparent 70%)" }}
                />

                {/* PRO badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                  <span className="prismatic-text font-[family-name:var(--font-label-sm)] text-[11px] leading-[14px] uppercase tracking-[0.12em] bg-[#0d0d1a] border border-purple-500/30 py-1 px-5 rounded-full whitespace-nowrap shadow-[0_0_20px_rgba(168,85,247,0.5)] inline-block">
                    ⬡ PRO
                  </span>
                </div>

                <div className="relative z-10 p-7 pb-5 pt-9">
                  <h3 className="prismatic-text font-[family-name:var(--font-headline-md)] text-[18px] leading-[22px] uppercase mb-3">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="prismatic-text font-[family-name:var(--font-headline-lg)] text-[42px] leading-[44px] tracking-[-0.03em]">
                      {formatPrice(plan.price)}
                    </span>
                    <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface-variant">
                      {formatDuration(plan.duration_days)}
                    </span>
                  </div>
                </div>

                <div className="relative z-10 px-7 pb-2">
                  <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, #a855f740, #ec489940, transparent)" }} />
                </div>

                <div className="relative z-10 flex-grow px-7 pt-5 pb-6">
                  <ul className="space-y-3">
                    {benefits.map((feature: string) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <span className="prismatic-text material-symbols-outlined text-[18px] mt-0.5 ![-webkit-text-fill-color:unset]" style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                          check_circle
                        </span>
                        <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface">
                          {feature}
                        </span>
                      </li>
                    ))}
                    {benefits.length === 0 && (
                      <li className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[18px] mt-0.5" style={{ WebkitTextFillColor: "transparent", background: "linear-gradient(135deg,#a855f7,#ec4899)", WebkitBackgroundClip: "text" }}>check_circle</span>
                        <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface">Acceso a la academia</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="relative z-10 px-7 pb-7">
                  {user ? (
                    <button
                      onClick={() => setSelectedPlan(plan)}
                      className="w-full py-3 px-6 text-center font-[family-name:var(--font-headline-md)] text-[13px] leading-[16px] uppercase rounded-lg transition-all duration-200 cursor-pointer text-white hover:scale-[1.02]"
                      style={{
                        background: "linear-gradient(90deg, #a855f7, #ec4899, #f97316, #eab308, #a855f7)",
                        backgroundSize: "300%",
                        animation: "prismatic-shift 4s linear infinite",
                        boxShadow: "0 0 24px rgba(168,85,247,0.4)",
                      }}
                    >
                      Comprar ahora
                    </button>
                  ) : (
                    <Link
                      href="/auth"
                      className="block w-full py-3 px-6 text-center font-[family-name:var(--font-headline-md)] text-[13px] leading-[16px] uppercase rounded-lg transition-all duration-200 text-white hover:scale-[1.02]"
                      style={{
                        background: "linear-gradient(90deg, #a855f7, #ec4899, #f97316, #eab308, #a855f7)",
                        backgroundSize: "300%",
                        animation: "prismatic-shift 4s linear infinite",
                        boxShadow: "0 0 24px rgba(168,85,247,0.4)",
                      }}
                    >
                      Seleccionar
                    </Link>
                  )}
                </div>
              </article>
            );
          }

          // Regular card
          return (
            <article
              key={plan.id}
              className="relative flex flex-col rounded-2xl transition-all duration-300 bg-surface-container-low border border-on-surface/5 hover:border-on-surface/10 hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
            >
              <div className="p-7 pb-5">
                <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] leading-[22px] text-on-surface-variant uppercase mb-3">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-[family-name:var(--font-headline-lg)] text-[42px] leading-[44px] tracking-[-0.03em] text-on-surface"
                  >
                    {formatPrice(plan.price)}
                  </span>
                  <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface-variant">
                    {formatDuration(plan.duration_days)}
                  </span>
                </div>
              </div>

              <div className="px-7 pb-2">
                <div className="h-px bg-on-surface/5" />
              </div>

              <div className="flex-grow px-7 pt-5 pb-6">
                <ul className="space-y-3">
                  {benefits.map((feature: string) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[18px] mt-0.5 text-primary/60">
                        check_circle
                      </span>
                      <span className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface">
                        {feature}
                      </span>
                    </li>
                  ))}
                  {benefits.length === 0 && (
                    <li className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[18px] mt-0.5 text-primary/60">
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

      <CheckoutModal
        open={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        plan={selectedPlan}
      />
    </section>
  );
}
