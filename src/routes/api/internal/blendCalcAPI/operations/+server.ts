import { env } from "$env/dynamic/private";
import { readBlendCalcAPIOperationsDashboard } from "$lib/server/blendCalcAPI/operations/blendCalcAPIOperations.server";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
		throw error(401, "Unauthorized");
	}
	try {
		return json(await readBlendCalcAPIOperationsDashboard(), {
			headers: { "cache-control": "private, no-store" },
		});
	} catch (dashboardError) {
		console.error("[blendCalcAPI] operations dashboard unavailable", {
			errorType:
				dashboardError instanceof Error
					? dashboardError.name
					: typeof dashboardError,
		});
		throw error(503, "Operations dashboard is temporarily unavailable.");
	}
};
