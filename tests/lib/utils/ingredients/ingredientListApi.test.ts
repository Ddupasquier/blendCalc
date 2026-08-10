import { describe, expect, it, vi } from "vitest";
import { LIST_PAGE_LIMITS } from "$lib/config/listPagination";
import type { IngredientListPage } from "$lib/utils/ingredients/ingredientListPage";
import { readIngredientListWindow } from "$lib/utils/ingredients/ingredientListApi";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const createFood = (fdcId: number) => ({
	fdcId,
	description: `Food ${fdcId}`,
	foodNutrients: [],
});

describe("readIngredientListWindow", () => {
	it("hydrates a preserved viewport through bounded API pages", async () => {
		const totalCount = 135;
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input), "http://localhost");
			const limit = Number(url.searchParams.get("limit"));
			const offset = Number(url.searchParams.get("offset"));
			const foods = Array.from(
				{ length: Math.min(limit, totalCount - offset) },
				(_, index) => createFood(offset + index + 1),
			);
			const payload = { foods, totalCount } satisfies IngredientListPage;

			return new Response(JSON.stringify(payload), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		const page = await readIngredientListWindow(
			MIX_STORAGE_KEYS.fridge,
			{
				limit: totalCount,
				offset: 0,
				query: "food",
				sort: "name-asc",
			},
			fetcher as typeof fetch,
		);

		expect(page.foods).toHaveLength(totalCount);
		expect(page.totalCount).toBe(totalCount);
		expect(fetcher).toHaveBeenCalledTimes(2);

		const requestedUrls = fetcher.mock.calls.map(([input]) =>
			new URL(String(input), "http://localhost"),
		);
		expect(requestedUrls[0].searchParams.get("limit")).toBe(
			String(LIST_PAGE_LIMITS.userFoodListRequest),
		);
		expect(requestedUrls[0].searchParams.get("offset")).toBe("0");
		expect(requestedUrls[1].searchParams.get("limit")).toBe("35");
		expect(requestedUrls[1].searchParams.get("offset")).toBe("100");
		expect(requestedUrls.every((url) => url.searchParams.get("q") === "food"))
			.toBe(true);
	});

	it("stops when the server reports the end of the matching list", async () => {
		const fetcher = vi.fn(async () => {
			const payload = {
				foods: [createFood(1), createFood(2)],
				totalCount: 2,
			} satisfies IngredientListPage;
			return new Response(JSON.stringify(payload), { status: 200 });
		});

		const page = await readIngredientListWindow(
			MIX_STORAGE_KEYS.shoppingList,
			{ limit: 50 },
			fetcher as typeof fetch,
		);

		expect(page.foods).toHaveLength(2);
		expect(fetcher).toHaveBeenCalledOnce();
	});
});
