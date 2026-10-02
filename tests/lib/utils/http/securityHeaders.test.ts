import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "$lib/utils/http/securityHeaders";

describe("security response headers", () => {
	it("prevents authenticated responses from being cached", () => {
		const response = new Response();
		applySecurityHeaders(response, new URL("https://example.com/mix"), true);

		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("strict-transport-security")).toContain(
			"max-age=31536000",
		);
		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("cross-origin-opener-policy")).toBe(
			"same-origin",
		);
		expect(response.headers.get("cross-origin-resource-policy")).toBe(
			"same-origin",
		);
		expect(response.headers.get("origin-agent-cluster")).toBe("?1");
	});

	it("allows first-party camera use while blocking unrelated sensitive capabilities", () => {
		const response = new Response();
		applySecurityHeaders(response, new URL("http://localhost:5173/"), false);

		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("permissions-policy")).toContain(
			"camera=(self)",
		);
		expect(response.headers.get("permissions-policy")).toContain(
			"microphone=()",
		);
		expect(response.headers.has("strict-transport-security")).toBe(false);
		expect(response.headers.has("x-robots-tag")).toBe(false);
	});

	it("does not cache authentication pages", () => {
		const response = new Response();
		applySecurityHeaders(response, new URL("https://example.com/auth"), false);

		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
	});

	it("noindexes private and missing responses without noindexing crawl controls", () => {
		const privateResponse = new Response();
		applySecurityHeaders(
			privateResponse,
			new URL("https://example.com/ingredients/fridge"),
			false,
		);
		expect(privateResponse.headers.get("x-robots-tag")).toBe(
			"noindex, nofollow",
		);

		const missingResponse = new Response(null, { status: 404 });
		applySecurityHeaders(
			missingResponse,
			new URL("https://example.com/missing"),
			false,
		);
		expect(missingResponse.headers.get("x-robots-tag")).toBe(
			"noindex, nofollow",
		);

		for (const path of ["/robots.txt", "/sitemap.xml"]) {
			const crawlControlResponse = new Response();
			applySecurityHeaders(
				crawlControlResponse,
				new URL(`https://example.com${path}`),
				false,
			);
			expect(crawlControlResponse.headers.has("x-robots-tag")).toBe(false);
		}
	});
});
