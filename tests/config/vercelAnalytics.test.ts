import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageMetadata = JSON.parse(readFileSync("package.json", "utf8")) as {
	dependencies?: Record<string, string>;
};
const appLayout = readFileSync(
	"src/lib/utils/analytics/vercelObservability.ts",
	"utf8",
);

describe("Vercel Web Analytics", () => {
	it("uses the supported SvelteKit integration in production", () => {
		expect(packageMetadata.dependencies?.["@vercel/analytics"]).toBeDefined();
		expect(appLayout).toContain('import("@vercel/analytics/sveltekit")');
		expect(appLayout).not.toMatch(/import\s+[^;]+from\s+["']@vercel\//);
		const rootLayout = readFileSync("src/routes/+layout.svelte", "utf8");
		expect(rootLayout).not.toContain("@vercel/");
		expect(rootLayout).toContain(
			"onMount(() => mountVercelObservability({ browser, dev }))",
		);
		expect(appLayout).toContain(
			"isApprovedObservabilityHostname(target.location.hostname)",
		);
		expect(appLayout).toContain(
			"dev || !isApprovedObservabilityHostname(target.location.hostname)",
		);
		expect(appLayout).toContain("injectAnalytics({");
		expect(appLayout).toContain('mode: "production"');
		const observability = readFileSync(
			"src/lib/utils/analytics/performanceObservability.ts",
			"utf8",
		);
		expect(observability).toContain('"www.blendcalc.food"');
		expect(observability).toContain('"blendcalc.vercel.app"');
	});

	it("redacts URL details and preserves Vercel resilient intake defaults", () => {
		expect(appLayout).toContain("beforeSend: redactObservabilityUrl");
		expect(appLayout).toContain('url.search = "";');
		expect(appLayout).toContain('url.hash = "";');
		expect(appLayout).not.toContain("scriptSrc:");
		expect(appLayout).not.toContain("eventEndpoint:");
		expect(appLayout).not.toContain("viewEndpoint:");
	});
});
