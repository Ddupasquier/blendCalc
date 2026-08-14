import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const foodImagePersistence = readFileSync(
	"src/lib/server/products/foodImages.server.ts",
	"utf8",
);

describe("food image persistence", () => {
	it("persists placement metadata with newly cached image assets", () => {
		const persistenceBody = foodImagePersistence.slice(
			foodImagePersistence.indexOf("export const persistFoodImageAsset"),
			foodImagePersistence.indexOf("export const publishModeratedFoodImageAsset"),
		);

		expect(persistenceBody).toContain("...normalizePlacement({");
		expect(persistenceBody).toContain('cropSource: image.cropSource ?? "auto"');
	});

	it("schedules OCR only for untouched trusted front images", () => {
		expect(foodImagePersistence).toContain(
			"isUntouchedAutomaticPlacementCandidate(image)",
		);
		expect(foodImagePersistence).toContain("completeServerBackgroundTask(");
		expect(foodImagePersistence).toContain(
			'.eq("placement_method", "default")',
		);
		expect(foodImagePersistence).toContain('.is("approved_by", null)');
	});
});
