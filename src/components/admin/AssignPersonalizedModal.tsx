"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getChileToday, addDaysChile } from "@/lib/dates";
import FormModal from "@/components/admin/FormModal";

interface PersonalizedPlan {
  id: string;
  name: string;
  price: number;
  total_classes: number;
  validity_days: number;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Dependent {
  id: string;
  full_name: string;
  tutor_id: string;
  category: string;
}

interface Beneficiary {
  id: string;
  profile_id: string | null;
  dependent_id: string | null;
}

interface GroupedResult {
  profile: Profile;
  dependents: Dependent[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
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

export default function AssignPersonalizedModal({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<PersonalizedPlan[]>([]);
  const [results, setResults] = useState<GroupedResult[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [searching, setSearching] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingPack, setExistingPack] = useState<{ id: string; planName: string; remainingClasses: number; endDate: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("personalized_plans")
      .select("id, name, price, total_classes, validity_days")
      .eq("active", true)
      .order("price")
      .then(({ data }) => {
        setPlans((data as PersonalizedPlan[]) || []);
      });
    setForm(emptyForm);
    setSelectedProfile(null);
    setResults([]);
    setDependents([]);
    setBeneficiaries([]);
    setReceiptFile(null);
    setExistingPack(null);
  }, [open]);

  const searchUsers = useCallback(async () => {
    const q = form.search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const supabase = createClient();

    // 1. Buscar titulares por nombre o email
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    const foundProfiles = (profiles as Profile[]) || [];

    // 2. Buscar cargas (dependents) por nombre
    const { data: matchedDeps } = await supabase
      .from("dependents")
      .select("id, full_name, tutor_id, category")
      .ilike("full_name", `%${q}%`)
      .limit(10);
    const foundDeps = (matchedDeps as Dependent[]) || [];

    // Obtener tutores de las cargas encontradas que no estén ya en foundProfiles
    const existingProfileIds = new Set(foundProfiles.map((p) => p.id));
    const missingTutorIds = Array.from(
      new Set(foundDeps.map((d) => d.tutor_id).filter((tId) => tId && !existingProfileIds.has(tId)))
    );

    let tutorProfiles: Profile[] = [];
    if (missingTutorIds.length > 0) {
      const { data: tutors } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", missingTutorIds);
      tutorProfiles = (tutors as Profile[]) || [];
    }

    const allProfiles = [...foundProfiles, ...tutorProfiles];

    if (allProfiles.length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }

    // Traer todas las cargas asociadas a todos los perfiles encontrados
    const allProfileIds = allProfiles.map((p) => p.id);
    const { data: deps } = await supabase
      .from("dependents")
      .select("id, full_name, tutor_id, category")
      .in("tutor_id", allProfileIds);
    const allDeps = (deps as Dependent[]) || [];

    const grouped: GroupedResult[] = allProfiles.map((p) => ({
      profile: p,
      dependents: allDeps.filter((d) => d.tutor_id === p.id),
    }));

    setResults(grouped);
    setSearching(false);
  }, [form.search]);

  useEffect(() => {
    const t = setTimeout(searchUsers, 300);
    return () => clearTimeout(t);
  }, [searchUsers]);

  const selectProfileAndBeneficiary = async (p: Profile, targetDependentId: string | null = null) => {
    setSelectedProfile(p);
    const supabase = createClient();
    const depRes = await supabase.from("dependents").select("id, full_name, tutor_id, category").eq("tutor_id", p.id);
    const deps = (depRes.data as Dependent[]) || [];
    setDependents(deps);

    const benByProfile = await supabase.from("beneficiaries").select("id, profile_id, dependent_id").eq("profile_id", p.id);
    const benList = [...((benByProfile.data as Beneficiary[]) || [])];

    if (deps.length > 0) {
      const depIds = deps.map((d) => d.id);
      const benByDependent = await supabase.from("beneficiaries").select("id, profile_id, dependent_id").in("dependent_id", depIds);
      const depBenList = (benByDependent.data as Beneficiary[]) || [];
      for (const b of depBenList) {
        if (!benList.find((existing) => existing.id === b.id)) {
          benList.push(b);
        }
      }
    }

    setBeneficiaries(benList);

    let chosenBeneficiaryId = "";
    if (targetDependentId) {
      const b = benList.find((ben) => ben.dependent_id === targetDependentId);
      chosenBeneficiaryId = b?.id || "";
      const matchedDep = deps.find((d) => d.id === targetDependentId);
      setForm((prev) => ({
        ...prev,
        search: matchedDep ? `${matchedDep.full_name} (Carga de ${p.full_name})` : p.full_name,
        beneficiaryId: chosenBeneficiaryId,
        planId: "",
        amount: 0,
      }));
    } else {
      const b = benList.find((ben) => ben.profile_id === p.id);
      chosenBeneficiaryId = b?.id || "";
      setForm((prev) => ({
        ...prev,
        search: p.full_name,
        beneficiaryId: chosenBeneficiaryId,
        planId: "",
        amount: 0,
      }));
    }

    if (chosenBeneficiaryId) {
      checkExistingPack(chosenBeneficiaryId);
    } else {
      setExistingPack(null);
    }
  };

  const getBeneficiaryId = (profileId: string, dependentId: string | null): string => {
    const b = beneficiaries.find((b) => dependentId ? b.dependent_id === dependentId : b.profile_id === profileId);
    return b?.id || "";
  };

  const checkExistingPack = async (beneficiaryId: string) => {
    if (!beneficiaryId) {
      setExistingPack(null);
      return;
    }

    const supabase = createClient();
    const today = getChileToday();

    const { data: pack } = await supabase
      .from("personalized_packs")
      .select("id, total_classes, used_classes, end_date, personalized_plans(name)")
      .eq("beneficiary_id", beneficiaryId)
      .eq("status", "activa")
      .gte("end_date", today)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pack) {
      setExistingPack({
        id: pack.id,
        planName: (pack.personalized_plans as unknown as { name: string })?.name || "—",
        remainingClasses: Math.max(0, pack.total_classes - pack.used_classes),
        endDate: pack.end_date,
      });
    } else {
      setExistingPack(null);
    }
  };

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
    if (!plan) {
      setSaving(false);
      return;
    }

    const endDate = addDaysChile(form.startDate, plan.validity_days);

    let receiptUrl: string | null = null;
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop();
      const path = `receipts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("public").upload(path, receiptFile, { upsert: true });
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("public").getPublicUrl(path);
        receiptUrl = publicUrl;
      }
    }

    // 1. Crear el pago asociado
    const { data: payment } = await supabase
      .from("payments")
      .insert({
        user_id: selectedProfile.id,
        beneficiary_id: form.beneficiaryId,
        amount: form.amount,
        method: form.method,
        status: "pagado",
        concept: `Clase Personalizada ${plan.name}`,
        notes: form.notes || null,
        receipt_url: receiptUrl,
      })
      .select("id")
      .single();

    // 2. Crear el pack de clases personalizadas
    const { error: packError } = await supabase.from("personalized_packs").insert({
      beneficiary_id: form.beneficiaryId,
      plan_id: form.planId,
      purchased_by: user?.id || selectedProfile.id,
      payment_id: payment?.id || null,
      start_date: form.startDate,
      end_date: endDate,
      total_classes: plan.total_classes,
      used_classes: 0,
      status: "activa",
    });

    if (packError) {
      console.error("AssignPersonalizedModal: error al crear pack:", packError);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <FormModal open={open} title="Asignar Plan Personalizado" onClose={onClose}>
      <div className="space-y-4">
        {/* Búsqueda de usuario */}
        <div className="relative">
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
            Buscar usuario o carga *
          </label>
          <div className="relative">
            <input
              value={form.search}
              onChange={(e) => {
                setForm({ ...form, search: e.target.value });
                if (!e.target.value.trim()) {
                  setSelectedProfile(null);
                  setDependents([]);
                  setBeneficiaries([]);
                  setForm((f) => ({ ...f, beneficiaryId: "" }));
                  setExistingPack(null);
                }
              }}
              placeholder="Escribe nombre, apellido o email..."
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 pr-10"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {/* Lista de sugerencias */}
          {results.length > 0 && !selectedProfile && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface-container-high border border-on-surface/10 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
              {results.map(({ profile: p, dependents: pDeps }) => {
                const searchLower = form.search.trim().toLowerCase();
                const matchedDep = pDeps.find((d) => d.full_name.toLowerCase().includes(searchLower));

                return (
                  <div key={p.id} className="border-b border-on-surface/5 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => selectProfileAndBeneficiary(p, null)}
                      className="w-full text-left px-4 py-2.5 hover:bg-on-surface/5 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{p.full_name}</p>
                        <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">{p.email}</p>
                      </div>
                      <span className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">Titular</span>
                    </button>

                    {matchedDep && (
                      <button
                        type="button"
                        onClick={() => selectProfileAndBeneficiary(p, matchedDep.id)}
                        className="w-full text-left px-4 py-2 pl-8 hover:bg-on-surface/5 transition-colors cursor-pointer flex items-center justify-between bg-surface-container"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[14px]">family_restroom</span>
                          <div>
                            <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface">{matchedDep.full_name}</p>
                            <p className="font-[family-name:var(--font-body-sm)] text-[10px] text-on-surface-variant">Carga de {p.full_name}</p>
                          </div>
                        </div>
                        <span className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-on-surface/10 text-on-surface-variant">Carga</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selección de beneficiario */}
        {selectedProfile && (
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
              Beneficiario del plan *
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-on-surface/10 bg-surface-container cursor-pointer hover:border-primary/40 transition-colors">
                <input
                  type="radio"
                  name="beneficiary"
                  checked={form.beneficiaryId === getBeneficiaryId(selectedProfile.id, null)}
                  onChange={() => {
                    const bId = getBeneficiaryId(selectedProfile.id, null);
                    setForm({ ...form, beneficiaryId: bId });
                    checkExistingPack(bId);
                  }}
                  className="accent-primary"
                />
                <div className="flex-1">
                  <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{selectedProfile.full_name}</p>
                  <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">Titular de la cuenta</p>
                </div>
              </label>

              {dependents.map((d) => (
                <label key={d.id} className="flex items-center gap-3 p-3 rounded-lg border border-on-surface/10 bg-surface-container cursor-pointer hover:border-primary/40 transition-colors">
                  <input
                    type="radio"
                    name="beneficiary"
                    checked={form.beneficiaryId === getBeneficiaryId(selectedProfile.id, d.id)}
                    onChange={() => {
                      const bId = getBeneficiaryId(selectedProfile.id, d.id);
                      setForm({ ...form, beneficiaryId: bId });
                      checkExistingPack(bId);
                    }}
                    className="accent-primary"
                  />
                  <div className="flex-1">
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{d.full_name}</p>
                    <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">Carga ({d.category})</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Alerta de pack activo existente */}
        {existingPack && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">info</span>
            <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface">
              Tiene un pack activo: <strong>{existingPack.planName}</strong> ({existingPack.remainingClasses} clases restantes, vence {new Date(existingPack.endDate).toLocaleDateString("es-CL")}). Se sumará este nuevo pack.
            </p>
          </div>
        )}

        {/* Selección de plan personalizado */}
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
            Plan Personalizado *
          </label>
          <select
            value={form.planId}
            onChange={(e) => handlePlanChange(e.target.value)}
            className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
          >
            <option value="">Selecciona un plan personalizado...</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.total_classes} {p.total_classes === 1 ? "clase" : "clases"} ({p.validity_days} días) — ${p.price.toLocaleString("es-CL")}
              </option>
            ))}
          </select>
        </div>

        {/* Detalles del plan seleccionado */}
        {selectedPlan && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-surface-container rounded-lg border border-on-surface/5 text-center">
            <div>
              <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">Clases</p>
              <p className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface">{selectedPlan.total_classes}</p>
            </div>
            <div>
              <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">Vigencia</p>
              <p className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface">{selectedPlan.validity_days} días</p>
            </div>
            <div>
              <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">Precio</p>
              <p className="font-[family-name:var(--font-headline-md)] text-[16px] text-primary">${selectedPlan.price.toLocaleString("es-CL")}</p>
            </div>
          </div>
        )}

        {/* Fecha de inicio */}
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
            Fecha de inicio *
          </label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Método de pago y Monto */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
              Método de pago *
            </label>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta (POS)</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
              Monto pagado ($) *
            </label>
            <input
              type="number"
              value={form.amount || ""}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {/* Comprobante de pago */}
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
            Comprobante de pago (opcional)
          </label>
          <input
            type="file"
            accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.bmp,.gif,.jfif"
            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2 text-[13px] text-on-surface-variant file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[12px] file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
          />
        </div>

        {/* Notas */}
        <div>
          <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">
            Notas internas (opcional)
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Observaciones sobre la asignación..."
            rows={2}
            className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 resize-none"
          />
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.beneficiaryId || !form.planId || saving}
            className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Asignando..." : "Asignar Plan Personalizado"}
          </button>
        </div>
      </div>
    </FormModal>
  );
}
