import { searchUsdaFoods } from "$lib/server/products/usdaCache.server";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to search foods.");

	const query = url.searchParams.get("q")?.trim() ?? "";
	if (query.length < 2) return json({ foods: [] });
	if (query.length > 120) throw error(400, "Search is too long.");

	try {
		return json({ foods: await searchUsdaFoods(query) });
	} catch {
		throw error(503, "Food search is temporarily unavailable.");
	}
};
