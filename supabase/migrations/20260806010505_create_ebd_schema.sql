/*
# Create EBD SIBO database schema

1. Purpose
- Cria o esquema completo do Sistema EBD SIBO (Escola Bíblica Dominical da Segunda Igreja Batista de Osasco).
- Permite que professores registrem chamadas e que a superintendência gerencie classes, alunos, professores, encerre sessões e visualize relatórios.

2. Enums
- `ebd_session_status`: status da sessão da EBD ("open" | "closed").
- `user_role`: papel do usuário ("admin" | "secretaria" | "professor" | "superintendencia").

3. Tables
- `profiles`: perfis de usuários (vinculados ao auth.users do Supabase). Contém full_name, username, phone, role.
- `classes`: classes da EBD (nome, faixa etária, sala, ativa).
- `students`: alunos e professores da EBD. Contém full_name, birth_date, wedding_date, phone, endereço completo (cep, street, number, complement, neighborhood, city), class_id, is_teacher, teacher_class_id, active.
- `teachers`: professores (estrutura preservada para attendance tracking). Contém full_name, email, phone, class_id, active.
- `ebd_sessions`: sessões/domingos da EBD. Contém session_date, status, closed_at, closed_by.
- `attendances`: presença de alunos por sessão. Contém session_id, student_id, class_id, present.
- `teacher_attendances`: presença de professores por sessão. Contém session_id, teacher_id, class_id, present.
- `visitors`: visitantes por sessão. Contém session_id, class_id, visitor_name, notes.

4. Security (RLS)
- Todas as tabelas com RLS habilitado.
- Políticas para `authenticated` (app com tela de login) nas tabelas de gestão.
- Políticas para `anon, authenticated` nas tabelas de chamada (professores não logados registram presença).

5. Notes
- A coluna `cep` foi incluída na tabela `students` para resolver o erro "Could not find the 'cep' column".
- O `profiles` é criado automaticamente via trigger quando um usuário se cadastra no Supabase Auth.
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "ebd_session_status" AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('admin', 'secretaria', 'professor', 'superintendencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "full_name" text NOT NULL DEFAULT '',
  "username" text,
  "phone" text,
  "role" "user_role" NOT NULL DEFAULT 'superintendencia'::"user_role",
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_profiles_authenticated" ON "profiles";
CREATE POLICY "select_profiles_authenticated" ON "profiles" FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_profiles_self" ON "profiles";
CREATE POLICY "insert_profiles_self" ON "profiles" FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_profiles_self" ON "profiles";
CREATE POLICY "update_profiles_self" ON "profiles" FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'username',
    'superintendencia'::user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."handle_new_user"();

-- ═══════════════════════════════════════════════════════════════════════════
-- CLASSES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "age_group" text,
  "room" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_classes_all" ON "classes";
CREATE POLICY "select_classes_all" ON "classes" FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_classes_authenticated" ON "classes";
CREATE POLICY "insert_classes_authenticated" ON "classes" FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_classes_authenticated" ON "classes";
CREATE POLICY "update_classes_authenticated" ON "classes" FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_classes_authenticated" ON "classes";
CREATE POLICY "delete_classes_authenticated" ON "classes" FOR DELETE
  TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- STUDENTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "students" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "full_name" text NOT NULL,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "birth_date" date,
  "wedding_date" date,
  "phone" text,
  "active" boolean NOT NULL DEFAULT true,
  "is_teacher" boolean NOT NULL DEFAULT false,
  "teacher_class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "cep" text,
  "street" text,
  "number" text,
  "complement" text,
  "neighborhood" text,
  "city" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_students_all" ON "students";
CREATE POLICY "select_students_all" ON "students" FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_students_authenticated" ON "students";
CREATE POLICY "insert_students_authenticated" ON "students" FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_students_authenticated" ON "students";
CREATE POLICY "update_students_authenticated" ON "students" FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_students_authenticated" ON "students";
CREATE POLICY "delete_students_authenticated" ON "students" FOR DELETE
  TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- TEACHERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "teachers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "full_name" text NOT NULL,
  "email" text,
  "phone" text,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "teachers" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_teachers_all" ON "teachers";
CREATE POLICY "select_teachers_all" ON "teachers" FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_teachers_authenticated" ON "teachers";
CREATE POLICY "insert_teachers_authenticated" ON "teachers" FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_teachers_authenticated" ON "teachers";
CREATE POLICY "update_teachers_authenticated" ON "teachers" FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_teachers_authenticated" ON "teachers";
CREATE POLICY "delete_teachers_authenticated" ON "teachers" FOR DELETE
  TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- EBD_SESSIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "ebd_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_date" date NOT NULL,
  "status" "ebd_session_status" NOT NULL DEFAULT 'open'::"ebd_session_status",
  "closed_at" timestamptz,
  "closed_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "ebd_sessions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_sessions_all" ON "ebd_sessions";
CREATE POLICY "select_sessions_all" ON "ebd_sessions" FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_sessions_authenticated" ON "ebd_sessions";
CREATE POLICY "insert_sessions_authenticated" ON "ebd_sessions" FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_sessions_authenticated" ON "ebd_sessions";
CREATE POLICY "update_sessions_authenticated" ON "ebd_sessions" FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_sessions_authenticated" ON "ebd_sessions";
CREATE POLICY "delete_sessions_authenticated" ON "ebd_sessions" FOR DELETE
  TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- ATTENDANCES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "attendances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "ebd_sessions"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "present" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "attendances" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_attendances_all" ON "attendances";
CREATE POLICY "select_attendances_all" ON "attendances" FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_attendances_authenticated" ON "attendances";
CREATE POLICY "insert_attendances_authenticated" ON "attendances" FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_attendances_authenticated" ON "attendances";
CREATE POLICY "update_attendances_authenticated" ON "attendances" FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_attendances_authenticated" ON "attendances";
CREATE POLICY "delete_attendances_authenticated" ON "attendances" FOR DELETE
  TO authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS "attendances_session_student_key"
  ON "attendances" ("session_id", "student_id");

-- ═══════════════════════════════════════════════════════════════════════════
-- TEACHER_ATTENDANCES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "teacher_attendances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "ebd_sessions"("id") ON DELETE CASCADE,
  "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "present" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "teacher_attendances" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_teacher_attendances_all" ON "teacher_attendances";
CREATE POLICY "select_teacher_attendances_all" ON "teacher_attendances" FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_teacher_attendances_authenticated" ON "teacher_attendances";
CREATE POLICY "insert_teacher_attendances_authenticated" ON "teacher_attendances" FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_teacher_attendances_authenticated" ON "teacher_attendances";
CREATE POLICY "update_teacher_attendances_authenticated" ON "teacher_attendances" FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_teacher_attendances_authenticated" ON "teacher_attendances";
CREATE POLICY "delete_teacher_attendances_authenticated" ON "teacher_attendances" FOR DELETE
  TO authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_attendances_session_teacher_key"
  ON "teacher_attendances" ("session_id", "teacher_id");

-- ═══════════════════════════════════════════════════════════════════════════
-- VISITORS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "visitors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "ebd_sessions"("id") ON DELETE CASCADE,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "visitor_name" text NOT NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "visitors" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_visitors_all" ON "visitors";
CREATE POLICY "select_visitors_all" ON "visitors" FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_visitors_authenticated" ON "visitors";
CREATE POLICY "insert_visitors_authenticated" ON "visitors" FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_visitors_authenticated" ON "visitors";
CREATE POLICY "update_visitors_authenticated" ON "visitors" FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_visitors_authenticated" ON "visitors";
CREATE POLICY "delete_visitors_authenticated" ON "visitors" FOR DELETE
  TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "public"."session_is_open"("_session_id" uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "ebd_sessions"
    WHERE "id" = "_session_id" AND "status" = 'open'
  );
$$;
