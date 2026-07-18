import { createClient } from "./client";

type SupabaseResult<T> = { data: T | null; error: string | null };

async function safeQuery<T>(
  queryFn: () => Promise<T>
): Promise<SupabaseResult<T>> {
  try {
    const data = await queryFn();
    return { data, error: null };
  } catch (e) {
    console.error("Supabase query error:", e);
    return { data: null, error: "Error al cargar datos. Intenta de nuevo." };
  }
}

export interface MembershipData {
  id: string;
  beneficiary_id: string;
  plan_id: string;
  purchased_by: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  plan: {
    id: string;
    name: string;
    price: number;
    duration_days: number;
    category: string;
    benefits: string[];
  };
  beneficiary: {
    id: string;
    profile_id: string | null;
    dependent_id: string | null;
    dependent: {
      full_name: string;
      category: string;
    } | null;
  } | null;
}

export interface DependentData {
  id: string;
  tutor_id: string;
  full_name: string;
  rut: string | null;
  birth_date: string;
  category: string;
  beneficiaries: {
    id: string;
    memberships: {
      status: string;
      end_date: string;
      plan: { name: string; price: number } | null;
    }[];
  }[];
}

export interface PaymentData {
  id: string;
  user_id: string;
  membership_id: string | null;
  order_id: string | null;
  concept: string;
  amount: number;
  method: string;
  status: string;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
  membership: {
    plan: { name: string } | null;
  } | null;
}

export interface NotificationData {
  id: string;
  type: string;
  subject: string;
  content: string;
  target: string;
  sent_by: string;
  sent_at: string | null;
  created_at: string;
}

export interface DashboardSummary {
  activeMemberships: MembershipData[];
  allMemberships: MembershipData[];
  recentPayments: PaymentData[];
  dependentsCount: number;
  paidThisMonth: number;
}

export async function getUserMemberships(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    const [ownBeneficiary, dependentsWithBeneficiary] = await Promise.all([
      supabase
        .from("beneficiaries")
        .select("id")
        .eq("profile_id", userId)
        .maybeSingle(),
      supabase
        .from("dependents")
        .select("id, full_name, birth_date, category, beneficiaries(id)")
        .eq("tutor_id", userId),
    ]);

    const beneficiaryIds = [
      ownBeneficiary.data?.id,
      ...(dependentsWithBeneficiary.data || []).map((d) => {
        const b = d.beneficiaries as unknown as { id: string }[] | { id: string } | null;
        if (!b) return undefined;
        return Array.isArray(b) ? b[0]?.id : b.id;
      }),
    ].filter(Boolean) as string[];

    if (beneficiaryIds.length === 0) {
      return {
        memberships: [] as MembershipData[],
        dependents: (dependentsWithBeneficiary.data || []) as DependentData[],
      };
    }

    const { data: memberships } = await supabase
      .from("memberships")
      .select(
        `
        *,
        plan:membership_plans(id, name, price, duration_days, category, benefits),
        beneficiary:beneficiaries(
          id,
          profile_id,
          dependent_id,
          dependent:dependents(full_name, category)
        )
      `
      )
      .in("beneficiary_id", beneficiaryIds)
      .order("created_at", { ascending: false });

    return {
      memberships: (memberships || []) as MembershipData[],
      dependents: (dependentsWithBeneficiary.data || []) as DependentData[],
    };
  });
}

