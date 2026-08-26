import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { AppPermission, AppRole } from "$lib/utils/moderation/moderation";

export const readAppRolePermissions = async (
	role: AppRole,
): Promise<AppPermission[]> => {
	const { data, error } = await getSupabaseAdminClient()
		.from("app_role_permissions")
		.select("permission")
		.eq("role", role)
		.order("permission");

	if (error) throw error;
	return data.map(({ permission }) => permission);
};
