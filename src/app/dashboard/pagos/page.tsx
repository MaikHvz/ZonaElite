"use client";

import { useSession } from "@/providers/SessionProvider";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getUserPayments,
  type PaymentData,
} from "@/lib/supabase/dashboard";
import PaymentRow from "@/components/dashboard/PaymentRow";
import { PaymentRowSkeleton } from "@/components/dashboard/DashboardSkeleton";
import PurchaseSuccessBanner, {
  PurchaseFailedBanner,
} from "@/components/PurchaseSuccessBanner";

export default function PagosPage() {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const statusParam = searchParams.get("status");
  const flowToken = searchParams.get("token");
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<"success" | "failed" | null>(null);
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  const fetchPayments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await getUserPayments(user.id, page, pageSize);
    setPayments(data?.payments || []);
    setTotal(data?.total || 0);
    setLoading(false);
  }, [user, page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Verificar pago cuando el usuario vuelve de Flow con token
  useEffect(() => {
    if (!flowToken || !user || verifying) return;

    setVerifying(true);
    fetch(`/api/flow/verify?token=${encodeURIComponent(flowToken)}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.status === "pagado") {
          setVerified("success");
        } else {
          setVerified("failed");
        }
        // Limpiar URL params
        router.replace("/dashboard/pagos");
        // Recargar pagos
        fetchPayments();
      })
      .catch(() => {
        setVerified("failed");
        router.replace("/dashboard/pagos");
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [flowToken, user, verifying, router, fetchPayments]);

  const paidThisMonth = payments
    .filter((p) => {
      const d = new Date(p.created_at);
      const now = new Date();
      return (
        p.status === "pagado" &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    })
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
        Mis <span className="text-primary">Pagos</span>
      </h1>

      {verifying && (
        <div className="glass-panel rounded-xl p-4 border-l-4 border-primary flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            Verificando pago con Flow...
          </p>
        </div>
      )}

      {!verifying && verified === "success" && <PurchaseSuccessBanner />}
      {!verifying && verified === "failed" && <PurchaseFailedBanner />}
      {!verifying && !verified && statusParam === "success" && (
        <PurchaseSuccessBanner />
      )}
      {!verifying && !verified && statusParam === "failed" && (
        <PurchaseFailedBanner />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-4">
          <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">
            Total pagos
          </span>
          <span className="font-[family-name:var(--font-headline-md)] text-[22px] text-on-surface">
            {total}
          </span>
        </div>
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-4">
          <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">
            Pagos este mes
          </span>
          <span className="font-[family-name:var(--font-headline-md)] text-[22px] text-on-surface">
            {new Intl.NumberFormat("es-CL", {
              style: "currency",
              currency: "CLP",
              minimumFractionDigits: 0,
            }).format(paidThisMonth)}
          </span>
        </div>
      </div>

      <div className="bg-surface-container border border-on-surface/5 rounded-2xl px-5">
        {loading ? (
          <>
            <PaymentRowSkeleton />
            <PaymentRowSkeleton />
            <PaymentRowSkeleton />
          </>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center">
            <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
              receipt_long
            </span>
            <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
              No hay pagos registrados
            </p>
          </div>
        ) : (
          payments.map((p) => <PaymentRow key={p.id} payment={p} />)
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant border border-on-surface/10 px-4 py-2 rounded-lg hover:border-on-surface/20 transition-colors disabled:opacity-30 cursor-pointer"
          >
            ← Anterior
          </button>
          <span className="font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant border border-on-surface/10 px-4 py-2 rounded-lg hover:border-on-surface/20 transition-colors disabled:opacity-30 cursor-pointer"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
