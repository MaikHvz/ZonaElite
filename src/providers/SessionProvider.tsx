"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  role_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  photo_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isStaff: false,
  refreshProfile: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;
  const isAdmin = profile?.role_id === 1;
  const isStaff = profile !== null && profile.role_id >= 1 && profile.role_id <= 3;

  const fetchProfile = async (u?: User | null) => {
    const target = u ?? session?.user;
    if (!target) { setProfile(null); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", target.id)
      .single();
    setProfile((data as UserProfile) || null);
  };

  const refreshProfile = async () => { await fetchProfile(); };

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await fetchProfile(session.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) await fetchProfile(session.user);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ session, user, profile, loading, isAdmin, isStaff, refreshProfile }}>
      {children}
    </SessionContext.Provider>
  );
}
