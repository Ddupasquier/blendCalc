import { env } from "$env/dynamic/private";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { syncVercelInteractionMetrics } from "$lib/server/analytics/vercelInteractionMetrics.server";

export const GET: RequestHandler = async ({ request }) => {
	const cronSecret = env.CRON_SECRET;
	if (
		!cronSecret ||
		request.headers.get("authorization") !== `Bearer ${cronSecret}`
	) {
		throw error(401, "Unauthorized");
	}

	try {
		const result = await syncVercelInteractionMetrics();
		return json({ synchronized: true, ...result });
	} catch (syncError) {
		console.error("[analytics] Vercel metric synchronization failed", {
			errorType:
				syncError instanceof Error ? syncError.name : typeof syncError,
		});
		throw error(503, "Analytics synchronization is temporarily unavailable.");
	}
};
