import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import {
	parseCatalogHealthRepairResult,
	type CatalogHealthRepairResult,
} from "$lib/utils/moderation/catalogHealthRepair";

export type CatalogHealthRepairFailureReason =
	| "issue_unavailable"
	| "dry_run_required"
	| "repair_not_supported"
	| "service_unavailable";

export class CatalogHealthRepairError extends Error {
	constructor(readonly reason: CatalogHealthRepairFailureReason) {
		super(reason);
		this.name = "CatalogHealthRepairError";
	}
}

const classifyCatalogHealthRepairFailure = (
	error: { code?: string; message?: string },
): CatalogHealthRepairFailureReason => {
	if (error.code === "P0002") return "issue_unavailable";
	const message = error.message?.toLowerCase() ?? "";
	if (message.includes("dry run")) return "dry_run_required";
	if (message.includes("does not support")) return "repair_not_supported";
	return "service_unavailable";
};

export const runCatalogHealthRepair = async (
	supabase: SupabaseClient<Database>,
	request: {
		occurrenceKey: string;
		apply: boolean;
		dryRunId: string | null;
	},
): Promise<CatalogHealthRepairResult> => {
	const { data, error } = await supabase.rpc("run_catalog_health_repair", {
		p_occurrence_key: request.occurrenceKey,
		p_apply: request.apply,
		p_dry_run_id: request.dryRunId ?? undefined,
	});

	if (error) {
		throw new CatalogHealthRepairError(classifyCatalogHealthRepairFailure(error));
	}

	try {
		return parseCatalogHealthRepairResult(data);
	} catch {
		throw new CatalogHealthRepairError("service_unavailable");
	}
};
