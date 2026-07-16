import { createClient } from "./client";

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

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as UserProfile | null;
}
