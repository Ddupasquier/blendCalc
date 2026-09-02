import { appIssueJson } from "$lib/server/errors/appError.server";
import { readIngredientPageSupportingData } from "$lib/server/user-data/ingredientPageSupportingData.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");

	try {
		return json(
			await readIngredientPageSupportingData({
				supabase: locals.supabase,
				userId: user.id,
			}),
			{
				headers: { "cache-control": "private, no-store" },
			},
		);
	} catch (error) {
		console.error("[ingredients] Supporting data could not load", {
			error: error instanceof Error ? error.message : typeof error,
		});
		return appIssueJson(503, "SERVICE_UNAVAILABLE");
	}
};
