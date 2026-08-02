"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getChileToday, addDaysChile } from "@/lib/dates";
import { extendOrCreateEnrollment } from "@/lib/enrollments";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import StatusBadge from "@/components/admin/StatusBadge";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";

interface EnrollmentPlan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

interface AcademyEnrollment {
  id: string;
  beneficiary_id: string;
  enrollment_plan_id: string;
  payment_id: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  enrollment_plans?: { name: string; duration_days: number } | null;
  beneficiaries?: {
    profiles?: { full_name: string } | null;
    dependents?: { full_name: string } | null;
  } | null;
}

interface SearchableUser {
  userId: string;
  fullName: string;
  email: string;
  beneficiaries: {
    beneficiaryId: string;
    label: string;
    category: string;
    hasActiveEnrollment: boolean;
  }[];
}

const emptyPlan = { name: "", price: 0, duration_days: 365, active: true, sort_order: 0 };

export default function AdminInscripcionesPage() {
  const [plans, setPlans] = useState<EnrollmentPlan[]>([]);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"planes" | "inscripciones">("planes");
  const [filter, setFilter] = useState<"todas" | "activas" | "proximas-vencer" | "vencidas">("todas");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EnrollmentPlan | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<EnrollmentPlan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchableUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchableUser | null>(null);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [assignMethod, setAssignMethod] = useState("transferencia");
  const [assignAmount, setAssignAmount] = useState(0);
  const [assigning, setAssigning] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = async () => {
    const supabase = createClient();
    const [pRes, eRes] = await Promise.all([
      supabase.from("enrollment_plans").select("*").order("sort_order"),
      supabase.from("academy_enrollments").select(`
        *,
        enrollment_plans(name, duration_days),
        beneficiaries(profiles(full_name), dependents(full_name))
      `).order("created_at", { ascending: false }),
    ]);
    setPlans((pRes.data as EnrollmentPlan[]) || []);
    setEnrollments((eRes.data as AcademyEnrollment[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyPlan);
    setModalOpen(true);
  };

  const openEdit = (p: EnrollmentPlan) => {
    setEditing(p);
    setForm({ name: p.name, price: p.price, duration_days: p.duration_days, active: p.active, sort_order: p.sort_order });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || form.duration_days <= 0) {
      setToast({ msg: "Nombre y duración son obligatorios", type: "error" });
      return;
    }
    try {
      setSaving(true);
      const supabase = createClient();
      if (editing) {
        const { error } = await supabase.from("enrollment_plans").update(form).eq("id", editing.id);
        if (error) { setToast({ msg: getSupabaseErrorMessage(error, "actualizar plan"), type: "error" }); return; }
      } else {
        const { error } = await supabase.from("enrollment_plans").insert(form);
        if (error) { setToast({ msg: getSupabaseErrorMessage(error, "crear plan"), type: "error" }); return; }
      }
      setModalOpen(false);
      await load();
      setToast({ msg: editing ? "Plan actualizado" : "Plan creado", type: "success" });
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
      const { error } = await supabase.from("enrollment_plans").delete().eq("id", deleteTarget.id);
      if (error) { setToast({ msg: getSupabaseErrorMessage(error, "eliminar plan"), type: "error" }); return; }
      setDeleteTarget(null);
      await load();
      setToast({ msg: "Plan eliminado", type: "success" });
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "eliminar plan"), type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const supabase = createClient();
    const today = getChileToday();

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (!profiles || profiles.length === 0) { setSearchResults([]); setSearching(false); return; }

    const profileIds = profiles.map((p) => p.id);

    const [ownBenRes, depsRes] = await Promise.all([
      supabase.from("beneficiaries").select("id, profile_id").in("profile_id", profileIds),
      supabase.from("dependents").select("id, full_name, category, tutor_id").in("tutor_id", profileIds),
    ]);

    const ownBens = ownBenRes.data || [];
    const deps = depsRes.data || [];

    const depBenIds = deps.map((d) => d.id);
    const depBenRes = depBenIds.length > 0
      ? await supabase.from("beneficiaries").select("id, dependent_id").in("dependent_id", depBenIds)
      : { data: [] };
    const depBens = depBenRes.data || [];

    const allBenIds = [...ownBens.map((b) => b.id), ...depBens.map((b) => b.id)];

    const enrollRes = allBenIds.length > 0
      ? await supabase
          .from("academy_enrollments")
          .select("beneficiary_id")
          .in("beneficiary_id", allBenIds)
          .eq("status", "activa")
          .gte("end_date", today)
      : { data: [] };
    const enrolledIds = new Set((enrollRes.data || []).map((e) => e.beneficiary_id));

    const results: SearchableUser[] = [];
    for (const p of profiles) {
      const beneficiaries = [];

      const ownBen = ownBens.find((b) => b.profile_id === p.id);
      if (ownBen) {
        beneficiaries.push({
          beneficiaryId: ownBen.id,
          label: `${p.full_name} (Yo)`,
          category: "adulto",
          hasActiveEnrollment: enrolledIds.has(ownBen.id),
        });
      }

      const userDeps = deps.filter((d) => d.tutor_id === p.id);
      for (const d of userDeps) {
        const depBen = depBens.find((b) => b.dependent_id === d.id);
        if (depBen) {
          beneficiaries.push({
            beneficiaryId: depBen.id,
            label: `${d.full_name} (Carga)`,
            category: d.category,
            hasActiveEnrollment: enrolledIds.has(depBen.id),
          });
        }
      }

      if (beneficiaries.length > 0) {
        results.push({ userId: p.id, fullName: p.full_name, email: p.email || "", beneficiaries });
      }
    }

    setSearchResults(results);
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (searchQuery) searchUsers(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleAssign = async () => {
    if (!selectedUser || !selectedBeneficiaryId || !selectedPlanId) return;
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) { setToast({ msg: "Selecciona un plan de inscripción", type: "error" }); return; }

    try {
      setAssigning(true);
      const supabase = createClient();

      let paymentId: string | null = null;
      if (assignAmount > 0) {
        const { data: payment } = await supabase.from("payments").insert({
          user_id: selectedUser.userId,
          beneficiary_id: selectedBeneficiaryId,
          concept: `Inscripción ${plan.name}`,
          amount: assignAmount,
          method: assignMethod,
          status: "pagado",
          paid_at: new Date().toISOString(),
        }).select("id").single();
        paymentId = payment?.id ?? null;
      }

      const result = await extendOrCreateEnrollment(
        supabase,
        selectedBeneficiaryId,
        selectedPlanId,
        paymentId
      );

      if (!result.success) {
        setToast({ msg: result.error || "Error al asignar inscripción", type: "error" });
        return;
      }

      setAssignOpen(false);
      setSelectedUser(null);
      setSelectedBeneficiaryId("");
      setSelectedPlanId("");
      setSearchQuery("");
      setSearchResults([]);
      await load();
      setToast({ msg: "Inscripción asignada correctamente", type: "success" });
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "asignar inscripción"), type: "error" });
    } finally {
      setAssigning(false);
    }
  };

  const getBeneficiaryName = (e: AcademyEnrollment) => {
    const b = e.beneficiaries;
    if (!b) return "—";
    return b.dependents?.full_name || b.profiles?.full_name || "—";
  };

  const formatCLP = (n: number) => "$" + n.toLocaleString("es-CL");

  const today = getChileToday();
  const in7Days = addDaysChile(today, 7);

  const filterCounts = {
    todas: enrollments.length,
    activas: enrollments.filter((e) => e.status === "activa" && e.end_date >= today).length,
    proximasVencer: enrollments.filter((e) => e.status === "activa" && e.end_date >= today && e.end_date <= in7Days).length,
    vencidas: enrollments.filter((e) => e.status === "vencida" || e.end_date < today).length,
  };

  const filteredEnrollments = filter === "todas" ? enrollments : enrollments.filter((e) => {
    switch (filter) {
      case "activas": return e.status === "activa" && e.end_date >= today;
      case "proximas-vencer": return e.status === "activa" && e.end_date >= today && e.end_date <= in7Days;
      case "vencidas": return e.status === "vencida" || e.end_date < today;
      default: return true;
    }
  });

  const planColumns = [
    { key: "name", label: "Nombre" },
    { key: "price", label: "Precio", render: (plan: EnrollmentPlan) => formatCLP(plan.price) },
    { key: "duration_days", label: "Duración", render: (plan: EnrollmentPlan) => `${plan.duration_days} días` },
    { key: "active", label: "Estado", render: (plan: EnrollmentPlan) => <StatusBadge status={plan.active ? "activo" : "cancelado"} /> },
    {
      key: "actions",
      label: "",
      render: (plan: EnrollmentPlan) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(plan)} className="text-on-surface-variant hover:text-primary text-[18px] cursor-pointer"><span className="material-symbols-outlined text-[18px]">edit</span></button>
          <button onClick={() => setDeleteTarget(plan)} className="text-on-surface-variant hover:text-red-400 text-[18px] cursor-pointer"><span className="material-symbols-outlined text-[18px]">delete</span></button>
        </div>
      ),
    },
  ];

  const enrollmentColumns = [
    {
      key: "beneficiary",
      label: "Beneficiario",
      render: (enrollment: AcademyEnrollment) => (
        <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{getBeneficiaryName(enrollment)}</span>
      ),
    },
    { key: "enrollment_plans", label: "Plan", render: (enrollment: AcademyEnrollment) => enrollment.enrollment_plans?.name || "—" },
    { key: "start_date", label: "Inicio" },
    { key: "end_date", label: "Vencimiento" },
    { key: "status", label: "Estado", render: (enrollment: AcademyEnrollment) => <StatusBadge status={enrollment.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[24px] text-on-surface uppercase">
            Inscripciones
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mt-1">
            Gestión de planes e inscripciones a la academia
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-on-surface/5 pb-2">
        <button
          onClick={() => setTab("planes")}
          className={`px-4 py-2 rounded-lg font-[family-name:var(--font-body-md)] text-[13px] transition-colors cursor-pointer ${
            tab === "planes" ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Planes de Inscripción
        </button>
        <button
          onClick={() => setTab("inscripciones")}
          className={`px-4 py-2 rounded-lg font-[family-name:var(--font-body-md)] text-[13px] transition-colors cursor-pointer ${
            tab === "inscripciones" ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Inscripciones Asignadas
        </button>
      </div>

      {tab === "planes" ? (
        <>
          <div className="flex justify-end">
            <button onClick={openCreate} className="btn-primary-gradient px-4 py-2 rounded-lg font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider text-white cursor-pointer">
              <span className="material-symbols-outlined text-[16px] mr-1 align-middle">add</span>
              Nuevo Plan
            </button>
          </div>
          <DataTable columns={planColumns} data={plans} loading={loading} />
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <button onClick={() => { setAssignOpen(true); setSearchQuery(""); setSelectedUser(null); setSelectedBeneficiaryId(""); setSelectedPlanId(plans[0]?.id || ""); setAssignAmount(0); setAssignMethod("transferencia"); }} className="btn-primary-gradient px-4 py-2 rounded-lg font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider text-white cursor-pointer">
              <span className="material-symbols-outlined text-[16px] mr-1 align-middle">add</span>
              Asignar Inscripción
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { key: "todas", label: "Todas" },
              { key: "activas", label: "Activas" },
              { key: "proximas-vencer", label: "Próximas a vencer" },
              { key: "vencidas", label: "Vencidas" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  filter === f.key
                    ? f.key === "vencidas"
                      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                      : f.key === "proximas-vencer"
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                        : f.key === "activas"
                          ? "bg-green-500/10 text-green-400 border-green-500/30"
                          : "btn-primary-gradient text-white"
                    : "border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                  filter === f.key ? "bg-black/20" : "bg-on-surface/10"
                }`}>
                  {filterCounts[f.key as keyof typeof filterCounts]}
                </span>
              </button>
            ))}
          </div>
          <DataTable columns={enrollmentColumns} data={filteredEnrollments} loading={loading} />
        </>
      )}

      {/* Modal: Crear/Editar Plan */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Plan" : "Nuevo Plan de Inscripción"}>
        <div className="space-y-4">
          <div>
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">Nombre *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: 6 Meses, 1 Año" className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">Precio (CLP) *</label>
              <input type="number" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface" />
            </div>
            <div>
              <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">Duración (días) *</label>
              <input type="number" inputMode="numeric" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">Activo</label>
            <button type="button" onClick={() => setForm({ ...form, active: !form.active })} className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${form.active ? "bg-primary" : "bg-on-surface/20"}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${form.active ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-[13px] font-[family-name:var(--font-label-md)] uppercase tracking-wider text-on-surface-variant hover:text-on-surface cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-primary text-on-primary rounded-lg text-[13px] font-[family-name:var(--font-label-md)] uppercase tracking-wider hover:opacity-90 disabled:opacity-50 cursor-pointer">
              {saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Plan"}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Modal: Asignar Inscripción */}
      {assignOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAssignOpen(false)}>
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-on-surface/5">
              <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase">Asignar Inscripción</h2>
              <button onClick={() => setAssignOpen(false)} className="text-on-surface-variant hover:text-on-surface cursor-pointer"><span className="material-symbols-outlined text-[24px]">close</span></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Search */}
              <div>
                <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">Buscar usuario</label>
                <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSelectedUser(null); }} placeholder="Nombre o email..." className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface" />
                {searching && <p className="text-[12px] text-on-surface-variant mt-1">Buscando...</p>}
                {searchResults.length > 0 && !selectedUser && (
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {searchResults.map((u) => (
                      <button key={u.userId} onClick={() => setSelectedUser(u)} className="w-full text-left p-2 rounded-lg hover:bg-on-surface/5 cursor-pointer">
                        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{u.fullName}</p>
                        <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">{u.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Beneficiary selection */}
              {selectedUser && (
                <div>
                  <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">Beneficiario *</label>
                  <div className="space-y-1">
                    {selectedUser.beneficiaries.map((b) => (
                      <label key={b.beneficiaryId} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedBeneficiaryId === b.beneficiaryId ? "border-primary bg-primary/5" : "border-on-surface/10 hover:border-on-surface/20"}`}>
                        <input type="radio" name="assign-beneficiary" checked={selectedBeneficiaryId === b.beneficiaryId} onChange={() => setSelectedBeneficiaryId(b.beneficiaryId)} className="accent-primary" />
                        <div className="flex-1">
                          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{b.label}</p>
                        </div>
                        {b.hasActiveEnrollment && (
                          <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-green-400">Ya tiene inscripción</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Plan selection */}
              {selectedBeneficiaryId && (
                <div>
                  <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">Plan de inscripción *</label>
                  <select value={selectedPlanId} onChange={(e) => { setSelectedPlanId(e.target.value); const p = plans.find((pl) => pl.id === e.target.value); if (p) setAssignAmount(p.price); }} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
                    {plans.filter((p) => p.active).map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {formatCLP(p.price)} ({p.duration_days} días)</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment method */}
              {selectedBeneficiaryId && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">Método de pago</label>
                      <select value={assignMethod} onChange={(e) => setAssignMethod(e.target.value)} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
                        <option value="transferencia">Transferencia</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="cortesia">Cortesía</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant block mb-1">Monto (CLP)</label>
                      <input type="number" inputMode="numeric" value={assignAmount} onChange={(e) => setAssignAmount(Number(e.target.value))} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface" />
                    </div>
                  </div>
                </>
              )}

              <button onClick={handleAssign} disabled={!selectedBeneficiaryId || !selectedPlanId || assigning} className="w-full btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider py-3 rounded-lg transition-opacity disabled:opacity-50 cursor-pointer">
                {assigning ? "Asignando..." : "Asignar Inscripción"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <DeleteConfirm open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Eliminar Plan" message={`¿Eliminar el plan "${deleteTarget?.name}"? Las inscripciones existentes no se verán afectadas.`} />

      {/* Toast */}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
