import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readFoodCategoryPickerData: vi.fn(),
}));

vi.mock("$lib/server/products/categoryPicker.server", () => ({
	readFoodCategoryPickerData: mocks.readFoodCategoryPickerData,
}));

import { GET } from "../../src/routes/api/food-categories/+server";

const pickerData = {
	suggestions: [],
	common: [],
	results: [],
};

const createEvent = (userId: string | null) => ({
	locals: {
		getVerifiedUser: vi.fn().mockResolvedValue(userId ? { id: userId } : null),
		supabase: { source: "test" },
	},
	url: new URL(
		"http://localhost:5173/api/food-categories?productName=Protein%20Bar&query=protein&sourceCategory=snacks",
	),
});

describe("food category picker route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readFoodCategoryPickerData.mockResolvedValue(pickerData);
	});

	it("requires a signed-in user", async () => {
		await expect(GET(createEvent(null) as never)).rejects.toMatchObject({
			status: 401,
		});
		expect(mocks.readFoodCategoryPickerData).not.toHaveBeenCalled();
	});

	it("loads ranked category data through the server", async () => {
		const event = createEvent("user-id");
		const response = await GET(event as never);
		if (!response) throw new Error("Expected a category picker response.");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(pickerData);
		expect(mocks.readFoodCategoryPickerData).toHaveBeenCalledWith(
			event.locals.supabase,
			{
				productName: "Protein Bar",
				query: "protein",
				sourceCategories: ["snacks"],
			},
		);
	});
});
