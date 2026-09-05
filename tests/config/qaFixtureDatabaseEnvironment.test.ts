import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageMetadata = JSON.parse(readFileSync("package.json", "utf8")) as {
	scripts: Record<string, string>;
};
const environmentHelper = readFileSync(
	"scripts/lib/qa/qa_database_environment.mjs",
	"utf8",
);
const imageModerationSeed = readFileSync(
	"scripts/qa/catalog/seed_image_moderation_submission.mjs",
	"utf8",
);

describe("QA fixture database environment", () => {
	it("routes every public QA fixture command to test mode", () => {
		for (const command of [
			"catalog:qa-seed",
			"catalog:qa-clean",
			"catalog:qa-image-seed",
			"catalog:qa-image-clean",
		]) {
			expect(packageMetadata.scripts[command]).toContain(
				"BLENDCALC_DATABASE_ENVIRONMENT=test",
			);
		}
	});

	it("loads the generated test environment and rejects non-local targets", () => {
		expect(environmentHelper).toContain('config({ path: ".env.test.local"');
		expect(environmentHelper).toContain(
			"Refusing to run a disposable QA fixture command",
		);
		expect(environmentHelper).toContain('hostname === "127.0.0.1"');
		expect(environmentHelper).toContain('hostname === "localhost"');
	});

	it("gives image-review fixtures a canonical category that moderation can approve", () => {
		expect(imageModerationSeed).toContain('foodCategory: "Protein Bars"');
		expect(imageModerationSeed).toContain('categories: ["Protein Bars"]');
		expect(imageModerationSeed).not.toContain(
			'foodCategory: "Verified Packaged Food"',
		);
	});
});
