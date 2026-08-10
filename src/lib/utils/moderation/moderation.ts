import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRoleClaim = Database["public"]["Enums"]["app_role"];
export type AppRole = Exclude<AppRoleClaim, "user">;

export const normalizeAppRoleClaim = (value: unknown): AppRoleClaim | null => {
  if (
    value === "user" ||
    value === "moderator" ||
    value === "admin" ||
    value === "developer"
  ) {
    return value;
  }
  return null;
};

export const isModerationAppRole = (
  role: AppRoleClaim | null,
): role is AppRole =>
  role === "moderator" || role === "admin" || role === "developer";

export const getElevatedAppRole = (
  role: AppRoleClaim | null,
): AppRole | null => (isModerationAppRole(role) ? role : null);

export const getUserAppRole = async (
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AppRole | null> => {
  const { data, error } = await supabase
    .from("app_role_assignments")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return getElevatedAppRole(data?.role ?? null);
};

export const canModerateTargetRole = (
  actorRole: AppRole,
  targetRole: AppRole | null,
) => {
  if (targetRole === "admin" || targetRole === "developer") return false;
  if (actorRole === "moderator" && targetRole !== null) return false;
  return true;
};

export const isActiveAccountBlock = (
  status: string,
  expiresAt: string | null,
  now = Date.now(),
) => {
  if (status === "banned") return true;
  if (status !== "suspended" || !expiresAt) return false;
  return new Date(expiresAt).getTime() > now;
};
