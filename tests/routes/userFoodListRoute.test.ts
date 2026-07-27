import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	annotateFoodsWithFoodSafety: vi.fn(),
	getUserFoodSafetyContext: vi.fn(),
	readCloudSmoothieListPage: vi.fn(),
}));

vi.mock("$lib/server/food-safety/foodSafetyEvaluation.server", () => ({
	annotateFoodsWithFoodSafety: mocks.annotateFoodsWithFoodSafety,
}));
vi.mock("$lib/server/food-safety/userFoodSafety.server", () => ({
	getUserFoodSafetyContext: mocks.getUserFoodSafetyContext,
}));
vi.mock("$lib/server/user-data/foodLists.server", () => ({
	readCloudSmoothieListPage: mocks.readCloudSmoothieListPage,
}));

import { GET } from "../../src/routes/api/user-food-lists/[list]/+server";

const createEvent = (
	list = "fridge",
	userId: string | null = "user-id",
) => ({
	locals: {
		getVerifiedUser: vi.fn().mockResolvedValue(userId ? { id: userId } : null),
		supabase: { source: "test" },
	},
	params: { list },
	url: new URL(
		"http://localhost:5173/api/user-food-lists/fridge?limit=15&offset=0&sort=recent&source=all&trust=any",
	),
});

describe("user food list route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readCloudSmoothieListPage.mockResolvedValue({
			foods: [{ fdcId: 1, description: "Milk", foodNutrients: [] }],
			totalCount: 1,
		});
		mocks.getUserFoodSafetyContext.mockResolvedValue({
			profile: null,
			policy: {
				preferenceConflictRules: [],
				compatibilityMatchRules: [],
			},
		});
		mocks.annotateFoodsWithFoodSafety.mockReturnValue([{
			fdcId: 1,
			description: "Milk",
			foodNutrients: [],
			allergenDisclosure: { contains: ["Milk"], mayContain: [] },
			preferenceWarnings: [],
		}]);
	});

	it("requires a signed-in user", async () => {
		await expect(GET(createEvent("fridge", null) as never)).rejects.toMatchObject({
			status: 401,
		});
	});

	it("rejects unknown list routes", async () => {
		await expect(GET(createEvent("pantry") as never)).rejects.toMatchObject({
			status: 404,
		});
	});

	it("returns only server-annotated list foods", async () => {
		const event = createEvent();
		const response = await GET(event as never);
		if (!response) throw new Error("Expected a food list response.");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			foods: [{
				fdcId: 1,
				description: "Milk",
				foodNutrients: [],
				allergenDisclosure: { contains: ["Milk"], mayContain: [] },
				preferenceWarnings: [],
			}],
			totalCount: 1,
		});
		expect(mocks.readCloudSmoothieListPage).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				limit: 15,
				offset: 0,
				sort: "recent",
			}),
			{
				supabase: event.locals.supabase,
				userId: "user-id",
			},
		);
		expect(mocks.annotateFoodsWithFoodSafety).toHaveBeenCalledTimes(1);
	});
});
