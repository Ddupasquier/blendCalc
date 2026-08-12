import { searchApprovedSharedProducts } from "$lib/server/products/catalog.server";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { annotateFoodsForUser } from "$lib/server/food-safety/userFoodSafety.server";

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireAppValue(
		await locals.getVerifiedUser(),
		401,
		"AUTH_REQUIRED",
	);

	const query = url.searchParams.get("q")?.trim() ?? "";
	if (query.length < 2) return json({ foods: [] });
	const foods = await searchApprovedSharedProducts(
		getSupabaseAdminClient(),
		query,
	);
	return json({
		foods: await annotateFoodsForUser(
			locals.supabase,
			user.id,
			foods,
		),
	});
};
