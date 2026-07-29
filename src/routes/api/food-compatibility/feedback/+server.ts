import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { appIssueJson } from "$lib/server/errors/appError.server";
import {
	parseFoodCompatibilityFeedbackRequest,
	submitFoodCompatibilityFeedback,
} from "$lib/server/food-safety/foodCompatibilityFeedback.server";

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");

	const input = parseFoodCompatibilityFeedbackRequest(
		await request.json().catch(() => null),
	);
	if (!input) return appIssueJson(400, "INVALID_REQUEST");

	try {
		const status = await submitFoodCompatibilityFeedback(user.id, input);
		return json({ status });
	} catch {
		return appIssueJson(503, "SERVICE_UNAVAILABLE");
	}
};
