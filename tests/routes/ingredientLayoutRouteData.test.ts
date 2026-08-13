import { describe, expect, it, vi } from "vitest";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const ingredientPageData = vi.hoisted(() => ({
	loadIngredientPageData: vi.fn().mockResolvedValue({ routeFood: null }),
}));

vi.mock("$lib/server/user-data/ingredientPageData.server", () => ingredientPageData);

import { load } from "../../src/routes/ingredients/+layout.server";

describe("ingredient layout route data", () => {
	it("passes normalized negative food IDs to the server page-data loader", async () => {
		await load({
			locals: {
				getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-1" }),
				supabase: { role: "authenticated" },
			},
			params: { foodId: "-123" },
			url: new URL("http://localhost:5173/ingredients/fridge/nutrition/-123"),
		} as never);

		expect(ingredientPageData.loadIngredientPageData).toHaveBeenCalledWith(
			{
				supabase: { role: "authenticated" },
				userId: "user-1",
			},
			{
				routeFoodId: -123,
				routeListKey: MIX_STORAGE_KEYS.fridge,
			},
		);
	});
});
