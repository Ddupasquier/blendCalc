import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";

const rpc = vi.fn();
const assertSharedProductFoodCanBePublished = vi.fn();

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: () => ({ rpc }),
}));

vi.mock("$lib/server/products/catalogFoodValidation.server", () => ({
	assertSharedProductFoodCanBePublished,
}));

const createFood = (): FoodItem => ({
	fdcId: 1,
	description: "Coherent product",
	barcode: "00012345678905",
	foodNutrients: [
		{
			nutrientId: 1008,
			nutrientName: "Energy",
			nutrientNumber: "208",
			unitName: "KCAL",
			value: 100,
		},
	],
});

describe("catalog publication", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		assertSharedProductFoodCanBePublished.mockResolvedValue({
			barcode: "00012345678905",
			issues: [],
			valid: true,
		});
		rpc.mockResolvedValue({ data: "shared-product-id", error: null });
	});

	it("validates the final canonical snapshot before calling the publication RPC", async () => {
		const { publishCatalogSubmission } =
			await import("$lib/server/products/catalogPublishing.server");
		const food = createFood();

		await publishCatalogSubmission({
			submissionId: "submission-id",
			food,
			productName: food.description,
			source: "usda",
			confidence: "source-verified",
			observations: [],
			provenance: [],
			conflicts: [],
		});

		expect(assertSharedProductFoodCanBePublished).toHaveBeenCalledOnce();
		expect(rpc).toHaveBeenCalledOnce();
	});

	it("does not call the publication RPC when canonical nutrition is invalid", async () => {
		const invalidNutritionError = new Error(
			"Added sugars cannot exceed total sugars.",
		);
		assertSharedProductFoodCanBePublished.mockRejectedValue(
			invalidNutritionError,
		);
		const { publishCatalogSubmission } =
			await import("$lib/server/products/catalogPublishing.server");

		await expect(
			publishCatalogSubmission({
				submissionId: "submission-id",
				food: createFood(),
				productName: "Invalid product",
				source: "usda",
				confidence: "source-verified",
				observations: [],
				provenance: [],
				conflicts: [],
			}),
		).rejects.toBe(invalidNutritionError);
		expect(rpc).not.toHaveBeenCalled();
	});
});
