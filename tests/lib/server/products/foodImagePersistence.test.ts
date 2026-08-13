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
});
