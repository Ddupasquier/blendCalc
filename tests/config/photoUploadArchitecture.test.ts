import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("photo upload architecture", () => {
	it("keeps every image file input inside the shared photo uploader", () => {
		const uploader = read(
			"src/lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte",
		);
		const consumers = [
			"src/lib/components/ingredients/manual-entry/NutritionLabelOcrInput/NutritionLabelOcrInput.svelte",
			"src/lib/components/ingredients/manual-entry/ProductImageEvidenceInput/ProductImageEvidenceInput.svelte",
			"src/lib/components/ingredients/manual-entry/steps/ShareStep/ShareStep.svelte",
			"src/lib/components/profile/ProfileImageSettings/ProfileImageSettings.svelte",
		];

		expect(uploader).toContain('type="file"');
		expect(uploader).toContain("photoCount");
		expect(uploader).toContain("description");
		for (const path of consumers) {
			const source = read(path);
			expect(source, path).toContain("PhotoUploadInput");
			expect(source, path).not.toContain('type="file"');
		}
	});
});
