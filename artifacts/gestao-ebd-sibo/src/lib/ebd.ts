import { supabase } from "@/integrations/supabase/client";

export const LOGO_URL =
  "/favicon.png";

export const CHURCH_NAME = "Segunda Igreja Batista de Osasco";

export type ClassRow = {
  id: string;
  name: string;
  age_group: string | null;
  room: string | null;
  active: boolean;
};

export type StudentRow = {
  id: string;
  class_id: string | null;
  full_name: string;
  birth_date: string | null;
  wedding_date: string | null;
  phone: string | null;
  active: boolean;
  // Address fields
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  // Teacher fields
  is_teacher: boolean;
  teacher_class_id: string | null;
};

export type TeacherRow = {
  id: string;
  class_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
};

export type SessionRow = {
  id: string;
  session_date: string;
  status: "open" | "closed";
  closed_at: string | null;
};

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Domingo da semana da data informada (ou o próprio dia, se já for domingo). */
export function sundayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export function formatBR(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function longDateBR(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Aniversários (dia/mês) que caem na semana do domingo informado. */
export function isInWeek(iso: string | null, sunday: string): boolean {
  if (!iso) return false;
  const start = new Date(`${sunday}T12:00:00`);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(`${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return days.includes(iso.slice(5, 10));
}

export async function fetchClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, age_group, room, active")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

export async function fetchStudents(): Promise<StudentRow[]> {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, class_id, full_name, birth_date, wedding_date, phone, active, cep, street, number, complement, neighborhood, city, is_teacher, teacher_class_id"
    )
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as StudentRow[];
}

export async function fetchTeachers(): Promise<TeacherRow[]> {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, class_id, full_name, phone, email, active")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as TeacherRow[];
}

export async function fetchSession(date: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("ebd_sessions")
    .select("id, session_date, status, closed_at")
    .eq("session_date", date)
    .maybeSingle();
  if (error) throw error;
  return (data as SessionRow | null) ?? null;
}

export async function ensureSession(date: string): Promise<SessionRow> {
  const existing = await fetchSession(date);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("ebd_sessions")
    .insert({ session_date: date, status: "open" })
    .select("id, session_date, status, closed_at")
    .single();
  if (error) {
    const again = await fetchSession(date);
    if (again) return again;
    throw error;
  }
  return data as SessionRow;
}
