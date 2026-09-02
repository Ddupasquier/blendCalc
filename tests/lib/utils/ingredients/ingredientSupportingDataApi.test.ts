import { describe, expect, it, vi } from "vitest";
import { readIngredientPageSupportingData } from "$lib/utils/ingredients/ingredientSupportingDataApi";

describe("readIngredientPageSupportingData", () => {
	it("reads the authenticated supporting-data boundary", async () => {
		const data = {
			customFoods: [],
			listIndex: {},
			provenanceOptions: [],
		};
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(data), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await expect(readIngredientPageSupportingData(fetcher)).resolves.toEqual(
			data,
		);
		expect(fetcher).toHaveBeenCalledWith("/api/ingredients/supporting-data", {
			headers: { accept: "application/json" },
		});
	});

	it("rejects a failed supporting-data response", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 503 }));

		await expect(readIngredientPageSupportingData(fetcher)).rejects.toThrow(
			"Ingredient supporting data could not be loaded",
		);
	});
});
