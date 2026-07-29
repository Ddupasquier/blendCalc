import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	annotateFoodsWithFoodSafety: vi.fn(),
	enrichFoodForListPlacement: vi.fn(),
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
vi.mock("$lib/server/user-data/foodListPlacement.server", () => ({
	enrichFoodForListPlacement: mocks.enrichFoodForListPlacement,
}));

import {
	GET,
	POST,
} from "../../src/routes/api/user-food-lists/[list]/+server";

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

const createPostEvent = (
	body: unknown,
	list = "fridge",
	userId: string | null = "user-id",
) => {
	const rpc = vi.fn().mockResolvedValue({ data: "added", error: null });
	return {
		locals: {
			getVerifiedUser: vi.fn().mockResolvedValue(
				userId ? { id: userId } : null,
			),
			supabase: { rpc },
		},
		params: { list },
		request: new Request(
			`http://localhost:5173/api/user-food-lists/${list}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			},
		),
		rpc,
	};
};

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
				version: 1,
				reviewedAt: "2026-07-29T00:00:00.000Z",
				preferenceConflictRules: [],
				compatibilityMatchRules: [],
				regionalProfiles: [],
			},
		});
		mocks.annotateFoodsWithFoodSafety.mockReturnValue([{
			fdcId: 1,
			description: "Milk",
			foodNutrients: [],
			allergenDisclosure: { contains: ["Milk"], mayContain: [] },
			preferenceWarnings: [],
		}]);
		mocks.enrichFoodForListPlacement.mockImplementation(
			async (_supabase, food) => food,
		);
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

	it("requires authentication for list placement", async () => {
		const response = await POST(
			createPostEvent({
				food: { fdcId: 1, description: "Milk", foodNutrients: [] },
			}, "fridge", null) as never,
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
	});

	it("enriches and places one food through the authoritative RPC", async () => {
		const food = { fdcId: 1, description: "Milk", foodNutrients: [] };
		const enrichedFood = {
			...food,
			ingredients: "Milk",
		};
		mocks.enrichFoodForListPlacement.mockResolvedValue(enrichedFood);
		const event = createPostEvent({ food, allowMove: true });

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ result: "added" });
		expect(mocks.enrichFoodForListPlacement).toHaveBeenCalledWith(
			event.locals.supabase,
			food,
		);
		expect(event.rpc).toHaveBeenCalledWith(
			"place_user_food_list_item",
			expect.objectContaining({
				p_allow_move: true,
				p_food: enrichedFood,
				p_list_type: "fridge",
			}),
		);
	});

	it("enriches a bounded batch before atomic placement", async () => {
		const foods = [
			{ fdcId: 1, description: "Milk", foodNutrients: [] },
			{ fdcId: 2, description: "Bread", foodNutrients: [] },
		];
		const event = createPostEvent({ foods }, "shopping-list");

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(mocks.enrichFoodForListPlacement).toHaveBeenCalledTimes(2);
		expect(event.rpc).toHaveBeenCalledWith(
			"place_user_food_list_items",
			expect.objectContaining({
				p_foods: foods,
				p_list_type: "shopping",
			}),
		);
	});
});
