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
							value_status: "reported",
							standard_error: 0.2,
							source_nutrient_key: "1003",
							source_nutrient_code: "203",
							mapping_status: "canonical",
							mapping_method: "source-identifier",
							mapping_review_reference: "usda-fdc",
							derivation_method: null,
									nutrient_definitions: {
										nutrient_id: 1003,
										nutrient_name: "Protein",
										nutrient_number: "203",
										default_unit_name: "G",
									},
								},
							],
							error: null,
						};
				}

				return { data: [], error: null };
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
					valueStatus: "reported",
					standardError: 0.2,
					sourceNutrientCode: "203",
					mappingStatus: "canonical",
			}),
		]);
		expect(mock.from).toHaveBeenCalledWith("food_nutrients");
		expect(mock.from).toHaveBeenCalledTimes(1);
	});

	it("throws when normalized reads fail instead of authorizing JSON snapshots", async () => {
		await expect(readNormalizedNutrientsByParent(
			createSupabaseMock({ nutrientReadFails: true }) as unknown as SupabaseClient<Database>,
			"user_food_list_item_id",
			["list-1"],
		)).rejects.toMatchObject({ message: "missing relation" });
	});
});
