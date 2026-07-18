import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
	rpc: vi.fn(),
}));

vi.mock("$lib/supabase/client", () => ({
	getSupabaseBrowserClient: () => ({ rpc: supabaseMocks.rpc }),
}));

import {
	saveCloudCustomFood,
	writeCloudCustomFoods,
} from "$lib/utils/storage/supabase/customFoods";
import type { FdcFood } from "$lib/utils/food/types";

const food = {
	fdcId: -101,
	description: "Backend validated food",
	customFood: true,
	customServingWeightGrams: 100,
	categories: ["Fruit"],
	categoryOptionId: "fruit",
	foodNutrients: [],
} satisfies FdcFood;

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

	it("uses one database request for a bulk recovery write", async () => {
		supabaseMocks.rpc.mockResolvedValue({ data: true, error: null });

		await expect(writeCloudCustomFoods([food])).resolves.toBe(true);
		expect(supabaseMocks.rpc).toHaveBeenCalledOnce();
		expect(supabaseMocks.rpc).toHaveBeenCalledWith("save_custom_foods", {
			p_foods: [expect.objectContaining({ fdcId: food.fdcId })],
		});
	});
});
