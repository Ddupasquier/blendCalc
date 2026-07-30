import { env } from "$env/dynamic/private";
import type { AppInteractionMetric } from "$lib/utils/analytics/appInteractionMetrics";
import { track } from "@vercel/analytics/server";

export const trackServerAppInteraction = async (
	metric: AppInteractionMetric,
	request: Request,
) => {
	if (env.VERCEL_ENV !== "production") return;

	try {
		await track(metric, undefined, { request });
	} catch (error) {
		console.warn("[analytics] Unable to record interaction metric", {
			metric,
			errorType: error instanceof Error ? error.name : typeof error,
		});
	}
};
