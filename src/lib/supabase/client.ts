import { browser } from "$app/environment";
import {
	PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	PUBLIC_SUPABASE_URL,
} from "$env/static/public";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import { getLocalSupabaseAuthCookieName } from "$lib/supabase/authCookie";

let browserClient: SupabaseClient<Database> | null = null;

export const getSupabaseBrowserClient = () => {
	if (!browser) return null;
	const localAuthCookieName =
		getLocalSupabaseAuthCookieName(PUBLIC_SUPABASE_URL);

	browserClient ??= createBrowserClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		localAuthCookieName
			? { cookieOptions: { name: localAuthCookieName } }
			: undefined,
	);

	return browserClient;
};
