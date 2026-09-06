import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { send } from "@vercel/queue";
import { processNutritionLabelOcrJob } from "$lib/server/ocr/nutritionLabelOcrJobs.server";
import {
	NUTRITION_LABEL_OCR_QUEUE_TOPIC,
	type NutritionLabelOcrQueueMessage,
} from "$lib/server/ocr/nutritionLabelOcrQueueContract";
import { NUTRITION_LABEL_OCR_JOB_RETENTION_SECONDS } from "$lib/utils/food/ocr/nutritionLabelOcrJobs";

const runLocalNutritionLabelOcrJob = (jobId: string) => {
	setTimeout(() => {
		void processNutritionLabelOcrJob(jobId).catch(() => {
			console.warn("[nutrition label OCR] Local background job failed", {
				phase: "recognition",
				reason: "local-background-job-failed",
			});
		});
	}, 0);
};

export const enqueueNutritionLabelOcrJob = async (jobId: string) => {
	if (dev && !env.VERCEL_OIDC_TOKEN) {
		runLocalNutritionLabelOcrJob(jobId);
		return;
	}

	await send<NutritionLabelOcrQueueMessage>(
		NUTRITION_LABEL_OCR_QUEUE_TOPIC,
		{ jobId },
		{
			idempotencyKey: jobId,
			region: "pdx1",
			retentionSeconds: NUTRITION_LABEL_OCR_JOB_RETENTION_SECONDS,
		},
	);
};
