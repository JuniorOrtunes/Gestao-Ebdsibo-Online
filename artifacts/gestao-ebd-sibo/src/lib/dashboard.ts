import { supabase } from "@/integrations/supabase/client";
import { sundayOf, todayISO } from "./ebd";

export type DashboardStats = {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  presentToday: number;
  visitorsToday: number;
  percentageToday: number;
};

export type ClassPresenceStat = {
  classId: string;
  className: string;
  present: number;
  total: number;
  percentage: number;
};

export type WeeklyTrendPoint = {
  label: string;
  date: string;
  total: number;
};

export type MonthlyByClassPoint = {
  label: string;
  [className: string]: number | string;
};

export type DistributionItem = {
  name: string;
  value: number;
  color: string;
};

// ─── Stats cards ─────────────────────────────────────────────────────────────

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = sundayOf(todayISO());

  const [classesRes, studentsRes, teachersRes, sessionRes] = await Promise.all([
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("students").select("id, is_teacher", { count: "exact" }).eq("active", true),
    supabase.from("teachers").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("ebd_sessions").select("id").eq("session_date", today).maybeSingle(),
  ]);

  const students = studentsRes.data ?? [];
  const totalStudents = students.filter((s) => !s.is_teacher).length;
  const totalTeachers =
    students.filter((s) => s.is_teacher).length || (teachersRes.count ?? 0);
  const totalClasses = classesRes.count ?? 0;

  const sessionId = sessionRes.data?.id;
  if (!sessionId) {
    return { totalStudents, totalTeachers, totalClasses, presentToday: 0, visitorsToday: 0, percentageToday: 0 };
  }

  const [attRes, tattRes, visRes] = await Promise.all([
    supabase.from("attendances").select("present").eq("session_id", sessionId),
    supabase.from("teacher_attendances").select("present").eq("session_id", sessionId),
    supabase.from("visitors").select("id", { count: "exact", head: true }).eq("session_id", sessionId),
  ]);

  const presentStudents = (attRes.data ?? []).filter((a) => a.present).length;
  const presentTeachers = (tattRes.data ?? []).filter((a) => a.present).length;
  const presentToday = presentStudents + presentTeachers;
  const visitorsToday = visRes.count ?? 0;

  const totalEnrolled = totalStudents + totalTeachers;
  const percentageToday = totalEnrolled > 0 ? Math.round((presentToday / totalEnrolled) * 100) : 0;

  return { totalStudents, totalTeachers, totalClasses, presentToday, visitorsToday, percentageToday };
}

// ─── Bar chart: presence % by class (latest session) ─────────────────────────

export async function fetchClassPresence(): Promise<ClassPresenceStat[]> {
  const { data: latestSession } = await supabase
    .from("ebd_sessions")
    .select("id")
    .order("session_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSession) return [];

  const [attRes, studentsRes, classesRes] = await Promise.all([
    supabase
      .from("attendances")
      .select("class_id, present")
      .eq("session_id", latestSession.id),
    supabase.from("students").select("class_id").eq("active", true),
    supabase.from("classes").select("id, name").eq("active", true),
  ]);

  const attendances = attRes.data ?? [];
  const students = studentsRes.data ?? [];
  const classes = classesRes.data ?? [];

  return classes
    .map((cls) => {
      const clsAttendances = attendances.filter((a) => a.class_id === cls.id);
      const present = clsAttendances.filter((a) => a.present).length;
      const total = students.filter((s) => s.class_id === cls.id).length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      return { classId: cls.id, className: cls.name, present, total, percentage };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.percentage - a.percentage);
}

// ─── Donut: distribution from latest session ─────────────────────────────────

export async function fetchAttendanceDistribution(): Promise<DistributionItem[]> {
  const { data: latestSession } = await supabase
    .from("ebd_sessions")
    .select("id")
    .order("session_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSession) {
    return [
      { name: "Presentes", value: 0, color: "#3b82f6" },
      { name: "Ausentes", value: 0, color: "#e5e7eb" },
      { name: "Visitantes", value: 0, color: "#10b981" },
    ];
  }

  const [attRes, tattRes, visRes] = await Promise.all([
    supabase.from("attendances").select("present").eq("session_id", latestSession.id),
    supabase.from("teacher_attendances").select("present").eq("session_id", latestSession.id),
    supabase.from("visitors").select("id", { count: "exact", head: true }).eq("session_id", latestSession.id),
  ]);

  const allAtt = [...(attRes.data ?? []), ...(tattRes.data ?? [])];
  const present = allAtt.filter((a) => a.present).length;
  const absent = allAtt.filter((a) => !a.present).length;
  const visitors = visRes.count ?? 0;

  return [
    { name: "Presentes", value: present, color: "#3b82f6" },
    { name: "Ausentes", value: absent, color: "#e5e7eb" },
    { name: "Visitantes", value: visitors, color: "#10b981" },
  ];
}

// ─── Weekly trend: total present for last 8 sessions ─────────────────────────

export async function fetchWeeklyTrend(): Promise<WeeklyTrendPoint[]> {
  const { data: sessions } = await supabase
    .from("ebd_sessions")
    .select("id, session_date")
    .order("session_date", { ascending: false })
    .limit(8);

  if (!sessions || sessions.length === 0) return [];

  const points = await Promise.all(
    sessions.map(async (s) => {
      const [attRes, tattRes] = await Promise.all([
        supabase.from("attendances").select("present").eq("session_id", s.id),
        supabase.from("teacher_attendances").select("present").eq("session_id", s.id),
      ]);
      const total =
        [...(attRes.data ?? []), ...(tattRes.data ?? [])].filter((a) => a.present).length;
      const [, m, d] = s.session_date.split("-");
      return { date: s.session_date, label: `${d}/${m}`, total };
    })
  );

  return points.reverse();
}

// ─── Monthly line chart: presence by class per session this month ─────────────

export async function fetchMonthlyByClass(): Promise<{ points: MonthlyByClassPoint[]; classNames: string[] }> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const from = `${year}-${month}-01`;
  const to = `${year}-${month}-31`;

  const [sessionsRes, classesRes] = await Promise.all([
    supabase
      .from("ebd_sessions")
      .select("id, session_date")
      .gte("session_date", from)
      .lte("session_date", to)
      .order("session_date"),
    supabase.from("classes").select("id, name").eq("active", true),
  ]);

  const sessions = sessionsRes.data ?? [];
  const classes = classesRes.data ?? [];

  if (sessions.length === 0 || classes.length === 0) return { points: [], classNames: [] };

  const points: MonthlyByClassPoint[] = await Promise.all(
    sessions.map(async (s) => {
      const { data: att } = await supabase
        .from("attendances")
        .select("class_id, present")
        .eq("session_id", s.id);

      const [, m, d] = s.session_date.split("-");
      const point: MonthlyByClassPoint = { label: `${d}/${m}` };

      for (const cls of classes) {
        const classAtt = (att ?? []).filter((a) => a.class_id === cls.id);
        point[cls.name] = classAtt.filter((a) => a.present).length;
      }

      return point;
    })
  );

  return { points, classNames: classes.map((c) => c.name) };
}
