import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Card, btnGhost, btnPrimary, inputCls, labelCls } from "@/components/ebd/Shell";
import { Shell } from "@/components/ebd/Shell";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureSession,
  fetchClasses,
  fetchSession,
  fetchStudents,
  fetchTeachers,
  longDateBR,
  sundayOf,
  todayISO,
} from "@/lib/ebd";

export const Route = createFileRoute("/chamada")({
  validateSearch: (search: Record<string, unknown>) => ({
    classe: typeof search['classe'] === "string" ? (search['classe'] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Chamada da classe | Sistema EBD SIBO" },
      {
        name: "description",
        content:
          "Registro de presença de alunos, professores e visitantes da classe na Escola Bíblica Dominical.",
      },
      { property: "og:title", content: "Chamada da classe | Sistema EBD SIBO" },
      {
        property: "og:description",
        content: "Registro de presença de alunos, professores e visitantes da classe na EBD.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChamadaPage,
});

function ChamadaPage() {
  const { classe } = Route.useSearch();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => sundayOf(todayISO()));
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [teacherPresent, setTeacherPresent] = useState<Record<string, boolean>>({});
  const [visitorNames, setVisitorNames] = useState<string[]>([]);
  const [newVisitor, setNewVisitor] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ["session", date],
    queryFn: () => fetchSession(date),
  });

  const currentClass = classes.find((c) => c.id === classe);
  const classStudents = useMemo(
    () => students.filter((s) => s.class_id === classe && s.active),
    [students, classe],
  );
  const classTeachers = useMemo(
    () => teachers.filter((t) => t.class_id === classe && t.active),
    [teachers, classe],
  );

  const { data: existing } = useQuery({
    queryKey: ["chamada", session?.id, classe],
    enabled: Boolean(session?.id && classe),
    queryFn: async () => {
      const [att, tatt, vis] = await Promise.all([
        supabase.from("attendances").select("student_id, present").eq("session_id", session!.id).eq("class_id", classe),
        supabase.from("teacher_attendances").select("teacher_id, present").eq("session_id", session!.id).eq("class_id", classe),
        supabase.from("visitors").select("id, visitor_name").eq("session_id", session!.id).eq("class_id", classe),
      ]);
      return {
        attendances: att.data ?? [],
        teacherAttendances: tatt.data ?? [],
        visitors: vis.data ?? [],
      };
    },
  });

  useEffect(() => {
    if (!existing) {
      setPresent({});
      setTeacherPresent({});
      setVisitorNames([]);
      return;
    }
    const p: Record<string, boolean> = {};
    existing.attendances.forEach((a) => {
      p[a.student_id as string] = Boolean(a.present);
    });
    const tp: Record<string, boolean> = {};
    existing.teacherAttendances.forEach((a) => {
      tp[a.teacher_id as string] = Boolean(a.present);
    });
    setPresent(p);
    setTeacherPresent(tp);
    setVisitorNames(existing.visitors.map((v) => v.visitor_name as string));
  }, [existing]);

  const closed = session?.status === "closed";

  const save = useMutation({
    mutationFn: async () => {
      const s = await ensureSession(date);
      if (s.status === "closed") throw new Error("A EBD deste domingo já foi encerrada.");
      if (classStudents.length) {
        const { error: e1 } = await supabase.from("attendances").upsert(
          classStudents.map((st) => ({
            session_id: s.id,
            student_id: st.id,
            class_id: classe,
            present: Boolean(present[st.id]),
          })),
          { onConflict: "session_id,student_id" },
        );
        if (e1) throw e1;
      }
      if (classTeachers.length) {
        const { error: e2 } = await supabase.from("teacher_attendances").upsert(
          classTeachers.map((t) => ({
            session_id: s.id,
            teacher_id: t.id,
            class_id: classe,
            present: Boolean(teacherPresent[t.id]),
          })),
          { onConflict: "session_id,teacher_id" },
        );
        if (e2) throw e2;
      }
      const { error: e3 } = await supabase
        .from("visitors")
        .delete()
        .eq("session_id", s.id)
        .eq("class_id", classe);
      if (e3) throw e3;
      const names = visitorNames.map((n) => n.trim()).filter(Boolean);
      if (names.length) {
        const { error: e4 } = await supabase.from("visitors").insert(
          names.map((n) => ({ session_id: s.id, class_id: classe, visitor_name: n })),
        );
        if (e4) throw e4;
      }
      return s;
    },
    onSuccess: () => {
      setSaved(true);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["session", date] });
      void queryClient.invalidateQueries({ queryKey: ["chamada"] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Erro ao salvar a chamada."),
  });

  if (!classe) {
    return (
      <Shell subtitle="Chamada">
        <Card>
        <p className="text-sm text-muted-foreground">Nenhuma <span translate="no">classe</span> selecionada.</p>
          <Link to="/" className={`${btnPrimary} mt-4`}>
            Escolher <span translate="no">classe</span>
          </Link>
        </Card>
      </Shell>
    );
  }

  const totalPresentes =
    classStudents.filter((s) => present[s.id]).length +
    classTeachers.filter((t) => teacherPresent[t.id]).length +
    visitorNames.filter((n) => n.trim()).length;

  return (
    <Shell
      subtitle={currentClass ? `Chamada — ${currentClass.name}` : "Chamada"}
      actions={
        <Link to="/" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">
          Trocar <span translate="no">classe</span>
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelCls} htmlFor="data">
                Domingo
              </label>
              <input
                id="data"
                type="date"
                className={inputCls}
                value={date}
                onChange={(e) => setDate(sundayOf(e.target.value || todayISO()))}
              />
            </div>
            <p className="pb-2 text-sm text-muted-foreground">{longDateBR(date)}</p>
          </div>

          {closed ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              EBD encerrada nesta data. As chamadas estão bloqueadas para edição.
            </p>
          ) : null}

          <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Alunos ({classStudents.length})
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {classStudents.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <input
                  id={`al-${s.id}`}
                  type="checkbox"
                  className="h-5 w-5"
                  disabled={closed || loadingSession}
                  checked={Boolean(present[s.id])}
                  onChange={(e) => setPresent((p) => ({ ...p, [s.id]: e.target.checked }))}
                />
                <label htmlFor={`al-${s.id}`} className="text-sm text-foreground">
                  {s.full_name}
                </label>
              </li>
            ))}
            {classStudents.length === 0 ? (
              <li className="py-2 text-sm text-muted-foreground">Nenhum aluno cadastrado nesta <span translate="no">classe</span>.</li>
            ) : null}
          </ul>

          {classTeachers.length ? (
            <>
              <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Professores
              </h2>
              <ul className="mt-2 divide-y divide-border">
                {classTeachers.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2">
                    <input
                      id={`pr-${t.id}`}
                      type="checkbox"
                      className="h-5 w-5"
                      disabled={closed}
                      checked={Boolean(teacherPresent[t.id])}
                      onChange={(e) =>
                        setTeacherPresent((p) => ({ ...p, [t.id]: e.target.checked }))
                      }
                    />
                    <label htmlFor={`pr-${t.id}`} className="text-sm text-foreground">
                      {t.full_name}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Visitantes
            </h2>
            <div className="mt-3 flex gap-2">
              <input
                className={inputCls}
                placeholder="Nome do visitante"
                value={newVisitor}
                disabled={closed}
                onChange={(e) => setNewVisitor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newVisitor.trim()) {
                    e.preventDefault();
                    setVisitorNames((v) => [...v, newVisitor.trim()]);
                    setNewVisitor("");
                  }
                }}
              />
              <button
                type="button"
                className={btnGhost}
                disabled={closed || !newVisitor.trim()}
                onClick={() => {
                  setVisitorNames((v) => [...v, newVisitor.trim()]);
                  setNewVisitor("");
                }}
              >
                Add
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {visitorNames.map((n, i) => (
                <li
                  key={`${n}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-sm"
                >
                  <span>{n}</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-destructive"
                    disabled={closed}
                    onClick={() => setVisitorNames((v) => v.filter((_, idx) => idx !== i))}
                  >
                    remover
                  </button>
                </li>
              ))}
              {visitorNames.length === 0 ? (
                <li className="text-sm text-muted-foreground">Nenhum visitante registrado.</li>
              ) : null}
            </ul>
          </Card>

          <Card>
            <p className="text-sm text-muted-foreground">Total de presentes na <span translate="no">classe</span></p>
            <p className="text-3xl font-bold text-foreground">{totalPresentes}</p>
            <button
              type="button"
              className={`${btnPrimary} mt-4 w-full`}
              disabled={closed || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Salvando..." : "Salvar chamada"}
            </button>
            {saved ? (
              <p className="mt-2 text-sm font-semibold text-foreground">Chamada salva com sucesso.</p>
            ) : null}
            {error ? <p className="mt-2 text-sm font-semibold text-destructive">{error}</p> : null}
          </Card>
        </div>
      </div>
    </Shell>
  );
}