import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { appIssueJson } from "$lib/server/errors/appError.server";
import {
	parseFoodCompatibilityFeedbackRequest,
	submitFoodCompatibilityFeedback,
} from "$lib/server/food-safety/foodCompatibilityFeedback.server";
import { readLimitedJson } from "$lib/server/security/requestBody.server";

const FEEDBACK_REQUEST_MAX_BYTES = 32 * 1024;

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");

	const input = parseFoodCompatibilityFeedbackRequest(
		await readLimitedJson(request, FEEDBACK_REQUEST_MAX_BYTES),
	);
	if (!input) return appIssueJson(400, "INVALID_REQUEST");

	try {
		const status = await submitFoodCompatibilityFeedback(user.id, input);
		return json({ status });
	} catch {
		return appIssueJson(503, "SERVICE_UNAVAILABLE");
	}
};
