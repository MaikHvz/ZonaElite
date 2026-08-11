"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/providers/SessionProvider";
import { getUserSportProfile } from "@/lib/supabase/dashboard";
import {
  sportProfilesFrom,
  sportPodiumsFrom,
  type UserSportProfileData,
} from "@/lib/supabase/dashboard";
import BeltBanner from "./BeltBanner";
import SportProfileInfo from "./SportProfileInfo";

/**
 * Card del titular en "Mis Cargas": muestra el perfil deportivo del
 * propio usuario (tutor) con disciplina, cinturón y podios, usando el
 * mismo lenguaje visual de las cards de cargas.
 */
export default function TutorSportCard() {
  const { user, profile } = useSession();
  const [sportData, setSportData] = useState<UserSportProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getUserSportProfile(user.id).then(({ data }) => {
      if (!cancelled) {
        setSportData(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sportProfiles = sportProfilesFrom(sportData);
  const sportPodiums = sportPodiumsFrom(sportData);
  const beltColor = sportProfiles[0]?.belt_grades?.color;

  const name = profile?.full_name || user?.email?.split("@")[0] || "Mi perfil";

  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5 hover:border-primary/30 transition-colors relative overflow-hidden">
      {beltColor && <BeltBanner color={beltColor} />}
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full btn-primary-gradient flex items-center justify-center shrink-0">
            {profile?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photo_url}
                alt={name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-white text-[20px]">
                person
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase truncate">
              {name}
            </h3>
            <span className="inline-block font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border bg-surface-container-high text-primary border-primary/20">
              Titular
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="h-10 animate-pulse bg-on-surface/5 rounded-xl" />
          ) : (
            <SportProfileInfo profiles={sportProfiles} podiums={sportPodiums} />
          )}
        </div>
      </div>
    </div>
  );
}
