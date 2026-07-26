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
    academy_enrollments: {
      status: string;
      end_date: string;
      enrollment_plans: { name: string } | null;
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
          ),
          academy_enrollments(
            status,
            end_date,
            enrollment_plans(name)
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

    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("beneficiary_id")
      .or(`session_id.eq.${sessionId},schedule_id.eq.${session.schedule_id}`);

    const enrolledIds = [...new Set((enrollments || []).map((e) => e.beneficiary_id))];

    if (enrolledIds.length === 0) return { beneficiaries: [] as AttendanceBeneficiary[] };

    const { data: members } = await supabase
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
      .gte("end_date", new Date().toISOString().split("T")[0])
      .in("beneficiary_id", enrolledIds);

    const beneficiaryMap = new Map<string, AttendanceBeneficiary>();
    for (const m of members || []) {
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

    for (const id of enrolledIds) {
      if (!beneficiaryMap.has(id)) {
        const { data: ben } = await supabase
          .from("beneficiaries")
          .select("id, dependent:dependents(full_name, category), profile:profiles(full_name)")
          .eq("id", id)
          .single();
        if (ben) {
          const b = ben as unknown as {
            id: string;
            dependent: { full_name: string; category: string } | null;
            profile: { full_name: string } | null;
          };
          const name = b.dependent?.full_name || b.profile?.full_name || "Sin nombre";
          const category = b.dependent?.category || "adulto";
          beneficiaryMap.set(id, {
            id,
            full_name: name,
            category,
            attendance: attendanceByBeneficiary.get(id) || null,
          });
        }
      }
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

// ─── Attendance Analytics (Admin) ─────────────────────────────────────────────

export interface AttendanceByDiscipline {
  discipline: string;
  present: number;
  absent: number;
  justified: number;
  total: number;
  rate: number;
}

export interface AttendanceStatusBreakdown {
  status: string;
  count: number;
}

export interface AttendanceTrend {
  date: string;
  present: number;
  absent: number;
  justified: number;
  total: number;
  rate: number;
}

export async function getAdminAttendanceAnalytics() {
  return safeQuery(async () => {
    const supabase = createClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sixWeeksAgo = new Date(now.getTime() - 42 * 86400000);

    const [attendanceRes, sessionsRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("status, session_id, session:class_sessions(session_date, schedule:schedules(discipline:disciplines(name)))")
        .gte("marked_at", sixWeeksAgo.toISOString()),
      supabase
        .from("class_sessions")
        .select("id, session_date")
        .gte("session_date", sixWeeksAgo.toISOString().split("T")[0]),
    ]);

    const rows = (attendanceRes.data || []) as unknown as Array<{
      status: string;
      session_id: string;
      session: {
        session_date: string;
        schedule: { discipline: { name: string } | null } | null;
      } | null;
    }>;

    const allSessions = (sessionsRes.data || []) as Array<{ id: string; session_date: string }>;

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    rows.forEach((r) => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    const statusBreakdown: AttendanceStatusBreakdown[] = [
      { status: "presente", count: statusCounts["presente"] || 0 },
      { status: "ausente", count: statusCounts["ausente"] || 0 },
      { status: "justificado", count: statusCounts["justificado"] || 0 },
    ];

    // By discipline
    const disciplineMap: Record<string, { present: number; absent: number; justified: number; total: number }> = {};
    rows.forEach((r) => {
      const discName = r.session?.schedule?.discipline?.name || "Sin disciplina";
      if (!disciplineMap[discName]) disciplineMap[discName] = { present: 0, absent: 0, justified: 0, total: 0 };
      disciplineMap[discName].total += 1;
      if (r.status === "presente") disciplineMap[discName].present += 1;
      else if (r.status === "ausente") disciplineMap[discName].absent += 1;
      else disciplineMap[discName].justified += 1;
    });
    const byDiscipline: AttendanceByDiscipline[] = Object.entries(disciplineMap)
      .map(([discipline, data]) => ({
        discipline,
        ...data,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Trend (last 6 weeks, grouped by week)
    const weekMap: Record<string, { present: number; absent: number; justified: number; total: number; date: string }> = {};
    for (let i = 5; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 86400000);
      const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
      weekMap[`w${i}`] = { present: 0, absent: 0, justified: 0, total: 0, date: label };
    }
    rows.forEach((r) => {
      const d = new Date(r.session?.session_date || "");
      const diff = Math.floor((now.getTime() - d.getTime()) / (7 * 86400000));
      const key = diff < 6 ? `w${5 - diff}` : null;
      if (key && weekMap[key]) {
        weekMap[key].total += 1;
        if (r.status === "presente") weekMap[key].present += 1;
        else if (r.status === "ausente") weekMap[key].absent += 1;
        else weekMap[key].justified += 1;
      }
    });
    const trend: AttendanceTrend[] = Object.entries(weekMap).map(([, v]) => ({
      date: v.date,
      present: v.present,
      absent: v.absent,
      justified: v.justified,
      total: v.total,
      rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }));

    // Global stats
    const totalRecords = rows.length;
    const totalPresent = statusCounts["presente"] || 0;
    const overallRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
    const sessionsLast30Days = allSessions.filter(
      (s) => new Date(s.session_date) >= thirtyDaysAgo
    ).length;

    return {
      overallRate,
      totalSessions: sessionsLast30Days,
      totalRecords,
      totalPresent,
      totalAbsent: statusCounts["ausente"] || 0,
      totalJustified: statusCounts["justificado"] || 0,
      statusBreakdown,
      byDiscipline,
      trend,
    };
  });
}

// ─── Attendance Stats (User Dashboard) ────────────────────────────────────────

export interface UserAttendanceStats {
  totalSessions: number;
  present: number;
  absent: number;
  justified: number;
  rate: number;
  byDiscipline: Array<{
    discipline: string;
    present: number;
    total: number;
    rate: number;
  }>;
  recentRecords: Array<{
    date: string;
    discipline: string;
    status: string;
  }>;
}

export async function getUserAttendanceStats(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [ownBeneficiary, dependentsWithBeneficiary] = await Promise.all([
      supabase
        .from("beneficiaries")
        .select("id")
        .eq("profile_id", userId)
        .maybeSingle(),
      supabase
        .from("dependents")
        .select("id, full_name, beneficiaries(id)")
        .eq("tutor_id", userId),
    ]);

    const beneficiaryIds: { id: string; name: string }[] = [];
    if (ownBeneficiary.data) {
      beneficiaryIds.push({ id: ownBeneficiary.data.id, name: "Yo" });
    }
    for (const d of dependentsWithBeneficiary.data || []) {
      const bRaw = d.beneficiaries as unknown as { id: string }[] | { id: string } | null;
      const bId = Array.isArray(bRaw) ? bRaw[0]?.id : bRaw?.id;
      if (bId) beneficiaryIds.push({ id: bId, name: d.full_name });
    }

    if (beneficiaryIds.length === 0) {
      return {
        totalSessions: 0,
        present: 0,
        absent: 0,
        justified: 0,
        rate: 0,
        byDiscipline: [],
        recentRecords: [],
      } as UserAttendanceStats;
    }

    const bIds = beneficiaryIds.map((b) => b.id);

    const { data } = await supabase
      .from("attendance")
      .select("status, session:class_sessions(session_date, schedule:schedules(discipline:disciplines(name)))")
      .in("beneficiary_id", bIds)
      .gte("marked_at", thirtyDaysAgo.toISOString())
      .order("marked_at", { ascending: false });

    const rows = (data || []) as unknown as Array<{
      status: string;
      session: {
        session_date: string;
        schedule: { discipline: { name: string } | null } | null;
      } | null;
    }>;

    const present = rows.filter((r) => r.status === "presente").length;
    const absent = rows.filter((r) => r.status === "ausente").length;
    const justified = rows.filter((r) => r.status === "justificado").length;
    const totalSessions = rows.length;
    const rate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;

    const disciplineMap: Record<string, { present: number; total: number }> = {};
    rows.forEach((r) => {
      const disc = r.session?.schedule?.discipline?.name || "Sin disciplina";
      if (!disciplineMap[disc]) disciplineMap[disc] = { present: 0, total: 0 };
      disciplineMap[disc].total += 1;
      if (r.status === "presente") disciplineMap[disc].present += 1;
    });
    const byDiscipline = Object.entries(disciplineMap)
      .map(([discipline, d]) => ({
        discipline,
        ...d,
        rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const recentRecords = rows.slice(0, 10).map((r) => ({
      date: r.session?.session_date || "",
      discipline: r.session?.schedule?.discipline?.name || "Sin disciplina",
      status: r.status,
    }));

    return {
      totalSessions,
      present,
      absent,
      justified,
      rate,
      byDiscipline,
      recentRecords,
    } as UserAttendanceStats;
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
      return { records: [] as Array<AttendanceRecord & { beneficiary_name: string }> };
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
            start_time,
            end_time,
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
