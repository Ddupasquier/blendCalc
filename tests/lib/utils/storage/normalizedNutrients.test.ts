import type { Database } from "$lib/types/database.types";
import { readNormalizedNutrientsByParent } from "$lib/utils/storage/supabase/normalizedNutrients";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

const createSupabaseMock = (options?: { nutrientReadFails?: boolean }) => {
	const from = vi.fn((table: string) => ({
		select: vi.fn(() => ({
			in: vi.fn(async () => {
				if (table === "food_nutrients") {
					return options?.nutrientReadFails
						? { data: null, error: { message: "missing relation" } }
						: {
							data: [
								{
									user_food_list_item_id: "list-1",
									custom_food_id: null,
									shared_product_id: null,
									nutrient_id: 1003,
									amount_per_100g: 8,
									unit_name: "G",
									value_origin: "reported",
									source: "usda",
									source_reference: "123",
									confidence: "source-verified",
								},
							],
							error: null,
						};
				}

				return {
					data: [
						{
							nutrient_id: 1003,
							nutrient_name: "Protein",
							nutrient_number: "203",
							default_unit_name: "G",
						},
					],
					error: null,
				};
			}),
		})),
	}));

	return { from };
};

describe("normalized nutrient Supabase reads", () => {
	it("groups nutrient rows by their food parent", async () => {
		const mock = createSupabaseMock();
		const result = await readNormalizedNutrientsByParent(
			mock as unknown as SupabaseClient<Database>,
			"user_food_list_item_id",
			["list-1"],
		);

		expect(result?.get("list-1")).toEqual([
			expect.objectContaining({
				nutrientId: 1003,
				nutrientName: "Protein",
				value: 8,
			}),
		]);
		expect(mock.from).toHaveBeenCalledWith("food_nutrients");
		expect(mock.from).toHaveBeenCalledWith("nutrient_definitions");
	});

	it("returns null so callers can use JSON when normalized reads fail", async () => {
		const result = await readNormalizedNutrientsByParent(
			createSupabaseMock({ nutrientReadFails: true }) as unknown as SupabaseClient<Database>,
			"user_food_list_item_id",
			["list-1"],
		);

		expect(result).toBeNull();
	});
});
