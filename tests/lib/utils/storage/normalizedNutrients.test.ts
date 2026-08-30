import type { Database } from "$lib/types/database.types";
import { readNormalizedNutrientsByParent } from "$lib/utils/storage/supabase/normalizedNutrients";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

const createSupabaseMock = (options?: {
	nutrientReadFails?: boolean;
	nativeMeasurementRows?: Record<string, unknown>[];
}) => {
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
										value_origin: "estimated",
										value_qualifier: "source-estimate",
										source: "usda",
										source_reference: "123",
										confidence: "source-verified",
										value_status: "estimated",
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
				if (table === "food_nutrient_measurements") {
					if (options?.nativeMeasurementRows) {
						return { data: options.nativeMeasurementRows, error: null };
					}
					return {
						data: null,
						error: { code: "42P01", message: "missing relation" },
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
				valueOrigin: "estimated",
				valueQualifier: "source-estimate",
				valueStatus: "estimated",
				standardError: 0.2,
				sourceNutrientCode: "203",
				mappingStatus: "canonical",
			}),
		]);
		expect(mock.from).toHaveBeenCalledWith("food_nutrients");
		expect(mock.from).toHaveBeenCalledTimes(2);
	});

	it("throws when normalized reads fail instead of authorizing JSON snapshots", async () => {
		await expect(
			readNormalizedNutrientsByParent(
				createSupabaseMock({
					nutrientReadFails: true,
				}) as unknown as SupabaseClient<Database>,
				"user_food_list_item_id",
				["list-1"],
			),
		).rejects.toMatchObject({ message: "missing relation" });
	});

	it("reads an exact source-defined serving without converting it to grams", async () => {
		const mock = createSupabaseMock({
			nativeMeasurementRows: [
				{
					user_food_list_item_id: "list-1",
					custom_food_id: null,
					shared_product_id: null,
					nutrient_id: 1008,
					amount: 140,
					unit_name: "KCAL",
					basis_kind: "serving",
					basis_quantity: 1,
					basis_unit_key: "serving",
					basis_serving_label: "2 cookies",
					value_origin: "reported",
					value_qualifier: null,
					source: "user-label",
					source_reference: "00000000000000",
					confidence: "user-reported",
					value_status: "reported",
					standard_error: null,
					source_nutrient_key: null,
					source_nutrient_code: null,
					mapping_status: "canonical",
					mapping_method: "manual-label",
					mapping_review_reference: null,
					derivation_method: null,
					nutrient_definitions: {
						nutrient_id: 1008,
						nutrient_name: "Energy",
						nutrient_number: "208",
						default_unit_name: "KCAL",
					},
				},
			],
		});
		const result = await readNormalizedNutrientsByParent(
			mock as unknown as SupabaseClient<Database>,
			"user_food_list_item_id",
			["list-1"],
		);

		expect(result.get("list-1")?.[0]).toMatchObject({
			nutrientId: 1008,
			value: 140,
			measurementBasis: {
				kind: "serving",
				quantity: 1,
				unitKey: "serving",
				servingLabel: "2 cookies",
			},
		});
		expect(mock.from).toHaveBeenCalledTimes(1);
	});
});
