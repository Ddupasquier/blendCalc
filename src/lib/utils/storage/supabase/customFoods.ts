import { compactFood } from "$lib/utils/food/records/foodRecords";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/nutrients/normalizedNutrients";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import type { FdcFood } from "$lib/utils/food/types";
import { hydrateFoodWithCatalogState } from "$lib/utils/ingredients/ingredientCatalogState";
import { normalizeFoodProductName } from "$lib/utils/products/productNameFormatting.js";
import type { Database } from "$lib/types/database.types";
import { readNormalizedNutrientsByParent } from "./normalizedNutrients";
import { readFoodServingsByParent } from "./servings";
import {
	type CloudDataContext,
	resolveCloudClient,
	resolveCloudDataContext,
	toJson,
} from "./shared";

export type CloudCustomFoodWriteResult =
	| "saved"
	| "duplicate-name"
	| "duplicate-barcode"
	| "error";

type CloudCustomFoodRow = Pick<
	Database["public"]["Tables"]["custom_foods"]["Row"],
	"id" | "food" | "source_key" | "trust_status"
>;

const hydrateCloudCustomFoods = async (
	rows: CloudCustomFoodRow[],
	context: CloudDataContext,
) => {
	const [normalizedRows, servingRows] = await Promise.all([
		readNormalizedNutrientsByParent(
			context.supabase,
			"custom_food_id",
			rows.map((row) => row.id),
		),
		readFoodServingsByParent(
			context.supabase,
			"custom_food_id",
			rows.map((row) => row.id),
		),
	]);

	return rows.map((row) => {
		const catalogFood = hydrateFoodWithCatalogState(
			normalizeFoodProductName(
				row.food as unknown as FdcFood,
			) as FdcFood,
			{
				shared_product_id:
					(row.food as unknown as FdcFood).sharedProductId ?? null,
				shared_product_submission_id:
					(row.food as unknown as FdcFood).sharedProductSubmissionId ?? null,
				source_key: row.source_key,
				trust_status: row.trust_status,
			},
		);
		const food = hydrateFoodWithNormalizedNutrients(
			catalogFood,
			normalizedRows.get(row.id) ?? [],
		);
		return hydrateFoodWithNormalizedServings(
			food,
			servingRows.get(row.id) ?? [],
		);
	});
};

export const readCloudCustomFoods = async (context?: CloudDataContext) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;

	const { data, error } = await cloud.supabase
		.from("custom_foods")
		.select("id, food, source_key, trust_status")
		.eq("user_id", cloud.userId)
		.order("created_at", { ascending: false });

	if (error) throw error;
	return hydrateCloudCustomFoods(data, cloud);
};

const readCloudCustomFoodByColumn = async (
	column: "barcode" | "fdc_id" | "name_key",
	value: number | string,
	context?: CloudDataContext,
) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;

	const { data, error } = await cloud.supabase
		.from("custom_foods")
		.select("id, food, source_key, trust_status")
		.eq("user_id", cloud.userId)
		.eq(column, value)
		.maybeSingle();

	if (error) throw error;
	if (!data) return null;
	const [food] = await hydrateCloudCustomFoods([data], cloud);
	return food ?? null;
};

export const readCloudCustomFoodByBarcode = (
	barcode: string,
	context?: CloudDataContext,
) => readCloudCustomFoodByColumn("barcode", barcode, context);

export const readCloudCustomFoodByNameKey = (
	nameKey: string,
	context?: CloudDataContext,
) => readCloudCustomFoodByColumn("name_key", nameKey, context);

export const readCloudCustomFoodByFdcId = (
	foodId: number,
	context?: CloudDataContext,
) => readCloudCustomFoodByColumn("fdc_id", foodId, context);

export const saveCloudCustomFood = async (
	food: FdcFood,
	context?: CloudDataContext,
): Promise<CloudCustomFoodWriteResult> => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return "error";

	const { data, error } = await supabase.rpc("save_custom_food", {
		p_fdc_id: food.fdcId,
		p_food: toJson(compactFood(food)),
	});

	if (error) return "error";
	return data === "saved" ||
		data === "duplicate-name" ||
		data === "duplicate-barcode"
		? data
		: "error";
};
