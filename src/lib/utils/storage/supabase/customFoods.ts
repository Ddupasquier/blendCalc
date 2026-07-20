import { compactFood } from "$lib/utils/food/records/foodRecords";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/nutrients/normalizedNutrients";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import type { FdcFood } from "$lib/utils/food/types";
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

export const readCloudCustomFoods = async (context?: CloudDataContext) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

	const { data, error } = await supabase
		.from("custom_foods")
		.select("id, food")
		.eq("user_id", userId)
		.order("created_at", { ascending: false });

	if (error) throw error;
	const [normalizedRows, servingRows] = await Promise.all([
		readNormalizedNutrientsByParent(
			supabase,
			"custom_food_id",
			data.map((row) => row.id),
		),
		readFoodServingsByParent(
			supabase,
			"custom_food_id",
			data.map((row) => row.id),
		),
	]);
	return data.map((row) => {
		const food = hydrateFoodWithNormalizedNutrients(
			row.food as unknown as FdcFood,
			normalizedRows.get(row.id) ?? [],
		);
		return hydrateFoodWithNormalizedServings(
			food,
			servingRows.get(row.id) ?? [],
		);
	});
};

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
