import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; username?: string };
};

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  created_at: string;
  role?: string;
};

function getConfig() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) {
    throw new Error("A configuração administrativa do Supabase está incompleta.");
  }
  return { url: url.replace(/\/$/, ""), serviceKey };
}

function authToken(req: Request): string | null {
  const value = req.header("authorization");
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : null;
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit,
  config: ReturnType<typeof getConfig>,
): Promise<{ data: T | null; error: string | null; status: number }> {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : text || `Supabase respondeu com status ${response.status}.`;
    return { data, error: message, status: response.status };
  }
  return { data, error: null, status: response.status };
}

async function requireAdministrator(req: Request) {
  const config = getConfig();
  const token = authToken(req);
  if (!token) {
    return { config, user: null as SupabaseUser | null, error: "Sessão não encontrada.", status: 401 };
  }

  const current = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!current.ok) {
    return { config, user: null as SupabaseUser | null, error: "Sessão inválida ou expirada.", status: 401 };
  }
  const user = (await current.json()) as SupabaseUser;
  const profile = await supabaseRequest<Pick<Profile, "role">[]>(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
    { method: "GET" },
    config,
  );
  const role = profile.data?.[0]?.role;
  if (role !== "admin" && role !== "superintendencia") {
    return { config, user: null as SupabaseUser | null, error: "Acesso administrativo não autorizado.", status: 403 };
  }
  return { config, user, error: null, status: 200 };
}

function usernameToEmail(username: string) {
  const slug = username
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return { slug, email: `${slug}@ebd.local` };
}

function sendError(res: Response, status: number, message: string) {
  res.status(status).json({ message });
}

router.get("/admin/users", async (req, res) => {
  try {
    const access = await requireAdministrator(req);
    if (access.error) return sendError(res, access.status, access.error);
    const result = await supabaseRequest<Profile[]>(
      "/rest/v1/profiles?select=id,full_name,username,created_at&order=created_at.asc",
      { method: "GET" },
      access.config,
    );
    if (result.error) return sendError(res, result.status, result.error);
    return res.json(result.data ?? []);
  } catch (error) {
    req.log.error({ err: error }, "Failed to list administrative users");
    return sendError(res, 500, error instanceof Error ? error.message : "Não foi possível carregar os usuários.");
  }
});

router.post("/admin/users", async (req, res) => {
  try {
    const access = await requireAdministrator(req);
    if (access.error) return sendError(res, access.status, access.error);

    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const { slug, email } = usernameToEmail(username);
    if (!slug || slug.length > 40) return sendError(res, 400, "Informe um nome de usuário válido.");
    if (!fullName) return sendError(res, 400, "Informe o nome completo.");
    if (password.length < 6) return sendError(res, 400, "A senha deve ter pelo menos 6 caracteres.");

    const created = await supabaseRequest<SupabaseUser>(
      "/auth/v1/admin/users",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, username: slug },
        }),
      },
      access.config,
    );
    if (created.error || !created.data) return sendError(res, created.status, created.error ?? "Não foi possível criar o usuário.");

    const profile = await supabaseRequest<Profile[]>(
      "/rest/v1/profiles?on_conflict=id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          id: created.data.id,
          full_name: fullName,
          username: slug,
          role: "superintendencia",
        }),
      },
      access.config,
    );
    if (profile.error) return sendError(res, profile.status, profile.error);
    return res.status(201).json(profile.data?.[0] ?? { id: created.data.id, full_name: fullName, username: slug });
  } catch (error) {
    req.log.error({ err: error }, "Failed to create administrative user");
    return sendError(res, 500, error instanceof Error ? error.message : "Não foi possível criar o usuário.");
  }
});

router.patch("/admin/users/:userId", async (req, res) => {
  try {
    const access = await requireAdministrator(req);
    if (access.error) return sendError(res, access.status, access.error);

    const userId = req.params.userId;
    const username = typeof req.body?.username === "string" ? req.body.username : undefined;
    const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : undefined;
    const password = typeof req.body?.password === "string" ? req.body.password : undefined;
    const updates: Record<string, unknown> = {};
    if (username !== undefined) {
      const converted = usernameToEmail(username);
      if (!converted.slug || converted.slug.length > 40) return sendError(res, 400, "Informe um nome de usuário válido.");
      updates.username = converted.slug;
    }
    if (fullName !== undefined) {
      if (!fullName) return sendError(res, 400, "Informe o nome completo.");
      updates.full_name = fullName;
    }
    if (password !== undefined && password.length > 0 && password.length < 6) {
      return sendError(res, 400, "A senha deve ter pelo menos 6 caracteres.");
    }
    if (Object.keys(updates).length === 0 && !password) return sendError(res, 400, "Nenhuma alteração informada.");

    if (Object.keys(updates).length > 0 || password) {
      const usernameEmail = username === undefined ? undefined : usernameToEmail(username).email;
      const authUpdate = await supabaseRequest<SupabaseUser>(
        `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...(password ? { password } : {}),
            ...(usernameEmail ? { email: usernameEmail, email_confirm: true } : {}),
            ...(updates.full_name || updates.username
              ? { user_metadata: { ...(updates.full_name ? { full_name: updates.full_name } : {}), ...(updates.username ? { username: updates.username } : {}) } }
              : {}),
          }),
        },
        access.config,
      );
      if (authUpdate.error) return sendError(res, authUpdate.status, authUpdate.error);
    }

    if (Object.keys(updates).length > 0) {
      const profile = await supabaseRequest<Profile[]>(
        `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(updates),
        },
        access.config,
      );
      if (profile.error) return sendError(res, profile.status, profile.error);
      return res.json(profile.data?.[0] ?? updates);
    }
    return res.json({ ok: true });
  } catch (error) {
    req.log.error({ err: error }, "Failed to update administrative user");
    return sendError(res, 500, error instanceof Error ? error.message : "Não foi possível atualizar o usuário.");
  }
});

router.delete("/admin/users/:userId", async (req, res) => {
  try {
    const access = await requireAdministrator(req);
    if (access.error) return sendError(res, access.status, access.error);
    if (access.user?.id === req.params.userId) return sendError(res, 400, "Você não pode excluir a sua própria conta.");

    const deleted = await supabaseRequest<unknown>(
      `/auth/v1/admin/users/${encodeURIComponent(req.params.userId)}`,
      { method: "DELETE" },
      access.config,
    );
    if (deleted.error) return sendError(res, deleted.status, deleted.error);
    await supabaseRequest<unknown>(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(req.params.userId)}`,
      { method: "DELETE" },
      access.config,
    );
    return res.json({ ok: true });
  } catch (error) {
    req.log.error({ err: error }, "Failed to delete administrative user");
    return sendError(res, 500, error instanceof Error ? error.message : "Não foi possível excluir o usuário.");
  }
});

export default router;