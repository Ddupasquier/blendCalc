import type { Database } from "$lib/types/database.types";
import {
	readSelectedCatalogFieldProvenance,
	toFoodFieldProvenance,
	type CatalogFieldSource,
} from "$lib/server/products/catalogFieldProvenance.server";
import { readActiveProductSafetyAlertsByProduct } from "$lib/server/products/productSafetyAlerts.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/nutrients/normalizedNutrients";
import type { FoodCompatibilitySummary } from "$lib/utils/food/quality/compatibility";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import type { FoodItem } from "$lib/utils/food/types";
import { hydrateFoodWithCatalogState } from "$lib/utils/ingredients/ingredientCatalogState";
import {
	formatSourceProductName,
	normalizeFoodProductName,
} from "$lib/utils/products/productNameFormatting.js";
import { hydrateFoodsWithCachedImages } from "$lib/utils/storage/supabase/foodImages";
import { readNormalizedNutrientsByParent } from "$lib/utils/storage/supabase/normalizedNutrients";
import { readFoodServingsByParent } from "$lib/utils/storage/supabase/servings";
import type { SupabaseClient } from "@supabase/supabase-js";

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

const hydrateFoodWithSharedProductMetadata = (
	food: FoodItem,
	row: SharedProductCompatibilityRow | undefined,
	fieldProvenance: Record<string, CatalogFieldSource>,
	safetyAlerts: FoodItem["safetyAlerts"],
) => {
	if (!row) return food;
	const canonicalFood = row.food as unknown as FoodItem;
	const canonicalSummary =
		row.compatibility_summary as unknown as FoodCompatibilitySummary;

	return {
		...food,
		canonicalDescription: formatSourceProductName(
			canonicalFood.canonicalDescription ?? canonicalFood.description,
		),
		foodIdentityType: canonicalFood.foodIdentityType,
		brandOwner: canonicalFood.brandOwner ?? food.brandOwner,
		foodCategory: canonicalFood.foodCategory ?? food.foodCategory,
		brandedFoodCategory:
			canonicalFood.brandedFoodCategory ?? food.brandedFoodCategory,
		categories: canonicalFood.categories ?? food.categories,
		categoryOptionId:
			canonicalFood.categoryOptionId ?? food.categoryOptionId,
		scientificName: canonicalFood.scientificName,
		alternateDescription: canonicalFood.alternateDescription,
		preparation: canonicalFood.preparation,
		gtinUpc: canonicalFood.gtinUpc ?? food.gtinUpc,
		barcode: canonicalFood.barcode ?? food.barcode,
		barcodeProvenance:
			canonicalFood.barcodeProvenance ?? food.barcodeProvenance,
		ingredients: canonicalFood.ingredients?.trim() || undefined,
		ingredientList: canonicalFood.ingredientList,
		structuredIngredients: canonicalFood.structuredIngredients,
		ingredientAnalysis: canonicalFood.ingredientAnalysis,
		additives: canonicalFood.additives,
		allergens: canonicalFood.allergens,
		traces: canonicalFood.traces,
		dietaryTags: canonicalFood.dietaryTags,
		labels: canonicalFood.labels,
		packageQuantity: canonicalFood.packageQuantity,
		sourceMetadata: canonicalFood.sourceMetadata,
		sourceIdentifiers:
			canonicalFood.sourceIdentifiers ?? food.sourceIdentifiers,
		sourceLabel: canonicalFood.sourceLabel ?? food.sourceLabel,
		sourceDataType: canonicalFood.sourceDataType ?? food.sourceDataType,
		sourcePublishedDate:
			canonicalFood.sourcePublishedDate ?? food.sourcePublishedDate,
		sourceModifiedDate:
			canonicalFood.sourceModifiedDate ?? food.sourceModifiedDate,
		sourceAttribution:
			canonicalFood.sourceAttribution ?? food.sourceAttribution,
		sourceAttributions:
			canonicalFood.sourceAttributions ?? food.sourceAttributions,
		publishedDate: canonicalFood.publishedDate ?? food.publishedDate,
		publicationDate:
			canonicalFood.publicationDate ?? food.publicationDate,
		modifiedDate: canonicalFood.modifiedDate ?? food.modifiedDate,
		availableDate: canonicalFood.availableDate ?? food.availableDate,
		discontinuedDate:
			canonicalFood.discontinuedDate ?? food.discontinuedDate,
		fieldProvenance: toFoodFieldProvenance(fieldProvenance),
		compatibilitySummary: canonicalSummary,
		safetyAlerts,
	};
};

export const hydrateCloudFoodListRows = async (
	supabase: SupabaseClient<Database>,
	rows: CloudFoodListHydrationRow[],
	catalogSupabase?: SupabaseClient<Database>,
) => {
	const sharedProductIds = [
		...new Set(rows.map((row) => row.shared_product_id).filter(Boolean)),
	] as string[];
	const catalogReadClient = sharedProductIds.length > 0
		? catalogSupabase ?? getSupabaseAdminClient()
		: null;
	const baseFoods = rows.map((row) =>
		hydrateFoodWithCatalogState(
			normalizeFoodProductName({
				...(row.food as unknown as FoodItem),
				listAddedAt:
					(row.food as unknown as FoodItem).listAddedAt ??
					new Date(row.created_at).getTime(),
			}) as FoodItem,
			row,
		),
	);
	const [
		normalizedRows,
		servingRows,
		foodsWithImages,
		sharedProductCompatibilityRows,
		sharedProductFieldProvenanceRows,
		safetyAlertsByProduct,
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
		catalogReadClient
			? readSelectedCatalogFieldProvenance(
				catalogReadClient,
				sharedProductIds,
			)
			: Promise.resolve(new Map<string, Record<string, CatalogFieldSource>>()),
		catalogReadClient
			? readActiveProductSafetyAlertsByProduct(sharedProductIds, catalogReadClient)
			: Promise.resolve(new Map()),
	]);

	return foodsWithImages.map((food, index) => {
		const row = rows[index];
		const foodWithMetadata = hydrateFoodWithSharedProductMetadata(
			food,
			row.shared_product_id
				? sharedProductCompatibilityRows.get(row.shared_product_id)
				: undefined,
			row.shared_product_id
				? sharedProductFieldProvenanceRows.get(row.shared_product_id) ?? {}
				: {},
			row.shared_product_id
				? safetyAlertsByProduct.get(row.shared_product_id) ?? []
				: [],
		);
		const foodWithNutrients = hydrateFoodWithNormalizedNutrients(
			foodWithMetadata,
			normalizedRows.get(row.id) ?? [],
		);
		return hydrateFoodWithNormalizedServings(
			foodWithNutrients,
			servingRows.get(row.id) ?? [],
		);
	});
};
