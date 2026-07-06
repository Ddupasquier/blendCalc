import { describe, expect, it, vi } from "vitest";
import { readCustomFoodCategoryOptions } from "$lib/utils/food/nutrients/categoryOptions";

const createSupabaseMock = (data: unknown[]) => {
	const query = {
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockResolvedValue({ data, error: null }),
	};

	return {
		query,
		client: {
			from: vi.fn(() => query),
		},
	};
};

describe("custom food category options", () => {
	it("returns manual-entry category options alphabetically by label", async () => {
		const { client, query } = createSupabaseMock([
			{
				id: "z-category",
				label: "Z category",
				observation_count: 20,
				source_count: 2,
			},
			{
				id: "apple-products",
				label: "Apple Products",
				observation_count: 1,
				source_count: 1,
			},
		]);

		const options = await readCustomFoodCategoryOptions(client as never);

		expect(client.from).toHaveBeenCalledWith("custom_food_category_options");
		expect(query.order).toHaveBeenCalledWith("label", { ascending: true });
		expect(options?.map((option) => option.label)).toEqual([
			"Apple Products",
			"Z category",
		]);
	});
});
