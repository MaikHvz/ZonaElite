"use client";

import { useSession } from "@/providers/SessionProvider";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getUserPayments,
  type PaymentData,
} from "@/lib/supabase/dashboard";
import PaymentRow from "@/components/dashboard/PaymentRow";
import { PaymentRowSkeleton } from "@/components/dashboard/DashboardSkeleton";
import PaymentSuccessModal, {
  type PaymentSuccessDetails,
} from "@/components/PaymentSuccessModal";
import PaymentErrorModal from "@/components/PaymentErrorModal";
import PurchaseSuccessBanner, {
  PurchaseFailedBanner,
  PurchasePendingBanner,
} from "@/components/PurchaseSuccessBanner";

const FLOW_TOKEN_KEY = "flow_pending_token";

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
  const [verified, setVerified] = useState<
    "success" | "rechazado" | "cancelado" | "pendiente" | "failed" | null
  >(null);
  const [successDetails, setSuccessDetails] = useState<PaymentSuccessDetails | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const verifyingRef = useRef(false);
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

  // Guardar token de Flow en sessionStorage cuando la URL lo trae
  useEffect(() => {
    if (flowToken) {
      sessionStorage.setItem(FLOW_TOKEN_KEY, flowToken);
    }
  }, [flowToken]);

  useEffect(() => {
    const tokenToVerify = flowToken || sessionStorage.getItem(FLOW_TOKEN_KEY);
    if (!tokenToVerify || !user || verifying || verifyingRef.current) return;

    sessionStorage.removeItem(FLOW_TOKEN_KEY);
    verifyingRef.current = true;

    setVerifying(true);
    fetch(`/api/flow/verify?token=${encodeURIComponent(tokenToVerify)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((result) => {
        if (result.status === "pagado") {
          setVerified("success");
          if (result.payment) {
            setSuccessDetails(result.payment);
          }
          setModalOpen(true);
        } else if (result.status === "rechazado") {
          setVerified("rechazado");
          setErrorModal({
            title: "El pago fue rechazado por tu banco o proveedor.",
            description:
              "No se realizó ningún cargo. Puedes intentar pagar nuevamente o usar otro método de pago.",
          });
        } else if (result.status === "cancelado") {
          setVerified("cancelado");
          setErrorModal({
            title: "El pago fue anulado o cancelado.",
            description:
              "No se realizó ningún cargo. Puedes intentar pagar nuevamente cuando quieras.",
          });
        } else if (result.status === "pendiente") {
          setVerified("pendiente");
        } else if (result.status === "not_found") {
          setVerified("failed");
          setErrorModal({
            title: "No pudimos confirmar tu pago.",
            description:
              "Si el problema persiste, contacta a la academia con tu número de orden.",
          });
        } else {
          setVerified("failed");
          setErrorModal({
            title: "El pago no pudo ser procesado.",
            description:
              "Si el problema persiste, contacta a la academia.",
          });
        }
        router.replace("/dashboard/pagos");
        fetchPayments();
      })
      .catch((err) => {
        console.error("[flow-verify] Client verification error:", err);
        setVerified("failed");
        setErrorModal({
          title: "No pudimos verificar tu pago.",
          description:
            "Revisa tu historial de pagos o contacta a la academia si necesitas ayuda.",
        });
        router.replace("/dashboard/pagos");
      })
      .finally(() => {
        setVerifying(false);
        verifyingRef.current = false;
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

  const pendingFlowToken = !user && (flowToken || sessionStorage.getItem(FLOW_TOKEN_KEY));

  return (
    <div className="space-y-6">
      <PaymentSuccessModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        details={successDetails}
      />
      <PaymentErrorModal
        open={!!errorModal}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title || ""}
        description={errorModal?.description || ""}
      />

      <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
        Mis <span className="text-primary">Pagos</span>
      </h1>

      {pendingFlowToken && !loading && (
        <div className="glass-panel rounded-xl p-4 border-l-4 border-amber-500 flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-500 text-xl">info</span>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            Se detectó un pago pendiente.{" "}
            <a href="/auth" className="text-primary hover:underline font-semibold">
              Inicia sesión
            </a>{" "}
            para confirmarlo.
          </p>
        </div>
      )}

      {verifying && (
        <div className="glass-panel rounded-xl p-4 border-l-4 border-primary flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            Verificando pago con Flow...
          </p>
        </div>
      )}

      {!verifying && verified === "success" && (
        <div onClick={() => setModalOpen(true)} className="cursor-pointer">
          <PurchaseSuccessBanner />
        </div>
      )}
      {!verifying && verified === "rechazado" && (
        <PurchaseFailedBanner
          title="Pago rechazado."
          description="No se realizó ningún cargo. Intenta nuevamente o usa otro método de pago."
        />
      )}
      {!verifying && verified === "cancelado" && (
        <PurchaseFailedBanner
          title="Pago anulado/cancelado."
          description="No se realizó ningún cargo. Puedes intentar pagar nuevamente."
        />
      )}
      {!verifying && verified === "pendiente" && <PurchasePendingBanner />}
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
