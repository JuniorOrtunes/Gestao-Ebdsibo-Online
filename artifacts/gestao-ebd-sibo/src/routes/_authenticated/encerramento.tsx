import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Card, Shell, btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from "@/components/ebd/Shell";
import { supabase } from "@/integrations/supabase/client";
import {
  CHURCH_NAME,
  LOGO_URL,
  fetchClasses,
  fetchSession,
  fetchStudents,
  fetchTeachers,
  formatBR,
  isInWeek,
  longDateBR,
  sundayOf,
  todayISO,
} from "@/lib/ebd";

export const Route = createFileRoute("/_authenticated/encerramento")({
  head: () => ({
    meta: [
      { title: "Encerramento da EBD | Sistema EBD SIBO" },
      {
        name: "description",
        content:
          "Boletim geral de encerramento da EBD: frequência por classe, total de presentes, visitantes e aniversariantes da semana.",
      },
      { property: "og:title", content: "Encerramento da EBD | Sistema EBD SIBO" },
      {
        property: "og:description",
        content: "Boletim geral de encerramento da EBD da Segunda Igreja Batista de Osasco.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Encerramento,
});

function Encerramento() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => sundayOf(todayISO()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const { data: session } = useQuery({ queryKey: ["session", date], queryFn: () => fetchSession(date) });

  const { data: records } = useQuery({
    queryKey: ["boletim", session?.id],
    enabled: Boolean(session?.id),
    queryFn: async () => {
      const [att, tatt, vis] = await Promise.all([
        supabase.from("attendances").select("class_id, present").eq("session_id", session!.id),
        supabase.from("teacher_attendances").select("class_id, present").eq("session_id", session!.id),
        supabase.from("visitors").select("class_id, visitor_name").eq("session_id", session!.id),
      ]);
      return {
        attendances: att.data ?? [],
        teacherAttendances: tatt.data ?? [],
        visitors: vis.data ?? [],
      };
    },
  });

  const rows = useMemo(() => {
    return classes
      .filter((c) => c.active)
      .map((c) => {
        const alunos = (records?.attendances ?? []).filter((a) => a.class_id === c.id && a.present).length;
        const profs = (records?.teacherAttendances ?? []).filter((a) => a.class_id === c.id && a.present).length;
        const visit = (records?.visitors ?? []).filter((v) => v.class_id === c.id).length;
        const matriculados = students.filter((s) => s.class_id === c.id && s.active).length;
        return { classe: c, alunos, profs, visit, total: alunos + profs + visit, matriculados };
      });
  }, [classes, records, students]);

  const totalGeral = rows.reduce((acc, r) => acc + r.total, 0);
  const totalMatriculados = rows.reduce((acc, r) => acc + r.matriculados, 0);
  const frequencia = totalMatriculados ? Math.round((totalGeral / totalMatriculados) * 100) : 0;

  const aniversariantes = students.filter((s) => isInWeek(s.birth_date, date));
  const bodas = students.filter((s) => isInWeek(s.wedding_date, date));

  async function setStatus(status: "open" | "closed") {
    setBusy(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      let sessionId = session?.id;
      if (!sessionId) {
        const { data, error: e } = await supabase
          .from("ebd_sessions")
          .insert({ session_date: date, status })
          .select("id")
          .single();
        if (e) throw e;
        sessionId = data.id;
      } else {
        const { error: e } = await supabase
          .from("ebd_sessions")
          .update({
            status,
            closed_at: status === "closed" ? new Date().toISOString() : null,
            closed_by: status === "closed" ? (userData.user?.id ?? null) : null,
          })
          .eq("id", sessionId);
        if (e) throw e;
      }
      await queryClient.invalidateQueries({ queryKey: ["session", date] });
      await queryClient.invalidateQueries({ queryKey: ["boletim"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o domingo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      subtitle="Encerramento da EBD"
      actions={
        <Link to="/painel" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">
          Voltar ao painel
        </Link>
      }
    >
      <Card className="mb-4 print:hidden">
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
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              session?.status === "closed"
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            {session?.status === "closed" ? "EBD ENCERRADA" : "EBD ABERTA"}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => window.print()}>
              Imprimir / Exportar PDF
            </button>
            {session?.status === "closed" ? (
              <button type="button" className={btnGhost} disabled={busy} onClick={() => setStatus("open")}>
                Reabrir domingo
              </button>
            ) : (
              <button type="button" className={btnDanger} disabled={busy} onClick={() => setStatus("closed")}>
                Encerrar EBD do domingo
              </button>
            )}
          </div>
        </div>
        {error ? <p className="mt-2 text-sm font-semibold text-destructive">{error}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Ao encerrar, as chamadas desta data ficam bloqueadas para edição pelos professores.
        </p>
      </Card>

      <div id="boletim" className="rounded-xl border border-border bg-card p-6 print:border-0 print:p-0">
        <header className="flex items-center gap-3 border-b border-border pb-3">
          <img src={LOGO_URL} alt="Logo da Segunda Igreja Batista de Osasco" className="h-14 w-14 object-contain" />
          <div>
            <h2 className="text-lg font-bold">Boletim Geral de Encerramento — EBD</h2>
            <p className="text-xs text-muted-foreground">
              {CHURCH_NAME} · {longDateBR(date)}
            </p>
          </div>
          <p className="ml-auto text-right">
            <span className="block text-xs uppercase text-muted-foreground">Total de presentes</span>
            <span className="block text-3xl font-bold">{totalGeral}</span>
          </p>
        </header>

        <section className="mt-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Frequência por <span translate="no" className="notranslate">classe</span>
          </h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-1"><span translate="no" className="notranslate">Classe</span></th>
                <th className="py-1 text-center">Matriculados</th>
                <th className="py-1 text-center">Presentes</th>
                <th className="py-1 text-center">Visitantes</th>
                <th className="py-1 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.classe.id} className="border-b border-border/60">
                  <td className="py-1 font-medium">{r.classe.name}</td>
                  <td className="py-1 text-center">{r.matriculados}</td>
                  <td className="py-1 text-center">{r.alunos + r.profs}</td>
                  <td className="py-1 text-center">{r.visit}</td>
                  <td className="py-1 text-center font-bold">{r.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-2 font-bold">Total geral</td>
                <td className="py-2 text-center font-bold">{totalMatriculados}</td>
                <td className="py-2 text-center">—</td>
                <td className="py-2 text-center">
                  {rows.reduce((acc, r) => acc + r.visit, 0)}
                </td>
                <td className="py-2 text-center text-lg font-bold">{totalGeral}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-1 text-xs text-muted-foreground">
            Frequência da EBD: {frequencia}% em relação aos matriculados.
          </p>
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Visitantes da semana
            </h3>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {(records?.visitors ?? []).map((v, i) => (
                  <tr key={`${v.visitor_name}-${i}`} className="border-b border-border/60">
                    <td className="py-1">{v.visitor_name}</td>
                    <td className="py-1 text-right text-xs text-muted-foreground">
                      {classes.find((c) => c.id === v.class_id)?.name ?? "-"}
                    </td>
                  </tr>
                ))}
                {(records?.visitors ?? []).length === 0 ? (
                  <tr>
                    <td className="py-1 text-sm text-muted-foreground">Nenhum visitante registrado.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Aniversariantes da semana
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {aniversariantes.map((s) => (
                <li key={s.id} className="flex justify-between border-b border-border/60 py-1">
                  <span>{s.full_name}</span>
                  <span className="text-xs text-muted-foreground">{formatBR(s.birth_date)}</span>
                </li>
              ))}
              {aniversariantes.length === 0 ? (
                <li className="text-muted-foreground">Nenhum aniversariante nesta semana.</li>
              ) : null}
            </ul>
            {bodas.length ? (
              <>
                <h3 className="mt-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Bodas da semana
                </h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {bodas.map((s) => (
                    <li key={s.id} className="flex justify-between border-b border-border/60 py-1">
                      <span>{s.full_name}</span>
                      <span className="text-xs text-muted-foreground">{formatBR(s.wedding_date)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        </div>

        <div className="mt-4 hidden text-center text-[10px] text-muted-foreground print:block">
          Superintendência da EBD · {CHURCH_NAME}
        </div>
      </div>

      <div className="mt-4 print:hidden">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            const linhas = rows.map((r) => `• ${r.classe.name}: ${r.total}`).join("\n");
            const visitantes = (records?.visitors ?? []).map((v) => `• ${v.visitor_name}`).join("\n");
            const nascidos = aniversariantes.map((s) => `• ${s.full_name} (${formatBR(s.birth_date)})`).join("\n");
            const texto = `📖 *EBD — ${CHURCH_NAME}*\n${longDateBR(date)}\n\n👥 *FREQUÊNCIA POR CLASSE*\n${linhas}\n\n✅ *TOTAL DE PRESENTES: ${totalGeral}*\n\n🤝 *NOSSOS VISITANTES*\n${visitantes || "—"}\n\n🎂 *ANIVERSARIANTES DA SEMANA*\n${nascidos || "—"}`;
            void navigator.clipboard.writeText(texto);
          }}
        >
          Copiar boletim para WhatsApp
        </button>
      </div>
    </Shell>
  );
}