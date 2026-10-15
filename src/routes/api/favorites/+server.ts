import { json } from "@sveltejs/kit";
import { appIssueJson } from "$lib/server/errors/appError.server";
import { readLimitedJson } from "$lib/server/security/requestBody.server";
import { readFavoriteFoodPage } from "$lib/server/user-data/favorites.server";
import {
	isFoodSafetyFilter,
	filterFoodsBySafety,
} from "$lib/utils/food/safety/foodSafetyFilters";
import type { RequestHandler } from "./$types";

const UUID_TARGET =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const privateJson = (data: unknown) =>
	json(data, { headers: { "cache-control": "private, no-store" } });

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!(await locals.getVerifiedUser()))
		return appIssueJson(401, "AUTH_REQUIRED");
	const body = (await readLimitedJson(request, 1024)) as {
		kind?: unknown;
		targetId?: unknown;
		favorite?: unknown;
	} | null;
	if (
		!body ||
		!["food", "recipe"].includes(String(body.kind)) ||
		typeof body.targetId !== "string" ||
		body.targetId.length > 80 ||
		!body.targetId.length ||
		typeof body.favorite !== "boolean" ||
		(body.kind === "food" &&
			(!Number.isSafeInteger(Number(body.targetId)) ||
				Number(body.targetId) === 0 ||
				String(Number(body.targetId)) !== body.targetId)) ||
		(body.kind === "recipe" && !UUID_TARGET.test(body.targetId))
	)
		return appIssueJson(400, "INVALID_REQUEST");
	const { data, error } = await locals.supabase.rpc("set_user_favorite", {
		p_kind: String(body.kind),
		p_target_id: body.targetId,
		p_favorite: body.favorite,
	});
	if (error) return appIssueJson(503, "SERVICE_UNAVAILABLE");
	return data === "saved"
		? privateJson({ favorite: body.favorite })
		: appIssueJson(404, "RESOURCE_NOT_FOUND");
};

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");
	const kind = url.searchParams.get("kind");
	const id = url.searchParams.get("id");
	try {
		if (id !== null) {
			if (
				kind === "food" &&
				Number.isSafeInteger(Number(id)) &&
				Number(id) !== 0 &&
				String(Number(id)) === id
			) {
				const { data, error } = await locals.supabase.rpc(
					"read_user_food_favorite_states",
					{ p_food_ids: [Number(id)] },
				);
				if (error) throw error;
				return privateJson({
					state: (data as Record<string, unknown>)[id] ?? null,
				});
			}
			if (kind === "recipe" && UUID_TARGET.test(id)) {
				const { data: recipe, error } = await locals.supabase
					.from("saved_drinks")
					.select("id")
					.eq("user_id", user.id)
					.eq("id", id)
					.maybeSingle();
				if (error) throw error;
				if (!recipe) return privateJson({ state: null });
				const { data, error: favoriteError } = await locals.supabase
					.from("user_saved_recipe_favorites")
					.select("recipe_id")
					.eq("user_id", user.id)
					.eq("recipe_id", id)
					.maybeSingle();
				if (favoriteError) throw favoriteError;
				return privateJson({ state: { favorite: Boolean(data) } });
			}
			return appIssueJson(400, "INVALID_REQUEST");
		}
		const query = url.searchParams.get("q") ?? "";
		const sort = url.searchParams.get("sort") ?? "recent";
		const safety = url.searchParams.get("safety") ?? "all";
		const limit = Number(url.searchParams.get("limit") ?? 15);
		const offset = Number(url.searchParams.get("offset") ?? 0);
		if (
			kind !== "food" ||
			!isFoodSafetyFilter(safety) ||
			query.length > 120 ||
			!["recent", "oldest", "name-asc", "name-desc"].includes(sort) ||
			!Number.isInteger(limit) ||
			limit < 1 ||
			limit > 100 ||
			!Number.isInteger(offset) ||
			offset < 0
		)
			return appIssueJson(400, "INVALID_REQUEST");
		const context = { supabase: locals.supabase, userId: user.id };
		if (safety === "all")
			return privateJson(
				await readFavoriteFoodPage(context, query, sort, limit, offset),
			);
		// Safety is evaluated from current server-owned evidence, before counting/paging.
		const deadline = Date.now() + 15_000;
		let scanned = 0,
			totalCount = 0;
		const foods = [];
		let availableCount = Number.POSITIVE_INFINITY;
		do {
			if (Date.now() >= deadline)
				throw new Error("Favorite safety read exceeded its budget");
			const page = await readFavoriteFoodPage(
				context,
				query,
				sort,
				25,
				scanned,
			);
			availableCount = page.totalCount;
			for (const food of filterFoodsBySafety(page.foods, safety)) {
				if (totalCount >= offset && foods.length < limit) foods.push(food);
				totalCount++;
			}
			scanned += page.foods.length;
			if (scanned >= page.totalCount || !page.foods.length) break;
		} while (scanned < availableCount);
		return privateJson({ foods, totalCount });
	} catch {
		return appIssueJson(503, "SERVICE_UNAVAILABLE");
	}
};
