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
const scriptDocumentation = readFileSync("scripts/README.md", "utf8");

describe("QA fixture database environment", () => {
	it("routes every documented QA fixture command through test mode", () => {
		for (const scriptPath of [
			"scripts/qa/catalog/seed_catalog_submission.mjs",
			"scripts/qa/catalog/seed_image_moderation_submission.mjs",
		]) {
			expect(scriptDocumentation).toContain(
				`node scripts/operations/environment/run_test_command.mjs -- node ${scriptPath}`,
			);
		}
		expect(packageMetadata.scripts).not.toHaveProperty("catalog:qa-seed");
		expect(packageMetadata.scripts).not.toHaveProperty("catalog:qa-image-seed");
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
