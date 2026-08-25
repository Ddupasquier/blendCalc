import { beforeEach, describe, expect, it, vi } from "vitest";

const readNutritionCompletenessCatalog = vi.fn();
const readProductRegulatoryDisclosureProfiles = vi.fn();

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: () => ({ source: "admin" }),
}));
vi.mock("$lib/server/nutrition/nutrientDefinitionCatalog.server", () => ({
	getNutrientDefinitionCatalog: async () => [],
}));
vi.mock("$lib/utils/food/quality/nutritionCompletenessData", () => ({
	readNutritionCompletenessCatalog,
}));
vi.mock("$lib/utils/food/quality/productRegulatoryDisclosureProfiles", () => ({
	readProductRegulatoryDisclosureProfiles,
}));

describe("nutrition completeness catalog rollout", () => {
	beforeEach(() => {
		vi.resetModules();
		readNutritionCompletenessCatalog.mockReset();
		readProductRegulatoryDisclosureProfiles.mockReset();
	});

	it("keeps the app available without inventing completeness scores before migration", async () => {
		readNutritionCompletenessCatalog.mockRejectedValue({
			code: "PGRST204",
			message:
				"Could not find the 'assessment_policy_key' column of 'nutrition_completeness_profiles' in the schema cache",
		});
		readProductRegulatoryDisclosureProfiles.mockResolvedValue([
			{ key: "existing-disclosure-profile" },
		]);
		const { getNutritionCompletenessCatalog } =
			await import("$lib/server/nutrition/nutritionCompletenessCatalog.server");

		await expect(getNutritionCompletenessCatalog()).resolves.toEqual({
			profiles: [],
			regulatoryDisclosureProfiles: [{ key: "existing-disclosure-profile" }],
		});
	});

	it("does not hide permission failures as rollout compatibility", async () => {
		const permissionError = {
			code: "42501",
			message: "permission denied for nutrition_completeness_profiles",
		};
		readNutritionCompletenessCatalog.mockRejectedValue(permissionError);
		const { getNutritionCompletenessCatalog } =
			await import("$lib/server/nutrition/nutritionCompletenessCatalog.server");

		await expect(getNutritionCompletenessCatalog()).rejects.toBe(
			permissionError,
		);
		expect(readProductRegulatoryDisclosureProfiles).not.toHaveBeenCalled();
	});
});
