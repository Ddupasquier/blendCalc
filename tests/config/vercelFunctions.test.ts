import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const vercelConfiguration = JSON.parse(readFileSync("vercel.json", "utf8")) as {
	functions?: Record<string, unknown>;
};

describe("Vercel functions", () => {
	it("keeps SvelteKit as the only owner of application API routing", () => {
		expect(vercelConfiguration.functions).toBeUndefined();
		expect(existsSync("api")).toBe(false);
	});
});
