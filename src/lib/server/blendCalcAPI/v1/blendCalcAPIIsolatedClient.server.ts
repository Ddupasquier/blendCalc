import { env } from "$env/dynamic/private";
import type { Database as BlendCalcAPIDatabase } from "../../../../../infrastructure/blendCalcAPI/supabase/database.types";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type BlendCalcAPIReadMode = "source" | "shadow" | "isolated";
export type BlendCalcAPIIsolatedClient = SupabaseClient<
	BlendCalcAPIDatabase,
	"blendcalc_api"
>;

let isolatedClient: BlendCalcAPIIsolatedClient | null = null;

export const readBlendCalcAPIReadMode = (): BlendCalcAPIReadMode => {
	const mode = env.BLENDCALC_API_READ_MODE?.trim().toLowerCase();
	return mode === "shadow" || mode === "isolated" ? mode : "source";
};

export const getBlendCalcAPIIsolatedClient = () => {
	if (isolatedClient) return isolatedClient;
	const url = env.BLENDCALC_API_SUPABASE_URL?.trim();
	const serviceRoleKey = env.BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!url || !serviceRoleKey) {
		throw new Error("The isolated blendCalcAPI database is not configured.");
	}
	isolatedClient = createClient<BlendCalcAPIDatabase, "blendcalc_api">(
		url,
		serviceRoleKey,
		{
			db: { schema: "blendcalc_api" },
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false,
			},
		},
	);
	return isolatedClient;
};
