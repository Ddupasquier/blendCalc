import type { Database } from "$lib/types/database.types";
import { readFoodServingsByParent } from "$lib/utils/storage/supabase/servings";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

const createSupabaseMock = (fails = false) => ({
	from: vi.fn(() => ({
		select: vi.fn(() => ({
			in: vi.fn(async () => fails
				? { data: null, error: { message: "serving read failed" } }
				: {
					data: [{
						user_food_list_item_id: "list-1",
						custom_food_id: null,
						shared_product_id: null,
						serving_order: 0,
						label: "1 cup",
						gram_weight: 245,
						amount: 1,
						unit_key: "cup",
						is_primary: true,
						measure_type: "Household measure",
						is_household_measure: true,
						source_measure_key: "portion:1",
						origin: "source-household-measure",
						gram_weight_method: "source-reported",
						calculation_basis: null,
						source: "usda",
						source_reference: "123",
						confidence: "unknown",
					}],
					error: null,
				}),
		})),
	})),
});

describe("normalized serving Supabase reads", () => {
	it("groups serving rows by their food parent", async () => {
		const result = await readFoodServingsByParent(
			createSupabaseMock() as unknown as SupabaseClient<Database>,
			"user_food_list_item_id",
			["list-1"],
		);

		expect(result.get("list-1")).toEqual([
			expect.objectContaining({ label: "1 cup", gramWeight: 245 }),
		]);
	});

	it("throws when serving reads fail instead of authorizing JSON snapshots", async () => {
		await expect(readFoodServingsByParent(
			createSupabaseMock(true) as unknown as SupabaseClient<Database>,
			"user_food_list_item_id",
			["list-1"],
		)).rejects.toMatchObject({ message: "serving read failed" });
	});
});
