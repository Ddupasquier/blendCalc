import { searchApprovedSharedProducts } from "$lib/server/products/catalog.server";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to search shared products.");

	const query = url.searchParams.get("q")?.trim() ?? "";
	if (query.length < 2) return json({ foods: [] });
	return json({ foods: await searchApprovedSharedProducts(locals.supabase, query) });
};
