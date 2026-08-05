import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, Shell, btnGhost, btnPrimary, inputCls, labelCls } from "@/components/ebd/Shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchClasses, fetchStudents, formatBR } from "@/lib/ebd";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios Comparativos de Presença | Sistema EBD SIBO" },
      {
        name: "description",
        content:
          "Comparativos de frequência semana a semana e mês a mês por classe da Escola Bíblica Dominical da SIBO.",
      },
      { property: "og:title", content: "Relatórios Comparativos de Presença | Sistema EBD SIBO" },
      {
        property: "og:description",
        content: "Frequência por classe, comparativos semanais e mensais da EBD da Segunda Igreja Batista de Osasco.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Relatorios,
});

type SessionLite = { id: string; session_date: string };
type AttendanceLite = { session_id: string; student_id: string; class_id: string | null; present: boolean };

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const PALETTE = [
  "hsl(var(--primary))",
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#db2777",
  "#0891b2",
  "#7c3aed",
  "#dc2626",
];

async function fetchYearData(year: number) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const { data: sessions, error: se } = await supabase
    .from("ebd_sessions")
    .select("id, session_date")
    .gte("session_date", start)
    .lte("session_date", end)
    .order("session_date");
  if (se) throw se;
  const list = (sessions ?? []) as SessionLite[];
  if (list.length === 0) return { sessions: list, attendances: [] as AttendanceLite[] };
  const { data: att, error: ae } = await supabase
    .from("attendances")
    .select("session_id, student_id, class_id, present")
    .in(
      "session_id",
      list.map((s) => s.id),
    );
  if (ae) throw ae;
  return { sessions: list, attendances: (att ?? []) as AttendanceLite[] };
}

