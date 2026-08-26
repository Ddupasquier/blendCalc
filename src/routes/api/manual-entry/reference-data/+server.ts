import { appIssueJson } from "$lib/server/errors/appError.server";
import { getManualEntryReferenceData } from "$lib/server/reference/manualEntryReferenceData.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");

	try {
		return json(await getManualEntryReferenceData(), {
			headers: {
				"cache-control": "private, max-age=60",
			},
		});
	} catch (error) {
		console.error("[manual-entry] Reference data could not load", {
			error: error instanceof Error ? error.message : typeof error,
		});
		return appIssueJson(503, "SERVICE_UNAVAILABLE");
	}
};
