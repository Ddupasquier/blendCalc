import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import type { AppRole } from "$lib/utils/moderation/moderation";

type AuthUser = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
	avatarAltText: string | null;
	role: AppRole | null;
};

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{
				session: Session | null;
				user: User | null;
			}>;
			session: Session | null;
			user: User | null;
		}
		interface PageData {
			authUser: AuthUser | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
