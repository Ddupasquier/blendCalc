import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import type { VerifiedAuthUser } from "$lib/utils/auth/types";
import type { AppRole } from "$lib/utils/moderation/moderation";
import type { RequestContext } from "@sveltejs/adapter-vercel";
import type {
	IngredientPageInitialData,
	MixPageInitialData,
	SavedPageInitialData,
} from "$lib/types/userData";
import type {
	AppIssueCode,
	AppIssueParams,
} from "$lib/utils/errors/appIssues";

type AuthUser = {
	id: string;
	displayName: string;
	welcomeName: string;
	avatarUrl: string | null;
	avatarAltText: string | null;
	role: AppRole | null;
};

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: AppIssueCode;
			params?: AppIssueParams;
		}
		interface Locals {
			supabase: SupabaseClient<Database>;
			getVerifiedUser: () => Promise<VerifiedAuthUser | null>;
			user: VerifiedAuthUser | null;
		}
		interface PageData {
			authUser: AuthUser | null;
			ingredientData?: IngredientPageInitialData;
			mixData?: MixPageInitialData;
			savedData?: SavedPageInitialData;
		}
		// interface PageState {}
		interface Platform {
			context?: RequestContext;
		}
	}
}

export {};
