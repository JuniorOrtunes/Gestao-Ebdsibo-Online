import { supabase } from "@/integrations/supabase/client";

export type AppUser = {
  id: string;
  full_name: string;
  username: string | null;
  created_at: string;
};

/**
 * List all profiles (users with access to the superintendent panel).
 * Compatible with TanStack Start server function call signature.
 */
export async function listAppUsers(_?: unknown): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AppUser[];
}

/**
 * Delete a user profile from the system.
 * Accepts TanStack Start server function call signature: { data: { userId } }
 */
export async function deleteAppUser(input: { data: { userId: string } } | string): Promise<{ ok: boolean }> {
  const userId = typeof input === "string" ? input : input.data.userId;

  // Get current user to prevent self-deletion
  const { data: currentUser } = await supabase.auth.getUser();
  if (currentUser.user?.id === userId) {
    throw new Error("Você não pode excluir a sua própria conta.");
  }

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (error) throw new Error(error.message);
  return { ok: true };
}
