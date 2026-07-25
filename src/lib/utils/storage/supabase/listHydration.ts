import type { Database } from "$lib/types/database.types";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/nutrients/normalizedNutrients";
import { hydrateFoodWithCatalogState } from "$lib/utils/ingredients/ingredientCatalogState";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import type { FdcFood } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFoodProductName } from "$lib/utils/products/productNameFormatting.js";
import { hydrateFoodsWithCachedImages } from "./foodImages";
import { readNormalizedNutrientsByParent } from "./normalizedNutrients";
import { readFoodServingsByParent } from "./servings";
import type { FoodCompatibilitySummary } from "$lib/utils/food/quality/compatibility";

export type CloudFoodListHydrationRow = Pick<
	Database["public"]["Tables"]["user_food_list_items"]["Row"],
	| "id"
	| "food"
	| "created_at"
	| "shared_product_id"
	| "shared_product_submission_id"
	| "source_key"
	| "trust_status"
>;

type SharedProductCompatibilityRow = Pick<
	Database["public"]["Tables"]["shared_products"]["Row"],
	"id" | "food" | "compatibility_summary"
>;

const readSharedProductCompatibilityRows = async (
	supabase: SupabaseClient<Database>,
	rows: CloudFoodListHydrationRow[],
) => {
	const sharedProductIds = [
		...new Set(rows.map((row) => row.shared_product_id).filter(Boolean)),
	] as string[];
	if (sharedProductIds.length === 0) {
		return new Map<string, SharedProductCompatibilityRow>();
	}

	const { data, error } = await supabase
		.from("shared_products")
		.select("id, food, compatibility_summary")
		.in("id", sharedProductIds);
	if (error) throw error;
	return new Map((data ?? []).map((row) => [row.id, row]));
};

const preferCanonicalValues = (
	canonical: string[] | undefined,
	snapshot: string[] | undefined,
) => canonical?.length ? canonical : snapshot;

const hasCompatibilityFacts = (
	summary: FoodCompatibilitySummary | undefined,
) => Boolean(summary?.allFacts?.length);

const hydrateFoodWithSharedProductCompatibility = (
	food: FdcFood,
	row: SharedProductCompatibilityRow | undefined,
) => {
	if (!row) return food;
	const canonicalFood = row.food as unknown as FdcFood;
	const canonicalSummary =
		row.compatibility_summary as unknown as FoodCompatibilitySummary;
	return {
		...food,
		ingredients: canonicalFood.ingredients?.trim() || food.ingredients,
		ingredientList: preferCanonicalValues(
			canonicalFood.ingredientList,
			food.ingredientList,
		),
		allergens: preferCanonicalValues(canonicalFood.allergens, food.allergens),
		traces: preferCanonicalValues(canonicalFood.traces, food.traces),
		dietaryTags: preferCanonicalValues(
			canonicalFood.dietaryTags,
			food.dietaryTags,
		),
		labels: preferCanonicalValues(canonicalFood.labels, food.labels),
		compatibilitySummary: hasCompatibilityFacts(canonicalSummary)
			? canonicalSummary
			: food.compatibilitySummary,
	};
};

export const hydrateCloudFoodListRows = async (
	supabase: SupabaseClient<Database>,
	rows: CloudFoodListHydrationRow[],
) => {
	const baseFoods = rows.map((row) =>
		hydrateFoodWithCatalogState(
			normalizeFoodProductName({
				...(row.food as unknown as FdcFood),
				listAddedAt:
					(row.food as unknown as FdcFood).listAddedAt ??
					new Date(row.created_at).getTime(),
			}) as FdcFood,
			row,
		),
	);
	const [
		normalizedRows,
		servingRows,
		foodsWithImages,
		sharedProductCompatibilityRows,
	] = await Promise.all([
		readNormalizedNutrientsByParent(
			supabase,
			"user_food_list_item_id",
			rows.map((row) => row.id),
		),
		readFoodServingsByParent(
			supabase,
			"user_food_list_item_id",
			rows.map((row) => row.id),
		),
		hydrateFoodsWithCachedImages(supabase, baseFoods),
		readSharedProductCompatibilityRows(supabase, rows),
	]);

	return foodsWithImages.map((food, index) => {
		const row = rows[index];
		const foodWithCompatibility = hydrateFoodWithSharedProductCompatibility(
			food,
			row.shared_product_id
				? sharedProductCompatibilityRows.get(row.shared_product_id)
				: undefined,
		);
		const foodWithNutrients = hydrateFoodWithNormalizedNutrients(
			foodWithCompatibility,
			normalizedRows.get(row.id) ?? [],
		);
		return hydrateFoodWithNormalizedServings(
			foodWithNutrients,
			servingRows.get(row.id) ?? [],
		);
	});
};
