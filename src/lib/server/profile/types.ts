import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";

export type ProfilePageDataReaderOptions = {
	supabase: SupabaseClient<Database>;
	userId: string;
};
