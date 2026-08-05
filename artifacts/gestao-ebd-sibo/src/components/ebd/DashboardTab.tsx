import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchAttendanceDistribution,
  fetchClassPresence,
  fetchDashboardStats,
  fetchMonthlyByClass,
  fetchWeeklyTrend,
} from "@/lib/dashboard";
import { Card } from "./Shell";

// ─── Count-up animation ───────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start: number | null = null;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
      else setValue(target);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return value;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

type StatCardProps = {
  label: string;
  value: number;
  icon: string;
  color: string;
  suffix?: string;
  loading?: boolean;
};

function StatCard({ label, value, icon, color, suffix = "", loading = false }: StatCardProps) {
  const displayed = useCountUp(value);

  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 shadow-sm flex items-start gap-4 transition-all duration-300`}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl"
        style={{ backgroundColor: `${color}18` }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-7 w-16 animate-pulse rounded-md bg-muted" />
        ) : (
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
            {displayed}
            {suffix}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

export function DashboardTab() {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    staleTime: 30_000,
  });

  const { data: classPresence = [], isLoading: loadingBar } = useQuery({
    queryKey: ["class-presence"],
    queryFn: fetchClassPresence,
    staleTime: 30_000,
  });

  const { data: distribution = [], isLoading: loadingDonut } = useQuery({
    queryKey: ["distribution"],
    queryFn: fetchAttendanceDistribution,
    staleTime: 30_000,
  });

  const { data: weeklyTrend = [], isLoading: loadingTrend } = useQuery({
    queryKey: ["weekly-trend"],
    queryFn: fetchWeeklyTrend,
    staleTime: 30_000,
  });

  const { data: monthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ["monthly-by-class"],
    queryFn: fetchMonthlyByClass,
    staleTime: 30_000,
  });

  const cards = [
    { label: "Alunos matriculados", value: stats?.totalStudents ?? 0, icon: "🎓", color: "#3b82f6" },
    { label: "Presentes hoje", value: stats?.presentToday ?? 0, icon: "✅", color: "#10b981" },
    { label: "Visitantes", value: stats?.visitorsToday ?? 0, icon: "👋", color: "#f59e0b" },
    { label: "Classes ativas", value: stats?.totalClasses ?? 0, icon: "🏫", color: "#8b5cf6" },
    { label: "Professores", value: stats?.totalTeachers ?? 0, icon: "👨‍🏫", color: "#ec4899" },
    {
      label: "Presença geral",
      value: stats?.percentageToday ?? 0,
      icon: "📊",
      color: "#06b6d4",
      suffix: "%",
    },
  ];

  const hasDistributionData = distribution.some((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} loading={loadingStats} />
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Line chart: monthly by class */}
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold text-foreground">Frequência por Classe — mês atual</h3>
          {loadingMonthly ? (
            <ChartSkeleton />
          ) : !monthly || monthly.points.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Sem dados para o mês atual
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={monthly.points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {monthly.classNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Donut: distribution */}
        <Card>
          <h3 className="mb-4 text-sm font-bold text-foreground">Distribuição — última sessão</h3>
          {loadingDonut ? (
            <ChartSkeleton />
          ) : !hasDistributionData ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Sem dados disponíveis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }: { name: string; value: number }) =>
                    value > 0 ? `${name} (${value})` : ""
                  }
                  labelLine={false}
                >
                  {distribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bar chart: % by class */}
        <Card>
          <h3 className="mb-4 text-sm font-bold text-foreground">% Presença por Classe — última sessão</h3>
          {loadingBar ? (
            <ChartSkeleton />
          ) : classPresence.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              Sem dados disponíveis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart
                data={classPresence}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis
                  type="category"
                  dataKey="className"
                  tick={{ fontSize: 11 }}
                  width={80}
                />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Presença"]}
                />
                <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                  {classPresence.map((entry, i) => (
                    <Cell key={entry.classId} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Line chart: weekly trend */}
        <Card>
          <h3 className="mb-4 text-sm font-bold text-foreground">Evolução de Frequência — últimas semanas</h3>
          {loadingTrend ? (
            <ChartSkeleton />
          ) : weeklyTrend.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              Sem dados disponíveis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <LineChart data={weeklyTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Presentes"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
