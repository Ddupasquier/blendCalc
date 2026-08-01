import type { User } from "@supabase/supabase-js";
import type { AppRoleClaim } from "$lib/utils/moderation/moderation";

export type VerifiedAuthUser = Pick<
	User,
	"id" | "email" | "app_metadata" | "user_metadata"
> & {
	appRoleClaim: AppRoleClaim | null;
};
