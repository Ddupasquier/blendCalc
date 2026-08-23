import { fail, type RequestEvent } from "@sveltejs/kit";
import { throwAppError } from "$lib/server/errors/appError.server";
import {
	decideNutrientMappingReview,
	NutrientMappingReviewError,
	readNutrientMappingReviewWorkspace,
} from "$lib/server/moderation/nutrientMappingReview.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import type { NutrientMappingReviewActionData } from "$lib/utils/moderation/nutrientMappingReview";

const NUTRIENT_MAPPING_REVIEW_ROUTE =
	"/profile/privileged-tools/data-operations/nutrient-mappings";
const NUTRIENT_MAPPING_REVIEW_FORM_MAX_BYTES = 20 * 1024;
const REVIEW_TEXT_MAX_LENGTH = 2000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type NutrientMappingReviewLoadEvent = Pick<RequestEvent, "locals" | "params">;
type NutrientMappingReviewActionEvent = Pick<
	RequestEvent,
	"locals" | "params" | "request"
>;

const getNutrientMappingReviewRoute = (mappingId: string) =>
	`${NUTRIENT_MAPPING_REVIEW_ROUTE}/${encodeURIComponent(mappingId)}`;

const getNutrientMappingReviewErrorMessage = (error: unknown) => {
	if (!(error instanceof NutrientMappingReviewError)) {
		return "This nutrient mapping could not be reviewed right now.";
	}
	if (error.reason === "mapping_unavailable") {
		return "This nutrient mapping could not be found.";
	}
	if (error.reason === "mapping_resolved") {
		return "This nutrient mapping has already been resolved. Refresh before continuing.";
	}
	if (error.reason === "invalid_unit_path") {
		return "That nutrient uses an incompatible unit. Choose one supported by the reviewed conversion data.";
	}
	return "This nutrient mapping could not be reviewed right now.";
};

export const loadNutrientMappingReviewWorkspace = async (
	{ locals, params }: NutrientMappingReviewLoadEvent,
) => {
	const mappingId = params.mappingId ?? "";
	if (!UUID_PATTERN.test(mappingId)) {
		throwAppError(404, "RESOURCE_NOT_FOUND");
	}
	const { role } = await requireModeratorPermission(
		locals,
		"data_operations.nutrient_mappings.manage",
		getNutrientMappingReviewRoute(mappingId),
	);
	return {
		viewerRole: role,
		workspace: await readNutrientMappingReviewWorkspace(
			locals.supabase,
			mappingId,
		),
	};
};

export const reviewNutrientMappingAction = async (
	{ locals, params, request }: NutrientMappingReviewActionEvent,
): Promise<NutrientMappingReviewActionData | ReturnType<typeof fail>> => {
	const mappingId = params.mappingId ?? "";
	if (!UUID_PATTERN.test(mappingId)) {
		return fail(404, {
			nutrientMappingReviewError: "This nutrient mapping could not be found.",
		});
	}
	await requireModeratorPermission(
		locals,
		"data_operations.nutrient_mappings.manage",
		getNutrientMappingReviewRoute(mappingId),
	);
	const formData = await readLimitedFormData(
		request,
		NUTRIENT_MAPPING_REVIEW_FORM_MAX_BYTES,
	);
	const outcome = String(formData.get("outcome") ?? "");
	const selectedNutrientValue = String(
		formData.get("selectedNutrientId") ?? "",
	).trim();
	const reviewNote = String(formData.get("reviewNote") ?? "").trim();
	const evidenceReference = String(
		formData.get("evidenceReference") ?? "",
	).trim();
	const selectedNutrientId = selectedNutrientValue
		? Number(selectedNutrientValue)
		: null;

	if (
		(outcome !== "approved" && outcome !== "excluded")
		|| !reviewNote
		|| reviewNote.length > REVIEW_TEXT_MAX_LENGTH
		|| evidenceReference.length > REVIEW_TEXT_MAX_LENGTH
		|| (outcome === "approved" && (
			!Number.isSafeInteger(selectedNutrientId)
			|| !evidenceReference
		))
		|| (outcome === "excluded" && selectedNutrientId !== null)
	) {
		return fail(400, {
			nutrientMappingReviewError:
				"Choose a valid decision and include the supporting review details.",
		});
	}

	try {
		const result = await decideNutrientMappingReview(locals.supabase, {
			mappingId,
			outcome,
			selectedNutrientId,
			reviewNote,
			evidenceReference: evidenceReference || null,
		});
		return {
			nutrientMappingReviewResult: result,
			nutrientMappingReviewSuccess: outcome === "approved"
				? "The nutrient mapping is approved and available for future normalized data."
				: "The candidate was excluded and removed from the review queue.",
		};
	} catch (error) {
		return fail(
			error instanceof NutrientMappingReviewError
				&& (error.reason === "mapping_resolved" || error.reason === "mapping_unavailable")
				? 409
				: 500,
			{
				nutrientMappingReviewError: getNutrientMappingReviewErrorMessage(error),
			},
		);
	}
};

export type NutrientMappingReviewWorkspaceData = Awaited<
	ReturnType<typeof loadNutrientMappingReviewWorkspace>
>;
