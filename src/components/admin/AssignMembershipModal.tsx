"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getChileToday, addDaysChile } from "@/lib/dates";
import FormModal from "@/components/admin/FormModal";

interface Plan { id: string; name: string; price: number; duration_days: number; category: string; }
interface Profile { id: string; full_name: string; email: string; }
interface Beneficiary { id: string; profile_id: string | null; }

// Renovar (v1.14.0): precarga alumno y plan. Al insertar la membresía, el
// trigger trg_memberships_resolve_renewals aprueba sola cualquier solicitud
// de renovación pendiente del alumno.
export interface AssignMembershipPrefill {
  profileId: string;
  planId?: string | null;
  renewal?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  prefill?: AssignMembershipPrefill | null;
}

const emptyForm = {
  search: "",
  beneficiaryId: "",
  planId: "",
  startDate: getChileToday(),
  method: "transferencia",
  amount: 0,
  notes: "",
};

export default function AssignMembershipModal({ open, onClose, onSaved, prefill }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [results, setResults] = useState<Profile[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [searching, setSearching] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingMembership, setExistingMembership] = useState<{ id: string; planName: string; endDate: string } | null>(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  const prefillProfileId = prefill?.profileId ?? null;
  const prefillPlanId = prefill?.planId ?? null;

  const searchUsers = useCallback(async () => {
    const q = form.search.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const supabase = createClient();

    // Una cuenta por alumno: se busca la cuenta del alumno (nombre, correo o RUT).
    // Una carga aún sin migrar se migra primero en /admin/migracion-cargas.
    const safe = q.replace(/[,()]/g, " ");
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,rut.ilike.%${safe}%`)
      .limit(10);

    setResults((profiles as Profile[]) || []);
    setSearching(false);
  }, [form.search]);

  useEffect(() => {
    const t = setTimeout(searchUsers, 300);
    return () => clearTimeout(t);
  }, [searchUsers]);

  const selectProfileAndBeneficiary = async (p: Profile) => {
    setSelectedProfile(p);
    const supabase = createClient();
    const benByProfile = await supabase.from("beneficiaries").select("id, profile_id").eq("profile_id", p.id);
    const benList = (benByProfile.data as Beneficiary[]) || [];
    setBeneficiaries(benList);

    const chosenBeneficiaryId = benList[0]?.id || "";
    setForm((prev) => ({
      ...prev,
      search: p.full_name,
      beneficiaryId: chosenBeneficiaryId,
      planId: "",
      amount: 0,
    }));

    if (chosenBeneficiaryId) {
      checkExistingMembership(chosenBeneficiaryId);
    } else {
      setExistingMembership(null);
    }
  };

  const getBeneficiaryId = (profileId: string): string => {
    const b = beneficiaries.find((b) => b.profile_id === profileId);
    return b?.id || "";
  };


  const checkExistingMembership = async (beneficiaryId: string) => {
    if (!beneficiaryId) {
      setExistingMembership(null);
      return;
    }

    const supabase = createClient();
    const today = getChileToday();

    const { data: membership } = await supabase
      .from("memberships")
      .select("id, end_date, membership_plans(name)")
      .eq("beneficiary_id", beneficiaryId)
      .eq("status", "activa")
      .gte("end_date", today)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membership) {
      setExistingMembership({
        id: membership.id,
        planName: (membership.membership_plans as unknown as { name: string })?.name || "—",
        endDate: membership.end_date,
      });
    } else {
      setExistingMembership(null);
    }
  };

  // Al abrir: limpia el formulario y, si hay prefill (Renovar), precarga
  // alumno y plan. Va después de selectProfileAndBeneficiary y
  // checkExistingMembership porque las usa.
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    let cancelled = false;
    setForm(emptyForm);
    setSelectedProfile(null);
    setResults([]);
    setBeneficiaries([]);
    setReceiptFile(null);

    (async () => {
      const { data } = await supabase.from("membership_plans").select("id, name, price, duration_days, category").eq("active", true).order("price");
      const planList = (data as Plan[]) || [];
      if (cancelled) return;
      setPlans(planList);
      if (!prefillProfileId) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", prefillProfileId)
        .maybeSingle();
      if (!profile || cancelled) return;
      await selectProfileAndBeneficiary(profile as Profile);
      // Solo se precarga si el plan anterior sigue activo; si no, el admin elige.
      const plan = planList.find((p) => p.id === prefillPlanId);
      if (plan && !cancelled) setForm((prev) => ({ ...prev, planId: plan.id, amount: plan.price }));
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillProfileId, prefillPlanId]);

  const selectedPlan = plans.find((p) => p.id === form.planId);

  const handlePlanChange = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    setForm({ ...form, planId, amount: plan?.price || 0 });
  };

  const handleSave = async () => {
    if (!form.beneficiaryId || !form.planId || !selectedProfile) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const plan = plans.find((p) => p.id === form.planId);
    if (!plan) { setSaving(false); return; }

    // Cancelar cualquier membresía activa previa
    const { error: cancelError } = await supabase
      .from("memberships")
      .update({ status: "cancelada" })
      .eq("beneficiary_id", form.beneficiaryId)
      .eq("status", "activa");

    if (cancelError) {
      console.error("AssignMembershipModal: fallo al cancelar membresías previas:", cancelError);
    }

    const endDate = addDaysChile(form.startDate, plan.duration_days);

    const { data: membership, error: insertError } = await supabase.from("memberships").insert({
      beneficiary_id: form.beneficiaryId,
      plan_id: form.planId,
      purchased_by: user?.id,
      start_date: form.startDate,
      end_date: endDate,
      status: "activa",
    }).select("id").single();

    // B-002: si el índice único rechazó el insert (23505), recargar estado para
    // reflejar la membresía activa que quedó creada (posible doble submit / admin paralelo).
    if (insertError?.code === "23505") {
      console.warn("AssignMembershipModal: ya existe una membresía activa (23505), se recarga el listado");
      setSaving(false);
      onSaved();
      onClose();
      return;
    }

    if (membership) {
      let receiptUrl = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop();
        const path = `receipts/${membership.id}.${ext}`;
        const { error } = await supabase.storage.from("public").upload(path, receiptFile, { upsert: true });
        if (!error) {
          const { data: urlData } = supabase.storage.from("public").getPublicUrl(path);
          receiptUrl = urlData.publicUrl;
        }
      }

      await supabase.from("payments").insert({
        user_id: selectedProfile.id,
        beneficiary_id: form.beneficiaryId,
        membership_id: membership.id,
        concept: `Asignación manual - ${plan.name}`,
        amount: form.amount,
        method: form.method,
        status: "pagado",
        receipt_url: receiptUrl,
        paid_at: new Date().toISOString(),
      });
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <FormModal open={open} title={prefill?.renewal ? "Renovar Membresía" : "Asignar Membresía"} onClose={onClose}>
      <div className="space-y-4">
        {prefill?.renewal && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-2">
            <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">autorenew</span>
            <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
              Renovación: se precargan el alumno y su plan anterior (si sigue activo). Si el alumno tenía una
              solicitud de renovación pendiente, se aprobará automáticamente al guardar.
            </p>
          </div>
        )}
        {/* Buscar usuario */}
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Buscar usuario *</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              value={form.search}
              onChange={(e) => setForm({ ...form, search: e.target.value, beneficiaryId: "", planId: "", amount: 0 })}
              placeholder="Nombre del alumno..."
              disabled={!!selectedProfile}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg pl-10 pr-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 disabled:opacity-50"
            />
            {selectedProfile && (
              <button
                onClick={() => {
                  setSelectedProfile(null);
                  setForm({ ...form, search: "", beneficiaryId: "", planId: "", amount: 0 });
                  setBeneficiaries([]);
                  setExistingMembership(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          {!selectedProfile && results.length > 0 && (
            <div className="mt-1 bg-surface-container border border-on-surface/10 rounded-lg max-h-60 overflow-y-auto">
              {results.map((profile) => (
                <div key={profile.id} className="border-b border-on-surface/5 last:border-0">
                  <button onClick={() => selectProfileAndBeneficiary(profile)} className="w-full text-left px-4 py-2.5 hover:bg-on-surface/5 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[16px]">person</span>
                      <div>
                        <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{profile.full_name}</p>
                        <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant">{profile.email}</p>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
          {!selectedProfile && searching && (
            <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant mt-1">Buscando...</p>
          )}
        </div>

        {/* Beneficiario */}
        {selectedProfile && (
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Beneficiario *</label>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.beneficiaryId === getBeneficiaryId(selectedProfile.id) ? "border-primary bg-primary/5" : "border-on-surface/10 hover:border-on-surface/20"}`}>
                <input type="radio" name="beneficiary" checked={form.beneficiaryId === getBeneficiaryId(selectedProfile.id)} onChange={() => { const bId = getBeneficiaryId(selectedProfile.id); setForm({ ...form, beneficiaryId: bId }); checkExistingMembership(bId); }} className="accent-primary" />
                <div>
                  <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">{selectedProfile.full_name}</p>
                  <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">Alumno</p>
                </div>
              </label>
            </div>
            {existingMembership && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
                  <p className="font-[family-name:var(--font-body-md)] text-[13px] text-amber-200">
                    Ya tiene una membresía activa: <span className="font-semibold">{existingMembership.planName}</span> hasta {new Date(existingMembership.endDate).toLocaleDateString("es-CL")}
                  </p>
                </div>
                <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-amber-200/70 mt-1">
                  La membresía anterior será cancelada al asignar la nueva.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Plan */}
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Plan *</label>
          <select value={form.planId} onChange={(e) => handlePlanChange(e.target.value)} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
            <option value="">Seleccionar plan...</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — ${p.price.toLocaleString("es-CL")} ({p.duration_days} días)</option>
            ))}
          </select>
        </div>

        {/* Fecha inicio */}
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Fecha de inicio *</label>
          <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          {selectedPlan && (
            <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant mt-1">
              Vence: {new Date(new Date(form.startDate).getTime() + selectedPlan.duration_days * 86400000).toLocaleDateString("es-CL")}
            </p>
          )}
        </div>

        {/* Método de pago y monto */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Método de pago *</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Monto ($) *</label>
            <input inputMode="numeric" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50" />
          </div>
        </div>

        {/* Comprobante */}
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Comprobante (opcional)</label>
          <label className="flex items-center gap-2 p-3 bg-surface-container border border-on-surface/10 rounded-lg cursor-pointer hover:border-on-surface/20 transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">upload_file</span>
            <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
              {receiptFile ? receiptFile.name : "Subir imagen o PDF del comprobante..."}
            </span>
            <input type="file" accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.bmp,.gif,.jfif" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} className="hidden" />
          </label>
        </div>

        {/* Notas */}
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Notas internas</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Ej: Pago via transferencia Banco Estado..." className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 resize-none" />
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={!form.beneficiaryId || !form.planId || saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Asignando..." : "Asignar Membresía"}</button>
        </div>
      </div>
    </FormModal>
  );
}
