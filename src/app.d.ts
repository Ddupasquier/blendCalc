import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import type { VerifiedAuthUser } from "$lib/utils/auth/types";
import type { AppRole } from "$lib/utils/moderation/moderation";
import type { RequestContext } from "@sveltejs/adapter-vercel";
import type { IngredientPageInitialData } from "$lib/types/pageData/ingredientPageData";
import type { MixPageInitialData } from "$lib/types/pageData/mixPageData";
import type { SavedRecipesPageInitialData } from "$lib/types/pageData/savedRecipesPageData";
import type { AppIssueCode, AppIssueParams } from "$lib/utils/errors/appIssues";
import type { ThemePreference } from "$lib/utils/theme/themePreference";
import type { BlendCalcAPIDatabaseObservation } from "$lib/server/blendCalcAPI/operations/blendCalcAPIOperations.server";

type AuthUser = {
	id: string;
	displayName: string;
	welcomeName: string;
	avatarUrl: string | null;
	avatarAltText: string | null;
	role: AppRole | null;
	themePreference: ThemePreference;
	playfulMessagesEnabled: boolean;
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
			serverTimings?: Record<string, number>;
			blendCalcAPIDatabaseObservation?: BlendCalcAPIDatabaseObservation;
		}
		interface PageData {
			authUser: AuthUser | null;
			themePreference: ThemePreference;
			ingredientData?: IngredientPageInitialData;
			mixData?: MixPageInitialData;
			savedData?: SavedRecipesPageInitialData;
		}
		interface PageState {
			ingredientRouteHref?: string;
			mixRouteHref?: string;
			profileRouteHref?: string;
			savedRecipesRouteHref?: string;
		}
		interface Platform {
			context?: RequestContext;
		}
	}
}

export {};
