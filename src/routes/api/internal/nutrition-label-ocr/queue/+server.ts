import { handleCallback } from "@vercel/queue";
import { processNutritionLabelOcrJob } from "$lib/server/ocr/nutritionLabelOcrJobs.server";
import type { NutritionLabelOcrQueueMessage } from "$lib/server/ocr/nutritionLabelOcrQueue.server";

export const config = {
	runtime: "nodejs24.x",
	regions: ["pdx1"],
	maxDuration: 60,
	memory: 1024,
	split: true,
};

export const POST = handleCallback<NutritionLabelOcrQueueMessage>(
	async (message) => {
		if (
			!message ||
			typeof message.jobId !== "string" ||
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
				message.jobId,
			)
		) {
			return;
		}
		await processNutritionLabelOcrJob(message.jobId);
	},
	{
		// The function can run for 60 seconds. Keep the message hidden long enough
		// for that invocation to end before a later delivery reclaims its lease.
		visibilityTimeoutSeconds: 90,
		retry: (_error, metadata) =>
			metadata.deliveryCount >= 3
				? { acknowledge: true }
				: { afterSeconds: 2 ** metadata.deliveryCount * 5 },
	},
);
