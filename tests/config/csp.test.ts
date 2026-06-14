import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("content security policy", () => {
	it("allows requests to the FoodData Central API", () => {
		const configSource = readFileSync("svelte.config.js", "utf8");

		expect(configSource).toContain("'https://api.nal.usda.gov'");
	});
});
