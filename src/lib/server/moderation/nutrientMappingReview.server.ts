import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import {
	parseNutrientMappingReviewDecisionResult,
	parseNutrientMappingReviewWorkspace,
	type NutrientMappingReviewDecisionResult,
	type NutrientMappingReviewWorkspace,
} from "$lib/utils/moderation/nutrientMappingReview";

export type NutrientMappingReviewFailureReason =
	| "mapping_unavailable"
	| "mapping_resolved"
	| "invalid_unit_path"
	| "service_unavailable";

export class NutrientMappingReviewError extends Error {
	constructor(readonly reason: NutrientMappingReviewFailureReason) {
		super(reason);
		this.name = "NutrientMappingReviewError";
	}
}

const classifyNutrientMappingReviewFailure = (error: {
	code?: string;
	message?: string;
}): NutrientMappingReviewFailureReason => {
	if (error.code === "P0002") return "mapping_unavailable";
	const message = error.message?.toLocaleLowerCase() ?? "";
	if (message.includes("no longer waiting for review"))
		return "mapping_resolved";
	if (message.includes("no reviewed conversion")) return "invalid_unit_path";
	return "service_unavailable";
};

export const readNutrientMappingReviewWorkspace = async (
	supabase: SupabaseClient<Database>,
	mappingId: string,
): Promise<NutrientMappingReviewWorkspace> => {
	const { data, error } = await supabase.rpc(
		"get_nutrient_mapping_review_workspace",
		{ p_mapping_id: mappingId },
	);
	if (error || data === null) {
		throw new NutrientMappingReviewError(
			error
				? classifyNutrientMappingReviewFailure(error)
				: "service_unavailable",
		);
	}
	try {
		return parseNutrientMappingReviewWorkspace(data);
	} catch {
		throw new NutrientMappingReviewError("service_unavailable");
	}
};

export const decideNutrientMappingReview = async (
	supabase: SupabaseClient<Database>,
	request: {
		mappingId: string;
		outcome: "approved" | "excluded";
		selectedNutrientId: number | null;
		reviewNote: string;
		evidenceReference: string | null;
	},
): Promise<NutrientMappingReviewDecisionResult> => {
	const { data, error } = await supabase.rpc("review_nutrient_source_mapping", {
		p_mapping_id: request.mappingId,
		p_outcome: request.outcome,
		p_review_note: request.reviewNote,
		...(request.selectedNutrientId === null
			? {}
			: { p_selected_nutrient_id: request.selectedNutrientId }),
		...(request.evidenceReference === null
			? {}
			: { p_evidence_reference: request.evidenceReference }),
	});
	if (error || data === null) {
		throw new NutrientMappingReviewError(
			error
				? classifyNutrientMappingReviewFailure(error)
				: "service_unavailable",
		);
	}
	try {
		return parseNutrientMappingReviewDecisionResult(data);
	} catch {
		throw new NutrientMappingReviewError("service_unavailable");
	}
};
