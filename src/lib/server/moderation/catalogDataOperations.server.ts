import { throwAppError } from "$lib/server/errors/appError.server";
import type { Database } from "$lib/types/database.types";
import {
	parseCatalogDataOperationsHealth,
	type CatalogDataOperationsHealth,
} from "$lib/utils/moderation/catalogDataOperationsHealth";
import {
	createUnavailableCatalogMonitorModerationSummary,
	parseCatalogMonitorModerationSummary,
	type CatalogMonitorModerationSummary,
} from "$lib/utils/moderation/catalogMonitorModeration";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_METRIC_WINDOW_DAYS = 30;
const DEFAULT_ISSUE_LIMIT = 20;

export const isCatalogMonitorSchemaUnavailable = (
	error: { code?: string; message?: string } | null | undefined,
) => {
	const message = error?.message?.toLowerCase() ?? "";
	return (
		(error?.code === "42883" || error?.code === "PGRST202") &&
		message.includes("get_catalog_data_operations_monitor_summary")
	);
};

export const readCatalogDataOperationsHealth = async (
	supabase: SupabaseClient<Database>,
): Promise<CatalogDataOperationsHealth> => {
	const { data, error } = await supabase.rpc("get_catalog_data_operations_health", {
		p_days: DEFAULT_METRIC_WINDOW_DAYS,
		p_issue_limit: DEFAULT_ISSUE_LIMIT,
	});

	if (error || data === null) {
		throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}

	try {
		return parseCatalogDataOperationsHealth(data);
	} catch {
		return throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}
};

export const readCatalogMonitorModerationSummary = async (
	supabase: SupabaseClient<Database>,
): Promise<CatalogMonitorModerationSummary> => {
	const { data, error } = await supabase.rpc(
		"get_catalog_data_operations_monitor_summary",
		{ p_limit: DEFAULT_ISSUE_LIMIT },
	);
	if (isCatalogMonitorSchemaUnavailable(error)) {
		return createUnavailableCatalogMonitorModerationSummary();
	}
	if (error || data === null) throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	try {
		return parseCatalogMonitorModerationSummary(data);
	} catch {
		return throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}
};
