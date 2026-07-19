import { describe, expect, it, vi } from "vitest";
import { loadFoodCategoryPickerData } from "$lib/utils/food/categories/categoryPicker";

const validOption = {
	id: "protein-bars",
	label: "Protein Bars",
	observationCount: 12,
	sourceCount: 3,
	verificationStatus: "multi_source_verified",
};

describe("food category picker client", () => {
	it("builds a relative request and keeps only complete server options", async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			suggestions: [validOption, { id: "invalid", label: "Invalid" }],
			common: [],
			results: [],
		}), { status: 200 }));

		const result = await loadFoodCategoryPickerData({
			productName: "Chocolate Dough Protein Bar",
			sourceCategories: ["Snacks"],
		}, fetcher);

		expect(fetcher).toHaveBeenCalledWith(
			"/api/food-categories?productName=Chocolate+Dough+Protein+Bar&sourceCategory=Snacks",
			expect.objectContaining({ signal: undefined }),
		);
		expect(result.suggestions).toEqual([validOption]);
	});

	it("returns a useful error when the endpoint fails", async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));

		await expect(loadFoodCategoryPickerData({}, fetcher)).rejects.toThrow(
			"Food categories could not be loaded.",
		);
	});
});
