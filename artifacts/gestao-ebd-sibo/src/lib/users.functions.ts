import { supabase } from "@/integrations/supabase/client";

export type AppUser = {
  id: string;
  full_name: string;
  username: string | null;
  created_at: string;
};

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(`/api/admin/users${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as { message?: string } | T | null;
  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : "Não foi possível concluir a operação.",
    );
  }
  return payload as T;
}

/**
 * List all profiles (users with access to the superintendent panel).
 * Compatible with TanStack Start server function call signature.
 */
export async function listAppUsers(_?: unknown): Promise<AppUser[]> {
  return adminRequest<AppUser[]>("");
}

/**
 * Delete a user profile from the system.
 * Accepts TanStack Start server function call signature: { data: { userId } }
 */
export async function deleteAppUser(input: { data: { userId: string } } | string): Promise<{ ok: boolean }> {
  const userId = typeof input === "string" ? input : input.data.userId;
  return adminRequest<{ ok: boolean }>(`/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export type AppUserInput = { fullName: string; username: string; password?: string };

export function createAppUser(input: AppUserInput) {
  return adminRequest<AppUser>("/", { method: "POST", body: JSON.stringify(input) });
}

export function updateAppUser(userId: string, input: AppUserInput) {
  return adminRequest<AppUser | { ok: boolean }>(`/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
