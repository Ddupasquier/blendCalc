import type { User } from "@supabase/supabase-js";

export type VerifiedAuthUser = Pick<
	User,
	"id" | "email" | "app_metadata" | "user_metadata"
>;
