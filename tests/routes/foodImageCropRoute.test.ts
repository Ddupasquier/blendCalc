import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getUserAppRole: vi.fn(),
	updateFoodImageAssetPlacement: vi.fn(),
}));

vi.mock("$lib/utils/moderation/moderation", () => ({
	getUserAppRole: mocks.getUserAppRole,
}));

vi.mock("$lib/server/products/foodImages.server", () => ({
	updateFoodImageAssetPlacement: mocks.updateFoodImageAssetPlacement,
}));

import { PATCH } from "../../src/routes/api/food-images/crop/+server";

const requestBody = {
	source: "open-food-facts",
	sourceReference: "00000000000000",
	role: "front",
	fitMode: "custom",
	cropX: 25,
	cropY: 75,
	cropZoom: 2,
	placementMethod: "smart-ocr",
	suggestionVersion: "tesseract-product-label-v1",
	suggestionConfidence: 84,
};

const savedImage = {
	source: "open-food-facts",
	sourceReference: "00000000000000",
	role: "front",
	imageUrl: "https://example.com/product.jpg",
	licenseName: "Example license",
	confidence: "source-verified",
	cropX: 50,
	cropY: 75,
	cropZoom: 2,
	fitMode: "custom",
	placementVersion: 2,
	placementMethod: "smart-ocr",
	suggestionVersion: "tesseract-product-label-v1",
	suggestionConfidence: 84,
};

const createEvent = (userId: string | null) => ({
	locals: {
		getVerifiedUser: vi.fn().mockResolvedValue(
			userId ? { id: userId } : null,
		),
		supabase: {},
	},
	request: new Request("http://localhost:5173/api/food-images/crop", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(requestBody),
	}),
});

describe("food image crop route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("saves valid moderator placement through the server", async () => {
		mocks.getUserAppRole.mockResolvedValue("moderator");
		mocks.updateFoodImageAssetPlacement.mockResolvedValue(savedImage);

		const response = await PATCH(createEvent("moderator-id") as never);
		if (!response) throw new Error("Expected an image placement response.");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ image: savedImage });
		expect(mocks.updateFoodImageAssetPlacement).toHaveBeenCalledWith({
			source: "open-food-facts",
			sourceReference: "00000000000000",
			role: "front",
			moderatorId: "moderator-id",
			crop: {
				cropX: 50,
				cropY: 75,
				cropZoom: 2,
				fitMode: "custom",
				placementVersion: 2,
				placementMethod: "smart-ocr",
				suggestionVersion: "tesseract-product-label-v1",
				suggestionConfidence: 84,
			},
		});
	});

	it("blocks placement changes without a signed-in user", async () => {
		await expect(PATCH(createEvent(null) as never)).rejects.toMatchObject({
			status: 401,
		});
		expect(mocks.updateFoodImageAssetPlacement).not.toHaveBeenCalled();
	});
});
