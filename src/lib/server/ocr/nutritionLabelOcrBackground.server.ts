import { dev } from "$app/environment";
import { processNutritionLabelOcrJob } from "$lib/server/ocr/nutritionLabelOcrJobs.server";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";

const processNutritionLabelOcrJobSafely = async (jobId: string) => {
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			await processNutritionLabelOcrJob(jobId);
			return;
		} catch {
			if (attempt < 3) continue;
			console.warn("[nutrition label OCR] Background job failed", {
				phase: "recognition",
				reason: "background-job-failed",
			});
		}
	}
};

export const scheduleNutritionLabelOcrJob = async (jobId: string) => {
	if (dev) {
		setTimeout(() => void processNutritionLabelOcrJobSafely(jobId), 0);
		return;
	}

	await completeServerBackgroundTask(processNutritionLabelOcrJobSafely(jobId));
};
