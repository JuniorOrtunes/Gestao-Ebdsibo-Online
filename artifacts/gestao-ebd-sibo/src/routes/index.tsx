import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Card, btnGhost, btnPrimary, inputCls, labelCls } from "@/components/ebd/Shell";
import { CHURCH_NAME, LOGO_URL, fetchClasses } from "@/lib/ebd";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sistema EBD - Segunda Igreja Batista de Osasco" },
      {
        name: "description",
        content:
          "Controle da Escola Bíblica Dominical da Segunda Igreja Batista de Osasco: classes, alunos, presenças, visitantes e relatórios.",
      },
      { property: "og:title", content: "Sistema EBD - Segunda Igreja Batista de Osasco" },
      {
        property: "og:description",
        content:
          "Controle da Escola Bíblica Dominical da Segunda Igreja Batista de Osasco: classes, alunos, presenças, visitantes e relatórios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [classId, setClassId] = useState("");
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: fetchClasses,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={LOGO_URL} alt="Logo da Segunda Igreja Batista de Osasco" className="h-20 w-20 object-contain" />
          <h1 className="mt-3 text-2xl font-bold text-foreground">Sistema EBD</h1>
          <p className="text-sm text-muted-foreground">{CHURCH_NAME}</p>
        </div>

        <Card>
          <h2 className="text-base font-bold text-foreground">Sou professor(a)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione sua classe para registrar a chamada do domingo.
          </p>
          <div className="mt-4">
            <label className={labelCls} htmlFor="classe">
              <span translate="no" className="notranslate">Classe</span>
            </label>
            <select
              id="classe"
              className={inputCls}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="" translate="no" className="notranslate">{isLoading ? "Carregando..." : "Selecione a classe"}</option>
              {classes
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="button"
            className={`${btnPrimary} mt-4 w-full`}
            disabled={!classId}
            onClick={() => navigate({ to: "/chamada", search: { classe: classId } })}
          >
            Entrar na chamada
          </button>
        </Card>

        <Card className="mt-4">
          <h2 className="text-base font-bold text-foreground">Superintendência</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesso com nome de usuário e senha para cadastros, encerramento da EBD e relatório geral.
          </p>
          <Link to="/auth" className={`${btnGhost} mt-4 w-full`}>
            Entrar com nome de usuário e senha
          </Link>
        </Card>
      </div>
    </div>
  );
}
