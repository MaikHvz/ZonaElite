"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";
import { exportProfessionalExcel, type ProfessionalSheetConfig } from "@/lib/excel";

interface Payment {
  id: string;
  user_id: string;
  beneficiary_id: string | null;
  membership_id: string | null;
  order_id: string | null;
  concept: string | null;
  amount: number;
  method: string;
  status: string;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
  commerce_order: string | null;
  flow_token: string | null;
  flow_order: number | null;
  include_enrollment: boolean;
  enrollment_plan_id: string | null;
  membership_plan_id: string | null;
  personalized_plan_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  profiles?: { full_name: string; email: string; rut: string | null } | null;
  beneficiaries?: {
    id: string;
    dependent?: { full_name: string } | null;
    profile?: { full_name: string } | null;
  } | null;
}

const METHOD_LABELS: Record<string, string> = {
  flow: "Flow.cl",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  cortesia: "Cortesía",
};

const METHOD_COLORS: Record<string, string> = {
  flow: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  transferencia: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  efectivo: "bg-green-500/10 text-green-400 border-green-500/20",
  cortesia: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const METHOD_ICONS: Record<string, string> = {
  flow: "credit_card",
  transferencia: "account_balance",
  efectivo: "payments",
  cortesia: "volunteer_activism",
};

export default function AdminVentasPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [methodFilter, setMethodFilter] = useState<string>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportTimeframe, setExportTimeframe] = useState<"mes" | "ano" | "historico">("mes");

  const [activeTab, setActiveTab] = useState<"pagos" | "solicitudes">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "solicitudes"
      ? "solicitudes"
      : "pagos"
  );
  const [requests, setRequests] = useState<Payment[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestFilter, setRequestFilter] = useState<string>("pendiente");
  const [reviewTarget, setReviewTarget] = useState<Payment | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const handleExportExcel = async () => {
    const now = new Date();
    const filteredForExport = payments.filter((p) => {
      if (p.status !== "pagado") return false;
      const date = new Date(p.created_at);
      if (exportTimeframe === "mes") {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      if (exportTimeframe === "ano") {
        return date.getFullYear() === now.getFullYear();
      }
      return true;
    });

    const totalIngresos = filteredForExport.reduce((sum, p) => sum + (p.amount || 0), 0);

    const byMethod: Record<string, { count: number; total: number }> = {};
    filteredForExport.forEach((p) => {
      if (!byMethod[p.method]) byMethod[p.method] = { count: 0, total: 0 };
      byMethod[p.method].count++;
      byMethod[p.method].total += p.amount || 0;
    });

    const periodoLabel =
      exportTimeframe === "mes"
        ? now.toLocaleString("es-CL", { month: "long", year: "numeric" })
        : exportTimeframe === "ano"
        ? `Año ${now.getFullYear()}`
        : "Histórico Completo";

    const cartolaSheet: ProfessionalSheetConfig = {
      sheetName: "Cartola de Ventas",
      reportTitle: "Cartola de Ventas",
      subtitle: `Período: ${periodoLabel}`,
      kpiBlocks: [
        {
          title: "RESUMEN FINANCIERO",
          rows: [
            ["Total Transacciones Exitosas", filteredForExport.length, true],
            ["Ingreso Total Generado", `$${totalIngresos.toLocaleString("es-CL")}`, true],
            ["Ticket Promedio por Venta", filteredForExport.length > 0 ? `$${Math.round(totalIngresos / filteredForExport.length).toLocaleString("es-CL")}` : "—"],
          ],
        },
        {
          title: "DESGLOSE POR MÉTODO DE PAGO",
          rows: Object.entries(byMethod).map(([method, info]) => [
            METHOD_LABELS[method] || method,
            `${info.count} ventas — $${info.total.toLocaleString("es-CL")}`,
          ]),
        },
      ],
    };

    const transaccionesSheet: ProfessionalSheetConfig = {
      sheetName: "Transacciones Detalle",
      reportTitle: "Transacciones",
      subtitle: `Período: ${periodoLabel} — Total: ${filteredForExport.length} registros`,
      tableData: filteredForExport.map((p) => ({
        "Fecha": p.paid_at
          ? new Date(p.paid_at).toLocaleString("es-CL")
          : new Date(p.created_at).toLocaleString("es-CL"),
        "N° Orden": p.order_id || p.commerce_order || p.id.slice(0, 8),
        "Cliente": getUserName(p),
        "Beneficiario": getBeneficiaryName(p),
        "Concepto": p.concept || "Membresía",
        "Método de Pago": METHOD_LABELS[p.method] || p.method,
        "Monto ($)": p.amount,
        "Estado": p.status,
      })),
    };

    await exportProfessionalExcel(
      [cartolaSheet, transaccionesSheet],
      `Reporte_Ventas_ZonaElite_${exportTimeframe}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select(`
        *,
        profiles:user_id(full_name, email),
        beneficiaries:beneficiary_id(
          id,
          dependent:dependents(full_name),
          profile:profiles(full_name)
        )
      `)
      .order("created_at", { ascending: false });

    setPayments((data as Payment[]) || []);
    setLoading(false);
  };

  const loadRequests = async () => {
    setRequestsLoading(true);
    const { data } = await supabase
      .from("payments")
      .select(`
        *,
        profiles:user_id(full_name, email, rut),
        beneficiaries:beneficiary_id(
          id,
          dependent:dependents(full_name),
          profile:profiles(full_name)
        )
      `)
      .eq("method", "transferencia")
      .order("created_at", { ascending: false });

    setRequests((data as Payment[]) || []);
    setRequestsLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((p) => {
      if (requestFilter === "todos") return true;
      return p.status === requestFilter;
    });
  }, [requests, requestFilter]);

  const doReview = async (action: "aprobar" | "rechazar") => {
    if (!reviewTarget) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const res = await fetch("/api/payments/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: reviewTarget.id,
          action,
          adminNote: adminNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error || "Error al revisar la solicitud");
        return;
      }
      setReviewTarget(null);
      setAdminNote("");
      await loadRequests();
      await loadData();
    } catch {
      setReviewError("Error de conexión. Intenta de nuevo.");
    } finally {
      setReviewing(false);
    }
  };

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (methodFilter !== "todos" && p.method !== methodFilter) return false;
      return true;
    });
  }, [payments, statusFilter, methodFilter]);

  const stats = useMemo(() => {
    const pagados = payments.filter((p) => p.status === "pagado");
    const pendientes = payments.filter((p) => p.status === "pendiente");
    const cancelados = payments.filter((p) => p.status === "cancelado");
    const rechazados = payments.filter((p) => p.status === "rechazado");

    const totalRevenue = pagados.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingAmount = pendientes.reduce((sum, p) => sum + (p.amount || 0), 0);

    const byMethod: Record<string, { count: number; total: number }> = {};
    for (const p of pagados) {
      if (!byMethod[p.method]) byMethod[p.method] = { count: 0, total: 0 };
      byMethod[p.method].count++;
      byMethod[p.method].total += p.amount || 0;
    }

    return {
      totalPagados: pagados.length,
      totalRevenue,
      totalPendientes: pendientes.length,
      pendingAmount,
      totalCancelados: cancelados.length,
      totalRechazados: rechazados.length,
      totalAll: payments.length,
      byMethod,
    };
  }, [payments]);

  const getBeneficiaryName = (p: Payment): string => {
    if (!p.beneficiaries) return "—";
    const depName = p.beneficiaries.dependent?.full_name;
    const tutorName = p.beneficiaries.profile?.full_name;
    if (depName && tutorName) return `${depName}`;
    if (depName) return depName;
    return tutorName || "—";
  };

  const getUserName = (p: Payment): string => {
    return p.profiles?.full_name || "—";
  };

  const getUserEmail = (p: Payment): string => {
    return p.profiles?.email || "";
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
            Ventas
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mt-1">
            Resumen de pagos y seguimiento de ventas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={exportTimeframe}
            onChange={(e) => setExportTimeframe(e.target.value as any)}
            className="bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 text-[13px] font-[family-name:var(--font-body-md)] text-on-surface focus:outline-none focus:border-primary/50"
          >
            <option value="mes">Este Mes</option>
            <option value="ano">Este Año</option>
            <option value="historico">Histórico Completo</option>
          </select>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/10 text-green-500 border border-green-500/20 hover:bg-green-600/20 transition-colors text-[13px] font-[family-name:var(--font-headline-md)] uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab("pagos")}
          className={`font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider px-4 py-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === "pagos"
              ? "btn-primary-gradient text-white"
              : "border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"
          }`}
        >
          Pagos
        </button>
        <button
          onClick={() => setActiveTab("solicitudes")}
          className={`font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider px-4 py-2 rounded-lg transition-colors cursor-pointer relative ${
            activeTab === "solicitudes"
              ? "btn-primary-gradient text-white"
              : "border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"
          }`}
        >
          Solicitudes
          {requests.filter((r) => r.status === "pendiente").length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {requests.filter((r) => r.status === "pendiente").length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "solicitudes" ? (
        <SolicitudesSection
          loading={requestsLoading}
          requests={filteredRequests}
          filter={requestFilter}
          setFilter={setRequestFilter}
          onReview={(p) => {
            setAdminNote("");
            setReviewError(null);
            setReviewTarget(p);
          }}
          getUserName={getUserName}
          getBeneficiaryName={getBeneficiaryName}
          getUserEmail={getUserEmail}
        />
      ) : (
        <>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-surface-container-lowest border border-on-surface/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-400 text-[20px]">payments</span>
            </div>
            <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
              Ingresos Totales
            </span>
          </div>
          <p className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface">
            ${stats.totalRevenue.toLocaleString("es-CL")}
          </p>
          <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant/60 mt-1">
            {stats.totalPagados} pago{stats.totalPagados !== 1 ? "s" : ""} confirmado{stats.totalPagados !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-on-surface/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-400 text-[20px]">schedule</span>
            </div>
            <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
              Pendientes
            </span>
          </div>
          <p className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface">
            ${stats.pendingAmount.toLocaleString("es-CL")}
          </p>
          <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant/60 mt-1">
            {stats.totalPendientes} pago{stats.totalPendientes !== 1 ? "s" : ""} pendiente{stats.totalPendientes !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-on-surface/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-400 text-[20px]">cancel</span>
            </div>
            <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
              Cancelados
            </span>
          </div>
          <p className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface">
            {stats.totalCancelados}
          </p>
          <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant/60 mt-1">
            pagos cancelados
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-on-surface/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-400 text-[20px]">block</span>
            </div>
            <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
              Rechazados
            </span>
          </div>
          <p className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface">
            {stats.totalRechazados}
          </p>
          <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant/60 mt-1">
            pagos rechazados
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-on-surface/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
            </div>
            <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
              Total Registros
            </span>
          </div>
          <p className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface">
            {stats.totalAll}
          </p>
          <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant/60 mt-1">
            todos los pagos
          </p>
        </div>
      </div>

      {/* Method Breakdown */}
      {Object.keys(stats.byMethod).length > 0 && (
        <div className="mb-8">
          <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-3">
            Ingresos por Método de Pago
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.byMethod)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([method, data]) => (
                <div
                  key={method}
                  className="bg-surface-container-lowest border border-on-surface/5 rounded-xl px-5 py-3 flex items-center gap-3"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${METHOD_COLORS[method]?.split(" ").slice(0, 1).join(" ") || "bg-on-surface/10"}`}>
                    <span className="material-symbols-outlined text-[16px]" style={{ color: method === "flow" ? "#60a5fa" : method === "transferencia" ? "#c084fc" : method === "efectivo" ? "#4ade80" : "#9ca3af" }}>
                      {METHOD_ICONS[method] || "help"}
                    </span>
                  </div>
                  <div>
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                      {METHOD_LABELS[method] || method}
                    </p>
                    <p className="font-[family-name:var(--font-headline-sm)] text-[14px] text-on-surface">
                      ${data.total.toLocaleString("es-CL")}
                      <span className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60 ml-2">
                        ({data.count} pago{data.count !== 1 ? "s" : ""})
                      </span>
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
            Estado:
          </span>
          <div className="flex gap-1">
            {["todos", "pagado", "pendiente", "rechazado", "cancelado"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === s
                    ? "btn-primary-gradient text-white"
                    : "border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"
                }`}
              >
                {s === "todos"
                  ? "Todos"
                  : s === "pagado"
                    ? "Pagado"
                    : s === "pendiente"
                      ? "Pendiente"
                      : s === "rechazado"
                        ? "Rechazado"
                        : "Cancelado"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
            Método:
          </span>
          <div className="flex gap-1">
            {["todos", "flow", "transferencia", "efectivo", "cortesia"].map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  methodFilter === m
                    ? "btn-primary-gradient text-white"
                    : "border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"
                }`}
              >
                {m === "todos" ? "Todos" : METHOD_LABELS[m] || m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4">
        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          {statusFilter !== "todos" && ` · Estado: ${statusFilter}`}
          {methodFilter !== "todos" && ` · Método: ${METHOD_LABELS[methodFilter] || methodFilter}`}
        </p>
      </div>

      {/* Payments Table */}
      <DataTable
        columns={[
          {
            key: "concept",
            label: "Concepto / Usuario",
            render: (p) => (
              <div className="min-w-[200px]">
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface font-medium">
                  {p.concept || "—"}
                </p>
                <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60 mt-0.5">
                  {getUserName(p)}
                </p>
                {getUserEmail(p) && (
                  <p className="font-[family-name:var(--font-body-sm)] text-[10px] text-on-surface-variant/40">
                    {getUserEmail(p)}
                  </p>
                )}
              </div>
            ),
          },
          {
            key: "beneficiary_id",
            label: "Beneficiario",
            render: (p) => (
              <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                {getBeneficiaryName(p)}
              </span>
            ),
          },
          {
            key: "amount",
            label: "Monto",
            render: (p) => (
              <span className="font-[family-name:var(--font-headline-sm)] text-[14px] text-on-surface">
                ${(p.amount || 0).toLocaleString("es-CL")}
              </span>
            ),
          },
          {
            key: "method",
            label: "Método",
            render: (p) => (
              <span className={`inline-flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-3 py-1 rounded-full border ${METHOD_COLORS[p.method] || "bg-on-surface/10 text-on-surface-variant border-on-surface/10"}`}>
                <span className="material-symbols-outlined text-[12px]">
                  {METHOD_ICONS[p.method] || "help"}
                </span>
                {METHOD_LABELS[p.method] || p.method}
              </span>
            ),
          },
          {
            key: "status",
            label: "Estado",
            render: (p) => <StatusBadge status={p.status} />,
          },
          {
            key: "paid_at",
            label: "Fecha",
            render: (p) => (
              <div>
                <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface">
                  {p.paid_at
                    ? new Date(p.paid_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
                    : new Date(p.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                {p.paid_at && (
                  <p className="font-[family-name:var(--font-body-sm)] text-[10px] text-on-surface-variant/40">
                    {new Date(p.paid_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            ),
          },
          {
            key: "id",
            label: "Detalle",
            render: (p) => (
              <button
                onClick={() => toggleExpand(p.id)}
                className="p-1.5 rounded-lg hover:bg-on-surface/5 transition-colors cursor-pointer"
                title="Ver detalles"
              >
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                  {expandedId === p.id ? "expand_less" : "expand_more"}
                </span>
              </button>
            ),
          },
        ]}
        data={filtered}
        loading={loading}
        searchPlaceholder="Buscar por concepto o usuario..."
        searchKey="concept"
        emptyMessage="No se encontraron pagos con los filtros seleccionados"
      />

      {/* Expanded Detail Row */}
      {expandedId && (() => {
        const p = payments.find((pay) => pay.id === expandedId);
        if (!p) return null;
        return (
          <div className="mt-2 mb-6 bg-surface-container-lowest border border-on-surface/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">
                Detalle del Pago
              </h3>
              <button
                onClick={() => setExpandedId(null)}
                className="p-1.5 rounded-full hover:bg-on-surface/5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">close</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Payment Info */}
              <div className="space-y-3">
                <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                  Información del Pago
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">ID</span>
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface font-mono">{p.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Orden comercio</span>
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface font-mono">{p.commerce_order?.slice(0, 8) || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Monto</span>
                    <span className="font-[family-name:var(--font-headline-sm)] text-[14px] text-on-surface">${(p.amount || 0).toLocaleString("es-CL")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Concepto</span>
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface text-right max-w-[200px]">{p.concept || "—"}</span>
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="space-y-3">
                <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                  Usuario
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Nombre</span>
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface">{getUserName(p)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Email</span>
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface">{getUserEmail(p) || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Beneficiario</span>
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface">{getBeneficiaryName(p)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">ID usuario</span>
                    <span className="font-[family-name:var(--font-body-sm)] text-[10px] text-on-surface font-mono">{p.user_id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>

              {/* Flow / Status Info */}
              <div className="space-y-3">
                <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                  Estado y Flujo
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Estado</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Método</span>
                    <span className={`inline-flex items-center gap-1 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${METHOD_COLORS[p.method] || ""}`}>
                      {METHOD_LABELS[p.method] || p.method}
                    </span>
                  </div>
                  {p.flow_token && (
                    <div className="flex justify-between">
                      <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Token Flow</span>
                      <span className="font-[family-name:var(--font-body-sm)] text-[10px] text-on-surface font-mono">{p.flow_token.slice(0, 12)}...</span>
                    </div>
                  )}
                  {p.flow_order && (
                    <div className="flex justify-between">
                      <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Orden Flow</span>
                      <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface font-mono">{p.flow_order}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Creado</span>
                    <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface">
                      {new Date(p.created_at).toLocaleDateString("es-CL")} {new Date(p.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {p.paid_at && (
                    <div className="flex justify-between">
                      <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Pagado</span>
                      <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface">
                        {new Date(p.paid_at).toLocaleDateString("es-CL")} {new Date(p.paid_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  {p.include_enrollment && (
                    <div className="flex justify-between items-center">
                      <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Inscripción</span>
                      <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Incluida
                      </span>
                    </div>
                  )}
                  {p.receipt_url && (
                    <div className="flex justify-between items-center">
                      <span className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">Comprobante</span>
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-[family-name:var(--font-body-sm)] text-[12px] text-primary hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Ver
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
        </>
      )}

      {/* Review modal */}
      {reviewTarget && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReviewTarget(null);
          }}
        >
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-on-surface/5">
              <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">
                Revisar solicitud
              </h3>
              <button
                onClick={() => setReviewTarget(null)}
                className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                  <span className="text-on-surface-variant">Usuario</span>
                  <span className="text-on-surface">{getUserName(reviewTarget)}</span>
                </div>
                <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                  <span className="text-on-surface-variant">Email</span>
                  <span className="text-on-surface">{getUserEmail(reviewTarget) || "—"}</span>
                </div>
                <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                  <span className="text-on-surface-variant">RUT</span>
                  <span className="text-on-surface">{reviewTarget.profiles?.rut || "—"}</span>
                </div>
                <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                  <span className="text-on-surface-variant">Concepto</span>
                  <span className="text-on-surface text-right">{reviewTarget.concept || "—"}</span>
                </div>
                <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                  <span className="text-on-surface-variant">Monto</span>
                  <span className="text-primary font-[family-name:var(--font-headline-sm)]">${(reviewTarget.amount || 0).toLocaleString("es-CL")}</span>
                </div>
                <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
                  <span className="text-on-surface-variant">Referencia</span>
                  <span className="text-on-surface font-mono text-[12px]">{reviewTarget.commerce_order || "—"}</span>
                </div>
              </div>

              {reviewTarget.receipt_url && (
                <div className="rounded-xl border border-on-surface/10 overflow-hidden">
                  {reviewTarget.receipt_url.endsWith(".pdf") ? (
                    <iframe
                      src={reviewTarget.receipt_url}
                      title="Comprobante"
                      className="w-full h-64"
                    />
                  ) : (
                    <img
                      src={reviewTarget.receipt_url}
                      alt="Comprobante de transferencia"
                      className="w-full max-h-64 object-contain bg-black/40"
                    />
                  )}
                  <a
                    href={reviewTarget.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 text-[12px] font-[family-name:var(--font-label-sm)] text-primary hover:bg-on-surface/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    Ver comprobante completo
                  </a>
                </div>
              )}

              <div>
                <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Nota (opcional, visible para el usuario al rechazar)
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder="Ej: El comprobante no coincide con el monto..."
                  className="w-full bg-surface-container-lowest border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              {reviewError && (
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-red-400 text-center">
                  {reviewError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => doReview("rechazar")}
                  disabled={reviewing}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-white font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider py-3 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {reviewing ? (
                    <div className="animate-spin w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full" />
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">block</span>
                  )}
                  Rechazar
                </button>
                <button
                  onClick={() => doReview("aprobar")}
                  disabled={reviewing}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider py-3 rounded-lg transition-opacity hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                >
                  {reviewing ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  )}
                  Aprobar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SolicitudesSectionProps {
  loading: boolean;
  requests: Payment[];
  filter: string;
  setFilter: (f: string) => void;
  onReview: (p: Payment) => void;
  getUserName: (p: Payment) => string;
  getBeneficiaryName: (p: Payment) => string;
  getUserEmail: (p: Payment) => string;
}

function SolicitudesSection({
  loading,
  requests,
  filter,
  setFilter,
  onReview,
  getUserName,
  getBeneficiaryName,
  getUserEmail,
}: SolicitudesSectionProps) {
  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
            Estado:
          </span>
          <div className="flex gap-1">
            {["pendiente", "pagado", "rechazado", "todos"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  filter === s
                    ? "btn-primary-gradient text-white"
                    : "border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"
                }`}
              >
                {s === "pendiente"
                  ? "Pendientes"
                  : s === "pagado"
                    ? "Aprobadas"
                    : s === "rechazado"
                      ? "Rechazadas"
                      : "Todas"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-container animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl py-12 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
            account_balance_wallet
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
            No hay solicitudes de transferencia con este filtro
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((p) => {
            const isPendiente = p.status === "pendiente";
            return (
              <div
                key={p.id}
                className="bg-surface-container border border-on-surface/5 rounded-2xl p-4 md:p-5"
              >
                <div className="flex flex-wrap items-center gap-3 md:gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPendiente ? "bg-blue-500/10" : p.status === "pagado" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    <span className={`material-symbols-outlined text-[20px] ${isPendiente ? "text-blue-400" : p.status === "pagado" ? "text-green-400" : "text-red-400"}`}>
                      account_balance
                    </span>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
                      {p.concept || "—"}
                    </p>
                    <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">
                      {getUserName(p)} {getUserEmail(p) && `· ${getUserEmail(p)}`}
                    </p>
                    <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant/70">
                      {getBeneficiaryName(p)} · {new Date(p.created_at).toLocaleDateString("es-CL")}{" "}
                      {p.commerce_order && <span className="text-primary/80">· {p.commerce_order}</span>}
                    </p>
                    {p.status === "rechazado" && p.admin_note && (
                      <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-red-400/80 mt-1">
                        Nota: {p.admin_note}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface">
                      ${(p.amount || 0).toLocaleString("es-CL")}
                    </p>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {p.receipt_url && (
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg bg-on-surface/5 hover:bg-primary/10 transition-colors cursor-pointer"
                        title="Ver comprobante"
                      >
                        <span className="material-symbols-outlined text-on-surface-variant text-[18px]">receipt_long</span>
                      </a>
                    )}
                    {isPendiente && (
                      <button
                        onClick={() => onReview(p)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">fact_check</span>
                        Revisar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
