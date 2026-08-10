import type { Database } from "$lib/types/database.types";
import type { VerifiedAuthUser } from "$lib/utils/auth/types";
import { normalizeAppRoleClaim } from "$lib/utils/moderation/moderation";
import type { SupabaseClient } from "@supabase/supabase-js";

type VerifiedAuthUserOptions = {
	requireCurrentAuthRecord?: boolean;
};

export const readVerifiedAuthUser = async (
	supabase: SupabaseClient<Database>,
	options: VerifiedAuthUserOptions = {},
): Promise<VerifiedAuthUser | null> => {
	if (options.requireCurrentAuthRecord) {
		const { data, error } = await supabase.auth.getUser();
		if (error || !data.user) return null;

		return {
			id: data.user.id,
			email: data.user.email,
			app_metadata: data.user.app_metadata,
			user_metadata: data.user.user_metadata,
			appRoleClaim: null,
		};
	}

	const { data, error } = await supabase.auth.getClaims();
	const claims = data?.claims;
	if (error || !claims?.sub) return null;

	return {
		id: claims.sub,
		email: typeof claims.email === "string" ? claims.email : undefined,
		app_metadata: claims.app_metadata ?? {},
		user_metadata: claims.user_metadata ?? {},
		appRoleClaim: normalizeAppRoleClaim(claims.app_role),
	};
};
