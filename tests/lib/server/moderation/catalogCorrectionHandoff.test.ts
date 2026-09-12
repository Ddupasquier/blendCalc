import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSupabaseAdminClient: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import { readCatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";

const createQuery = (result: { data: unknown; error: unknown }) => {
	const query: Record<string, unknown> = {};
	for (const method of ["select", "eq", "in", "order", "limit"]) {
		query[method] = vi.fn(() => query);
	}
	query.maybeSingle = vi.fn(async () => result);
	query.then = (
		resolve: (value: typeof result) => unknown,
		reject: (reason: unknown) => unknown,
	) => Promise.resolve(result).then(resolve, reject);
	return query;
};

describe("catalog correction handoff", () => {
	beforeEach(() => vi.clearAllMocks());

	it("identifies the nutrient, basis, stored value, and every competing source", async () => {
		const results = new Map<string, Array<{ data: unknown; error: null }>>([
			[
				"shared_products",
				[
					{
						data: {
							food: { fdcId: 373595, foodNutrients: [] },
							product_name: "Chocolate Dough Protein Bar",
							brand_owner: "Barebells",
							source: "usda",
							source_reference: "373595",
							canonical_provenance: {},
							last_verified_at: "2026-08-01T00:00:00Z",
						},
						error: null,
					},
				],
			],
			[
				"catalog_actionable_product_conflicts",
				[
					{
						data: [
							{
								id: "conflict-id",
								field_path: "nutrient:1093",
								observed_values: [
									{
										source: "usda",
										sourceReference: "373595",
										value: 59,
										unitName: "MG",
										basis: "per 100 g",
									},
									{
										source: "open-food-facts",
										sourceReference: "00000000772914",
										value: 40,
										unitName: "MG",
										basis: "per 100 g",
									},
								],
							},
						],
						error: null,
					},
				],
			],
			["catalog_provider_change_reviews", [{ data: [], error: null }]],
			[
				"catalog_correction_origins",
				[
					{
						data: [
							{
								id: "origin-id",
								origin_type: "catalog_conflict",
								provider_change_review_id: null,
								shared_product_conflict_id: "conflict-id",
								food_compatibility_feedback_id: null,
								affected_field_paths: ["nutrient:1093"],
								status: "waiting_for_correction",
								submission_id: null,
							},
						],
						error: null,
					},
				],
			],
			["shared_product_submissions", [{ data: null, error: null }]],
			[
				"nutrient_definitions",
				[
					{
						data: [
							{
								nutrient_id: 1093,
								nutrient_name: "Sodium, Na",
								default_unit_name: "MG",
							},
						],
						error: null,
					},
				],
			],
			[
				"food_nutrients",
				[
					{
						data: [
							{
								nutrient_id: 1093,
								amount_per_100g: 59,
								unit_name: "MG",
								source: "usda",
								source_reference: "373595",
							},
						],
						error: null,
					},
				],
			],
			[
				"product_data_sources",
				[
					{
						data: [
							{
								key: "usda",
								display_name: "USDA FoodData Central",
								source_type: "government_dataset",
								homepage_url: "https://fdc.nal.usda.gov/",
								api_redistribution_allowed: true,
							},
							{
								key: "open-food-facts",
								display_name: "Open Food Facts",
								source_type: "community_database",
								homepage_url: "https://world.openfoodfacts.org/",
								api_redistribution_allowed: true,
							},
						],
						error: null,
					},
				],
			],
		]);
		const from = vi.fn((table: string) => {
			const result = results.get(table)?.shift();
			if (!result) throw new Error(`Unexpected query for ${table}`);
			return createQuery(result);
		});
		mocks.getSupabaseAdminClient.mockReturnValue({ from });

		const handoff = await readCatalogCorrectionHandoff("product-id");

		expect(handoff.findings).toEqual([
			expect.objectContaining({
				fieldLabel: "Sodium, Na",
				comparisonBasis: "per 100 g",
				currentValue: expect.objectContaining({
					source: "USDA FoodData Central · record 373595",
					value: "59 mg · per 100 g",
					amountPer100g: 59,
					unit: "mg",
				}),
				evidence: [
					expect.objectContaining({
						source: "USDA FoodData Central · record 373595",
						value: "59 mg · per 100 g",
						amountPer100g: 59,
					}),
					expect.objectContaining({
						source: "Open Food Facts · record 00000000772914",
						value: "40 mg · per 100 g",
						amountPer100g: 40,
					}),
				],
			}),
		]);
		expect(handoff.decisionWorkbenchAvailable).toBe(true);
	});

	it("falls back to the existing conflict table while the decision workbench migration is rolling out", async () => {
		const results = new Map<string, Array<{ data: unknown; error: unknown }>>([
			[
				"catalog_actionable_product_conflicts",
				[
					{
						data: null,
						error: {
							code: "PGRST205",
							message:
								"Could not find the table catalog_actionable_product_conflicts",
						},
					},
				],
			],
			["shared_product_conflicts", [{ data: [], error: null }]],
			[
				"shared_products",
				[
					{
						data: {
							food: {},
							product_name: "Test product",
							brand_owner: null,
							source: "user-label",
							source_reference: null,
							canonical_provenance: {},
							last_verified_at: null,
						},
						error: null,
					},
				],
			],
			["catalog_provider_change_reviews", [{ data: [], error: null }]],
			["catalog_correction_origins", [{ data: [], error: null }]],
			["shared_product_submissions", [{ data: null, error: null }]],
			[
				"product_data_sources",
				[
					{
						data: [
							{
								key: "user-label",
								display_name: "User label",
								source_type: "user_submitted",
								homepage_url: null,
								api_redistribution_allowed: false,
							},
						],
						error: null,
					},
				],
			],
		]);
		const from = vi.fn((table: string) => {
			const result = results.get(table)?.shift();
			if (!result) throw new Error(`Unexpected query for ${table}`);
			return createQuery(result);
		});
		mocks.getSupabaseAdminClient.mockReturnValue({ from });

		const handoff = await readCatalogCorrectionHandoff("product-id");

		expect(handoff.decisionWorkbenchAvailable).toBe(false);
		expect(from).toHaveBeenCalledWith("shared_product_conflicts");
	});
});
