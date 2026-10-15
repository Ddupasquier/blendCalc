import { json } from "@sveltejs/kit";
import { appIssueJson } from "$lib/server/errors/appError.server";
import { loadSavedRecipesPageData } from "$lib/server/user-data/savedRecipesPageData.server";
import { filterItemsByQuery } from "$lib/utils/list/listNavigation";
import {
	isFoodSafetyFilter,
	foodMatchesSafetyFilter,
} from "$lib/utils/food/safety/foodSafetyFilters";
import type { RequestHandler } from "./$types";

const privateJson = (data: unknown) =>
	json(data, { headers: { "cache-control": "private, no-store" } });

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");
	const query = url.searchParams.get("q") ?? "";
	const sort = url.searchParams.get("sort") ?? "newest";
	const safety = url.searchParams.get("safety") ?? "all";
	const favoritesOnly = url.searchParams.get("favorites") === "true";
	const limit = Number(url.searchParams.get("limit") ?? 15),
		offset = Number(url.searchParams.get("offset") ?? 0);
	if (
		query.length > 120 ||
		!["newest", "oldest", "name"].includes(sort) ||
		!isFoodSafetyFilter(safety) ||
		!Number.isInteger(limit) ||
		limit < 1 ||
		limit > 100 ||
		!Number.isInteger(offset) ||
		offset < 0
	)
		return appIssueJson(400, "INVALID_REQUEST");
	const page = await loadSavedRecipesPageData({
		supabase: locals.supabase,
		userId: user.id,
	});
	if (page.loadError) return appIssueJson(503, "SERVICE_UNAVAILABLE");
	const recipes = filterItemsByQuery(page.recipes, query, (recipe) =>
		[recipe.name, ...recipe.foods.map((food) => food.description)].join(" "),
	)
		.filter(
			(recipe) =>
				(!favoritesOnly || recipe.isFavorite) &&
				(safety === "all" ||
					recipe.foods.some((food) => foodMatchesSafetyFilter(food, safety))),
		)
		.sort(
			(a, b) =>
				(sort === "name"
					? a.name.localeCompare(b.name)
					: sort === "oldest"
						? a.createdAt - b.createdAt
						: b.createdAt - a.createdAt) || a.id.localeCompare(b.id),
		);
	return privateJson({
		recipes: recipes.slice(offset, offset + limit),
		totalCount: recipes.length,
	});
};