function pct(present: number, enrolled: number) {
  if (!enrolled) return 0;
  return Math.round((present / enrolled) * 1000) / 10;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus size={12} /> —</span>;
  }
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        flat ? "text-muted-foreground" : up ? "text-emerald-600" : "text-destructive"
      }`}
    >
      {flat ? <Minus size={12} /> : up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? "+" : ""}
      {value.toFixed(1)} p.p.
    </span>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-foreground">{label}</p>
      {payload.map((p: any) => {
        const meta = p.payload?.meta?.[p.dataKey] as { present: number; enrolled: number } | undefined;
        return (
          <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="font-semibold text-foreground">{p.name}</span>
            {meta ? <span>{meta.present} de {meta.enrolled} presentes</span> : null}
            <span className="font-semibold text-foreground">{Number(p.value).toFixed(1)}%</span>
          </p>
        );
      })}
    </div>
  );
}

function Relatorios() {
  const now = new Date();
  const year = now.getFullYear();
  const [view, setView] = useState<"semana" | "mes">("semana");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [month, setMonth] = useState<number>(now.getMonth());

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const { data, isLoading } = useQuery({
    queryKey: ["report-year", year],
    queryFn: () => fetchYearData(year),
  });

  const activeClasses = useMemo(() => classes.filter((c) => c.active), [classes]);
  const shown = useMemo(
    () => (classFilter === "all" ? activeClasses : activeClasses.filter((c) => c.id === classFilter)),
    [activeClasses, classFilter],
  );

  const studentClass = useMemo(() => {
    const m = new Map<string, string | null>();
    students.forEach((s) => m.set(s.id, s.class_id));
    return m;
  }, [students]);

  const enrolledByClass = useMemo(() => {
    const m = new Map<string, number>();
    students.filter((s) => s.active).forEach((s) => {
      if (!s.class_id) return;
      m.set(s.class_id, (m.get(s.class_id) ?? 0) + 1);
    });
    return m;
  }, [students]);

  /** Map sessionId -> classId -> presentes */
  const presenceBySession = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    (data?.attendances ?? []).forEach((a) => {
      if (!a.present) return;
      const classId = a.class_id ?? studentClass.get(a.student_id) ?? null;
      if (!classId) return;
      const inner = m.get(a.session_id) ?? new Map<string, number>();
      inner.set(classId, (inner.get(classId) ?? 0) + 1);
      m.set(a.session_id, inner);
    });
    return m;
  }, [data, studentClass]);

  const weekRows = useMemo(() => {
    const sessions = (data?.sessions ?? []).filter(
      (s) => Number(s.session_date.slice(5, 7)) - 1 === month,
    );
    return sessions.map((s) => {
      const inner = presenceBySession.get(s.id) ?? new Map<string, number>();
      const row: Record<string, unknown> = {
        label: formatBR(s.session_date).slice(0, 5),
        date: s.session_date,
        meta: {} as Record<string, { present: number; enrolled: number }>,
      };
      shown.forEach((c) => {
        const present = inner.get(c.id) ?? 0;
        const enrolled = enrolledByClass.get(c.id) ?? 0;
        row[c.id] = pct(present, enrolled);
        (row["meta"] as Record<string, { present: number; enrolled: number }>)[c.id] = { present, enrolled };
      });
      const totalPresent = shown.reduce((acc, c) => acc + (inner.get(c.id) ?? 0), 0);
      const totalEnrolled = shown.reduce((acc, c) => acc + (enrolledByClass.get(c.id) ?? 0), 0);
      row["_totalPresent"] = totalPresent;
      row["_totalEnrolled"] = totalEnrolled;
      row["_rate"] = pct(totalPresent, totalEnrolled);
      return row;
    });
  }, [data, month, shown, presenceBySession, enrolledByClass]);

  const monthRows = useMemo(() => {
    const byMonth = new Map<number, { present: number; slots: number; meta: Record<string, { present: number; enrolled: number }> }>();
    (data?.sessions ?? []).forEach((s) => {
      const m = Number(s.session_date.slice(5, 7)) - 1;
      const inner = presenceBySession.get(s.id) ?? new Map<string, number>();
      const entry = byMonth.get(m) ?? { present: 0, slots: 0, meta: {} };
      shown.forEach((c) => {
        const present = inner.get(c.id) ?? 0;
        const enrolled = enrolledByClass.get(c.id) ?? 0;
        entry.present += present;
        entry.slots += enrolled;
        const prev = entry.meta[c.id] ?? { present: 0, enrolled: 0 };
        entry.meta[c.id] = { present: prev.present + present, enrolled: prev.enrolled + enrolled };
      });
      byMonth.set(m, entry);
    });
    return MONTHS.map((name, i) => {
      const entry = byMonth.get(i);
      const meta: Record<string, { present: number; enrolled: number }> = {};
      const row: Record<string, unknown> = { label: name, meta };
      shown.forEach((c) => {
        const cm = entry?.meta[c.id] ?? { present: 0, enrolled: 0 };
        meta[c.id] = cm;
        row[c.id] = pct(cm.present, cm.enrolled);
      });
      meta["_media"] = { present: entry?.present ?? 0, enrolled: entry?.slots ?? 0 };
      row["_media"] = pct(entry?.present ?? 0, entry?.slots ?? 0);
      row["_hasData"] = Boolean(entry);
      return row;
    });
  }, [data, shown, presenceBySession, enrolledByClass]);

  const weekSummary = weekRows.map((r, i) => ({
    label: String(r["label"]),
    present: Number(r["_totalPresent"] ?? 0),
    enrolled: Number(r["_totalEnrolled"] ?? 0),
    rate: Number(r["_rate"] ?? 0),
    delta: i === 0 ? null : Number(r["_rate"] ?? 0) - Number(weekRows[i - 1]?.["_rate"] ?? 0),
  }));

  const monthSummary = monthRows
    .map((r, i) => ({
      label: String(r["label"]),
      rate: Number(r["_media"] ?? 0),
      hasData: Boolean(r["_hasData"]),
      index: i,
    }))
    .filter((r) => r.hasData)
    .map((r, i, arr) => ({ ...r, delta: i === 0 ? null : r.rate - (arr[i - 1]?.rate ?? 0) }));

  return (
    <Shell
      subtitle="Relatórios comparativos de presença"
      actions={
        <>
          <Link to="/painel" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">
            Painel
          </Link>
          <Link to="/encerramento" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">
            Encerramento
          </Link>
        </>
      }
    >
      <Card className="mb-4 animate-fade-in">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <button type="button" className={view === "semana" ? btnPrimary : btnGhost} onClick={() => setView("semana")}>
              Semana a semana
            </button>
            <button type="button" className={view === "mes" ? btnPrimary : btnGhost} onClick={() => setView("mes")}>
              Mês a mês
            </button>
          </div>
          <div className="w-56">
            <label className={labelCls}>Sala / classe</label>
            <select className={inputCls} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="all">Todas as salas</option>
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {view === "semana" ? (
            <div className="w-44">
              <label className={labelCls}>Mês</label>
              <select className={inputCls} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>
                    {m}/{year}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </Card>

      {isLoading ? (
        <Card>
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </Card>
      ) : view === "semana" ? (
        <div className="space-y-4">
          <Card className="animate-fade-in">
            <h2 className="text-base font-bold">Presença por domingo — {MONTHS[month]}/{year}</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Percentual de frequência sobre os alunos ativos matriculados em cada classe.
            </p>
            {weekRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma chamada registrada neste mês.</p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekRows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fillOpacity: 0.08 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {shown.map((c, i) => (
                      <Bar
                        key={c.id}
                        dataKey={c.id}
                        name={c.name}
                        fill={PALETTE[i % PALETTE.length]}
                        radius={[6, 6, 0, 0]}
                        isAnimationActive
                        animationDuration={900}
                        animationBegin={i * 90}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="animate-fade-in">
            <h2 className="text-base font-bold">Variação semanal</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Domingo</th>
                    <th className="py-2">Presentes</th>
                    <th className="py-2">Matriculados</th>
                    <th className="py-2">Frequência</th>
                    <th className="py-2">vs. domingo anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {weekSummary.map((r) => (
                    <tr key={r.label} className="border-b border-border/60">
                      <td className="py-2 font-semibold">{r.label}</td>
                      <td className="py-2">{r.present}</td>
                      <td className="py-2">{r.enrolled}</td>
                      <td className="py-2 font-semibold">{r.rate.toFixed(1)}%</td>
                      <td className="py-2"><Delta value={r.delta} /></td>
                    </tr>
                  ))}
                  {weekSummary.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-muted-foreground">
                        Sem dados para o mês selecionado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="animate-fade-in">
            <h2 className="text-base font-bold">Engajamento mês a mês — {year}</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {classFilter === "all" ? "Média geral de todas as salas e linha por classe." : "Frequência mensal da sala selecionada."}
            </p>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthRows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {classFilter === "all" ? (
                    <Line
                      type="monotone"
                      dataKey="_media"
                      name="Média geral"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      isAnimationActive
                      animationDuration={900}
                    />
                  ) : null}
                  {shown.map((c, i) => (
                    <Line
                      key={c.id}
                      type="monotone"
                      dataKey={c.id}
                      name={c.name}
                      stroke={PALETTE[(i + 1) % PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive
                      animationDuration={900}
                      animationBegin={(i + 1) * 90}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="animate-fade-in">
            <h2 className="text-base font-bold">Crescimento mensal</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {monthSummary.map((r) => (
                <div key={r.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs uppercase text-muted-foreground">{r.label}/{year}</p>
                  <p className="text-2xl font-bold">{r.rate.toFixed(1)}%</p>
                  <Delta value={r.delta} />
                </div>
              ))}
              {monthSummary.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem chamadas registradas neste ano.</p>
              ) : null}
            </div>
          </Card>
        </div>
      )}
    </Shell>
  );
}
