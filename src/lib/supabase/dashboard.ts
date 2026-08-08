import { createClient } from "./client";
import { getChileToday, addDaysChile, chileDateToUtc, chileMonthStartDate } from "../dates";
import { effectiveMembershipStatus } from "../membership-status";

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
    tokens: number | null;
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
  commerce_order?: string | null;
  membership_plan_id?: string | null;
  personalized_plan_id?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  admin_note?: string | null;
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
        plan:membership_plans(id, name, price, duration_days, category, benefits, tokens),
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

export async function getUserTransferRequests(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("payments")
      .select(
        `
        *,
        membership:memberships(
          plan:membership_plans(name)
        )
      `
      )
      .eq("user_id", userId)
      .eq("method", "transferencia")
      .order("created_at", { ascending: false });

    return (data || []) as PaymentData[];
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

    const firstOfMonth = chileDateToUtc(chileMonthStartDate());

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
    const today = getChileToday();
    const activeMemberships = allMemberships.filter(
      (m) =>
        effectiveMembershipStatus(m.status, m.end_date, today) === "activa"
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
      .select("full_name, phone, birth_date, rut")
      .eq("id", userId)
      .single();
    return data as { full_name: string; phone: string | null; birth_date: string | null; rut: string | null } | null;
  });
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; phone?: string; birth_date?: string; rut?: string }
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
    mode?: string;
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
    const today = getChileToday();

    const { data } = await supabase
      .from("class_sessions")
      .select(
        `
        *,
        schedule:schedules(
          id, day_of_week, start_time, end_time, mode,
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
      .select("schedule_id, schedules(mode)")
      .eq("id", sessionId)
      .single();

    if (!session) return { beneficiaries: [] as AttendanceBeneficiary[] };

    const scheduleMode = (session.schedules as unknown as { mode?: string } | null)?.mode;
    if (scheduleMode === "personalizado") {
      const { data: enrollments } = await supabase
        .from("personalized_enrollments")
        .select("beneficiary_id")
        .eq("session_id", sessionId);

      const beneficiaryMap = new Map<string, AttendanceBeneficiary>();
      for (const e of enrollments || []) {
        const id = e.beneficiary_id;
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

      return {
        beneficiaries: Array.from(beneficiaryMap.values()).sort((a, b) =>
          a.full_name.localeCompare(b.full_name)
        ),
      };
    }

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
      .lte("start_date", getChileToday())
      .gte("end_date", getChileToday())
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

    if (status === "justificado") {
      const { data: session } = await supabase
        .from("class_sessions")
        .select("session_date, schedule:schedules(discipline:disciplines(name))")
        .eq("id", sessionId)
        .single();

      const { data: beneficiary } = await supabase
        .from("beneficiaries")
        .select("id, profile_id, dependent:dependents(full_name, tutor_id)")
        .eq("id", beneficiaryId)
        .single();

      if (session && beneficiary) {
        const depData = beneficiary.dependent as unknown as { full_name: string; tutor_id: string } | null;
        const beneficiaryName = depData?.full_name || "Alumno";
        const ownerId = depData?.tutor_id || beneficiary.profile_id;
        const disciplineData = (session as { schedule?: { discipline?: { name?: string } } }).schedule?.discipline?.name || "Clase";
        const sessionDate = (session as { session_date?: string }).session_date;

        if (ownerId && sessionDate) {
          await supabase.rpc("notify_token_return", {
            p_user_id: ownerId,
            p_beneficiary_name: beneficiaryName,
            p_session_date: sessionDate,
            p_discipline_name: disciplineData,
          });
        }
      }
    }

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
    const today = getChileToday();
    const thirtyDaysAgo = addDaysChile(today, -30);
    const sixWeeksAgo = addDaysChile(today, -42);

    const [attendanceRes, sessionsRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("status, session_id, session:class_sessions(session_date, schedule:schedules(discipline:disciplines(name)))")
        .gte("marked_at", chileDateToUtc(sixWeeksAgo)),
      supabase
        .from("class_sessions")
        .select("id, session_date")
        .gte("session_date", sixWeeksAgo),
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
      (s) => s.session_date >= thirtyDaysAgo
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

// =====================================================
// TOKEN SYSTEM TYPES AND FUNCTIONS
// =====================================================

export interface TokenInfo {
  remaining: number | null;
  total: number | null;
  consumed: number;
  justified: number;
  is_unlimited: boolean;
}

export interface DebtDetail {
  enrollment_id: string;
  session_date: string;
  discipline_name: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  source: string;
  enrolled_at: string;
}

export interface PendingDebt {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  session: {
    session_date: string;
    schedule: { discipline: { name: string } | null } | null;
  } | null;
}

export async function getPendingDebts(beneficiaryId: string): Promise<PendingDebt[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("debts")
    .select("id, amount, status, created_at, session:class_sessions(session_date, schedule:schedules(discipline:disciplines(name)))")
    .eq("beneficiary_id", beneficiaryId)
    .eq("status", "pendiente")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as unknown as PendingDebt[];
}

export async function getRemainingTokens(
  beneficiaryId: string,
  membershipId: string
): Promise<TokenInfo> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_remaining_tokens", {
    p_beneficiary_id: beneficiaryId,
    p_membership_id: membershipId,
  });

  if (error || !data || data.length === 0) {
    return {
      remaining: null,
      total: null,
      consumed: 0,
      justified: 0,
      is_unlimited: true,
    };
  }

  const result = data[0];
  return {
    remaining: result.remaining,
    total: result.total,
    consumed: result.consumed,
    justified: result.justified,
    is_unlimited: result.is_unlimited,
  };
}

export async function getEnrollmentDebt(
  beneficiaryId: string,
  membershipId: string
): Promise<DebtDetail[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_enrollment_debt", {
    p_beneficiary_id: beneficiaryId,
    p_membership_id: membershipId,
  });

  if (error || !data) {
    return [];
  }

  return data as DebtDetail[];
}

export async function getBeneficiaryTokens(
  userId: string
): Promise<Map<string, TokenInfo>> {
  const supabase = createClient();
  const tokenMap = new Map<string, TokenInfo>();

  const [ownBeneficiary, dependentsWithBeneficiary] = await Promise.all([
    supabase
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle(),
    supabase
      .from("dependents")
      .select("id, beneficiaries(id)")
      .eq("tutor_id", userId),
  ]);

  const beneficiaryIds: string[] = [];

  if (ownBeneficiary.data?.id) {
    beneficiaryIds.push(ownBeneficiary.data.id);
  }

  for (const d of dependentsWithBeneficiary.data || []) {
    const bRaw = d.beneficiaries as unknown as { id: string }[] | { id: string } | null;
    const bId = Array.isArray(bRaw) ? bRaw[0]?.id : bRaw?.id;
    if (bId) {
      beneficiaryIds.push(bId);
    }
  }

  if (beneficiaryIds.length === 0) {
    return tokenMap;
  }

  for (const bId of beneficiaryIds) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("id")
      .eq("beneficiary_id", bId)
      .eq("status", "activa")
      .gte("end_date", getChileToday())
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membership) {
      const tokenInfo = await getRemainingTokens(bId, membership.id);
      tokenMap.set(bId, tokenInfo);
    }
  }

  return tokenMap;
}

// =====================================================
// CLASES PERSONALIZADAS (módulo desacoplado)
// =====================================================

export interface PersonalizedPlanData {
  id: string;
  name: string;
  price: number;
  total_classes: number;
  validity_days: number;
  features: string[] | null;
  active: boolean;
}

export interface PersonalizedPackData {
  id: string;
  beneficiary_id: string;
  plan_id: string;
  purchased_by: string;
  payment_id: string | null;
  start_date: string;
  end_date: string;
  total_classes: number;
  used_classes: number;
  status: string;
  created_at: string;
  plan: {
    id: string;
    name: string;
    price: number;
    total_classes: number;
    validity_days: number;
    features: string[] | null;
  } | null;
  beneficiary: {
    id: string;
    profile_id: string | null;
    dependent_id: string | null;
    dependent: { full_name: string; category: string } | null;
  } | null;
}

export async function getActivePersonalizedPlans() {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("personalized_plans")
      .select("id, name, price, total_classes, validity_days, features")
      .eq("active", true)
      .order("price");
    return (data || []) as PersonalizedPlanData[];
  });
}

export interface PersonalizedBeneficiary {
  id: string;
  name: string;
  isSelf: boolean;
  packs: PersonalizedPackData[];
}

export async function getUserPersonalizedData(userId: string) {
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
        .select("id, full_name, beneficiaries(id)")
        .eq("tutor_id", userId),
    ]);

    const beneficiaryEntries: { id: string; name: string; isSelf: boolean }[] = [];
    if (ownBeneficiary.data) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      beneficiaryEntries.push({
        id: ownBeneficiary.data.id,
        name: (profile as { full_name: string } | null)?.full_name || "Yo",
        isSelf: true,
      });
    }

    for (const d of dependentsWithBeneficiary.data || []) {
      const bRaw = d.beneficiaries as unknown as { id: string }[] | { id: string } | null;
      const bId = Array.isArray(bRaw) ? bRaw[0]?.id : bRaw?.id;
      if (bId) {
        beneficiaryEntries.push({ id: bId, name: d.full_name, isSelf: false });
      }
    }

    const packsByBeneficiary = new Map<string, PersonalizedPackData[]>();
    if (beneficiaryEntries.length > 0) {
      const { data: packs } = await supabase
        .from("personalized_packs")
        .select(
          `
          *,
          plan:personalized_plans(id, name, price, total_classes, validity_days, features),
          beneficiary:beneficiaries(
            id, profile_id, dependent_id,
            dependent:dependents(full_name, category)
          )
        `
        )
        .in(
          "beneficiary_id",
          beneficiaryEntries.map((b) => b.id)
        )
        .order("created_at", { ascending: false });

      for (const p of (packs || []) as PersonalizedPackData[]) {
        const list = packsByBeneficiary.get(p.beneficiary_id) || [];
        list.push(p);
        packsByBeneficiary.set(p.beneficiary_id, list);
      }
    }

    const beneficiaries: PersonalizedBeneficiary[] = beneficiaryEntries.map((b) => ({
      id: b.id,
      name: b.name,
      isSelf: b.isSelf,
      packs: packsByBeneficiary.get(b.id) || [],
    }));

    return { beneficiaries, packsByBeneficiary };
  });
}

// =====================================================
// USER NOTIFICATIONS
// =====================================================

export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  content: string;
  read: boolean;
  created_at: string;
}

export async function getPersonalNotifications(userId: string): Promise<UserNotification[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("user_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) {
    return [];
  }

  return data as UserNotification[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("user_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    return 0;
  }

  return count || 0;
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_notifications")
    .update({ read: true })
    .eq("id", notificationId);

  return !error;
}

export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  return !error;
}
