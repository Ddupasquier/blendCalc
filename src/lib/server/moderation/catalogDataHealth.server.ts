import { throwAppError } from "$lib/server/errors/appError.server";
import type { Database } from "$lib/types/database.types";
import {
	parseModeratorDataHealth,
	type ModeratorDataHealth,
} from "$lib/utils/moderation/dataHealth";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_METRIC_WINDOW_DAYS = 30;
const DEFAULT_ISSUE_LIMIT = 20;

export const readModeratorDataHealth = async (
	supabase: SupabaseClient<Database>,
): Promise<ModeratorDataHealth> => {
	const { data, error } = await supabase.rpc("get_moderator_data_health", {
		p_days: DEFAULT_METRIC_WINDOW_DAYS,
		p_issue_limit: DEFAULT_ISSUE_LIMIT,
	});

	if (error || data === null) {
		throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}

	try {
		return parseModeratorDataHealth(data);
	} catch {
		return throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}
};
