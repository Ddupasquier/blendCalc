import { env } from "$env/dynamic/private";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { cleanupExpiredNutritionLabelOcrJobs } from "$lib/server/ocr/nutritionLabelOcrJobs.server";

export const GET: RequestHandler = async ({ request }) => {
	const cronSecret = env.CRON_SECRET;
	if (
		!cronSecret ||
		request.headers.get("authorization") !== `Bearer ${cronSecret}`
	) {
		throw error(401, "Unauthorized");
	}

	try {
		return json(await cleanupExpiredNutritionLabelOcrJobs());
	} catch (cleanupError) {
		console.error("[nutrition label OCR] Expiry cleanup failed", {
			errorType:
				cleanupError instanceof Error ? cleanupError.name : typeof cleanupError,
		});
		throw error(503, "OCR cleanup is temporarily unavailable.");
	}
};
