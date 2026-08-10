import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseMocks = vi.hoisted(() => ({
	rpc: vi.fn(),
}));
const normalizedData = vi.hoisted(() => ({
	readNormalizedNutrientsByParent: vi.fn().mockResolvedValue(new Map()),
	readFoodServingsByParent: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("$lib/supabase/client", () => ({
	getSupabaseBrowserClient: () => ({ rpc: supabaseMocks.rpc }),
}));
vi.mock(
	"$lib/utils/storage/supabase/normalizedNutrients",
	() => ({ readNormalizedNutrientsByParent: normalizedData.readNormalizedNutrientsByParent }),
);
vi.mock(
	"$lib/utils/storage/supabase/servings",
	() => ({ readFoodServingsByParent: normalizedData.readFoodServingsByParent }),
);

import {
	readCloudCustomFoodByBarcode,
	readCloudCustomFoodByNameKey,
	saveCloudCustomFood,
} from "$lib/utils/storage/supabase/customFoods";
import type { FoodItem } from "$lib/utils/food/types";

const food = {
	fdcId: -101,
	description: "Backend validated food",
	customFood: true,
	customServingWeightGrams: 100,
	categories: ["Fruit"],
	categoryOptionId: "fruit",
	foodNutrients: [],
} satisfies FoodItem;

const createReadClient = () => {
	const maybeSingle = vi.fn().mockResolvedValue({
		data: {
			id: "custom-1",
			food,
			source_key: "custom",
			trust_status: "user-private",
		},
		error: null,
	});
	const matchValue = vi.fn(() => ({ maybeSingle }));
	const matchUser = vi.fn(() => ({ eq: matchValue }));
	const select = vi.fn(() => ({ eq: matchUser }));
	const from = vi.fn(() => ({ select }));

	return {
		client: { from } as unknown as SupabaseClient<Database>,
		from,
		matchUser,
		matchValue,
	};
};

describe("custom-food Supabase storage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("saves through the authoritative database function", async () => {
		supabaseMocks.rpc.mockResolvedValue({ data: "saved", error: null });

		await expect(saveCloudCustomFood(food)).resolves.toBe("saved");
		expect(supabaseMocks.rpc).toHaveBeenCalledWith("save_custom_food", {
			p_fdc_id: food.fdcId,
			p_food: expect.objectContaining({
				categoryOptionId: "fruit",
				description: food.description,
			}),
		});
	});

	it.each(["duplicate-name", "duplicate-barcode"] as const)(
		"preserves the expected %s result",
		async (result) => {
			supabaseMocks.rpc.mockResolvedValue({ data: result, error: null });

			await expect(saveCloudCustomFood(food)).resolves.toBe(result);
		},
	);

	it.each([
		["barcode", "00012345678905", readCloudCustomFoodByBarcode],
		["name_key", "backend validated food", readCloudCustomFoodByNameKey],
	] as const)(
		"reads one custom food through the indexed %s column",
		async (column, value, readFood) => {
			const query = createReadClient();

			await expect(readFood(value, {
				supabase: query.client,
				userId: "user-1",
			})).resolves.toMatchObject({ description: food.description });

			expect(query.from).toHaveBeenCalledWith("custom_foods");
			expect(query.matchUser).toHaveBeenCalledWith("user_id", "user-1");
			expect(query.matchValue).toHaveBeenCalledWith(column, value);
		},
	);

});
