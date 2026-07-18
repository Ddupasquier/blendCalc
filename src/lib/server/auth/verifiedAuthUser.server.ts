import type { Database } from "$lib/types/database.types";
import type { VerifiedAuthUser } from "$lib/utils/auth/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const readVerifiedAuthUser = async (
	supabase: SupabaseClient<Database>,
): Promise<VerifiedAuthUser | null> => {
	const { data, error } = await supabase.auth.getClaims();
	const claims = data?.claims;
	if (error || !claims?.sub) return null;

	return {
		id: claims.sub,
		email: typeof claims.email === "string" ? claims.email : undefined,
		app_metadata: claims.app_metadata ?? {},
		user_metadata: claims.user_metadata ?? {},
	};
};
