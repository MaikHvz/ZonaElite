"use client";

import { useSession } from "@/providers/SessionProvider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  getMedicalRecord,
  upsertMedicalRecord,
  type MedicalRecord,
} from "@/lib/supabase/dashboard";
import MedicalInfoCard from "@/components/dashboard/MedicalInfoCard";
import EmergencyContactCard from "@/components/dashboard/EmergencyContactCard";
import { createClient } from "@/lib/supabase/client";

function calcAge(birthDate: string) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function MedicoPage() {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const dependentId = params.id as string;

  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [dependent, setDependent] = useState<{
    full_name: string;
    birth_date: string;
    category: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !user) router.push("/auth");
  }, [user, sessionLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const supabase = createClient();

    const { data: dep } = await supabase
      .from("dependents")
      .select("full_name, birth_date, category, beneficiaries(id)")
      .eq("id", dependentId)
      .eq("tutor_id", user.id)
      .single();

    if (!dep) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setDependent({
      full_name: dep.full_name,
      birth_date: dep.birth_date,
      category: dep.category,
    });

    const bRaw = dep.beneficiaries as unknown as { id: string }[] | { id: string } | null;
    const beneficiaryId = Array.isArray(bRaw)
      ? bRaw[0]?.id
      : bRaw?.id;

    if (!beneficiaryId) {
      setLoading(false);
      return;
    }

    const { data } = await getMedicalRecord(beneficiaryId);
    setRecord(data);
    setLoading(false);
  }, [user, dependentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveMedical = async (data: {
    enfermedades: string;
    lesiones: string;
    medicamentos: string;
    alergias: string;
  }) => {
    if (!user) return { error: "No autenticado" };

    const supabase = createClient();
    const { data: dep } = await supabase
      .from("dependents")
      .select("beneficiaries(id)")
      .eq("id", dependentId)
      .eq("tutor_id", user.id)
      .single();

    const bRaw = dep?.beneficiaries as unknown as { id: string }[] | { id: string } | null;
    const beneficiaryId = Array.isArray(bRaw) ? bRaw[0]?.id : bRaw?.id;
    if (!beneficiaryId) return { error: "Beneficiario no encontrado" };

    const result = await upsertMedicalRecord(beneficiaryId, data);
    if (result.error) return { error: result.error };
    setRecord(result.data);
    return { error: null };
  };

  const handleSaveEmergency = async (data: {
    contacto_emergencia_nombre: string;
    contacto_emergencia_telefono: string;
  }) => {
    if (!user) return { error: "No autenticado" };

    const supabase = createClient();
    const { data: dep } = await supabase
      .from("dependents")
      .select("beneficiaries(id)")
      .eq("id", dependentId)
      .eq("tutor_id", user.id)
      .single();

    const bRaw = dep?.beneficiaries as unknown as { id: string }[] | { id: string } | null;
    const beneficiaryId = Array.isArray(bRaw) ? bRaw[0]?.id : bRaw?.id;
    if (!beneficiaryId) return { error: "Beneficiario no encontrado" };

    const result = await upsertMedicalRecord(beneficiaryId, data);
    if (result.error) return { error: result.error };
    setRecord(result.data);
    return { error: null };
  };

  if (sessionLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-surface-container rounded-lg animate-pulse" />
        <div className="h-40 bg-surface-container rounded-2xl animate-pulse" />
        <div className="h-32 bg-surface-container rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-on-surface/20 text-[64px] mb-4 block">
          search_off
        </span>
        <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant mb-4">
          Carga no encontrada o no tienes acceso
        </p>
        <button
          onClick={() => router.push("/dashboard/cargas")}
          className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-6 py-2 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
        >
          Volver a cargas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.push("/dashboard/cargas")}
          className="flex items-center gap-1 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors mb-3 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Mis cargas
        </button>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full btn-primary-gradient flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-[20px]">
              person
            </span>
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] md:text-[36px] text-on-surface uppercase tracking-tighter">
              Ficha <span className="text-primary">Médica</span>
            </h1>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
              {dependent?.full_name}
              {dependent?.birth_date && (
                <span className="ml-2 text-on-surface-variant/60">
                  · {calcAge(dependent.birth_date)} años
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <MedicalInfoCard
        record={record}
        beneficiaryId={dependentId}
        onSave={handleSaveMedical}
      />

      <EmergencyContactCard
        record={record}
        beneficiaryId={dependentId}
        onSave={handleSaveEmergency}
      />
    </div>
  );
}
