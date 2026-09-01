import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	deleteProductEvidence: vi.fn(),
	submitProductForCatalog: vi.fn(),
}));

vi.mock("$lib/server/products/catalog.server", () => ({
	submitProductForCatalog: mocks.submitProductForCatalog,
}));

vi.mock("$lib/server/products/productEvidence.server", () => ({
	deleteProductEvidence: mocks.deleteProductEvidence,
}));

import { submitCatalogIntake } from "$lib/server/products/catalogIntake.server";

const food = {
	fdcId: -1,
	description: "Count-based cookie",
	barcode: "00000000119993",
	foodNutrients: [],
};
const evidencePaths = {
	front: "user/intake/front.webp",
	nutrition: "user/intake/nutrition.webp",
	barcode: "user/intake/barcode.webp",
};

describe("catalog intake", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.deleteProductEvidence.mockResolvedValue(undefined);
	});

	it("sends accepted app intake through the existing catalog pipeline", async () => {
		mocks.submitProductForCatalog.mockResolvedValue({
			status: "pending",
			message: "The product is waiting for review.",
			evidenceAccepted: true,
		});

		const result = await submitCatalogIntake({
			actorUserId: "user-id",
			food,
			evidencePaths,
			reviewFlags: ["Review current package label."],
			frontImageCrop: null,
			intent: "catalog_correction",
		});

		expect(result.status).toBe("pending");
		expect(mocks.submitProductForCatalog).toHaveBeenCalledWith(
			"user-id",
			food,
			evidencePaths,
			{
				reviewFlags: ["Review current package label."],
				frontImageCrop: null,
				intent: "catalog_correction",
			},
		);
		expect(mocks.deleteProductEvidence).not.toHaveBeenCalled();
	});

	it("removes unclaimed evidence when the existing pipeline declines intake", async () => {
		mocks.submitProductForCatalog.mockResolvedValue({
			status: "already-available",
			message: "This product is already available to everyone.",
			evidenceAccepted: false,
		});

		const result = await submitCatalogIntake({
			actorUserId: "user-id",
			food,
			evidencePaths,
		});

		expect(result.status).toBe("already-available");
		expect(mocks.deleteProductEvidence).toHaveBeenCalledWith(evidencePaths);
	});

	it("removes evidence and preserves pipeline failures", async () => {
		const pipelineError = new Error("Moderation intake is unavailable.");
		mocks.submitProductForCatalog.mockRejectedValue(pipelineError);

		await expect(
			submitCatalogIntake({
				actorUserId: "user-id",
				food,
				evidencePaths,
			}),
		).rejects.toBe(pipelineError);
		expect(mocks.deleteProductEvidence).toHaveBeenCalledWith(evidencePaths);
	});
});