export async function getUserPayments(
  userId: string,
  page = 0,
  pageSize = 20
) {
  return safeQuery(async () => {
    const supabase = createClient();
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await supabase
      .from("payments")
      .select(
        `
        *,
        membership:memberships(
          plan:membership_plans(name)
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    return {
      payments: (data || []) as PaymentData[],
      total: count || 0,
    };
  });
}

export async function getUserDependents(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("dependents")
      .select(
        `
        *,
        beneficiaries(
          id,
          memberships(
            status,
            end_date,
            plan:membership_plans(name, price)
          )
        )
      `
      )
      .eq("tutor_id", userId)
      .order("full_name");

    return (data || []) as DependentData[];
  });
}

export async function getUserNotifications(page = 0, pageSize = 20) {
  return safeQuery(async () => {
    const supabase = createClient();
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    return {
      notifications: (data || []) as NotificationData[],
      total: count || 0,
    };
  });
}

export async function getDashboardSummary(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString();

    const [membershipsRes, paymentsRes, dependentsRes, thisMonthRes] =
      await Promise.all([
        getUserMemberships(userId),
        supabase
          .from("payments")
          .select(
            "*, membership:memberships(plan:membership_plans(name))"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("dependents")
          .select("id", { count: "exact", head: true })
          .eq("tutor_id", userId),
        supabase
          .from("payments")
          .select("amount")
          .eq("user_id", userId)
          .eq("status", "pagado")
          .gte("created_at", firstOfMonth),
      ]);

    const allMemberships = membershipsRes.data?.memberships || [];
    const activeMemberships = allMemberships.filter(
      (m) => m.status === "activa"
    );

    const paidThisMonth = (thisMonthRes.data || []).reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    return {
      activeMemberships,
      allMemberships,
      recentPayments: (paymentsRes.data || []) as PaymentData[],
      dependentsCount: dependentsRes.count || 0,
      paidThisMonth,
    } as DashboardSummary;
  });
}

export async function getProfileForEdit(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, birth_date")
      .eq("id", userId)
      .single();
    return data as { full_name: string; phone: string | null; birth_date: string | null } | null;
  });
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; phone?: string; birth_date?: string }
) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  });
}

// ─── Medical Records ──────────────────────────────────────────────────────────

export interface MedicalRecord {
  id: string;
  beneficiary_id: string;
  enfermedades: string | null;
  lesiones: string | null;
  medicamentos: string | null;
  alergias: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
  updated_at: string;
}

export async function getMedicalRecord(beneficiaryId: string) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("medical_records")
      .select("*")
      .eq("beneficiary_id", beneficiaryId)
      .maybeSingle();
    return data as MedicalRecord | null;
  });
}

export async function upsertMedicalRecord(
  beneficiaryId: string,
  record: {
    enfermedades?: string;
    lesiones?: string;
    medicamentos?: string;
    alergias?: string;
    contacto_emergencia_nombre?: string;
    contacto_emergencia_telefono?: string;
  }
) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("medical_records")
      .upsert(
        { beneficiary_id: beneficiaryId, ...record },
        { onConflict: "beneficiary_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return data as MedicalRecord;
  });
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export interface ClassSessionData {
  id: string;
  schedule_id: string;
  session_date: string;
  created_at: string;
  schedule: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    discipline: { name: string } | null;
    professor: { full_name: string } | null;
  };
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  beneficiary_id: string;
  status: "presente" | "ausente" | "justificado";
  marked_by: string | null;
  marked_at: string;
}

export interface AttendanceBeneficiary {
  id: string;
  full_name: string;
  category: string;
  attendance: AttendanceRecord | null;
}

export async function getUpcomingSessions() {
  return safeQuery(async () => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("class_sessions")
      .select(
        `
        *,
        schedule:schedules(
          id, day_of_week, start_time, end_time,
          discipline:disciplines(name),
          professor:profiles(full_name)
        )
      `
      )
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .limit(30);

    return (data || []) as ClassSessionData[];
  });
}

export async function getAttendanceForSession(sessionId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("*")
      .eq("session_id", sessionId);

    const attendance = (attendanceData || []) as AttendanceRecord[];
    const attendanceByBeneficiary = new Map(
      attendance.map((a) => [a.beneficiary_id, a])
    );

    const { data: session } = await supabase
      .from("class_sessions")
      .select("schedule_id")
      .eq("id", sessionId)
      .single();

    if (!session) return { beneficiaries: [] as AttendanceBeneficiary[] };

    const { data: membersWithMembership } = await supabase
      .from("memberships")
      .select(
        `
        beneficiary_id,
        beneficiary:beneficiaries(
          id,
          dependent:dependents(full_name, category),
          profile:profiles(full_name)
        )
      `
      )
      .eq("status", "activa")
      .lte("start_date", new Date().toISOString().split("T")[0])
      .gte("end_date", new Date().toISOString().split("T")[0]);

    const beneficiaryMap = new Map<string, AttendanceBeneficiary>();
    for (const m of membersWithMembership || []) {
      if (beneficiaryMap.has(m.beneficiary_id)) continue;
      const b = m.beneficiary as unknown as {
        id: string;
        dependent: { full_name: string; category: string } | null;
        profile: { full_name: string } | null;
      } | null;
      if (!b) continue;
      const name = b.dependent?.full_name || b.profile?.full_name || "Sin nombre";
      const category = b.dependent?.category || "adulto";
      beneficiaryMap.set(m.beneficiary_id, {
        id: m.beneficiary_id,
        full_name: name,
        category,
        attendance: attendanceByBeneficiary.get(m.beneficiary_id) || null,
      });
    }

    return {
      beneficiaries: Array.from(beneficiaryMap.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      ),
    };
  });
}

export async function markAttendance(
  sessionId: string,
  beneficiaryId: string,
  status: "presente" | "ausente" | "justificado",
  markedBy: string
) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("attendance")
      .upsert(
        {
          session_id: sessionId,
          beneficiary_id: beneficiaryId,
          status,
          marked_by: markedBy,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "session_id,beneficiary_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceRecord;
  });
}

export async function getAttendanceHistory(
  beneficiaryId: string,
  limit = 50
) {
  return safeQuery(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("attendance")
      .select(
        `
        *,
        session:class_sessions(
          session_date,
          schedule:schedules(
            discipline:disciplines(name)
          )
        )
      `
      )
      .eq("beneficiary_id", beneficiaryId)
      .order("marked_at", { ascending: false })
      .limit(limit);

    return (data || []) as (AttendanceRecord & {
      session: {
        session_date: string;
        schedule: { discipline: { name: string } | null };
      };
    })[];
  });
}

export async function getUserAttendance(userId: string, limit = 50) {
  return safeQuery(async () => {
    const supabase = createClient();

    const [ownBeneficiary, dependentsWithBeneficiary] = await Promise.all([
      supabase
        .from("beneficiaries")
        .select("id, profile:profiles(full_name)")
        .eq("profile_id", userId)
        .maybeSingle(),
      supabase
        .from("dependents")
        .select("full_name, beneficiaries(id)")
        .eq("tutor_id", userId),
    ]);

    const beneficiaryIds: { id: string; name: string }[] = [];

    if (ownBeneficiary.data) {
      const p = ownBeneficiary.data.profile as unknown as { full_name: string } | null;
      beneficiaryIds.push({
        id: ownBeneficiary.data.id,
        name: p?.full_name || "Yo",
      });
    }

    for (const d of dependentsWithBeneficiary.data || []) {
      const bRaw = d.beneficiaries as unknown as { id: string }[] | { id: string } | null;
      const bId = Array.isArray(bRaw) ? bRaw[0]?.id : bRaw?.id;
      if (bId) {
        beneficiaryIds.push({ id: bId, name: d.full_name });
      }
    }

    if (beneficiaryIds.length === 0) {
      return { records: [] as any[] };
    }

    const bIds = beneficiaryIds.map((b) => b.id);
    const nameMap = new Map(beneficiaryIds.map((b) => [b.id, b.name]));

    const { data } = await supabase
      .from("attendance")
      .select(
        `
        *,
        session:class_sessions(
          session_date,
          schedule:schedules(
            discipline:disciplines(name)
          )
        )
      `
      )
      .in("beneficiary_id", bIds)
      .order("marked_at", { ascending: false })
      .limit(limit);

    const records = (data || []).map((r) => ({
      ...r,
      beneficiary_name: nameMap.get(r.beneficiary_id) || "Desconocido",
    }));

    return { records };
  });
}
