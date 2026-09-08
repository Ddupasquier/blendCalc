import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };

describe("local authentication test environment", () => {
	it("isolates Cloudflare's public test widget from ordinary browser tests", () => {
		expect(packageJson.scripts["dev:test:auth"]).toContain(
			"PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA",
		);
		expect(packageJson.scripts["dev:test:auth"]).toContain(
			"BLENDCALC_DATABASE_ENVIRONMENT=test",
		);
		expect(packageJson.scripts["dev:test"]).not.toContain(
			"PUBLIC_TURNSTILE_SITE_KEY=",
		);
	});
});
