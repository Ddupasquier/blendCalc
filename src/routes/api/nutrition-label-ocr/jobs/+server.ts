import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { appIssueJson } from "$lib/server/errors/appError.server";
import {
	createNutritionLabelOcrJob,
	failNutritionLabelOcrJobScheduling,
	NUTRITION_LABEL_OCR_SOURCE_MAX_BYTES,
} from "$lib/server/ocr/nutritionLabelOcrJobs.server";
import { scheduleNutritionLabelOcrJob } from "$lib/server/ocr/nutritionLabelOcrBackground.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";

const OCR_FORM_OVERHEAD_BYTES = 256 * 1024;

export const config = {
	runtime: "nodejs24.x",
	regions: ["pdx1"],
	maxDuration: 60,
	memory: 1024,
	split: true,
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");

	const formData = await readLimitedFormData(
		request,
		NUTRITION_LABEL_OCR_SOURCE_MAX_BYTES + OCR_FORM_OVERHEAD_BYTES,
	);
	const photo = formData.get("photo");
	if (!(photo instanceof File) || photo.size === 0) {
		return appIssueJson(400, "INVALID_REQUEST");
	}

	let created;
	try {
		created = await createNutritionLabelOcrJob({
			file: photo,
			userId: user.id,
		});
	} catch (error) {
		if (
			error instanceof Error &&
			(error.message === "invalid-source-size" ||
				error.message === "invalid-source-type")
		) {
			return appIssueJson(400, "INVALID_REQUEST");
		}
		return appIssueJson(503, "SERVICE_UNAVAILABLE");
	}

	if (created.shouldEnqueue) {
		try {
			await scheduleNutritionLabelOcrJob(created.job.id);
		} catch {
			await failNutritionLabelOcrJobScheduling(created.job.id);
			return appIssueJson(503, "SERVICE_UNAVAILABLE");
		}
	}

	return json(
		{ job: created.job },
		{ status: created.job.status === "completed" ? 200 : 202 },
	);
};
