import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };

describe("local authentication test environment", () => {
	it("isolates Cloudflare's public test widget from ordinary browser tests", () => {
		expect(packageJson.scripts["dev:test:auth"]).toContain(
			"run_application_environment.mjs test --auth",
		);
		const launcher = readFileSync(
			"scripts/operations/environment/run_application_environment.mjs",
			"utf8",
		);
		expect(launcher).toContain("1x00000000000000000000AA");
		expect(packageJson.scripts["dev:test"]).not.toContain("--auth");
	});
});
