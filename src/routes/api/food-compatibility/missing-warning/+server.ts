import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { appIssueJson } from "$lib/server/errors/appError.server";
import {
	parseMissingFoodWarningFeedbackRequest,
	submitMissingFoodWarningFeedback,
} from "$lib/server/food-safety/foodCompatibilityFeedback.server";
import { FOOD_COMPATIBILITY_EVIDENCE_MAX_BYTES } from "$lib/server/food-safety/foodCompatibilityEvidence.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";

const MISSING_WARNING_REQUEST_MAX_BYTES =
	FOOD_COMPATIBILITY_EVIDENCE_MAX_BYTES + 64 * 1024;

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");

	const formData = await readLimitedFormData(
		request,
		MISSING_WARNING_REQUEST_MAX_BYTES,
	);
	const input = parseMissingFoodWarningFeedbackRequest(formData);
	if (!input) return appIssueJson(400, "INVALID_REQUEST");

	try {
		const status = await submitMissingFoodWarningFeedback(user.id, input);
		if (status === "invalid") return appIssueJson(400, "INVALID_REQUEST");
		return json({ status });
	} catch {
		return appIssueJson(503, "SERVICE_UNAVAILABLE");
	}
};
