import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ConfirmDeleteModal } from "@/components/ebd/ConfirmDeleteModal";
import { DashboardTab } from "@/components/ebd/DashboardTab";
import { Card, Shell, btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from "@/components/ebd/Shell";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { supabase } from "@/integrations/supabase/client";
import { fetchClasses, fetchStudents, fetchTeachers, formatBR } from "@/lib/ebd";
import { deleteAppUser, listAppUsers } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel da Superintendência | Sistema EBD SIBO" },
      { name: "description", content: "Painel de gestão da EBD — classes, alunos e superintendentes." },
      { property: "og:title", content: "Painel da Superintendência | Sistema EBD SIBO" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Painel,
});

type Tab = "dashboard" | "classes" | "alunos" | "superintendentes";

const TAB_LABELS: Record<Tab, string> = {
  dashboard: "Dashboard",
  classes: "Classes",
  alunos: "Alunos",
  superintendentes: "Superintendentes",
};

function Painel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [name, setName] = useState("");

  // ── Realtime sync ──────────────────────────────────────────────────────────
  useRealtimeSync();

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { full_name?: string } | undefined;
      setName(meta?.full_name ?? data.user?.email ?? "");
    });
  }, []);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["classes"] });
    void queryClient.invalidateQueries({ queryKey: ["students"] });
    void queryClient.invalidateQueries({ queryKey: ["teachers"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Shell
      subtitle="Painel da Superintendência"
      actions={
        <>
          <span className="rounded-lg bg-white/15 px-3 py-1.5 text-sm">Olá, {name}</span>
          <Link to="/encerramento" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">
            Encerramento
          </Link>
          <Link to="/relatorios" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">
            Comparativos
          </Link>
          <button type="button" onClick={signOut} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">
            Sair
          </button>
        </>
      }
    >
      {/* Tab bar */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(["dashboard", "classes", "alunos", "superintendentes"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={tab === t ? btnPrimary : btnGhost}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "classes" && <ClassesTab classes={classes} onChange={invalidate} />}
      {tab === "alunos" && <StudentsTab students={students} classes={classes} onChange={invalidate} />}
      {tab === "superintendentes" && <SuperintendentesTab />}
    </Shell>
  );
}

// ─── useSaver ─────────────────────────────────────────────────────────────────

function useSaver(onChange: () => void) {
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => PromiseLike<{ error: unknown | null }>) => {
    const { error: err } = await fn();
    if (err) {
      setError((err as { message?: string }).message ?? "Erro ao salvar.");
      return false;
    }
    setError(null);
    onChange();
    return true;
  };
  return { error, run };
}

// ─── Classes Tab ──────────────────────────────────────────────────────────────

function ClassesTab({
  classes,
  onChange,
}: {
  classes: Awaited<ReturnType<typeof fetchClasses>>;
  onChange: () => void;
}) {
  const { error, run } = useSaver(onChange);
  const [form, setForm] = useState({ name: "", age_group: "", room: "" });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await run(() => supabase.from("classes").delete().eq("id", deleteTarget));
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <>
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        isPending={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <Card>
        <h2 className="text-base font-bold">Classes</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(() => supabase.from("classes").insert({ ...form }));
            if (ok) setForm({ name: "", age_group: "", room: "" });
          }}
        >
          <div>
            <label className={labelCls}>Nome</label>
            <input
              className={inputCls}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Faixa etária</label>
            <input
              className={inputCls}
              value={form.age_group}
              onChange={(e) => setForm({ ...form, age_group: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Sala</label>
            <input
              className={inputCls}
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
            />
          </div>
          <button type="submit" className={`${btnPrimary} self-end`}>
            Adicionar classe
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <ul className="mt-5 divide-y divide-border">
          {classes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="mr-auto">
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.age_group || "-"} · {c.room || "sem sala"} · {c.active ? "ativa" : "inativa"}
                </p>
              </div>
              <button
                type="button"
                className={btnGhost}
                onClick={() => run(() => supabase.from("classes").update({ active: !c.active }).eq("id", c.id))}
              >
                {c.active ? "Desativar" : "Ativar"}
              </button>
              <button
                type="button"
                className={btnDanger}
                onClick={() => setDeleteTarget(c.id)}
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

// ─── ViaCEP ───────────────────────────────────────────────────────────────────

type ViaCEPResult = {
  logradouro: string;
  bairro: string;
  localidade: string;
  erro?: boolean;
};

async function fetchViaCEP(cep: string): Promise<ViaCEPResult> {
  const clean = cep.replace(/\D/g, "");
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!res.ok) throw new Error("CEP não encontrado.");
  const data = (await res.json()) as ViaCEPResult;
  if (data.erro) throw new Error("CEP inválido ou não encontrado.");
  return data;
}

// ─── Students Tab ─────────────────────────────────────────────────────────────

type StudentFormState = {
  full_name: string;
  class_id: string;
  birth_date: string;
  wedding_date: string;
  phone: string;
  // Address
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  // Teacher
  is_teacher: boolean;
  teacher_class_id: string;
};

const EMPTY_STUDENT_FORM: StudentFormState = {
  full_name: "",
  class_id: "",
  birth_date: "",
  wedding_date: "",
  phone: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  is_teacher: false,
  teacher_class_id: "",
};

function StudentsTab({
  students,
  classes,
  onChange,
}: {
  students: Awaited<ReturnType<typeof fetchStudents>>;
  classes: Awaited<ReturnType<typeof fetchClasses>>;
  onChange: () => void;
}) {
  const { error, run } = useSaver(onChange);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<StudentFormState>(EMPTY_STUDENT_FORM);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const list = students.filter((s) => !filter || s.class_id === filter);

  // Auto-fill address when CEP has 8 digits
  useEffect(() => {
    const clean = form.cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    setCepError(null);
    fetchViaCEP(clean)
      .then((data) => {
        setForm((f) => ({
          ...f,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
        }));
      })
      .catch((err: unknown) => {
        setCepError(err instanceof Error ? err.message : "CEP não encontrado.");
      })
      .finally(() => setCepLoading(false));
  }, [form.cep]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await run(() => supabase.from("students").delete().eq("id", deleteTarget));
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <>
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        isPending={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <Card>
        <h2 className="text-base font-bold">Alunos</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(() =>
              supabase.from("students").insert({
                full_name: form.full_name,
                class_id: form.class_id || null,
                birth_date: form.birth_date || null,
                wedding_date: form.wedding_date || null,
                phone: form.phone || null,
                cep: form.cep || null,
                street: form.street || null,
                number: form.number || null,
                complement: form.complement || null,
                neighborhood: form.neighborhood || null,
                city: form.city || null,
                is_teacher: form.is_teacher,
                teacher_class_id: form.is_teacher && form.teacher_class_id ? form.teacher_class_id : null,
              }),
            );
            if (ok) setForm(EMPTY_STUDENT_FORM);
          }}
        >
          {/* Basic info */}
          <div className="grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nome *</label>
              <input
                className={inputCls}
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Classe</label>
              <select
                className={inputCls}
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              >
                <option value="">Sem classe</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nascimento</label>
              <input
                type="date"
                className={inputCls}
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Casamento</label>
              <input
                type="date"
                className={inputCls}
                value={form.wedding_date}
                onChange={(e) => setForm({ ...form, wedding_date: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Endereço
            </p>
            <div className="grid gap-3 sm:grid-cols-6">
              <div>
                <label className={labelCls}>CEP</label>
                <div className="relative">
                  <input
                    className={inputCls}
                    placeholder="00000-000"
                    maxLength={9}
                    value={form.cep}
                    onChange={(e) => setForm({ ...form, cep: e.target.value })}
                  />
                  {cepLoading && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
                      buscando…
                    </span>
                  )}
                </div>
                {cepError && <p className="mt-1 text-xs text-destructive">{cepError}</p>}
              </div>
              <div className="sm:col-span-3">
                <label className={labelCls}>Rua</label>
                <input
                  className={inputCls}
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Número</label>
                <input
                  className={inputCls}
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Complemento</label>
                <input
                  className={inputCls}
                  value={form.complement}
                  onChange={(e) => setForm({ ...form, complement: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Bairro</label>
                <input
                  className={inputCls}
                  value={form.neighborhood}
                  onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Cidade</label>
                <input
                  className={inputCls}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Teacher toggle */}
          <div className="flex flex-wrap items-start gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.is_teacher}
                onChange={(e) => setForm({ ...form, is_teacher: e.target.checked, teacher_class_id: "" })}
              />
              <span className="text-sm font-semibold">É Professor(a)?</span>
            </label>
            {form.is_teacher && (
              <div className="flex-1 min-w-48">
                <label className={labelCls}>Classe que Leciona</label>
                <select
                  className={inputCls}
                  value={form.teacher_class_id}
                  onChange={(e) => setForm({ ...form, teacher_class_id: e.target.value })}
                >
                  <option value="">Selecione a classe</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button type="submit" className={btnPrimary}>
            Adicionar aluno
          </button>
        </form>

        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

        {/* Filter */}
        <div className="mt-6 max-w-64">
          <label className={labelCls}>Filtrar por classe</label>
          <select className={inputCls} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todas as classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <ul className="mt-4 divide-y divide-border">
          {list.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="mr-auto">
                <p className="text-sm font-semibold">
                  {s.full_name}
                  {s.is_teacher && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      Professor(a)
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {classes.find((c) => c.id === s.class_id)?.name ?? "Sem classe"} · nasc.{" "}
                  {formatBR(s.birth_date)}
                  {s.city ? ` · ${s.city}` : ""}
                </p>
              </div>
              <select
                className={`${inputCls} max-w-52`}
                value={s.class_id ?? ""}
                onChange={(e) =>
                  run(() =>
                    supabase.from("students").update({ class_id: e.target.value || null }).eq("id", s.id),
                  )
                }
              >
                <option value="">Sem classe</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                className={btnDanger}
                onClick={() => setDeleteTarget(s.id)}
              >
                Excluir
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">Nenhum aluno encontrado.</li>
          )}
        </ul>
      </Card>
    </>
  );
}

// ─── Superintendentes Tab ─────────────────────────────────────────────────────

function SuperintendentesTab() {
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrentId(data.user?.id ?? null));
  }, []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["app-users"],
    queryFn: () => listAppUsers(),
  });

  const del = useMutation({
    mutationFn: (userId: string) => deleteAppUser({ data: { userId } }),
    onSuccess: () => {
      setError(null);
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (err: unknown) => {
      setDeleteTarget(null);
      setError(err instanceof Error ? err.message : "Não foi possível excluir o superintendente.");
    },
  });

  return (
    <>
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        isPending={del.isPending}
        onConfirm={() => { if (deleteTarget) del.mutate(deleteTarget); }}
        onCancel={() => setDeleteTarget(null)}
      />
      <Card>
        <h2 className="text-base font-bold">Superintendentes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Integrantes com acesso à superintendência. Exclua aqui contas criadas por engano.
        </p>
        {error ? <p className="mt-2 text-sm font-medium text-destructive">{error}</p> : null}
        {isLoading ? (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="mr-auto">
                  <p className="text-sm font-semibold">
                    {u.full_name || u.username}
                    {u.id === currentId ? (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        você
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    usuário: {u.username ?? "-"} · cadastrado em {formatBR(u.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  className={`${btnDanger} disabled:opacity-50`}
                  disabled={u.id === currentId}
                  onClick={() => setDeleteTarget(u.id)}
                >
                  Excluir
                </button>
              </li>
            ))}
            {users.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">Nenhum superintendente cadastrado.</li>
            )}
          </ul>
        )}
      </Card>
    </>
  );
}
