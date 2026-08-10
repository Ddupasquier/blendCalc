import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import type { AppRole } from "$lib/utils/moderation/moderation";

export type ProfilePageDataReaderOptions = {
	supabase: SupabaseClient<Database>;
	userId: string;
	appRole: AppRole | null;
};
