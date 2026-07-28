"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";
import AssignMembershipModal from "@/components/admin/AssignMembershipModal";
import MembershipReceipt from "@/components/admin/MembershipReceipt";
import type { ReceiptData } from "@/components/admin/MembershipReceipt";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";
import { getRemainingTokens, getEnrollmentDebt, type TokenInfo, type DebtDetail } from "@/lib/supabase/dashboard";

interface Plan { id: string; name: string; price: number; duration_days: number; category: string; benefits: string[]; tokens: number | null; active: boolean; featured?: boolean; }
interface Membership { id: string; beneficiary_id: string; plan_id: string; purchased_by: string; start_date: string; end_date: string; status: string; created_at: string; membership_plans?: { name: string }; profiles?: { full_name: string }; beneficiaries?: { dependents?: { full_name: string; profiles?: { full_name: string } | null } | null; profiles?: { full_name: string } | null }; }

const emptyPlan = { name: "", price: 0, duration_days: 30, category: "adulto", benefits: [] as string[], tokens: null as number | null, active: true, featured: false };

export default function AdminMembresiasPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"planes" | "membresias">("planes");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newBenefit, setNewBenefit] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [editMembership, setEditMembership] = useState<Membership | null>(null);
  const [editForm, setEditForm] = useState({ endDate: "", status: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Membership | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [debtDetails, setDebtDetails] = useState<DebtDetail[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const [pRes, mRes] = await Promise.all([
      supabase.from("membership_plans").select("*").order("price"),
      supabase.from("memberships").select("*, membership_plans(name), profiles:purchased_by(full_name), beneficiaries!inner(dependents(full_name, profiles!tutor_id(full_name)), profiles(full_name))").order("created_at", { ascending: false }),
    ]);
    setPlans((pRes.data as Plan[]) || []);
    setMemberships((mRes.data as Membership[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyPlan); setNewBenefit(""); setModalOpen(true); };
  const openEdit = (p: Plan) => { setEditing(p); setForm({ name: p.name, price: p.price, duration_days: p.duration_days, category: p.category, benefits: Array.isArray(p.benefits) ? p.benefits : [], tokens: p.tokens, active: p.active, featured: p.featured ?? false }); setNewBenefit(""); setModalOpen(true); };

  const handleSetFeatured = async (plan: Plan) => {
    const supabase = createClient();
    // Remove featured from all plans first, then set this one
    await supabase.from("membership_plans").update({ featured: false }).eq("featured", true);
    if (!plan.featured) {
      await supabase.from("membership_plans").update({ featured: true }).eq("id", plan.id);
    }
    await load();
    setToast({ msg: plan.featured ? "Plan ya no es PRO destacado" : `"${plan.name}" marcado como PRO destacado`, type: "success" });
  };

  const addBenefit = () => {
    const text = newBenefit.trim();
    if (!text || form.benefits.includes(text)) return;
    setForm({ ...form, benefits: [...form.benefits, text] });
    setNewBenefit("");
  };

  const removeBenefit = (idx: number) => {
    setForm({ ...form, benefits: form.benefits.filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const supabase = createClient();
      if (editing) {
        const { error } = await supabase.from("membership_plans").update(form).eq("id", editing.id);
        if (error) { setToast({ msg: getSupabaseErrorMessage(error, "actualizar plan"), type: "error" }); return; }
      } else {
        const { error } = await supabase.from("membership_plans").insert(form);
        if (error) { setToast({ msg: getSupabaseErrorMessage(error, "crear plan"), type: "error" }); return; }
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "guardar plan"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const supabase = createClient();
      const { error } = await supabase.from("membership_plans").delete().eq("id", deleteTarget.id);
      if (error) { setToast({ msg: getSupabaseErrorMessage(error, "eliminar plan"), type: "error" }); return; }
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "eliminar plan"), type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const openEditMembership = (m: Membership) => {
    setEditMembership(m);
    setEditForm({ endDate: m.end_date, status: m.status });
  };

  const handleSaveMembership = async () => {
    if (!editMembership) return;
    try {
      setEditSaving(true);
      const supabase = createClient();
      const { error } = await supabase.from("memberships").update({ end_date: editForm.endDate, status: editForm.status }).eq("id", editMembership.id);
      if (error) { setToast({ msg: getSupabaseErrorMessage(error, "actualizar membresía"), type: "error" }); return; }
      setEditMembership(null);
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "guardar membresía"), type: "error" });
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelMembership = async () => {
    if (!cancelTarget) return;
    try {
      setCancelling(true);
      const supabase = createClient();
      const { error } = await supabase.from("memberships").update({ status: "cancelada" }).eq("id", cancelTarget.id);
      if (error) { setToast({ msg: getSupabaseErrorMessage(error, "cancelar membresía"), type: "error" }); return; }
      setCancelTarget(null);
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "cancelar membresía"), type: "error" });
    } finally {
      setCancelling(false);
    }
  };

  const getBeneficiaryName = (m: Membership): string => {
    const depName = m.beneficiaries?.dependents?.full_name;
    const tutorName = m.beneficiaries?.dependents?.profiles?.full_name;
    const userName = m.beneficiaries?.profiles?.full_name;
    if (depName && tutorName) return `${depName} — Carga de ${tutorName}`;
    if (depName) return `${depName} — Carga`;
    return userName || m.profiles?.full_name || "—";
  };

  const toggleTokenDetails = async (m: Membership) => {
    if (expandedToken === m.id) {
      setExpandedToken(null);
      setTokenInfo(null);
      setDebtDetails([]);
      return;
    }

    setExpandedToken(m.id);
    setLoadingTokens(true);
    setTokenInfo(null);
    setDebtDetails([]);

    const [tokenRes, debtRes] = await Promise.all([
      getRemainingTokens(m.beneficiary_id, m.id),
      getEnrollmentDebt(m.beneficiary_id, m.id),
    ]);

    setTokenInfo(tokenRes);
    setDebtDetails(debtRes);
    setLoadingTokens(false);
  };

  const getReceiptData = (m: Membership): ReceiptData => {
    const depName = m.beneficiaries?.dependents?.full_name;
    const tutorName = m.beneficiaries?.dependents?.profiles?.full_name;
    return {
      receiptNumber: `REC-${new Date(m.created_at).getFullYear()}-${m.id.slice(0, 8).toUpperCase()}`,
      beneficiaryName: depName || m.beneficiaries?.profiles?.full_name || m.profiles?.full_name || "—",
      tutorName: tutorName || undefined,
      planName: m.membership_plans?.name || "—",
      startDate: m.start_date,
      endDate: m.end_date,
      amount: 0,
      method: "transferencia",
      issuedAt: m.created_at,
    };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">Membresías</h1>
        <div className="flex gap-3">
          {tab === "membresias" && (
            <button onClick={() => setAssignOpen(true)} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Asignar Membresía
            </button>
          )}
          {tab === "planes" && (
            <button onClick={openCreate} className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-5 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nuevo Plan
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        {(["planes", "membresias"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`font-[family-name:var(--font-headline-md)] text-[13px] uppercase tracking-wider px-4 py-2 rounded-lg transition-colors cursor-pointer ${tab === t ? "btn-primary-gradient text-white" : "border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"}`}>
            {t === "planes" ? "Planes" : "Membresías"}
          </button>
        ))}
      </div>

      {tab === "planes" ? (
        <DataTable
          columns={[
            { key: "name", label: "Nombre", render: (p) => (
              <div className="flex items-center gap-2">
                <span>{p.name}</span>
                {p.featured && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-[family-name:var(--font-label-sm)] uppercase tracking-wider" style={{ background: "linear-gradient(90deg,#a855f7,#ec4899,#f97316,#eab308,#22c55e,#06b6d4,#a855f7)", backgroundSize: "200%", animation: "prismatic 3s linear infinite", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", border: "1px solid #a855f740" }}>
                    ⬡ PRO
                  </span>
                )}
              </div>
            )},
            { key: "price", label: "Precio", render: (p) => `$${p.price.toLocaleString("es-CL")}` },
            { key: "duration_days", label: "Duración", render: (p) => `${p.duration_days} días` },
            { key: "category", label: "Categoría", render: (p) => p.category.charAt(0).toUpperCase() + p.category.slice(1) },
            { key: "tokens", label: "Tokens", render: (p) => p.tokens === null ? <span className="text-on-surface-variant">Ilimitado</span> : <span className="text-on-surface">{p.tokens}</span> },
            { key: "featured", label: "PRO", render: (p) => (
              <button
                onClick={(e) => { e.stopPropagation(); handleSetFeatured(p); }}
                title={p.featured ? "Quitar destacado PRO" : "Marcar como PRO destacado"}
                className="cursor-pointer transition-transform hover:scale-110"
              >
                {p.featured ? (
                  <span className="material-symbols-outlined text-[20px]" style={{ background: "linear-gradient(135deg,#a855f7,#ec4899,#f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>star</span>
                ) : (
                  <span className="material-symbols-outlined text-[20px] text-on-surface/20 hover:text-on-surface/50">star</span>
                )}
              </button>
            )},
            { key: "active", label: "Estado", render: (p) => <StatusBadge status={p.active ? "activo" : "cancelado"} /> },
          ]}
          data={plans}
          loading={loading}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          emptyMessage="No hay planes creados"
        />
      ) : (
        <>
        <DataTable
          columns={[
            { key: "beneficiary_id", label: "Beneficiario", render: (m) => (
              <div>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{getBeneficiaryName(m)}</p>
              </div>
            )},
            { key: "plan_id", label: "Plan", render: (m) => m.membership_plans?.name || "—" },
            { key: "start_date", label: "Inicio", render: (m) => new Date(m.start_date).toLocaleDateString("es-CL") },
            { key: "end_date", label: "Fin", render: (m) => new Date(m.end_date).toLocaleDateString("es-CL") },
            { key: "status", label: "Estado", render: (m) => <StatusBadge status={m.status} /> },
            { key: "tokens", label: "Tokens", render: (m) => {
              if (m.status !== "activa") return <span className="text-on-surface-variant/40 text-[11px]">—</span>;
              const plan = plans.find((p) => p.id === m.plan_id);
              if (!plan || plan.tokens === null) {
                return (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                    <span className="material-symbols-outlined text-[12px] text-green-400">all_inclusive</span>
                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] text-green-400">Ilimitado</span>
                  </span>
                );
              }
              const isExpanded = expandedToken === m.id;
              return (
                <button
                  onClick={() => toggleTokenDetails(m)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors cursor-pointer hover:opacity-80 bg-surface-container-high/50 border-on-surface/10"
                >
                  <span className="material-symbols-outlined text-[12px] text-on-surface-variant">token</span>
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] text-on-surface">{plan.tokens} clases</span>
                  <span className={`material-symbols-outlined text-[10px] text-on-surface-variant transition-transform ${isExpanded ? "rotate-180" : ""}`}>expand_more</span>
                </button>
              );
            }},
          ]}
          data={memberships}
          loading={loading}
          onEdit={openEditMembership}
          onDelete={setCancelTarget}
          emptyMessage="No hay membresías registradas"
        />

        {expandedToken && (
          <div className="mt-3 bg-surface-container-lowest border border-on-surface/5 rounded-xl p-5 animate-in slide-in-from-top-2 duration-200">
            {loadingTokens ? (
              <div className="flex items-center gap-3 py-4">
                <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">Cargando tokens...</span>
              </div>
            ) : tokenInfo ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">token</span>
                    <h4 className="font-[family-name:var(--font-headline-md)] text-[14px] text-on-surface uppercase">
                      Estado de Tokens
                    </h4>
                  </div>
                  <button onClick={() => setExpandedToken(null)} className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {tokenInfo.is_unlimited ? (
                  <div className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/15 rounded-lg">
                    <span className="material-symbols-outlined text-green-400 text-[24px]">all_inclusive</span>
                    <div>
                      <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">Plan ilimitado</p>
                      <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">Sin restricción de clases</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-surface-container rounded-lg border border-on-surface/5 text-center">
                        <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider text-on-surface-variant mb-1">Total</p>
                        <p className="font-[family-name:var(--font-headline-md)] text-[22px] text-on-surface">{tokenInfo.total}</p>
                      </div>
                      <div className="p-3 bg-surface-container rounded-lg border border-on-surface/5 text-center">
                        <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider text-on-surface-variant mb-1">Consumidos</p>
                        <p className="font-[family-name:var(--font-headline-md)] text-[22px] text-on-surface">{tokenInfo.consumed}</p>
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${
                        tokenInfo.remaining !== null && tokenInfo.remaining < 0
                          ? "bg-red-500/5 border-red-500/15"
                          : tokenInfo.remaining !== null && tokenInfo.remaining <= 2
                            ? "bg-yellow-500/5 border-yellow-500/15"
                            : "bg-green-500/5 border-green-500/15"
                      }`}>
                        <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider text-on-surface-variant mb-1">Restantes</p>
                        <p className={`font-[family-name:var(--font-headline-md)] text-[22px] ${
                          tokenInfo.remaining !== null && tokenInfo.remaining < 0
                            ? "text-red-400"
                            : tokenInfo.remaining !== null && tokenInfo.remaining <= 2
                              ? "text-yellow-400"
                              : "text-green-400"
                        }`}>{tokenInfo.remaining}</p>
                      </div>
                    </div>

                    {tokenInfo.justified > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-lg">
                        <span className="material-symbols-outlined text-yellow-400 text-[16px]">info</span>
                        <span className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                          {tokenInfo.justified} clase{tokenInfo.justified > 1 ? "s" : ""} justificada{tokenInfo.justified > 1 ? "s" : ""} — token{tokenInfo.justified > 1 ? "s" : ""} devuelto{tokenInfo.justified > 1 ? "s" : ""}
                        </span>
                      </div>
                    )}

                    {tokenInfo.remaining !== null && tokenInfo.remaining < 0 && debtDetails.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-[family-name:var(--font-headline-md)] text-[12px] uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          Deuda — {Math.abs(tokenInfo.remaining)} inscripciones exceden el plan
                        </p>
                        <div className="space-y-1.5">
                          {debtDetails.map((d) => (
                            <div key={d.enrollment_id} className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                              <span className="material-symbols-outlined text-red-400/60 text-[16px]">event_busy</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface">
                                  {d.discipline_name} — {new Date(d.session_date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
                                </p>
                                <p className="font-[family-name:var(--font-body-sm)] text-[10px] text-on-surface-variant">
                                  {d.professor_name} · {d.start_time?.slice(0, 5)}-{d.end_time?.slice(0, 5)} · {d.source === "qr" ? "QR" : "Admin"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant py-4">
                No se pudo cargar la información de tokens.
              </p>
            )}
          </div>
        )}
        </>
      )}

      {/* Plan modal */}
      <FormModal open={modalOpen} title={editing ? "Editar Plan" : "Nuevo Plan"} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Nombre *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Precio ($) *</label>
              <input inputMode="numeric" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Duración (días) *</label>
              <input inputMode="numeric" value={form.duration_days || ""} onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Tokens por periodo</label>
            <div className="flex items-center gap-3">
              <input
                inputMode="numeric"
                value={form.tokens === null ? "" : form.tokens}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setForm({ ...form, tokens: val === "" ? null : Number(val) });
                }}
                placeholder="Ilimitado"
                className="flex-1 bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, tokens: form.tokens === null ? 12 : null })}
                className={`px-4 py-2.5 rounded-lg text-[13px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider transition-colors cursor-pointer ${form.tokens === null ? "btn-primary-gradient text-white" : "border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"}`}
              >
                {form.tokens === null ? "Ilimitado" : "Fijo"}
              </button>
            </div>
            <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60 mt-1.5">
              Dejar vacío para planes ilimitados. Número fijo = clases incluidas por periodo.
            </p>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Categoría *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              <option value="adulto">Adulto</option>
              <option value="nino">Niño</option>
            </select>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Beneficios</label>
            <div className="flex gap-2 mb-3">
              <input
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBenefit(); } }}
                placeholder="Escribe un beneficio..."
                className="flex-1 bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={addBenefit}
                disabled={!newBenefit.trim()}
                className="btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] px-4 py-2.5 rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
              >
                + Agregar
              </button>
            </div>
            {form.benefits.length > 0 ? (
              <ul className="space-y-2">
                {form.benefits.map((b, idx) => (
                  <li key={idx} className="flex items-center justify-between bg-surface-container border border-on-surface/5 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                      <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{b}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBenefit(idx)}
                      className="text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/50 italic">
                Sin beneficios agregados
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
              <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">Activo</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-on-surface/10 hover:border-purple-500/40 transition-colors" style={form.featured ? { borderColor: "#a855f740", background: "linear-gradient(135deg, #a855f710, #ec489910, #f9731610)" } : {}}>
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="accent-purple-500" />
              <div>
                <span className="font-[family-name:var(--font-body-md)] text-[14px]" style={form.featured ? { background: "linear-gradient(90deg,#a855f7,#ec4899,#f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 700 } : { color: "var(--color-on-surface)" }}>⬡ Destacado PRO</span>
                <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60 mt-0.5">Aparece al centro con efecto prismático. Solo 1 plan puede ser PRO.</p>
              </div>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={!form.name || saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Plan"}</button>
          </div>
        </div>
      </FormModal>

      {/* Edit membership modal */}
      <FormModal open={!!editMembership} title="Editar Membresía" onClose={() => setEditMembership(null)}>
        <div className="space-y-4">
          {editMembership && (
            <>
              <div className="bg-surface-container rounded-lg p-4 border border-on-surface/5">
                <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1">Beneficiario</p>
                <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{getBeneficiaryName(editMembership)}</p>
                <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1 mt-2">Plan</p>
                <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{editMembership.membership_plans?.name}</p>
              </div>
              <div>
                <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Fecha de vencimiento</label>
                <input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Estado</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
                  <option value="activa">Activa</option>
                  <option value="vencida">Vencida</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
                <button onClick={() => setEditMembership(null)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
                <button onClick={handleSaveMembership} disabled={editSaving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{editSaving ? "Guardando..." : "Guardar Cambios"}</button>
              </div>
            </>
          )}
        </div>
      </FormModal>

      {/* Cancel confirmation */}
      <DeleteConfirm open={!!cancelTarget} title="Cancelar Membresía" message={`¿Estás seguro de cancelar la membresía de "${cancelTarget ? getBeneficiaryName(cancelTarget) : ""}"? Esta acción no se puede deshacer.`} onConfirm={handleCancelMembership} onCancel={() => setCancelTarget(null)} loading={cancelling} />

      {/* Assign membership modal */}
      <AssignMembershipModal open={assignOpen} onClose={() => setAssignOpen(false)} onSaved={load} />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
