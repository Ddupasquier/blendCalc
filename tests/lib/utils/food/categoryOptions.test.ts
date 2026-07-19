import { describe, expect, it, vi } from "vitest";
import { readCustomFoodCategoryOptions } from "$lib/utils/food/nutrients/categoryOptions";

type PageResult = {
	data: unknown[] | null;
	error: { message: string } | null;
	count?: number | null;
};

const createSupabaseMock = (pageResults: PageResult[]) => {
	let pageIndex = 0;
	const query = {
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		range: vi.fn(() =>
			Promise.resolve(
				pageResults[pageIndex++] ?? { data: [], error: null, count: null },
			),
		),
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
				data: [
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
				],
				error: null,
				count: 2,
			},
		]);

		const options = await readCustomFoodCategoryOptions(client as never);

		expect(client.from).toHaveBeenCalledWith("custom_food_category_options");
		expect(query.order).toHaveBeenCalledWith("label", { ascending: true });
		expect(query.order).toHaveBeenCalledWith("id", { ascending: true });
		expect(query.range).toHaveBeenCalledWith(0, 999);
		expect(options?.map((option) => option.label)).toEqual([
			"Apple Products",
			"Z category",
		]);
	});

	it("loads every category page instead of stopping at Supabase's row limit", async () => {
		const firstPage = Array.from({ length: 1_000 }, (_, index) => ({
			id: `category-${index.toString().padStart(4, "0")}`,
			label: `Category ${index.toString().padStart(4, "0")}`,
			observation_count: 1,
			source_count: 1,
		}));
		const { client, query } = createSupabaseMock([
			{ data: firstPage, error: null, count: 1_002 },
			{
				data: [
					{
						id: "yogurts",
						label: "Yogurts",
						observation_count: 1,
						source_count: 1,
					},
					{
						id: "zucchini",
						label: "Zucchini",
						observation_count: 1,
						source_count: 1,
					},
				],
				error: null,
			},
		]);

		const options = await readCustomFoodCategoryOptions(client as never);

		expect(query.range).toHaveBeenNthCalledWith(1, 0, 999);
		expect(query.range).toHaveBeenNthCalledWith(2, 1_000, 1_999);
		expect(options).toHaveLength(1_002);
		expect(options?.slice(-2).map((option) => option.label)).toEqual([
			"Yogurts",
			"Zucchini",
		]);
	});

	it("rejects a partial category list when a later page fails", async () => {
		const firstPage = Array.from({ length: 1_000 }, (_, index) => ({
			id: `category-${index}`,
			label: `Category ${index}`,
			observation_count: 1,
			source_count: 1,
		}));
		const { client } = createSupabaseMock([
			{ data: firstPage, error: null, count: 1_001 },
			{ data: null, error: { message: "request failed" } },
		]);

		await expect(readCustomFoodCategoryOptions(client as never)).resolves.toBeNull();
	});
});
