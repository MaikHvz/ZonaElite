"use client";

import { useSession } from "@/providers/SessionProvider";
import { useCallback, useEffect, useState } from "react";
import {
  getMedicalRecord,
  upsertMedicalRecord,
  getProfileForEdit,
  updateProfile,
  type MedicalRecord,
} from "@/lib/supabase/dashboard";
import MedicalInfoCard from "@/components/dashboard/MedicalInfoCard";
import EmergencyContactCard from "@/components/dashboard/EmergencyContactCard";
import PhysicalInfoCard from "@/components/dashboard/PhysicalInfoCard";
import TutorSportCard from "@/components/dashboard/TutorSportCard";
import GuideHelpButton from "@/components/guide/GuideHelpButton";
import { createClient } from "@/lib/supabase/client";
import { categoryFromBirth, categoryLabel } from "@/lib/category";

// "Mi ficha" (reemplaza "Mis Cargas"): una cuenta por alumno, así que la
// ficha médica, los datos físicos y el perfil deportivo son del propio
// alumno. Los datos médicos cuelgan del beneficiario de la cuenta.
export default function FichaPage() {
  const { user } = useSession();
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(null);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [profile, setProfile] = useState<{
    full_name: string;
    birth_date: string | null;
    weight: number | null;
    height: number | null;
    dominant_hand: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    const [{ data: ben }, { data: prof }] = await Promise.all([
      supabase.from("beneficiaries").select("id").eq("profile_id", user.id).maybeSingle(),
      getProfileForEdit(user.id),
    ]);

    if (prof) {
      setProfile({
        full_name: prof.full_name,
        birth_date: prof.birth_date,
        weight: prof.weight,
        height: prof.height,
        dominant_hand: prof.dominant_hand,
      });
    }

    if (ben) {
      setBeneficiaryId(ben.id);
      const { data } = await getMedicalRecord(ben.id);
      setRecord(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveMedical = async (data: Record<string, string>) => {
    if (!beneficiaryId) return { error: "No se encontró tu ficha" };
    const result = await upsertMedicalRecord(beneficiaryId, data);
    if (result.error) return { error: result.error };
    setRecord(result.data);
    return { error: null };
  };

  const savePhysical = async (data: { weight: number | null; height: number | null; dominant_hand: string | null }) => {
    if (!user) return { error: "No autenticado" };
    const { error } = await updateProfile(user.id, data);
    if (error) return { error };
    setProfile((prev) => (prev ? { ...prev, ...data } : prev));
    return { error: null };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-surface-container rounded-lg animate-pulse" />
        <div className="h-40 bg-surface-container rounded-2xl animate-pulse" />
        <div className="h-32 bg-surface-container rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div data-guide="ficha-header">
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
            Mi <span className="text-primary">Ficha</span>
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mt-1">
            {profile?.full_name}
            {profile?.birth_date && (
              <span className="ml-2 text-on-surface-variant/60">· {categoryLabel(categoryFromBirth(profile.birth_date))}</span>
            )}
          </p>
        </div>
        <GuideHelpButton tourId="ficha" pill />
      </div>

      <div data-guide="ficha-sport">
        <TutorSportCard />
      </div>

      {beneficiaryId && (
        <>
          <div data-guide="ficha-medica">
            <MedicalInfoCard record={record} beneficiaryId={beneficiaryId} onSave={saveMedical} />
          </div>

          <PhysicalInfoCard
            weight={profile?.weight ?? null}
            height={profile?.height ?? null}
            dominantHand={profile?.dominant_hand ?? null}
            onSave={savePhysical}
          />

          <div data-guide="ficha-emergencia">
            <EmergencyContactCard record={record} beneficiaryId={beneficiaryId} onSave={saveMedical} />
          </div>
        </>
      )}
    </div>
  );
}
