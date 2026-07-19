import { readFoodCategoryPickerData } from "$lib/server/products/categoryPicker.server";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAX_QUERY_LENGTH = 120;
const MAX_SOURCE_CATEGORIES = 20;

const readSearchValue = (url: URL, key: string) =>
	(url.searchParams.get(key) ?? "").trim().slice(0, MAX_QUERY_LENGTH);

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) throw error(401, "Sign in to load food categories.");

	const sourceCategories = url.searchParams
		.getAll("sourceCategory")
		.map((category) => category.trim().slice(0, MAX_QUERY_LENGTH))
		.filter(Boolean)
		.slice(0, MAX_SOURCE_CATEGORIES);
	const data = await readFoodCategoryPickerData(locals.supabase, {
		productName: readSearchValue(url, "productName"),
		query: readSearchValue(url, "query"),
		sourceCategories,
	});

	return json(data, {
		headers: {
			"cache-control": "private, max-age=60",
		},
	});
};
