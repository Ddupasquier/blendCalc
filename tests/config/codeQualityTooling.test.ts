import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readText = (filePath: string) => readFileSync(filePath, "utf8");
const packageConfiguration = JSON.parse(readText("package.json"));

describe("code quality tooling", () => {
	it("runs code and style linting through one blocking command", () => {
		expect(packageConfiguration.scripts.lint).toBe(
			"npm run lint:code && npm run lint:styles",
		);
		expect(packageConfiguration.scripts["lint:code"]).toContain("eslint .");
		expect(packageConfiguration.scripts["lint:styles"]).toContain("stylelint");
	});

	it("checks new files without concealing the full formatting audit", () => {
		expect(packageConfiguration.scripts["format:check"]).toContain(
			"check_new_file_formatting.mjs",
		);
		expect(packageConfiguration.scripts["format:check:all"]).toBe(
			"prettier --check .",
		);
	});

	it("keeps generated output outside maintained lint ownership", () => {
		const eslintConfiguration = readText("eslint.config.js");
		const stylelintConfiguration = readText("stylelint.config.js");

		expect(eslintConfiguration).toContain('".vercel/**"');
		expect(eslintConfiguration).toContain('"supabase/.temp/**"');
		expect(stylelintConfiguration).toContain('".vercel/**"');
		expect(stylelintConfiguration).toContain('"supabase/.temp/**"');
	});

	it("enforces lint and new-file formatting in source verification", () => {
		const workflow = readText(".github/workflows/verify.yml");

		expect(workflow).toContain("run: npm run lint");
		expect(workflow).toContain("run: npm run format:check");
		expect(workflow).toContain("FORMAT_BASE_REF:");
	});
});
