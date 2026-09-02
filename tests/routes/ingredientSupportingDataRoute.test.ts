import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readIngredientPageSupportingData: vi.fn(),
}));

vi.mock("$lib/server/user-data/ingredientPageSupportingData.server", () => ({
	readIngredientPageSupportingData: mocks.readIngredientPageSupportingData,
}));

import { GET } from "../../src/routes/api/ingredients/supporting-data/+server";

const createEvent = (signedIn: boolean) => ({
	locals: {
		getVerifiedUser: vi
			.fn()
			.mockResolvedValue(signedIn ? { id: "ingredient-user" } : null),
		supabase: { name: "authenticated-client" },
	},
});

describe("ingredient supporting data route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readIngredientPageSupportingData.mockResolvedValue({
			customFoods: [],
			listIndex: {},
			provenanceOptions: [],
		});
	});

	it("requires a verified signed-in user", async () => {
		const response = await GET(createEvent(false) as never);

		expect(response?.status).toBe(401);
		expect(await response?.json()).toMatchObject({ code: "AUTH_REQUIRED" });
		expect(mocks.readIngredientPageSupportingData).not.toHaveBeenCalled();
	});

	it("returns private safety-annotated supporting data", async () => {
		const response = await GET(createEvent(true) as never);

		expect(response?.status).toBe(200);
		expect(response?.headers.get("cache-control")).toBe("private, no-store");
		expect(mocks.readIngredientPageSupportingData).toHaveBeenCalledWith({
			supabase: { name: "authenticated-client" },
			userId: "ingredient-user",
		});
	});

	it("returns one safe failure when supporting data is unavailable", async () => {
		mocks.readIngredientPageSupportingData.mockRejectedValue(
			new Error("database details stay server-side"),
		);

		const response = await GET(createEvent(true) as never);

		expect(response?.status).toBe(503);
		expect(await response?.json()).toMatchObject({
			code: "SERVICE_UNAVAILABLE",
		});
	});
});
