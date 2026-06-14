import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "moderator" | "admin";

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
	return (data?.role as AppRole | undefined) ?? null;
};

export const canModerateTargetRole = (
	actorRole: AppRole,
	targetRole: AppRole | null,
) => {
	if (targetRole === "admin") return false;
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
