import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageMetadata = JSON.parse(readFileSync("package.json", "utf8")) as {
	dependencies?: Record<string, string>;
};
const appLayout = readFileSync("src/routes/+layout.svelte", "utf8");

describe("Vercel Speed Insights", () => {
	it("uses the supported SvelteKit integration in production", () => {
		expect(
			packageMetadata.dependencies?.["@vercel/speed-insights"],
		).toBeDefined();
		expect(appLayout).toContain(
			'import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";',
		);
		expect(appLayout).toContain(
			"isApprovedObservabilityHostname(window.location.hostname)",
		);
		expect(appLayout).toContain("if (!dev && isVercelObservabilityAvailable)");
		expect(appLayout).toContain("injectSpeedInsights({");
	});

	it("redacts URL details and preserves Vercel resilient intake defaults", () => {
		expect(appLayout).toContain('url.search = "";');
		expect(appLayout).toContain('url.hash = "";');
		expect(appLayout).not.toContain("scriptSrc:");
		expect(appLayout).not.toContain("endpoint:");
	});
});
