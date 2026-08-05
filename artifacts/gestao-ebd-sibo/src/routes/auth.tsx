import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

import { Card, btnGhost, btnPrimary, inputCls, labelCls } from "@/components/ebd/Shell";
import { supabase } from "@/integrations/supabase/client";
import { CHURCH_NAME, LOGO_URL } from "@/lib/ebd";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso da Superintendência | Sistema EBD SIBO" },
      {
        name: "description",
        content:
          "Área restrita da superintendência da Escola Bíblica Dominical da Segunda Igreja Batista de Osasco.",
      },
      { property: "og:title", content: "Acesso da Superintendência | Sistema EBD SIBO" },
      {
        property: "og:description",
        content: "Área restrita da superintendência da EBD da Segunda Igreja Batista de Osasco.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  const passwordMismatch = mode === "signup" && confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    !loading && (mode === "login" || (password.length >= 6 && password === confirmPassword));

  function toAuthEmail(value: string) {
    const slug = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]+/g, ".")
      .replace(/^\.+|\.+$/g, "");
    return { slug, email: `${slug}@ebd.local` };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { slug, email } = toAuthEmail(username);
      if (!slug) {
        setError("Informe um nome de usuário válido.");
        return;
      }
      if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("As senhas não coincidem.");
          return;
        }
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName || username, username: slug },
          },
        });
        if (err) throw err;
        if (!data.session) {
          setMessage("Cadastro criado. Agora entre com seu nome de usuário e senha.");
          return;
        }
        navigate({ to: "/painel", replace: true });
        return;
      }
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      navigate({ to: "/painel", replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(
        /invalid login credentials/i.test(raw)
          ? "Nome de usuário ou senha incorretos."
          : raw || "Não foi possível concluir o acesso.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <button
          type="button"
          className="mb-4 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => navigate({ to: "/", replace: true })}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={LOGO_URL} alt="Logo da Segunda Igreja Batista de Osasco" className="h-16 w-16 object-contain" />
          <h1 className="mt-3 text-xl font-bold text-foreground">Superintendência da EBD</h1>
          <p className="text-sm text-muted-foreground">{CHURCH_NAME}</p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" ? (
              <div>
                <label className={labelCls} htmlFor="nome">
                  Nome completo
                </label>
                <input
                  id="nome"
                  className={inputCls}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            ) : null}
            <div>
              <label className={labelCls} htmlFor="usuario">
                Nome de usuário
              </label>
              <input
                id="usuario"
                type="text"
                autoComplete="username"
                placeholder="ex.: carlos"
                className={inputCls}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={40}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="senha">
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={`${inputCls} pr-10`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {mode === "signup" ? (
              <div>
                <label className={labelCls} htmlFor="confirmar-senha">
                  Confirmar senha
                </label>
                <div className="relative">
                  <input
                    id="confirmar-senha"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    className={`${inputCls} pr-10 ${passwordMismatch ? "border-destructive" : ""}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwordMismatch ? (
                  <p className="mt-1 text-sm font-medium text-destructive">As senhas não coincidem.</p>
                ) : null}
              </div>
            ) : null}
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            {message ? <p className="text-sm font-medium text-foreground">{message}</p> : null}
            <button type="submit" className={`${btnPrimary} w-full disabled:opacity-60`} disabled={!canSubmit}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar acesso"}
            </button>
          </form>
          <button
            type="button"
            className={`${btnGhost} mt-3 w-full`}
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setMessage(null);
              setConfirmPassword("");
            }}
          >
            {mode === "login" ? "Cadastrar novo integrante" : "Já tenho acesso"}
          </button>
        </Card>
      </div>
    </div>
  );
}